jest.mock(
  '@librechat/data-schemas',
  () => ({
    encryptV3: jest.fn((value) => `enc:${value}`),
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
}));

jest.mock('~/models', () => ({
  updatePluginAuth: jest.fn(),
  updateUserKey: jest.fn(),
  deleteUserKey: jest.fn(),
  deletePluginAuth: jest.fn(),
  findOnePluginAuth: jest.fn(),
}));

const {
  createShadowUser,
  findShadowUserByUsername,
  loginAsUser,
  createUserToken,
} = require('./NewapiClient');
const { updatePluginAuth, updateUserKey } = require('~/models');
const { provisionShadowAccount } = require('./HeziProvisioning');

describe('HeziProvisioning', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createShadowUser.mockResolvedValue({ success: true });
    findShadowUserByUsername.mockResolvedValue({ id: 42 });
    loginAsUser.mockResolvedValue({ cookie: 'session=abc', userId: 42 });
    createUserToken.mockResolvedValue('sk-test');
    updatePluginAuth.mockResolvedValue({});
    updateUserKey.mockResolvedValue({});
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
});
