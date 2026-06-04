const mockFetch = jest.fn();

jest.mock('undici', () => ({
  fetch: (...args) => mockFetch(...args),
}));

jest.mock(
  '@librechat/data-schemas',
  () => ({
    logger: { warn: jest.fn() },
  }),
  { virtual: true },
);

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn(async () => JSON.stringify(body)),
    headers: { get: jest.fn(() => '') },
  };
}

describe('NewapiClient', () => {
  beforeEach(() => {
    jest.resetModules();
    mockFetch.mockReset();
    process.env.HEZI_NEWAPI_BASE_URL = 'https://newapi.test';
  });

  afterEach(() => {
    delete process.env.HEZI_NEWAPI_BASE_URL;
    delete process.env.HEZI_NEWAPI_ADMIN_TOKEN;
    delete process.env.HEZI_NEWAPI_ADMIN_USER_ID;
    delete process.env.HEZI_NEWAPI_TIMEOUT_MS;
  });

  test('fetches the created token key from the token list when create returns full key', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ success: true, message: '' }))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            items: [
              { id: 9, name: 'other', key: 'sk-other' },
              { id: 10, name: 'hezi-default', key: 'sk-created' },
            ],
          },
        }),
      );

    const { createUserToken } = require('./NewapiClient');

    await expect(
      createUserToken({
        cookie: 'session=abc',
        userId: 42,
        name: 'hezi-default',
      }),
    ).resolves.toBe('sk-created');

    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://newapi.test/api/token/?p=0&page_size=10',
      expect.objectContaining({
        headers: expect.objectContaining({
          Cookie: 'session=abc',
          'New-Api-User': '42',
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  test('fetches full token key by id when token list masks keys', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ success: true, message: '' }))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: {
            items: [
              { id: 9, name: 'other', key: 'PE0H**********1234' },
              { id: 10, name: 'hezi-default', key: 'ABCD**********WXYZ' },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          data: { key: 'rawCreatedFullKey123' },
        }),
      );

    const { createUserToken } = require('./NewapiClient');

    await expect(
      createUserToken({
        cookie: 'session=abc',
        userId: 42,
        name: 'hezi-default',
      }),
    ).resolves.toBe('sk-rawCreatedFullKey123');

    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      'https://newapi.test/api/token/10/key',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Cookie: 'session=abc',
          'New-Api-User': '42',
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  test('adds a configured timeout signal to NewAPI requests', async () => {
    process.env.HEZI_NEWAPI_ADMIN_TOKEN = 'admin-token';
    process.env.HEZI_NEWAPI_ADMIN_USER_ID = '1';
    process.env.HEZI_NEWAPI_TIMEOUT_MS = '1234';
    const abortTimeoutSpy = jest.spyOn(globalThis.AbortSignal, 'timeout');
    mockFetch.mockResolvedValue(jsonResponse({ success: true, message: '' }));
    const { createShadowUser } = require('./NewapiClient');

    await createShadowUser({
      username: 'hezi_00ffeeddccbb',
      password: 'Password2345678',
      displayName: 'teacher',
      remark: 'HeZi userId: 66554433221100ffeeddccbb',
    });

    expect(abortTimeoutSpy).toHaveBeenCalledWith(1234);
    expect(mockFetch.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
    abortTimeoutSpy.mockRestore();
  });

  test('updates a NewAPI shadow user profile without changing credentials', async () => {
    process.env.HEZI_NEWAPI_ADMIN_TOKEN = 'admin-token';
    process.env.HEZI_NEWAPI_ADMIN_USER_ID = '1';
    mockFetch.mockResolvedValue(jsonResponse({ success: true, message: '' }));
    const { updateShadowUserProfile } = require('./NewapiClient');

    await updateShadowUserProfile({
      id: 41,
      username: 'hezi_ba9684c86492',
      group: 'default',
      status: 1,
      role: 1,
      displayName: '111',
      remark: 'HeZi userId: 6a1e98dc3835ba9684c86492 | email: user@example.com',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://newapi.test/api/user/',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: 'admin-token',
          'New-Api-User': '1',
        }),
        body: JSON.stringify({
          id: 41,
          username: 'hezi_ba9684c86492',
          group: 'default',
          display_name: '111',
          remark: 'HeZi userId: 6a1e98dc3835ba9684c86492 | email: user@example.com',
          status: 1,
          role: 1,
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  test('creates one NewAPI redemption code per invite', async () => {
    process.env.HEZI_NEWAPI_ADMIN_TOKEN = 'admin-token';
    process.env.HEZI_NEWAPI_ADMIN_USER_ID = '1';
    mockFetch.mockResolvedValue(
      jsonResponse({
        success: true,
        data: ['redeem-a', 'redeem-b'],
      }),
    );
    const { createRedemptionCodes } = require('./NewapiClient');

    await expect(
      createRedemptionCodes({
        name: 'hezi_invite_smoke',
        quota: 250000000,
        count: 2,
      }),
    ).resolves.toEqual(['redeem-a', 'redeem-b']);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://newapi.test/api/redemption/',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'admin-token',
          'New-Api-User': '1',
        }),
        body: JSON.stringify({
          name: 'hezi_invite_smoke',
          quota: 250000000,
          count: 2,
        }),
        signal: expect.any(AbortSignal),
      }),
    );
  });
});
