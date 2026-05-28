jest.mock(
  '@librechat/data-schemas',
  () => ({
    encryptV3: jest.fn((value) => `enc:${value}`),
    decryptV3: jest.fn((value) => value.replace(/^enc:/, '')),
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  }),
  { virtual: true },
);

jest.mock('./NewapiClient', () => ({
  NewapiError: class NewapiError extends Error {},
  generateShadowPassword: jest.fn(() => 'Password2345678'),
  createShadowUser: jest.fn(),
  findShadowUserByUsername: jest.fn(),
  loginAsUser: jest.fn(),
  createUserToken: jest.fn(),
  redeemQuotaCode: jest.fn(),
  deleteShadowUser: jest.fn(),
}));

jest.mock('~/models', () => ({
  updatePluginAuth: jest.fn(),
  updateUserKey: jest.fn(),
  deleteUserKey: jest.fn(),
  deletePluginAuth: jest.fn(),
  findOnePluginAuth: jest.fn(),
  createHeziProvisioningError: jest.fn(),
  countHeziProvisioningErrors: jest.fn(),
}));

const {
  createShadowUser,
  findShadowUserByUsername,
  loginAsUser,
  createUserToken,
  deleteShadowUser,
} = require('./NewapiClient');
const {
  updatePluginAuth,
  updateUserKey,
  findOnePluginAuth,
  createHeziProvisioningError,
  countHeziProvisioningErrors,
} = require('~/models');
const {
  provisionShadowAccount,
  recordProvisioningError,
  cleanupShadowAccount,
} = require('./HeziProvisioning');

describe('HeziProvisioning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createShadowUser.mockResolvedValue({ success: true });
    findShadowUserByUsername.mockResolvedValue({ id: 42 });
    loginAsUser.mockResolvedValue({ cookie: 'session=abc', userId: 42 });
    createUserToken.mockResolvedValue('sk-test');
    deleteShadowUser.mockResolvedValue(true);
    findOnePluginAuth.mockResolvedValue(null);
    updatePluginAuth.mockResolvedValue({});
    updateUserKey.mockResolvedValue({});
    createHeziProvisioningError.mockResolvedValue({});
    countHeziProvisioningErrors.mockResolvedValue(0);
    process.env.HEZI_NEWAPI_BASE_URL = 'https://newapi.flyli.cn';
  });

  test('uses a short NewAPI display name even when the LibreChat email is long', async () => {
    const user = {
      _id: { toString: () => '66554433221100ffeeddccbb' },
      email: 'very.long.integration.smoke.address.for.hezi@example.flyli.cn',
    };

    await provisionShadowAccount({ user });

    expect(createShadowUser).toHaveBeenCalledWith({
      username: 'hezi_00ffeeddccbb',
      password: 'Password2345678',
      displayName: 'hezi_00ffeeddccbb',
    });
  });

  test('stores the shadow token as the user key for the HeZi custom endpoint', async () => {
    const user = {
      _id: { toString: () => '66554433221100ffeeddccbb' },
      email: 'teacher@example.flyli.cn',
    };

    await provisionShadowAccount({ user });

    expect(updateUserKey).toHaveBeenCalledWith({
      userId: '66554433221100ffeeddccbb',
      name: 'HeZi newAPI',
      value: JSON.stringify({
        apiKey: 'sk-test',
        baseURL: 'https://newapi.flyli.cn/v1',
      }),
      expiresAt: null,
    });
  });

  test('records provisioning errors with the next retry count', async () => {
    countHeziProvisioningErrors.mockResolvedValue(2);

    await recordProvisioningError({
      userId: '66554433221100ffeeddccbb',
      step: 'login_fallback',
      error: new Error('NewAPI temporarily unavailable'),
    });

    expect(countHeziProvisioningErrors).toHaveBeenCalledWith({
      userId: '66554433221100ffeeddccbb',
      step: 'login_fallback',
    });
    expect(createHeziProvisioningError).toHaveBeenCalledWith({
      userId: '66554433221100ffeeddccbb',
      step: 'login_fallback',
      error: 'NewAPI temporarily unavailable',
      retryCount: 3,
    });
  });

  test('deletes the remote NewAPI shadow user from the v3-encrypted stored id', async () => {
    findOnePluginAuth.mockResolvedValue({ value: 'enc:42' });

    await cleanupShadowAccount('66554433221100ffeeddccbb');

    expect(findOnePluginAuth).toHaveBeenCalledWith({
      userId: '66554433221100ffeeddccbb',
      pluginKey: 'newapi-shadow',
      authField: 'newapi_user_id',
    });
    expect(deleteShadowUser).toHaveBeenCalledWith(42);
  });
});
