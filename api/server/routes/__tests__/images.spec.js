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
  listGenerationTopics: jest.fn(),
  markGenerationFailed: jest.fn(),
  markGenerationSucceeded: jest.fn(),
  updateGenerationTopic: jest.fn(),
};

const mockImageService = {
  getImageModel: jest.fn(),
  getImageModels: jest.fn(),
  runImageGeneration: jest.fn(),
};

jest.mock('~/models', () => mockDb);

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => next(),
}));

jest.mock('~/server/services/hezi/ImageGenerationService', () => mockImageService);

describe('image generation routes', () => {
  let app;

  beforeAll(() => {
    const imagesRouter = require('../images');

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
    mockImageService.getImageModel.mockReturnValue({
      provider: 'openai',
      modelId: 'gpt-image-2',
      disabled: false,
    });
    mockImageService.getImageModels.mockReturnValue([
      { provider: 'openai', modelId: 'gpt-image-2', disabled: false },
    ]);
    mockDb.getGenerationTopic.mockResolvedValue({ _id: '507f1f77bcf86cd799439011' });
  });

  it('returns the configured image models', async () => {
    const response = await request(app).get('/api/images/models');

    expect(response.status).toBe(200);
    expect(response.body.models).toEqual([
      { provider: 'openai', modelId: 'gpt-image-2', disabled: false },
    ]);
    expect(mockImageService.getImageModels).toHaveBeenCalledTimes(1);
  });

  it('creates a topic and returns succeeded generations', async () => {
    mockDb.createGenerationTopic.mockResolvedValue({ _id: 'topic-1', title: '画一只穿宇航服的猫' });
    mockDb.createGenerationBatchWithGenerations.mockResolvedValue({
      batch: { _id: 'batch-1', prompt: '画一只穿宇航服的猫' },
      generations: [{ _id: 'generation-1' }],
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
    expect(response.body.batch.generations).toEqual([
      {
        _id: 'generation-1',
        status: 'succeeded',
        asset: { url: 'https://cdn.example.com/cat.png' },
      },
    ]);
  });

  it('marks rows failed when image generation fails', async () => {
    mockDb.createGenerationBatchWithGenerations.mockResolvedValue({
      batch: { _id: 'batch-1', prompt: 'prompt' },
      generations: [{ _id: 'generation-1' }],
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

    expect(response.status).toBe(502);
    expect(mockDb.markGenerationFailed).toHaveBeenCalledWith({
      userId: 'user-123',
      generationId: 'generation-1',
      error: 'upstream timeout',
    });
    expect(response.body.error).toBe('当前模型暂不可用，请换一个');
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

  it('soft deletes a batch for the authenticated user', async () => {
    mockDb.deleteGenerationBatch.mockResolvedValue({});

    const response = await request(app).delete('/api/images/batches/batch-1');

    expect(response.status).toBe(204);
    expect(mockDb.deleteGenerationBatch).toHaveBeenCalledWith({
      userId: 'user-123',
      batchId: 'batch-1',
    });
  });
});
