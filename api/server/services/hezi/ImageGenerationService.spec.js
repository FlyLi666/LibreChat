const {
  getImageModels,
  mapImageRequestPayload,
  normalizeImageResponse,
  runImageGeneration,
} = require('./ImageGenerationService');

describe('ImageGenerationService', () => {
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
      image_urls: ['/images/user-123/reference.png'],
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
});
