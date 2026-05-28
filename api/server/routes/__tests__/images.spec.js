const express = require('express');
const request = require('supertest');

const mockDb = {
  createGenerationBatchWithGenerations: jest.fn(),
  createGenerationTopic: jest.fn(),
  deleteGeneration: jest.fn(),
  deleteGenerationBatch: jest.fn(),
  deleteGenerationTopic: jest.fn(),
  getUserKeyValues: jest.fn(),
  getGenerationTopic: jest.fn(),
  listGenerationBatches: jest.fn(),
  listPendingGenerationBatches: jest.fn(),
  listGenerationTopics: jest.fn(),
  markGenerationFailed: jest.fn(),
  markGenerationSucceeded: jest.fn(),
  updateGenerationTopic: jest.fn(),
};

const mockImageService = {
  getImageModel: jest.fn(),
  getImageModels: jest.fn(),
  getLiveImageModels: jest.fn(),
  runImageGeneration: jest.fn(),
};
const mockImageAssetStorage = {
  persistGeneratedImageAsset: jest.fn(),
};
const mockAppConfig = {
  fileStrategy: 'local',
  fileConfig: { imageGeneration: { px: 1024 } },
};

jest.mock('~/models', () => mockDb);

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => next(),
  configMiddleware: (req, _res, next) => {
    req.config = mockAppConfig;
    next();
  },
}));

jest.mock('~/server/services/hezi/ImageGenerationService', () => mockImageService);
jest.mock('~/server/services/hezi/ImageAssetStorage', () => mockImageAssetStorage);

function flushBackgroundJobs() {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('image generation routes', () => {
  let app;
  let imagesRouter;

  beforeAll(() => {
    imagesRouter = require('../images');

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: 'user-123' };
      next();
    });
    app.use('/api/images', imagesRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    imagesRouter._resetImageGenerationQueueForTests?.();
    mockImageService.getImageModel.mockImplementation((modelId) => {
      if (modelId === 'dall-e-3') {
        return {
          provider: 'openai',
          modelId: 'dall-e-3',
          disabled: false,
          paramSchemas: [
            { name: 'size', type: 'enum', default: '1024x1024', enum: ['1024x1024'] },
            { name: 'quality', type: 'enum', default: 'standard', enum: ['standard', 'hd'] },
            { name: 'imageNum', type: 'number', default: 1, min: 1, max: 1 },
          ],
        };
      }
      return {
        provider: 'openai',
        modelId: 'gpt-image-2',
        disabled: false,
        paramSchemas: [
          {
            name: 'imageUrls',
            type: 'images',
            default: [],
            maxCount: 1,
          },
          { name: 'size', type: 'enum', default: '1024x1024', enum: ['1024x1024'] },
          { name: 'quality', type: 'enum', default: 'standard', enum: ['standard', 'hd'] },
          { name: 'imageNum', type: 'number', default: 1, min: 1, max: 4 },
        ],
      };
    });
    mockImageService.getImageModels.mockReturnValue([
      { provider: 'openai', modelId: 'gpt-image-2', disabled: false },
    ]);
    mockImageService.getLiveImageModels.mockResolvedValue([
      { provider: 'openai', modelId: 'gpt-image-2', disabled: false },
    ]);
    mockImageAssetStorage.persistGeneratedImageAsset.mockImplementation(async ({ image }) => ({
      asset: image,
      fileId: undefined,
    }));
    mockDb.getGenerationTopic.mockResolvedValue({ _id: '507f1f77bcf86cd799439011' });
  });

  it('returns the configured image models', async () => {
    const response = await request(app).get('/api/images/models');

    expect(response.status).toBe(200);
    expect(response.body.models).toEqual([
      { provider: 'openai', modelId: 'gpt-image-2', disabled: false },
    ]);
    expect(mockImageService.getLiveImageModels).toHaveBeenCalledWith({
      userId: 'user-123',
      getUserKeyValues: mockDb.getUserKeyValues,
    });
  });

  it('creates a topic, returns pending generations, and completes in the background', async () => {
    mockDb.createGenerationTopic.mockResolvedValue({ _id: 'topic-1', title: '画一只穿宇航服的猫' });
    mockDb.createGenerationBatchWithGenerations.mockResolvedValue({
      batch: { _id: 'batch-1', prompt: '画一只穿宇航服的猫' },
      generations: [{ _id: 'generation-1', status: 'pending' }],
    });
    mockImageService.runImageGeneration.mockResolvedValue([
      { url: 'https://cdn.example.com/cat.png' },
    ]);
    mockDb.markGenerationSucceeded.mockResolvedValue({
      _id: 'generation-1',
      status: 'succeeded',
      asset: { url: 'https://cdn.example.com/cat.png' },
    });
    mockDb.updateGenerationTopic.mockResolvedValue({});

    const response = await request(app)
      .post('/api/images/generate')
      .send({
        model: 'gpt-image-2',
        prompt: '画一只穿宇航服的猫',
        params: { size: '1024x1024' },
        imageNum: 1,
      });

    expect(response.status).toBe(200);
    expect(mockDb.createGenerationTopic).toHaveBeenCalledWith({
      userId: 'user-123',
      title: '画一只穿宇航服的猫',
      type: 'image',
    });
    expect(mockDb.createGenerationBatchWithGenerations).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        topicId: 'topic-1',
        provider: 'openai',
        model: 'gpt-image-2',
        prompt: '画一只穿宇航服的猫',
      }),
    );
    expect(mockImageService.runImageGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        model: 'gpt-image-2',
        getUserKeyValues: mockDb.getUserKeyValues,
      }),
    );
    expect(response.body.batch.generations).toEqual([{ _id: 'generation-1', status: 'pending' }]);
    await flushBackgroundJobs();
    await flushBackgroundJobs();
    expect(mockImageAssetStorage.persistGeneratedImageAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        image: { url: 'https://cdn.example.com/cat.png' },
        generationId: 'generation-1',
      }),
    );
    expect(mockDb.markGenerationSucceeded).toHaveBeenCalledWith({
      userId: 'user-123',
      generationId: 'generation-1',
      asset: { url: 'https://cdn.example.com/cat.png' },
      fileId: undefined,
    });
  });

  it('returns pending generations before upstream image generation finishes', async () => {
    mockDb.createGenerationTopic.mockResolvedValue({ _id: 'topic-1', title: '画一只穿宇航服的猫' });
    mockDb.createGenerationBatchWithGenerations.mockResolvedValue({
      batch: { _id: 'batch-1', prompt: '画一只穿宇航服的猫' },
      generations: [{ _id: 'generation-1', status: 'pending' }],
    });
    let resolveImages;
    mockImageService.runImageGeneration.mockReturnValue(
      new Promise((resolve) => {
        resolveImages = resolve;
      }),
    );

    const responsePromise = request(app)
      .post('/api/images/generate')
      .send({
        model: 'gpt-image-2',
        prompt: '画一只穿宇航服的猫',
        params: { size: '1024x1024' },
        imageNum: 1,
      });

    const response = await Promise.race([
      responsePromise,
      new Promise((resolve) => setTimeout(() => resolve(null), 50)),
    ]);

    expect(response).not.toBeNull();
    expect(response.status).toBe(200);
    expect(response.body.batch.generations).toEqual([{ _id: 'generation-1', status: 'pending' }]);
    expect(mockDb.markGenerationSucceeded).not.toHaveBeenCalled();
    resolveImages([{ url: 'https://cdn.example.com/cat.png' }]);
    await flushBackgroundJobs();
    await flushBackgroundJobs();
  });

  it('keeps reference image URLs on the created batch and background generation request', async () => {
    mockDb.createGenerationTopic.mockResolvedValue({
      _id: 'topic-1',
      title: '保留参考图构图',
    });
    mockDb.createGenerationBatchWithGenerations.mockResolvedValue({
      batch: {
        _id: 'batch-1',
        prompt: '保留参考图构图',
        params: { imageUrls: ['/images/user-123/reference.png'] },
      },
      generations: [{ _id: 'generation-1', status: 'pending' }],
    });
    mockImageService.runImageGeneration.mockResolvedValue([
      { url: 'https://cdn.example.com/reference-result.png' },
    ]);

    const response = await request(app)
      .post('/api/images/generate')
      .send({
        model: 'gpt-image-2',
        prompt: '保留参考图构图',
        params: {
          size: '1024x1024',
          imageUrls: ['/images/user-123/reference.png'],
        },
        imageNum: 1,
      });

    expect(response.status).toBe(200);
    expect(mockDb.createGenerationBatchWithGenerations).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          size: '1024x1024',
          imageUrls: ['/images/user-123/reference.png'],
        },
      }),
    );
    await flushBackgroundJobs();
    expect(mockImageService.runImageGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          size: '1024x1024',
          imageUrls: ['/images/user-123/reference.png'],
        },
      }),
    );
  });

  it('marks rows failed in the background when image generation fails', async () => {
    mockDb.createGenerationBatchWithGenerations.mockResolvedValue({
      batch: { _id: 'batch-1', prompt: 'prompt' },
      generations: [{ _id: 'generation-1', status: 'pending' }],
    });
    mockImageService.runImageGeneration.mockRejectedValue(new Error('upstream timeout'));
    mockDb.markGenerationFailed.mockResolvedValue({
      _id: 'generation-1',
      status: 'failed',
      error: 'upstream timeout',
    });

    const response = await request(app).post('/api/images/generate').send({
      topicId: '507f1f77bcf86cd799439011',
      model: 'gpt-image-2',
      prompt: 'prompt',
    });

    expect(response.status).toBe(200);
    expect(response.body.batch.generations).toEqual([{ _id: 'generation-1', status: 'pending' }]);
    await flushBackgroundJobs();
    await flushBackgroundJobs();
    expect(mockDb.markGenerationFailed).toHaveBeenCalledWith({
      userId: 'user-123',
      generationId: 'generation-1',
      error: 'upstream timeout',
    });
  });

  it('persists base64 image assets before marking generations succeeded', async () => {
    mockDb.createGenerationBatchWithGenerations.mockResolvedValue({
      batch: { _id: 'batch-1', prompt: 'prompt' },
      generations: [{ _id: 'generation-1', status: 'pending' }],
    });
    mockImageService.runImageGeneration.mockResolvedValue([
      { b64: 'abc123', mimeType: 'image/png' },
    ]);
    mockImageAssetStorage.persistGeneratedImageAsset.mockResolvedValue({
      asset: { url: '/images/user-123/hezi-image-generation-1.png', mimeType: 'image/png' },
      fileId: 'file-1',
    });
    mockDb.markGenerationSucceeded.mockResolvedValue({
      _id: 'generation-1',
      status: 'succeeded',
    });

    const response = await request(app).post('/api/images/generate').send({
      topicId: '507f1f77bcf86cd799439011',
      model: 'gpt-image-2',
      prompt: 'prompt',
    });

    expect(response.status).toBe(200);
    await flushBackgroundJobs();
    await flushBackgroundJobs();
    expect(mockImageAssetStorage.persistGeneratedImageAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        req: expect.objectContaining({
          config: mockAppConfig,
        }),
        image: { b64: 'abc123', mimeType: 'image/png' },
        generationId: 'generation-1',
      }),
    );
    expect(mockDb.markGenerationSucceeded).toHaveBeenCalledWith({
      userId: 'user-123',
      generationId: 'generation-1',
      asset: { url: '/images/user-123/hezi-image-generation-1.png', mimeType: 'image/png' },
      fileId: 'file-1',
    });
  });

  it('rejects malformed topic ids before creating rows', async () => {
    const response = await request(app).post('/api/images/generate').send({
      topicId: 'not-an-object-id',
      model: 'gpt-image-2',
      prompt: 'prompt',
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'IMAGE_TOPIC_INVALID' });
    expect(mockDb.createGenerationBatchWithGenerations).not.toHaveBeenCalled();
  });

  it('rejects missing or foreign topics before creating rows', async () => {
    mockDb.getGenerationTopic.mockResolvedValue(null);

    const response = await request(app).post('/api/images/generate').send({
      topicId: '507f1f77bcf86cd799439011',
      model: 'gpt-image-2',
      prompt: 'prompt',
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'IMAGE_TOPIC_NOT_FOUND' });
    expect(mockDb.getGenerationTopic).toHaveBeenCalledWith({
      userId: 'user-123',
      topicId: '507f1f77bcf86cd799439011',
    });
    expect(mockDb.createGenerationBatchWithGenerations).not.toHaveBeenCalled();
  });

  it('rejects params that are not declared by the selected model schema', async () => {
    const response = await request(app)
      .post('/api/images/generate')
      .send({
        model: 'gpt-image-2',
        prompt: 'prompt',
        params: { size: '1024x1024', unsupported: true },
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'IMAGE_PARAM_INVALID',
      message: 'unsupported is not supported by gpt-image-2',
    });
    expect(mockDb.createGenerationBatchWithGenerations).not.toHaveBeenCalled();
  });

  it('rejects image counts above the selected model schema maximum before creating rows', async () => {
    const response = await request(app)
      .post('/api/images/generate')
      .send({
        model: 'gpt-image-2',
        prompt: 'prompt',
        params: { size: '1024x1024' },
        imageNum: 9,
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'IMAGE_PARAM_INVALID',
      message: 'imageNum must be between 1 and 4',
    });
    expect(mockDb.createGenerationBatchWithGenerations).not.toHaveBeenCalled();
  });

  it('rejects reference images for models that do not declare imageUrls support', async () => {
    const response = await request(app)
      .post('/api/images/generate')
      .send({
        model: 'dall-e-3',
        prompt: 'prompt',
        params: { size: '1024x1024', imageUrls: ['/images/user-123/reference.png'] },
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'IMAGE_PARAM_INVALID',
      message: 'imageUrls is not supported by dall-e-3',
    });
    expect(mockDb.createGenerationBatchWithGenerations).not.toHaveBeenCalled();
  });

  it('soft deletes a batch for the authenticated user', async () => {
    mockDb.deleteGenerationBatch.mockResolvedValue({});

    const response = await request(app).delete('/api/images/batches/batch-1');

    expect(response.status).toBe(204);
    expect(mockDb.deleteGenerationBatch).toHaveBeenCalledWith({
      userId: 'user-123',
      batchId: 'batch-1',
    });
  });

  it('recovers pending image batches for startup durable delivery', async () => {
    mockDb.listPendingGenerationBatches.mockResolvedValue([
      {
        _id: 'batch-pending',
        userId: 'user-123',
        topicId: 'topic-1',
        provider: 'openai',
        model: 'gpt-image-2',
        prompt: 'recover pending image',
        params: { size: '1024x1024' },
        generations: [{ _id: 'generation-1', status: 'pending' }],
      },
    ]);
    mockImageService.runImageGeneration.mockResolvedValue([
      { url: 'https://cdn.example.com/recovered.png' },
    ]);
    mockDb.markGenerationSucceeded.mockResolvedValue({
      _id: 'generation-1',
      status: 'succeeded',
      asset: { url: 'https://cdn.example.com/recovered.png' },
    });

    await imagesRouter.recoverPendingImageGenerationJobs({ appConfig: mockAppConfig });
    await flushBackgroundJobs();
    await flushBackgroundJobs();

    expect(mockDb.listPendingGenerationBatches).toHaveBeenCalledWith({ limit: 25 });
    expect(mockImageService.runImageGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        model: 'gpt-image-2',
        prompt: 'recover pending image',
        params: { size: '1024x1024' },
        imageNum: 1,
      }),
    );
    expect(mockDb.markGenerationSucceeded).toHaveBeenCalledWith({
      userId: 'user-123',
      generationId: 'generation-1',
      asset: { url: 'https://cdn.example.com/recovered.png' },
      fileId: undefined,
    });
  });
});
