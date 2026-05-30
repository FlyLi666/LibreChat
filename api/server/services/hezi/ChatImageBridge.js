const { ContentTypes } = require('librechat-data-provider');
const { logger } = require('@librechat/data-schemas');
const db = require('~/models');
const { HEZI_ENDPOINT_NAME } = require('./HeziProvisioning');
const { runImageGeneration } = require('./ImageGenerationService');
const { persistGeneratedImageAsset } = require('./ImageAssetStorage');

const CHAT_IMAGE_MODEL = 'gpt-image-2';
const CHAT_IMAGE_PROVIDER = 'openai';
const DEFAULT_IMAGE_PARAMS = {
  size: '1024x1024',
  quality: 'standard',
};

const explicitImageTerms =
  /(生图|生成图片|生成一张图|生成一幅图|出图|画图|图片|照片|插画|海报|头像|壁纸|表情包|logo|绘制|画一|画个|draw|image|picture|photo|illustration|poster|avatar)/i;
const generatedConcreteObject =
  /(生成|做|创作|create|generate).{0,12}(一只|一张|一幅|一个|只|张|幅).{0,30}(猫|狗|人像|人物|角色|机器人|车|房子|花|风景|头像|海报|插画|壁纸|表情包|logo)/i;
const negativeTextTerms =
  /(代码|脚本|文案|文章|标题|摘要|计划|方案|列表|表格|邮件|报告|翻译|解释|总结|改写|code|script|copy|article|email|report|translate|summarize)/i;

function isHeziChatEndpoint(endpoint, req) {
  return (
    endpoint === HEZI_ENDPOINT_NAME ||
    req?.body?.endpoint === HEZI_ENDPOINT_NAME ||
    req?.body?.spec === 'hezi-default' ||
    req?.body?.modelSpec === 'hezi-default'
  );
}

function shouldRouteToImageGeneration(text) {
  const prompt = String(text || '').trim();
  if (!prompt) {
    return false;
  }
  if (negativeTextTerms.test(prompt) && !explicitImageTerms.test(prompt)) {
    return false;
  }
  return explicitImageTerms.test(prompt) || generatedConcreteObject.test(prompt);
}

function makeTopicTitle(prompt) {
  const trimmed = String(prompt || '').trim();
  return trimmed.length > 30 ? `${trimmed.slice(0, 30)}...` : trimmed || '聊天生图';
}

function buildImageContent({ asset, fileId, generationId }) {
  const textPart = {
    type: ContentTypes.TEXT,
    text: '已生成图片。',
  };

  if (fileId) {
    return [
      {
        type: ContentTypes.IMAGE_FILE,
        [ContentTypes.IMAGE_FILE]: {
          file_id: fileId,
          filename: `hezi-image-${generationId}.png`,
          filepath: asset.url,
          type: asset.mimeType || 'image/png',
          width: asset.width,
          height: asset.height,
        },
      },
      textPart,
    ];
  }

  return [
    {
      type: ContentTypes.IMAGE_URL,
      [ContentTypes.IMAGE_URL]: {
        url: asset.url,
      },
    },
    textPart,
  ];
}

async function createChatImageResponse({ endpoint, req, userId, prompt }) {
  if (!isHeziChatEndpoint(endpoint, req) || !shouldRouteToImageGeneration(prompt)) {
    return null;
  }

  let topic;
  let created;
  try {
    topic = await db.createGenerationTopic({
      userId,
      title: makeTopicTitle(prompt),
      type: 'image',
    });
    created = await db.createGenerationBatchWithGenerations({
      userId,
      topicId: topic._id,
      provider: CHAT_IMAGE_PROVIDER,
      model: CHAT_IMAGE_MODEL,
      prompt,
      params: DEFAULT_IMAGE_PARAMS,
      imageNum: 1,
    });

    const images = await runImageGeneration({
      userId,
      provider: CHAT_IMAGE_PROVIDER,
      model: CHAT_IMAGE_MODEL,
      prompt,
      params: DEFAULT_IMAGE_PARAMS,
      imageNum: 1,
      getUserKeyValues: db.getUserKeyValues,
    });
    const image = images[0];
    const generation = created.generations[0];
    const { asset, fileId } = await persistGeneratedImageAsset({
      req,
      image,
      generationId: generation._id,
    });
    const updated = await db.markGenerationSucceeded({
      userId,
      generationId: generation._id,
      asset,
      fileId,
    });
    if (asset?.url) {
      await db.updateGenerationTopic({ userId, topicId: topic._id, coverUrl: asset.url });
    }

    return {
      text: '已生成图片。',
      content: buildImageContent({
        asset,
        fileId,
        generationId: generation._id,
      }),
      metadata: {
        heziImageGeneration: {
          provider: CHAT_IMAGE_PROVIDER,
          model: CHAT_IMAGE_MODEL,
          topicId: String(topic._id),
          batchId: String(created.batch._id),
          generationId: String(generation._id),
          status: updated?.status || 'succeeded',
        },
      },
    };
  } catch (error) {
    logger.error('[HeZiChatImageBridge] chat image generation failed', error);
    if (created?.generations?.length) {
      await Promise.all(
        created.generations.map((generation) =>
          db.markGenerationFailed({
            userId,
            generationId: generation._id,
            error: error.message || '当前模型暂不可用',
          }),
        ),
      );
    }
    return {
      text: `图片生成失败：${error.message || '当前模型暂不可用'}`,
      content: [
        {
          type: ContentTypes.TEXT,
          text: `图片生成失败：${error.message || '当前模型暂不可用'}`,
        },
      ],
      metadata: {
        heziImageGeneration: {
          provider: CHAT_IMAGE_PROVIDER,
          model: CHAT_IMAGE_MODEL,
          status: 'failed',
        },
      },
    };
  }
}

module.exports = {
  createChatImageResponse,
  shouldRouteToImageGeneration,
};
