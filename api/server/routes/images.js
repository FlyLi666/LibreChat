const express = require('express');
const { logger, isValidObjectIdString } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');
const db = require('~/models');
const {
  getImageModels,
  getImageModel,
  runImageGeneration,
} = require('~/server/services/hezi/ImageGenerationService');
const { persistGeneratedImageAsset } = require('~/server/services/hezi/ImageAssetStorage');

const router = express.Router();

router.use(requireJwtAuth);

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
  setImmediate(() => {
    runImageGenerationJob(params).catch((error) => {
      logger.error('[HeZiImageGeneration] background job failed', error);
    });
  });
}

router.get('/models', (_req, res) => {
  res.json({ models: getImageModels() });
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
  const params = req.body?.params && typeof req.body.params === 'object' ? req.body.params : {};
  const imageNum = Number(req.body?.imageNum || params.imageNum || 1);

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }
  if (!modelDef) {
    return res.status(400).json({ error: 'IMAGE_MODEL_NOT_FOUND' });
  }
  if (modelDef.disabled) {
    return res.status(400).json({ error: 'IMAGE_MODEL_DISABLED' });
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

module.exports = router;
