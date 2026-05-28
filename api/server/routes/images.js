const express = require('express');
const { logger, isValidObjectIdString } = require('@librechat/data-schemas');
const { requireJwtAuth, configMiddleware } = require('~/server/middleware');
const db = require('~/models');
const {
  getImageModel,
  getLiveImageModels,
  runImageGeneration,
} = require('~/server/services/hezi/ImageGenerationService');
const { persistGeneratedImageAsset } = require('~/server/services/hezi/ImageAssetStorage');

const router = express.Router();
const queuedImageBatchIds = new Set();

router.use(requireJwtAuth);
router.use(configMiddleware);

function getUserId(req) {
  return req.user?.id || req.user?._id;
}

function makeTopicTitle(prompt) {
  const trimmed = String(prompt || '').trim();
  return trimmed.length > 30 ? `${trimmed.slice(0, 30)}...` : trimmed || '新建主题';
}

function serializeBatch(batch, generations) {
  return {
    ...batch,
    generations,
  };
}

function getJobRequest(req) {
  return {
    config: req.config,
    user: req.user,
  };
}

function getJobBatchId({ created }) {
  return created?.batch?._id ? String(created.batch._id) : null;
}

function getRecoveryJobRequest({ appConfig, batch }) {
  return {
    config: appConfig,
    user: {
      id: String(batch.userId),
      _id: batch.userId,
      tenantId: batch.tenantId,
    },
  };
}

function makeImageParamError(message) {
  const error = new Error(message);
  error.code = 'IMAGE_PARAM_INVALID';
  return error;
}

function validateParamValue({ schema, value }) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (schema.type === 'enum') {
    if (typeof value !== 'string' || !(schema.enum || []).includes(value)) {
      throw makeImageParamError(`${schema.name} must be one of ${(schema.enum || []).join(', ')}`);
    }
    return value;
  }

  if (schema.type === 'number') {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw makeImageParamError(`${schema.name} must be a number`);
    }
    if (typeof schema.min === 'number' && parsed < schema.min) {
      throw makeImageParamError(`${schema.name} must be between ${schema.min} and ${schema.max}`);
    }
    if (typeof schema.max === 'number' && parsed > schema.max) {
      throw makeImageParamError(`${schema.name} must be between ${schema.min} and ${schema.max}`);
    }
    return parsed;
  }

  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') {
      throw makeImageParamError(`${schema.name} must be a boolean`);
    }
    return value;
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      throw makeImageParamError(`${schema.name} must be a string`);
    }
    return value;
  }

  if (schema.type === 'image') {
    if (typeof value !== 'string' || !value.trim()) {
      throw makeImageParamError(`${schema.name} must be an image URL`);
    }
    return value.trim();
  }

  if (schema.type === 'images') {
    if (!Array.isArray(value)) {
      throw makeImageParamError(`${schema.name} must be an array of image URLs`);
    }
    if (typeof schema.maxCount === 'number' && value.length > schema.maxCount) {
      throw makeImageParamError(`${schema.name} supports at most ${schema.maxCount} image(s)`);
    }
    const urls = value.map((item) => {
      if (typeof item !== 'string' || !item.trim()) {
        throw makeImageParamError(`${schema.name} must contain image URLs`);
      }
      return item.trim();
    });
    return urls;
  }

  return value;
}

function validateImageRequestParams({ modelDef, params, imageNum }) {
  const schemaMap = new Map((modelDef.paramSchemas || []).map((schema) => [schema.name, schema]));
  const nextParams = {};

  for (const [name, value] of Object.entries(params || {})) {
    const schema = schemaMap.get(name);
    if (!schema) {
      throw makeImageParamError(`${name} is not supported by ${modelDef.modelId}`);
    }
    const nextValue = validateParamValue({ schema, value });
    if (nextValue !== undefined) {
      nextParams[name] = nextValue;
    }
  }

  const imageNumSchema = schemaMap.get('imageNum');
  const nextImageNum = validateParamValue({
    schema: imageNumSchema || { name: 'imageNum', type: 'number', min: 1, max: 4 },
    value: imageNum,
  });

  return {
    params: nextParams,
    imageNum: nextImageNum,
  };
}

async function runImageGenerationJob({
  req,
  userId,
  topic,
  topicId,
  created,
  provider,
  model,
  prompt,
  params,
  imageNum,
}) {
  try {
    const images = await runImageGeneration({
      userId,
      provider,
      model,
      prompt,
      params,
      imageNum,
      getUserKeyValues: db.getUserKeyValues,
    });
    const updated = [];
    for (let i = 0; i < created.generations.length; i++) {
      const image = images[i] || images[0];
      const { asset, fileId } = await persistGeneratedImageAsset({
        req,
        image,
        generationId: created.generations[i]._id,
      });
      const generation = await db.markGenerationSucceeded({
        userId,
        generationId: created.generations[i]._id,
        asset,
        fileId,
      });
      if (generation) {
        updated.push(generation);
      }
    }
    if (topic && updated[0]?.asset?.url) {
      await db.updateGenerationTopic({ userId, topicId, coverUrl: updated[0].asset.url });
    }
  } catch (error) {
    logger.error('[HeZiImageGeneration] generate failed', error);
    for (const generation of created.generations) {
      await db.markGenerationFailed({
        userId,
        generationId: generation._id,
        error: error.message || '当前模型暂不可用',
      });
    }
  }
}

function queueImageGenerationJob(params) {
  const batchId = getJobBatchId(params);
  if (batchId && queuedImageBatchIds.has(batchId)) {
    return false;
  }
  if (batchId) {
    queuedImageBatchIds.add(batchId);
  }
  setImmediate(async () => {
    try {
      await runImageGenerationJob(params);
    } catch (error) {
      logger.error('[HeZiImageGeneration] background job failed', error);
    } finally {
      if (batchId) {
        queuedImageBatchIds.delete(batchId);
      }
    }
  });
  return true;
}

async function recoverPendingImageGenerationJobs({ appConfig, limit = 25 } = {}) {
  const pendingBatches = await db.listPendingGenerationBatches({ limit });
  let queued = 0;
  for (const batch of pendingBatches) {
    const generations = (batch.generations || []).filter(
      (generation) => generation.status === 'pending',
    );
    if (generations.length === 0) {
      continue;
    }
    const didQueue = queueImageGenerationJob({
      req: getRecoveryJobRequest({ appConfig, batch }),
      userId: batch.userId,
      topic: batch.topicId ? { _id: batch.topicId } : null,
      topicId: batch.topicId,
      created: {
        batch,
        generations,
      },
      provider: batch.provider,
      model: batch.model,
      prompt: batch.prompt,
      params: batch.params || {},
      imageNum: generations.length,
    });
    if (didQueue) {
      queued++;
    }
  }
  if (queued > 0) {
    logger.info(`[HeZiImageGeneration] recovered ${queued} pending image batch(es)`);
  }
  return { found: pendingBatches.length, queued };
}

router.get('/models', async (req, res) => {
  const models = await getLiveImageModels({
    userId: getUserId(req),
    getUserKeyValues: db.getUserKeyValues,
  });
  res.json({ models });
});

router.get('/topics', async (req, res) => {
  const topics = await db.listGenerationTopics({ userId: getUserId(req) });
  res.json({ topics });
});

router.patch('/topics/:id', async (req, res) => {
  const topic = await db.updateGenerationTopic({
    userId: getUserId(req),
    topicId: req.params.id,
    title: req.body?.title,
  });
  if (!topic) {
    return res.status(404).json({ error: 'Topic not found' });
  }
  res.json({ topic });
});

router.delete('/topics/:id', async (req, res) => {
  await db.deleteGenerationTopic({ userId: getUserId(req), topicId: req.params.id });
  res.status(204).end();
});

router.get('/topics/:id/batches', async (req, res) => {
  const batches = await db.listGenerationBatches({
    userId: getUserId(req),
    topicId: req.params.id,
  });
  res.json({ batches });
});

router.delete('/batches/:id', async (req, res) => {
  await db.deleteGenerationBatch({ userId: getUserId(req), batchId: req.params.id });
  res.status(204).end();
});

router.delete('/generations/:id', async (req, res) => {
  await db.deleteGeneration({ userId: getUserId(req), generationId: req.params.id });
  res.status(204).end();
});

router.post('/generate', async (req, res) => {
  const userId = getUserId(req);
  const prompt = String(req.body?.prompt || '').trim();
  const model = String(req.body?.model || process.env.IMAGE_GEN_DEFAULT_MODEL || 'gpt-image-2');
  const modelDef = getImageModel(model);
  const provider = String(req.body?.provider || modelDef?.provider || 'openai');
  const rawParams = req.body?.params && typeof req.body.params === 'object' ? req.body.params : {};
  const rawImageNum = req.body?.imageNum ?? rawParams.imageNum ?? 1;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  if (!modelDef) {
    return res.status(400).json({ error: 'IMAGE_MODEL_NOT_FOUND' });
  }
  if (modelDef.disabled) {
    return res.status(400).json({ error: 'IMAGE_MODEL_DISABLED' });
  }

  let params = rawParams;
  let imageNum = Number(rawImageNum);
  try {
    const validated = validateImageRequestParams({ modelDef, params: rawParams, imageNum });
    params = validated.params;
    imageNum = validated.imageNum;
  } catch (error) {
    if (error.code === 'IMAGE_PARAM_INVALID') {
      return res.status(400).json({ error: error.code, message: error.message });
    }
    throw error;
  }

  let topicId = req.body?.topicId;
  let topic = null;
  if (topicId) {
    if (typeof topicId !== 'string' || !isValidObjectIdString(topicId)) {
      return res.status(400).json({ error: 'IMAGE_TOPIC_INVALID' });
    }
    topic = await db.getGenerationTopic({ userId, topicId });
    if (!topic) {
      return res.status(404).json({ error: 'IMAGE_TOPIC_NOT_FOUND' });
    }
  } else {
    topic = await db.createGenerationTopic({
      userId,
      title: makeTopicTitle(prompt),
      type: 'image',
    });
    topicId = topic._id;
  }

  const created = await db.createGenerationBatchWithGenerations({
    userId,
    topicId,
    provider,
    model,
    prompt,
    params,
    imageNum,
  });

  queueImageGenerationJob({
    req: getJobRequest(req),
    userId,
    topic,
    topicId,
    created,
    provider,
    model,
    prompt,
    params,
    imageNum,
  });

  return res.json({
    topic,
    batch: serializeBatch(created.batch, created.generations),
  });
});

router.recoverPendingImageGenerationJobs = recoverPendingImageGenerationJobs;
router._resetImageGenerationQueueForTests = () => queuedImageBatchIds.clear();

module.exports = router;
