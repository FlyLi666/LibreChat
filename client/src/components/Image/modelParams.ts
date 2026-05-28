import type { TImageModel } from 'librechat-data-provider';

const imageModels: TImageModel[] = [
  {
    provider: 'openai',
    modelId: 'gpt-image-2',
    displayName: 'GPT Image 2',
    paramSchemas: [
      {
        name: 'imageUrls',
        type: 'images',
        default: [],
        maxCount: 1,
        maxFileSize: 5 * 1024 * 1024,
        i18nLabel: 'com_image_reference_image',
      },
      {
        name: 'size',
        type: 'enum',
        default: '1024x1024',
        enum: [
          'auto',
          '1024x1024',
          '1536x1024',
          '1024x1536',
          '2048x2048',
          '2048x1152',
          '3840x2160',
          '2160x3840',
        ],
        i18nLabel: 'com_image_config_size',
      },
      {
        name: 'quality',
        type: 'enum',
        default: 'standard',
        enum: ['standard', 'hd', 'auto'],
        i18nLabel: 'com_image_config_quality',
      },
      {
        name: 'imageNum',
        type: 'number',
        default: 1,
        min: 1,
        max: 4,
        step: 1,
        i18nLabel: 'com_image_config_image_num',
      },
    ],
  },
  {
    provider: 'gemini',
    modelId: 'gemini-3.1-flash-image-preview',
    displayName: 'Nano Banana',
    paramSchemas: [
      {
        name: 'imageUrls',
        type: 'images',
        default: [],
        maxCount: 1,
        maxFileSize: 5 * 1024 * 1024,
        i18nLabel: 'com_image_reference_image',
      },
      {
        name: 'aspectRatio',
        type: 'enum',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        i18nLabel: 'com_image_config_aspect',
      },
      {
        name: 'resolution',
        type: 'enum',
        default: '1K',
        enum: ['512', '1K', '2K', '4K'],
        i18nLabel: 'com_image_config_resolution',
      },
      {
        name: 'imageNum',
        type: 'number',
        default: 1,
        min: 1,
        max: 4,
        step: 1,
        i18nLabel: 'com_image_config_image_num',
      },
    ],
  },
  {
    provider: 'openai',
    modelId: 'dall-e-3',
    displayName: 'DALL-E 3',
    paramSchemas: [
      {
        name: 'size',
        type: 'enum',
        default: '1024x1024',
        enum: ['1024x1024', '1792x1024', '1024x1792'],
        i18nLabel: 'com_image_config_size',
      },
      {
        name: 'quality',
        type: 'enum',
        default: 'standard',
        enum: ['standard', 'hd'],
        i18nLabel: 'com_image_config_quality',
      },
      {
        name: 'imageNum',
        type: 'number',
        default: 1,
        min: 1,
        max: 1,
        step: 1,
        i18nLabel: 'com_image_config_image_num',
      },
    ],
  },
  {
    provider: 'google',
    modelId: 'imagen-4',
    displayName: 'Imagen 4',
    paramSchemas: [
      {
        name: 'aspectRatio',
        type: 'enum',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '3:4', '4:3'],
        i18nLabel: 'com_image_config_aspect',
      },
      {
        name: 'imageNum',
        type: 'number',
        default: 1,
        min: 1,
        max: 4,
        step: 1,
        i18nLabel: 'com_image_config_image_num',
      },
    ],
  },
  {
    provider: 'flux',
    modelId: 'flux-kontext-dev',
    displayName: 'Flux Kontext Dev',
    disabled: true,
    paramSchemas: [
      {
        name: 'imageUrls',
        type: 'images',
        default: [],
        maxCount: 1,
        maxFileSize: 5 * 1024 * 1024,
        i18nLabel: 'com_image_reference_image',
      },
      {
        name: 'strength',
        type: 'number',
        default: 0.7,
        min: 0,
        max: 1,
        step: 0.05,
        i18nLabel: 'com_image_config_strength',
      },
      {
        name: 'steps',
        type: 'number',
        default: 28,
        min: 1,
        max: 80,
        step: 1,
        i18nLabel: 'com_image_config_steps',
      },
      {
        name: 'cfg',
        type: 'number',
        default: 3.5,
        min: 0,
        max: 20,
        step: 0.5,
        i18nLabel: 'com_image_config_cfg',
      },
    ],
  },
];

export function getImageModels({ includeDisabled = true } = {}) {
  return includeDisabled ? imageModels : imageModels.filter((model) => !model.disabled);
}

export function getImageModel(modelId: string | null | undefined) {
  return imageModels.find((model) => model.modelId === modelId);
}

export function getDefaultImageParams(model: TImageModel | undefined) {
  return Object.fromEntries(
    (model?.paramSchemas ?? []).map((schema) => [schema.name, schema.default]),
  );
}
