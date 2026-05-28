const mockGenerate2FATempToken = jest.fn();
const mockSetAuthTokens = jest.fn();
const mockHasShadowAccount = jest.fn();
const mockProvisionShadowAccount = jest.fn();
const mockEnsureQuotaRedeemed = jest.fn();
const mockRecordProvisioningError = jest.fn();

jest.mock(
  '@librechat/data-schemas',
  () => ({
    logger: { error: jest.fn(), warn: jest.fn() },
  }),
  { virtual: true },
);

jest.mock(
  '@librechat/api',
  () => ({
    isEnabled: (value) => value === true || value === 'true',
  }),
  { virtual: true },
);

jest.mock('~/server/services/twoFactorService', () => ({
  generate2FATempToken: (...args) => mockGenerate2FATempToken(...args),
}));

jest.mock('~/server/services/AuthService', () => ({
  setAuthTokens: (...args) => mockSetAuthTokens(...args),
}));

jest.mock('~/server/services/hezi/HeziProvisioning', () => ({
  hasShadowAccount: (...args) => mockHasShadowAccount(...args),
  provisionShadowAccount: (...args) => mockProvisionShadowAccount(...args),
  ensureQuotaRedeemed: (...args) => mockEnsureQuotaRedeemed(...args),
  recordProvisioningError: (...args) => mockRecordProvisioningError(...args),
}));

const { loginController } = require('./LoginController');

function createRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

describe('loginController - HeZi shadow account fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HEZI_REQUIRE_INVITE_CODE = 'true';
    mockHasShadowAccount.mockResolvedValue(true);
    mockProvisionShadowAccount.mockResolvedValue({});
    mockEnsureQuotaRedeemed.mockResolvedValue({ redeemed: false });
    mockRecordProvisioningError.mockResolvedValue({});
    mockSetAuthTokens.mockResolvedValue('local-token');
  });

  afterEach(() => {
    delete process.env.HEZI_REQUIRE_INVITE_CODE;
  });

  it('provisions a missing shadow account before issuing auth tokens', async () => {
    mockHasShadowAccount.mockResolvedValue(false);
    const req = {
      user: {
        _id: { toString: () => '66554433221100ffeeddccbb' },
        email: 'teacher@example.com',
      },
    };
    const res = createRes();

    await loginController(req, res);

    expect(mockHasShadowAccount).toHaveBeenCalledWith('66554433221100ffeeddccbb');
    expect(mockProvisionShadowAccount).toHaveBeenCalledWith({ user: req.user });
    expect(mockProvisionShadowAccount.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetAuthTokens.mock.invocationCallOrder[0],
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith({
      token: 'local-token',
      user: {
        _id: req.user._id,
        email: 'teacher@example.com',
        id: '66554433221100ffeeddccbb',
      },
    });
  });

  it('records fallback failures without blocking login', async () => {
    const error = new Error('NewAPI unavailable');
    mockHasShadowAccount.mockResolvedValue(false);
    mockProvisionShadowAccount.mockRejectedValue(error);
    const req = {
      user: {
        _id: { toString: () => '66554433221100ffeeddccbb' },
        email: 'teacher@example.com',
      },
    };
    const res = createRes();

    await loginController(req, res);

    expect(mockRecordProvisioningError).toHaveBeenCalledWith({
      userId: '66554433221100ffeeddccbb',
      step: 'login_fallback',
      error,
    });
    expect(mockSetAuthTokens).toHaveBeenCalledWith(req.user._id, res, null, req);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('retries pending quota redemption for existing shadow accounts before issuing auth tokens', async () => {
    const req = {
      user: {
        _id: { toString: () => '66554433221100ffeeddccbb' },
        email: 'teacher@example.com',
      },
    };
    const res = createRes();

    await loginController(req, res);

    expect(mockEnsureQuotaRedeemed).toHaveBeenCalledWith('66554433221100ffeeddccbb');
    expect(mockEnsureQuotaRedeemed.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetAuthTokens.mock.invocationCallOrder[0],
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('records quota redemption retry failures without blocking login', async () => {
    const error = new Error('quota service unavailable');
    mockEnsureQuotaRedeemed.mockRejectedValue(error);
    const req = {
      user: {
        _id: { toString: () => '66554433221100ffeeddccbb' },
        email: 'teacher@example.com',
      },
    };
    const res = createRes();

    await loginController(req, res);

    expect(mockRecordProvisioningError).toHaveBeenCalledWith({
      userId: '66554433221100ffeeddccbb',
      step: 'login_quota_redeem',
      error,
    });
    expect(mockSetAuthTokens).toHaveBeenCalledWith(req.user._id, res, null, req);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('does not block login when provisioning error logging fails', async () => {
    mockHasShadowAccount.mockResolvedValue(false);
    mockProvisionShadowAccount.mockRejectedValue(new Error('NewAPI unavailable'));
    mockRecordProvisioningError.mockRejectedValue(new Error('Mongo unavailable'));
    const req = {
      user: {
        _id: { toString: () => '66554433221100ffeeddccbb' },
        email: 'teacher@example.com',
      },
    };
    const res = createRes();

    await loginController(req, res);

    expect(mockSetAuthTokens).toHaveBeenCalledWith(req.user._id, res, null, req);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
