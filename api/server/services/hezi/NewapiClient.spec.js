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

  test('fetches the created token key from the token list when create returns no data', async () => {
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
});
