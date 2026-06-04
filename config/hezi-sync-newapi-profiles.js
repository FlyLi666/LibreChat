/**
 * HeZi: sync NewAPI shadow-user labels from LibreChat users.
 *
 * Usage:
 *   npm run hezi-sync-newapi-profiles
 *   npm run hezi-sync-newapi-profiles -- --apply
 *   npm run hezi-sync-newapi-profiles -- --user=codex-test@flyli.cn --apply
 */
const path = require('path');
const mongoose = require('mongoose');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });

const connect = require('./connect');
const {
  findShadowUserByUsername,
  updateShadowUserProfile,
} = require('~/server/services/hezi/NewapiClient');
const {
  buildShadowProfile,
  getShadowUsername,
  PLUGIN_KEY,
} = require('~/server/services/hezi/HeziProvisioning');

function getArg(name, fallback = '') {
  const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function sameText(left, right) {
  return String(left || '').trim() === String(right || '').trim();
}

function buildUserFilter(userArg) {
  if (!userArg) {
    return {};
  }
  if (/^[a-f0-9]{24}$/i.test(userArg)) {
    return { _id: new mongoose.Types.ObjectId(userArg) };
  }
  return {
    $or: [{ email: userArg }, { username: userArg }, { name: userArg }],
  };
}

async function hasShadowAuth(db, userId) {
  return !!(await db.collection('pluginauths').findOne({
    userId: String(userId),
    pluginKey: PLUGIN_KEY,
    authField: 'sk_token',
  }));
}

(async () => {
  const apply = hasFlag('apply');
  const userArg = getArg('user');
  const limit = Number(getArg('limit', '0'));

  await connect();
  const db = mongoose.connection.db;
  const query = buildUserFilter(userArg);
  let cursor = db.collection('users').find(query).sort({ createdAt: 1 });
  if (Number.isFinite(limit) && limit > 0) {
    cursor = cursor.limit(limit);
  }
  const users = await cursor.toArray();

  const results = {
    mode: apply ? 'apply' : 'dry-run',
    scanned: users.length,
    matched: 0,
    changed: 0,
    updated: 0,
    skipped: 0,
    missingShadow: 0,
  };

  for (const user of users) {
    const userId = String(user._id);
    const shadowUsername = getShadowUsername(userId);
    const hasAuth = await hasShadowAuth(db, userId);
    if (!hasAuth) {
      results.skipped += 1;
      continue;
    }

    const shadow = await findShadowUserByUsername(shadowUsername);
    if (!shadow?.id) {
      results.missingShadow += 1;
      console.log(`[missing] ${user.email || userId} -> ${shadowUsername}`);
      continue;
    }

    results.matched += 1;
    const profile = buildShadowProfile(user, shadowUsername);
    const needsUpdate =
      !sameText(shadow.display_name, profile.displayName) ||
      !sameText(shadow.remark, profile.remark);

    if (!needsUpdate) {
      console.log(`[ok] ${shadowUsername} display="${shadow.display_name || ''}"`);
      continue;
    }

    results.changed += 1;
    console.log(
      `[change] #${shadow.id} ${shadowUsername} display "${shadow.display_name || ''}" -> "${
        profile.displayName
      }" remark="${profile.remark}"`,
    );

    if (apply) {
      await updateShadowUserProfile({
        id: shadow.id,
        username: shadow.username,
        group: shadow.group || 'default',
        status: shadow.status,
        role: shadow.role,
        displayName: profile.displayName,
        remark: profile.remark,
      });
      results.updated += 1;
    }
  }

  console.log(`[hezi-sync-newapi-profiles] ${JSON.stringify(results, null, 2)}`);
  await mongoose.disconnect();
  process.exit(0);
})().catch(async (err) => {
  console.error('[hezi-sync-newapi-profiles] fatal', err);
  try {
    await mongoose.disconnect();
  } catch {
    // Process is already failing; keep the original fatal error visible.
  }
  process.exit(1);
});
