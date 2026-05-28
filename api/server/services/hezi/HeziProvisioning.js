/**
 * HeZi shadow-account provisioning.
 *
 * Called once after a new LibreChat user is created. Performs the chain:
 *   1. Generate a NewAPI-safe shadow password
 *   2. Create a NewAPI user named hezi_<userId>
 *   3. Find the new user's NewAPI id
 *   4. Login as that shadow user → cookie
 *   5. Create an sk-xxx user-scoped token
 *   6. Optionally redeem the inviteCode-bound quotaCode (best-effort)
 *   7. Encrypt password + token + numeric id with encryptV3
 *      → store as PluginAuth rows under pluginKey 'newapi-shadow'
 *   8. Store the token as the user's "HeZi newAPI" custom endpoint key
 *      so chat calls use the shadow account, not the global gateway key.
 *
 * Failure semantics:
 *   - Steps 1-5 are atomic-ish: if any fails, throw → caller rolls back the LibreChat user.
 *   - Step 6 (redeem) is best-effort: log + continue.
 *   - Step 7 must succeed: persistence is required, otherwise we can't recover later.
 */

const { encryptV3, logger } = require('@librechat/data-schemas');
const {
  NewapiError,
  generateShadowPassword,
  createShadowUser,
  findShadowUserByUsername,
  loginAsUser,
  createUserToken,
  redeemQuotaCode,
} = require('./NewapiClient');
const {
  updatePluginAuth,
  updateUserKey,
  deleteUserKey,
  deletePluginAuth,
  findOnePluginAuth,
} = require('~/models');

const PLUGIN_KEY = 'newapi-shadow';
const HEZI_ENDPOINT_NAME = 'HeZi newAPI';

async function storeShadow(userId, fields) {
  for (const [authField, value] of Object.entries(fields)) {
    if (value == null) continue;
    await updatePluginAuth({
      userId: String(userId),
      pluginKey: PLUGIN_KEY,
      authField,
      value: encryptV3(String(value)),
    });
  }
}

function getNewapiV1BaseUrl() {
  const base = (process.env.HEZI_NEWAPI_BASE_URL || 'https://newapi.flyli.cn').replace(/\/+$/, '');
  return base.endsWith('/v1') ? base : `${base}/v1`;
}

async function storeEndpointKey(userId, sk) {
  await updateUserKey({
    userId: String(userId),
    name: HEZI_ENDPOINT_NAME,
    value: JSON.stringify({
      apiKey: sk,
      baseURL: getNewapiV1BaseUrl(),
    }),
    expiresAt: null,
  });
}

/**
 * Provision a HeZi shadow account for a freshly-created LibreChat user.
 *
 * @param {object} args
 * @param {object} args.user        LibreChat user document (must have _id and email)
 * @param {string} [args.quotaCode] Optional NewAPI redemption code from invite
 * @returns {Promise<{ newapiUserId: number, sk: string, redeemed: boolean }>}
 */
async function provisionShadowAccount({ user, quotaCode }) {
  if (!user?._id) {
    throw new Error('provisionShadowAccount: user._id missing');
  }
  const userId = String(user._id);
  const username = `hezi_${userId.slice(-12)}`; // <= 17 chars; NewAPI accepts
  const displayName = username;
  const password = generateShadowPassword();

  // 1+2. Create shadow user (ignore "already exists" — recover by lookup)
  try {
    await createShadowUser({ username, password, displayName });
  } catch (err) {
    if (err instanceof NewapiError && /exist|duplicate/i.test(JSON.stringify(err.body || ''))) {
      logger.warn(`[HeziProvisioning] shadow user ${username} already exists, attempting recovery`);
    } else {
      throw err;
    }
  }

  // 3. Find new user's id
  const shadow = await findShadowUserByUsername(username);
  if (!shadow?.id) {
    throw new NewapiError('shadow user created but lookup failed', { code: 'POSTCREATE_LOOKUP' });
  }
  const newapiUserId = shadow.id;

  // 4. Login as shadow → cookie
  const session = await loginAsUser({ username, password });
  // Sanity: NewAPI may report id under either field
  const sessionUserId = session.userId || newapiUserId;

  // 5. Create sk-token
  const sk = await createUserToken({
    cookie: session.cookie,
    userId: sessionUserId,
    name: 'hezi-default',
    unlimited: true,
    expiredTime: -1,
  });

  // 6. Best-effort redeem
  let redeemed = false;
  if (quotaCode) {
    try {
      await redeemQuotaCode({
        cookie: session.cookie,
        userId: sessionUserId,
        code: quotaCode,
      });
      redeemed = true;
    } catch (err) {
      logger.error('[HeziProvisioning] quota redeem failed (non-fatal)', {
        userId,
        err: err.message,
        body: err.body,
      });
    }
  }

  // 7. Persist (must succeed)
  await storeShadow(userId, {
    password,
    sk_token: sk,
    newapi_user_id: newapiUserId,
    quota_redeemed: redeemed ? '1' : '0',
    quota_code: quotaCode || '',
  });
  await storeEndpointKey(userId, sk);

  logger.info(
    `[HeziProvisioning] provisioned ${username} (newapiId=${newapiUserId}, redeemed=${redeemed})`,
  );
  return { newapiUserId, sk, redeemed };
}

/** Has this user already been provisioned (used by login fallback)? */
async function hasShadowAccount(userId) {
  const row = await findOnePluginAuth({
    userId: String(userId),
    pluginKey: PLUGIN_KEY,
    authField: 'sk_token',
  });
  return !!row;
}

/** Best-effort cleanup if registration rolls back. */
async function rollbackShadowAccount(userId) {
  try {
    await deletePluginAuth({ userId: String(userId), pluginKey: PLUGIN_KEY, all: true });
    await deleteUserKey({ userId: String(userId), name: HEZI_ENDPOINT_NAME });
  } catch (err) {
    logger.warn('[HeziProvisioning] rollback delete failed', err);
  }
  // Note: we don't try to delete the NewAPI user here because we may not know
  // its numeric id at the time of rollback (e.g., createShadowUser failed).
  // Admin can sweep orphaned hezi_* users on schedule.
}

module.exports = {
  provisionShadowAccount,
  hasShadowAccount,
  rollbackShadowAccount,
  PLUGIN_KEY,
  HEZI_ENDPOINT_NAME,
};
