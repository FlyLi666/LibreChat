const { fetch } = require('undici');
const { logger } = require('@librechat/data-schemas');
const { HEZI_ENDPOINT_NAME } = require('./HeziProvisioning');

const DEFAULT_BASE_URL = 'https://newapi.flyli.cn/v1';
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_MODELS_TIMEOUT_MS = 10_000;

const imageModels = [
  {
    provider: 'openai',
    modelId: 'gpt-image-2',
    displayName: 'GPT Image 2',
    disabled: false,
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
    disabled: false,
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
    disabled: false,
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
    disabled: false,
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
    reason: 'not_configured',
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

function getImageModels({ includeDisabled = true } = {}) {
  return includeDisabled ? imageModels : imageModels.filter((model) => !model.disabled);
}

function cloneImageModel(model) {
  return {
    ...model,
    paramSchemas: model.paramSchemas.map((schema) => ({ ...schema })),
  };
}

function mergeLiveModelAvailability(modelIds, { includeDisabled = true } = {}) {
  const available = new Set(modelIds);
  const models = imageModels.map((model) => {
    const next = cloneImageModel(model);
    if (available.has(model.modelId)) {
      delete next.reason;
      next.disabled = false;
      return next;
    }
    next.disabled = true;
    next.reason = 'not_configured';
    return next;
  });
  return includeDisabled ? models : models.filter((model) => !model.disabled);
}

function getImageModel(modelId) {
  return imageModels.find((model) => model.modelId === modelId);
}

function clampImageNum(value, max = 4) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

function getPublicImageBaseUrl() {
  return (
    process.env.HEZI_IMAGE_PUBLIC_BASE_URL ||
    process.env.DOMAIN_SERVER ||
    process.env.DOMAIN_CLIENT ||
    'http://localhost:3080'
  ).replace(/\/+$/, '');
}

function normalizeReferenceImageUrls(imageUrls = []) {
  return imageUrls
    .filter((url) => typeof url === 'string' && url.trim())
    .map((url) => {
      const trimmed = url.trim();
      if (/^(https?:|data:)/i.test(trimmed)) {
        return trimmed;
      }
      if (trimmed.startsWith('/')) {
        return `${getPublicImageBaseUrl()}${trimmed}`;
      }
      return trimmed;
    });
}

function mapImageRequestPayload({ provider, model, prompt, params = {}, imageNum = 1 }) {
  const modelDef = getImageModel(model);
  const nSchema = modelDef?.paramSchemas?.find((schema) => schema.name === 'imageNum');
  const n = clampImageNum(imageNum, nSchema?.max ?? 4);
  const payload = {
    model,
    prompt,
    n,
  };

  if (provider === 'openai') {
    if (params.size) {
      payload.size = params.size;
    }
    if (params.quality) {
      payload.quality = params.quality;
    }
    if (params.imageUrls?.length) {
      payload.image_urls = normalizeReferenceImageUrls(params.imageUrls);
    }
    return payload;
  }

  if (params.aspectRatio) {
    payload.aspect_ratio = params.aspectRatio;
  }
  if (params.resolution) {
    payload.resolution = params.resolution;
  }
  if (params.imageUrls?.length) {
    payload.image_urls = normalizeReferenceImageUrls(params.imageUrls);
  }
  return payload;
}

function normalizeImageResponse(body) {
  const items = Array.isArray(body?.data) ? body.data : [];
  return items
    .map((item) => {
      if (item?.url) {
        return {
          url: item.url,
          width: item.width,
          height: item.height,
          mimeType: item.mimeType || 'image/png',
        };
      }
      if (item?.b64_json) {
        return {
          b64: item.b64_json,
          mimeType: item.mimeType || 'image/png',
        };
      }
      return null;
    })
    .filter(Boolean);
}

function getNewapiTimeoutMs() {
  const configured = Number(process.env.HEZI_IMAGE_GEN_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

function getNewapiModelsTimeoutMs() {
  const configured = Number(process.env.HEZI_IMAGE_MODELS_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MODELS_TIMEOUT_MS;
}

function getDefaultBaseUrl() {
  const base = (process.env.HEZI_NEWAPI_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  return base.endsWith('/v1') ? base : `${base}/v1`;
}

function normalizeModelIds(body) {
  let items = [];
  if (Array.isArray(body?.data)) {
    items = body.data;
  } else if (Array.isArray(body)) {
    items = body;
  }
  return items
    .map((item) => (typeof item === 'string' ? item : item?.id || item?.model || item?.modelId))
    .filter(Boolean)
    .map(String);
}

async function getEndpointKeyValues({ userId, getUserKeyValues }) {
  return (await getUserKeyValues({ userId: String(userId), name: HEZI_ENDPOINT_NAME })) || {};
}

async function getLiveImageModels({ userId, getUserKeyValues, includeDisabled = true }) {
  let values = {};
  try {
    values = await getEndpointKeyValues({ userId, getUserKeyValues });
  } catch (error) {
    logger.warn('[HeZiImageGeneration] failed to load user NewAPI key for model probing', {
      userId: String(userId),
      error: error.message,
    });
    return getImageModels({ includeDisabled });
  }

  const apiKey = values.apiKey;
  const baseURL = (values.baseURL || getDefaultBaseUrl()).replace(/\/+$/, '');
  if (!apiKey) {
    return getImageModels({ includeDisabled });
  }

  try {
    const response = await fetch(`${baseURL}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(getNewapiModelsTimeoutMs()),
    });
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
    if (!response.ok) {
      logger.warn('[HeZiImageGeneration] NewAPI model probing failed', {
        status: response.status,
        body,
      });
      return getImageModels({ includeDisabled });
    }
    return mergeLiveModelAvailability(normalizeModelIds(body), { includeDisabled });
  } catch (error) {
    logger.warn('[HeZiImageGeneration] NewAPI model probing request failed', {
      error: error.message,
    });
    return getImageModels({ includeDisabled });
  }
}

async function runImageGeneration({
  userId,
  provider,
  model,
  prompt,
  params,
  imageNum,
  getUserKeyValues,
}) {
  const modelDef = getImageModel(model);
  if (!modelDef) {
    throw new Error('IMAGE_MODEL_NOT_FOUND');
  }
  if (modelDef.disabled) {
    throw new Error('IMAGE_MODEL_DISABLED');
  }
  const values = await getEndpointKeyValues({ userId, getUserKeyValues });
  const apiKey = values.apiKey;
  const baseURL = (values.baseURL || getDefaultBaseUrl()).replace(/\/+$/, '');
  if (!apiKey) {
    throw new Error('IMAGE_NO_USER_KEY');
  }
  const payload = mapImageRequestPayload({ provider, model, prompt, params, imageNum });
  const response = await fetch(`${baseURL}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(getNewapiTimeoutMs()),
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    logger.warn('[HeZiImageGeneration] NewAPI image generation failed', {
      status: response.status,
      body,
    });
    const message = body?.error?.message || body?.message || 'IMAGE_NEWAPI_FAILED';
    throw new Error(message);
  }
  const images = normalizeImageResponse(body);
  if (!images.length) {
    throw new Error('IMAGE_EMPTY_RESPONSE');
  }
  return images;
}

module.exports = {
  getImageModels,
  getImageModel,
  getLiveImageModels,
  mapImageRequestPayload,
  normalizeReferenceImageUrls,
  normalizeImageResponse,
  runImageGeneration,
};
