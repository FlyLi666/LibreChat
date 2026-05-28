/**
 * HeZi: seed invite codes.
 *
 * Usage:
 *   npm run hezi-seed-invites -- --count=10 --note="launch batch"
 *   npm run hezi-seed-invites -- --codes=ABC123,XYZ789 --quota=2500000
 *   npm run hezi-seed-invites -- --count=10 --quota=0  # no NewAPI top-up codes
 *
 * Codes are uppercase, persisted via bulkUpsertInviteCodes (idempotent).
 */
const path = require('path');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });

const { createModels, createMethods } = require('@librechat/data-schemas');
const connect = require('./connect');
const { createRedemptionCodes } = require('~/server/services/hezi/NewapiClient');
const {
  DEFAULT_INVITE_QUOTA,
  buildInviteDocs,
  createInviteQuotaCodes,
} = require('~/server/services/hezi/InviteSeeder');

function genCode() {
  // 10-char base32-ish, no easy-confusing chars (0/O, 1/I/L)
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const buf = crypto.randomBytes(10);
  let out = '';
  for (let i = 0; i < 10; i++) {
    out += alphabet[buf[i] % alphabet.length];
  }
  return out;
}

function parseArg(name, fallback) {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=').slice(1).join('=') : fallback;
}

(async () => {
  await connect();
  createModels(mongoose);
  const methods = createMethods(mongoose);

  const count = parseInt(parseArg('count', '10'), 10);
  const codesArg = parseArg('codes', '');
  const note = parseArg('note', 'seed');
  const quota = parseArg('quota', String(DEFAULT_INVITE_QUOTA));
  const tenantId = parseArg('tenant', '');

  let codes;
  if (codesArg) {
    codes = codesArg
      .split(',')
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
  } else {
    codes = Array.from({ length: count }, genCode);
  }

  const quotaCodes = await createInviteQuotaCodes({
    count: codes.length,
    note,
    quota,
    createRedemptionCodes,
  });

  const docs = buildInviteDocs({
    codes,
    note,
    tenantId,
    quotaCodes,
  });

  console.log(`[hezi-seed-invites] inserting ${docs.length} codes...`);
  if (quotaCodes.length > 0) {
    console.log(`[hezi-seed-invites] attached ${quotaCodes.length} NewAPI redemption codes`);
  } else {
    console.log('[hezi-seed-invites] NewAPI quota disabled for this batch');
  }
  const result = await methods.bulkUpsertInviteCodes(docs);
  console.log('[hezi-seed-invites] result:', JSON.stringify(result, null, 2));
  console.log('Codes:');
  for (const c of codes) console.log('  ' + c);

  process.exit(0);
})().catch((err) => {
  console.error('[hezi-seed-invites] fatal', err);
  process.exit(1);
});
