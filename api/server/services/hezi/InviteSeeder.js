const DEFAULT_INVITE_QUOTA = 2500000;

function sanitizeRedemptionNamePart(value) {
  return (
    String(value || 'seed')
      .replace(/[^A-Za-z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 6) || 'seed'
  );
}

async function createInviteQuotaCodes({
  count,
  note,
  quota = DEFAULT_INVITE_QUOTA,
  createRedemptionCodes,
  timestamp = Date.now(),
}) {
  const numericQuota = Number(quota);
  if (!Number.isFinite(numericQuota) || numericQuota < 0) {
    throw new Error(`Invalid invite quota: ${quota}`);
  }
  if (numericQuota === 0) {
    return [];
  }
  const codes = await createRedemptionCodes({
    name: `hezi_${sanitizeRedemptionNamePart(note)}_${String(timestamp).slice(0, 8)}`,
    quota: numericQuota,
    count,
  });
  if (codes.length !== count) {
    throw new Error(`Expected ${count} NewAPI redemption codes, got ${codes.length}`);
  }
  return codes;
}

function buildInviteDocs({ codes, note, tenantId, quotaCodes = [] }) {
  return codes.map((code, index) => ({
    code,
    note,
    enabled: true,
    maxUses: 1,
    quotaCode: quotaCodes[index] || undefined,
    tenantId: tenantId || undefined,
  }));
}

module.exports = {
  DEFAULT_INVITE_QUOTA,
  buildInviteDocs,
  createInviteQuotaCodes,
};
