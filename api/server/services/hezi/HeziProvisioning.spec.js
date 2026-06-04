jest.mock('@librechat/data-schemas', () => ({
  encryptV3: jest.fn((value) => `enc:${value}`),
  decryptV3: jest.fn((value) => value.replace(/^enc:/, '')),
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

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
  redeemQuotaCode,
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
  ensureQuotaRedeemed,
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
    redeemQuotaCode.mockResolvedValue({ success: true });
    deleteShadowUser.mockResolvedValue(true);
    findOnePluginAuth.mockResolvedValue(null);
    updatePluginAuth.mockResolvedValue({});
    updateUserKey.mockResolvedValue({});
    createHeziProvisioningError.mockResolvedValue({});
    countHeziProvisioningErrors.mockResolvedValue(0);
    process.env.HEZI_NEWAPI_BASE_URL = 'https://newapi.flyli.cn';
  });

  test('labels the NewAPI shadow user with the HeZi registered username', async () => {
    const user = {
      _id: { toString: () => '66554433221100ffeeddccbb' },
      username: 'teacher',
      name: 'Teacher Zhang',
      email: 'very.long.integration.smoke.address.for.hezi@example.flyli.cn',
    };

    await provisionShadowAccount({ user });

    expect(createShadowUser).toHaveBeenCalledWith({
      username: 'hezi_00ffeeddccbb',
      password: 'Password2345678',
      displayName: 'teacher',
      remark:
        'HeZi userId: 66554433221100ffeeddccbb | email: very.long.integration.smoke.address.for.hezi@example.flyli.cn | username: teacher | name: Teacher Zhang | shadow: hezi_00ffeeddccbb',
    });
  });

  test('falls back to the HeZi name when username is empty', async () => {
    const user = {
      _id: { toString: () => '66554433221100ffeeddccbb' },
      username: '',
      name: 'Display Name',
      email: 'teacher@example.flyli.cn',
    };

    await provisionShadowAccount({ user });

    expect(createShadowUser).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Display Name',
        remark: expect.stringContaining('name: Display Name'),
      }),
    );
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

  test('retries quota redemption from stored shadow credentials when login fallback finds it pending', async () => {
    findOnePluginAuth.mockImplementation(async ({ authField }) => {
      const rows = {
        quota_redeemed: { value: 'enc:0' },
        quota_code: { value: 'enc:quota-5-yuan' },
        password: { value: 'enc:Password2345678' },
        newapi_user_id: { value: 'enc:42' },
      };
      return rows[authField] || null;
    });

    await ensureQuotaRedeemed('66554433221100ffeeddccbb');

    expect(loginAsUser).toHaveBeenCalledWith({
      username: 'hezi_00ffeeddccbb',
      password: 'Password2345678',
    });
    expect(redeemQuotaCode).toHaveBeenCalledWith({
      cookie: 'session=abc',
      userId: 42,
      code: 'quota-5-yuan',
    });
    expect(updatePluginAuth).toHaveBeenCalledWith({
      userId: '66554433221100ffeeddccbb',
      pluginKey: 'newapi-shadow',
      authField: 'quota_redeemed',
      value: 'enc:1',
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
