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
          data: { key: 'sk-created-full' },
        }),
      );

    const { createUserToken } = require('./NewapiClient');

    await expect(
      createUserToken({
        cookie: 'session=abc',
        userId: 42,
        name: 'hezi-default',
      }),
    ).resolves.toBe('sk-created-full');

    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      'https://newapi.test/api/token/10/key',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Cookie: 'session=abc',
          'New-Api-User': '42',
        }),
      }),
    );
  });
});
