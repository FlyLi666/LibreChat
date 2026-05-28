import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createGenerationMethods } from './generation';
import generationTopicSchema from '~/schema/generationTopic';
import generationBatchSchema from '~/schema/generationBatch';
import generationSchema from '~/schema/generation';
import type { IGeneration, IGenerationBatch, IGenerationTopic } from '~/types/generation';

let mongoServer: MongoMemoryServer;
let methods: ReturnType<typeof createGenerationMethods>;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  if (!mongoose.models.GenerationTopic) {
    mongoose.model<IGenerationTopic>('GenerationTopic', generationTopicSchema);
  }
  if (!mongoose.models.GenerationBatch) {
    mongoose.model<IGenerationBatch>('GenerationBatch', generationBatchSchema);
  }
  if (!mongoose.models.Generation) {
    mongoose.model<IGeneration>('Generation', generationSchema);
  }
  methods = createGenerationMethods(mongoose);
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('generation methods', () => {
  it('uses the PRD collection names', () => {
    expect(mongoose.models.GenerationTopic.collection.name).toBe('generationtopics');
    expect(mongoose.models.GenerationBatch.collection.name).toBe('generationbatches');
    expect(mongoose.models.Generation.collection.name).toBe('generations');
  });

  it('creates topics and lists only active topics for a user', async () => {
    const userId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    const topic = await methods.createGenerationTopic({
      userId,
      title: '宇航猫',
      type: 'image',
    });
    await methods.createGenerationTopic({ userId: otherUserId, title: '别人', type: 'image' });
    await methods.deleteGenerationTopic({ userId, topicId: topic._id });

    await methods.createGenerationTopic({
      userId,
      title: '水彩',
      type: 'image',
      coverUrl: '/images/u/cat.png',
    });

    const topics = await methods.listGenerationTopics({ userId });
    expect(topics).toHaveLength(1);
    expect(topics[0]).toMatchObject({
      title: '水彩',
      type: 'image',
      coverUrl: '/images/u/cat.png',
    });
    expect(topics[0].deletedAt).toBeFalsy();
  });

  it('creates a batch with pending generation rows and marks outcomes', async () => {
    const userId = new mongoose.Types.ObjectId();
    const topic = await methods.createGenerationTopic({ userId, title: '主题', type: 'image' });
    const batch = await methods.createGenerationBatchWithGenerations({
      userId,
      topicId: topic._id,
      provider: 'openai',
      model: 'gpt-image-2',
      prompt: '画一只穿宇航服的猫',
      params: { size: '1024x1024' },
      imageNum: 2,
    });

    expect(batch.generations).toHaveLength(2);
    expect(batch.batch).toMatchObject({
      provider: 'openai',
      model: 'gpt-image-2',
      prompt: '画一只穿宇航服的猫',
    });
    expect(batch.generations[0].status).toBe('pending');

    await methods.markGenerationSucceeded({
      userId,
      generationId: batch.generations[0]._id,
      asset: {
        url: '/images/user/cat.png',
        width: 1024,
        height: 1024,
        mimeType: 'image/png',
      },
      seed: 42,
      fileId: 'file-1',
    });
    await methods.markGenerationFailed({
      userId,
      generationId: batch.generations[1]._id,
      error: '当前模型暂不可用',
    });

    const batches = await methods.listGenerationBatches({ userId, topicId: topic._id });
    expect(batches).toHaveLength(1);
    expect(batches[0].generations).toHaveLength(2);
    expect(batches[0].generations[0]).toMatchObject({
      status: 'succeeded',
      seed: 42,
      fileId: 'file-1',
      asset: { url: '/images/user/cat.png', width: 1024, height: 1024 },
    });
    expect(batches[0].generations[1]).toMatchObject({
      status: 'failed',
      error: '当前模型暂不可用',
    });
  });

  it('soft deletes generations without returning them in batch feeds', async () => {
    const userId = new mongoose.Types.ObjectId();
    const topic = await methods.createGenerationTopic({ userId, title: '主题', type: 'image' });
    const batch = await methods.createGenerationBatchWithGenerations({
      userId,
      topicId: topic._id,
      provider: 'openai',
      model: 'gpt-image-2',
      prompt: 'prompt',
      params: {},
      imageNum: 1,
    });

    await methods.deleteGeneration({ userId, generationId: batch.generations[0]._id });

    const batches = await methods.listGenerationBatches({ userId, topicId: topic._id });
    expect(batches[0].generations).toHaveLength(0);
  });

  it('soft deletes batches without returning them in topic feeds', async () => {
    const userId = new mongoose.Types.ObjectId();
    const topic = await methods.createGenerationTopic({ userId, title: '主题', type: 'image' });
    const batch = await methods.createGenerationBatchWithGenerations({
      userId,
      topicId: topic._id,
      provider: 'openai',
      model: 'gpt-image-2',
      prompt: 'prompt',
      params: {},
      imageNum: 1,
    });

    await methods.deleteGenerationBatch({ userId, batchId: batch.batch._id });

    const batches = await methods.listGenerationBatches({ userId, topicId: topic._id });
    expect(batches).toHaveLength(0);
  });
});
