const { fetch: mockFetch } = require('undici');
const {
  getImageModels,
  getLiveImageModels,
  mapImageRequestPayload,
  normalizeImageResponse,
  runImageGeneration,
} = require('./ImageGenerationService');

jest.mock('undici', () => ({
  fetch: jest.fn(),
}));

describe('ImageGenerationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.DOMAIN_SERVER;
    delete process.env.HEZI_IMAGE_PUBLIC_BASE_URL;
  });

  it('exposes gpt-image-2 as the default OpenAI model with size schema', () => {
    const models = getImageModels();
    const model = models.find((item) => item.modelId === 'gpt-image-2');

    expect(model).toMatchObject({
      provider: 'openai',
      modelId: 'gpt-image-2',
      displayName: 'GPT Image 2',
      disabled: false,
    });
    expect(model.paramSchemas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'size',
          type: 'enum',
          default: '1024x1024',
        }),
        expect.objectContaining({
          name: 'imageNum',
          type: 'number',
          default: 1,
        }),
      ]),
    );
  });

  it('maps OpenAI image requests to NewAPI /v1/images/generations payloads', () => {
    expect(
      mapImageRequestPayload({
        provider: 'openai',
        model: 'gpt-image-2',
        prompt: '画一只穿宇航服的猫',
        params: { size: '1024x1024', quality: 'standard' },
        imageNum: 2,
      }),
    ).toEqual({
      model: 'gpt-image-2',
      prompt: '画一只穿宇航服的猫',
      n: 2,
      size: '1024x1024',
      quality: 'standard',
    });
  });

  it('maps reference image URLs into NewAPI image request payloads', () => {
    process.env.DOMAIN_SERVER = 'https://hezi.example.com';

    expect(
      mapImageRequestPayload({
        provider: 'openai',
        model: 'gpt-image-2',
        prompt: '保留参考图构图，改成玻璃质感 App 图标',
        params: {
          size: '1024x1024',
          quality: 'standard',
          imageUrls: ['/images/user-123/reference.png'],
        },
        imageNum: 1,
      }),
    ).toEqual({
      model: 'gpt-image-2',
      prompt: '保留参考图构图，改成玻璃质感 App 图标',
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      image_urls: ['https://hezi.example.com/images/user-123/reference.png'],
    });
  });

  it('uses the dedicated public image base URL when preparing reference images for NewAPI', () => {
    process.env.DOMAIN_SERVER = 'https://internal.example.com';
    process.env.HEZI_IMAGE_PUBLIC_BASE_URL = 'https://assets.example.com/';

    expect(
      mapImageRequestPayload({
        provider: 'gemini',
        model: 'gemini-3.1-flash-image-preview',
        prompt: '保留参考图构图',
        params: {
          imageUrls: ['/images/user-123/reference.png', 'https://cdn.example.com/remote.png'],
        },
        imageNum: 1,
      }),
    ).toEqual({
      model: 'gemini-3.1-flash-image-preview',
      prompt: '保留参考图构图',
      n: 1,
      image_urls: [
        'https://assets.example.com/images/user-123/reference.png',
        'https://cdn.example.com/remote.png',
      ],
    });
  });

  it('normalizes URL and base64 image responses', () => {
    expect(
      normalizeImageResponse({
        data: [
          { url: 'https://cdn.example.com/a.png', width: 1024, height: 1024 },
          { b64_json: 'abc123' },
        ],
      }),
    ).toEqual([
      { url: 'https://cdn.example.com/a.png', width: 1024, height: 1024, mimeType: 'image/png' },
      { b64: 'abc123', mimeType: 'image/png' },
    ]);
  });

  it('throws IMAGE_NO_USER_KEY when the user endpoint key is missing', async () => {
    await expect(
      runImageGeneration({
        userId: 'user-1',
        provider: 'openai',
        model: 'gpt-image-2',
        prompt: 'prompt',
        params: {},
        imageNum: 1,
        getUserKeyValues: jest.fn().mockResolvedValue(null),
      }),
    ).rejects.toThrow('IMAGE_NO_USER_KEY');
  });

  it('marks registered image models missing from NewAPI /v1/models as disabled', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: [{ id: 'gemini-3.1-flash-image-preview' }, { id: 'dall-e-3' }],
        }),
    });

    const models = await getLiveImageModels({
      userId: 'user-1',
      getUserKeyValues: jest.fn().mockResolvedValue({
        apiKey: 'sk-user',
        baseURL: 'https://newapi.example.com/v1',
      }),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://newapi.example.com/v1/models',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sk-user' }),
      }),
    );
    expect(
      models.find((model) => model.modelId === 'gemini-3.1-flash-image-preview'),
    ).toMatchObject({
      disabled: false,
    });
    expect(models.find((model) => model.modelId === 'gpt-image-2')).toMatchObject({
      disabled: true,
      reason: 'not_configured',
    });
  });
});
