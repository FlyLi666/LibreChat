import { getImageModel, getImageModels } from './modelParams';

describe('image model params', () => {
  it('defaults to gpt-image-2 with text-to-image and reference-image schema', () => {
    const model = getImageModel('gpt-image-2');

    expect(model).toMatchObject({
      provider: 'openai',
      modelId: 'gpt-image-2',
      displayName: 'GPT Image 2',
    });
    expect(model?.paramSchemas.map((schema) => schema.name)).toEqual([
      'imageUrls',
      'size',
      'quality',
      'imageNum',
    ]);
  });

  it('adapts schemas by model family', () => {
    expect(getImageModel('dall-e-3')?.paramSchemas.map((schema) => schema.name)).toEqual([
      'size',
      'quality',
      'imageNum',
    ]);
    expect(
      getImageModel('gemini-3.1-flash-image-preview')?.paramSchemas.map((schema) => schema.name),
    ).toEqual(['imageUrls', 'aspectRatio', 'resolution', 'imageNum']);
    expect(getImageModel('imagen-4')?.paramSchemas.map((schema) => schema.name)).toEqual([
      'aspectRatio',
      'imageNum',
    ]);
  });

  it('keeps disabled future models out of the default enabled set', () => {
    const enabledModels = getImageModels({ includeDisabled: false });

    expect(enabledModels.every((model) => !model.disabled)).toBe(true);
    expect(enabledModels.map((model) => model.modelId)).toContain('gpt-image-2');
  });
});
