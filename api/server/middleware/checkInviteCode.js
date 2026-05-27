const { logger } = require('@librechat/data-schemas');
const { isEnabled } = require('@librechat/api');
const { validateInviteCode } = require('~/models');

/**
 * HeZi: enforce invite-code requirement on registration.
 *
 * Activated when HEZI_REQUIRE_INVITE_CODE=1 (or "true").
 * When inactive, this middleware is a no-op so upstream behaviour stays identical.
 *
 * On success: attaches `req.heziInviteCode` (the validated record) so
 * downstream `registrationController` -> `registerUser` can consume it.
 * The actual atomic consume happens after `createUser` succeeds, so a
 * failed registration won't burn a code.
 *
 * Errors are returned as JSON with a stable `code` field that the client
 * uses to look up i18n strings (com_auth_invite_code_*).
 */
async function checkInviteCode(req, res, next) {
  const enforce = isEnabled(process.env.HEZI_REQUIRE_INVITE_CODE);
  if (!enforce) {
    return next();
  }

  const raw = (req.body?.inviteCode ?? '').toString().trim();
  if (!raw) {
    return res.status(400).json({
      code: 'INVITE_CODE_REQUIRED',
      message: '请填写邀请码',
    });
  }

  try {
    const result = await validateInviteCode(raw);
    if (!result.ok) {
      const codeMap = {
        not_found: { code: 'INVITE_CODE_INVALID', message: '邀请码无效' },
        disabled: { code: 'INVITE_CODE_INVALID', message: '邀请码无效' },
        exhausted: { code: 'INVITE_CODE_EXHAUSTED', message: '邀请码已被使用' },
        expired: { code: 'INVITE_CODE_EXPIRED', message: '邀请码已过期' },
      };
      const payload = codeMap[result.reason] || codeMap.not_found;
      return res.status(400).json(payload);
    }

    /** Stash for the registerUser hook to consume atomically after createUser. */
    req.heziInviteCode = {
      code: result.record.code,
      quotaCode: result.record.quotaCode,
      raw,
    };
    return next();
  } catch (err) {
    logger.error('[checkInviteCode] validation failed', err);
    return res.status(500).json({
      code: 'INVITE_CODE_CHECK_FAILED',
      message: '邀请码校验失败，请稍后再试',
    });
  }
}

module.exports = checkInviteCode;
