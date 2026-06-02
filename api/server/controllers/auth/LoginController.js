const { logger } = require('@librechat/data-schemas');
const { isEnabled } = require('@librechat/api');
const { generate2FATempToken } = require('~/server/services/twoFactorService');
const { setAuthTokens } = require('~/server/services/AuthService');
const {
  hasShadowAccount,
  provisionShadowAccount,
  ensureQuotaRedeemed,
  recordProvisioningError,
} = require('~/server/services/hezi/HeziProvisioning');

const recordFallbackError = async (userId, error, step = 'login_fallback') => {
  try {
    await recordProvisioningError({
      userId,
      step,
      error,
    });
  } catch (recordError) {
    logger.warn('[loginController] HeZi provisioning error logging failed', {
      userId,
      error: recordError.message,
    });
  }
};

function shouldProvisionHeziShadowAccounts() {
  return (
    isEnabled(process.env.HEZI_REQUIRE_INVITE_CODE) ||
    isEnabled(process.env.HEZI_ENABLE_SHADOW_PROVISIONING) ||
    !!process.env.HEZI_NEWAPI_ADMIN_TOKEN
  );
}

const ensureHeziShadowAccount = async (user) => {
  if (!shouldProvisionHeziShadowAccounts()) {
    return;
  }
  const userId = user._id.toString();
  try {
    const hasShadow = await hasShadowAccount(userId);
    if (hasShadow) {
      try {
        await ensureQuotaRedeemed(userId);
      } catch (error) {
        logger.warn('[loginController] HeZi quota redemption fallback failed', {
          userId,
          error: error.message,
        });
        await recordFallbackError(userId, error, 'login_quota_redeem');
      }
      return;
    }
    await provisionShadowAccount({ user });
  } catch (error) {
    logger.warn('[loginController] HeZi shadow provisioning fallback failed', {
      userId,
      error: error.message,
    });
    await recordFallbackError(userId, error);
  }
};

const loginController = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (req.user.twoFactorEnabled) {
      const tempToken = generate2FATempToken(req.user._id);
      return res.status(200).json({ twoFAPending: true, tempToken });
    }

    await ensureHeziShadowAccount(req.user);

    const { password: _p, totpSecret: _t, __v, ...user } = req.user;
    user.id = user._id.toString();

    const token = await setAuthTokens(req.user._id, res, null, req);

    return res.status(200).send({ token, user });
  } catch (err) {
    logger.error('[loginController]', err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = {
  loginController,
};
