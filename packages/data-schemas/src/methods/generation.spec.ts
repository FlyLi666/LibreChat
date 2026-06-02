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

  it('marks pending generations as cancelled before hiding them', async () => {
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

    const deleted = await methods.deleteGeneration({ userId, generationId: batch.generations[0]._id });

    expect(deleted).toMatchObject({
      status: 'failed',
      error: '用户已取消',
    });
    expect(deleted?.deletedAt).toBeTruthy();
  });

  it('finds only active pending generations for background jobs', async () => {
    const userId = new mongoose.Types.ObjectId();
    const topic = await methods.createGenerationTopic({ userId, title: '主题', type: 'image' });
    const batch = await methods.createGenerationBatchWithGenerations({
      userId,
      topicId: topic._id,
      provider: 'openai',
      model: 'gpt-image-2',
      prompt: 'prompt',
      params: {},
      imageNum: 2,
    });
    await methods.markGenerationSucceeded({
      userId,
      generationId: batch.generations[1]._id,
      asset: { url: '/images/user/done.png' },
    });

    const active = await methods.getActivePendingGeneration({
      userId,
      generationId: batch.generations[0]._id,
    });
    const completed = await methods.getActivePendingGeneration({
      userId,
      generationId: batch.generations[1]._id,
    });

    expect(active?._id).toEqual(batch.generations[0]._id);
    expect(completed).toBeNull();
  });

  it('counts active pending generations for a user', async () => {
    const userId = new mongoose.Types.ObjectId();
    const topic = await methods.createGenerationTopic({ userId, title: '主题', type: 'image' });
    const batch = await methods.createGenerationBatchWithGenerations({
      userId,
      topicId: topic._id,
      provider: 'openai',
      model: 'gpt-image-2',
      prompt: 'prompt',
      params: {},
      imageNum: 3,
    });
    await methods.markGenerationFailed({
      userId,
      generationId: batch.generations[0]._id,
      error: 'failed',
    });

    await expect(methods.countPendingGenerationsForUser({ userId })).resolves.toBe(2);
  });

  it('marks stale pending generations failed before recovery', async () => {
    const userId = new mongoose.Types.ObjectId();
    const topic = await methods.createGenerationTopic({ userId, title: '主题', type: 'image' });
    const stale = await methods.createGenerationBatchWithGenerations({
      userId,
      topicId: topic._id,
      provider: 'openai',
      model: 'gpt-image-2',
      prompt: 'stale',
      params: {},
      imageNum: 1,
    });
    const fresh = await methods.createGenerationBatchWithGenerations({
      userId,
      topicId: topic._id,
      provider: 'openai',
      model: 'gpt-image-2',
      prompt: 'fresh',
      params: {},
      imageNum: 1,
    });
    await mongoose.models.Generation.collection.updateOne(
      { _id: stale.generations[0]._id },
      { $set: { createdAt: new Date('2026-05-30T00:00:00.000Z') } },
    );
    await mongoose.models.Generation.collection.updateOne(
      { _id: fresh.generations[0]._id },
      { $set: { createdAt: new Date('2026-05-30T00:10:00.000Z') } },
    );

    const result = await methods.markStalePendingGenerationsFailed({
      olderThan: new Date('2026-05-30T00:05:00.000Z'),
      error: '生成任务超时，请重试',
    });

    expect(result.modifiedCount).toBe(1);
    const batches = await methods.listGenerationBatches({ userId, topicId: topic._id });
    const staleGeneration = batches
      .flatMap((batch) => batch.generations)
      .find((generation) => String(generation._id) === String(stale.generations[0]._id));
    const freshGeneration = batches
      .flatMap((batch) => batch.generations)
      .find((generation) => String(generation._id) === String(fresh.generations[0]._id));
    expect(staleGeneration).toMatchObject({ status: 'failed', error: '生成任务超时，请重试' });
    expect(freshGeneration).toMatchObject({ status: 'pending' });
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

  it('lists active pending batches for startup recovery', async () => {
    const userId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    const topic = await methods.createGenerationTopic({ userId, title: '主题', type: 'image' });
    const otherTopic = await methods.createGenerationTopic({
      userId: otherUserId,
      title: '别人',
      type: 'image',
    });
    const pending = await methods.createGenerationBatchWithGenerations({
      userId,
      topicId: topic._id,
      provider: 'openai',
      model: 'gpt-image-2',
      prompt: 'pending prompt',
      params: { size: '1024x1024' },
      imageNum: 1,
    });
    await methods.createGenerationBatchWithGenerations({
      userId: otherUserId,
      topicId: otherTopic._id,
      provider: 'openai',
      model: 'gpt-image-2',
      prompt: 'other pending prompt',
      params: {},
      imageNum: 1,
    });
    const completed = await methods.createGenerationBatchWithGenerations({
      userId,
      topicId: topic._id,
      provider: 'openai',
      model: 'gpt-image-2',
      prompt: 'completed prompt',
      params: {},
      imageNum: 1,
    });
    await methods.markGenerationSucceeded({
      userId,
      generationId: completed.generations[0]._id,
      asset: { url: '/images/user/completed.png' },
    });
    const deleted = await methods.createGenerationBatchWithGenerations({
      userId,
      topicId: topic._id,
      provider: 'openai',
      model: 'gpt-image-2',
      prompt: 'deleted prompt',
      params: {},
      imageNum: 1,
    });
    await methods.deleteGenerationBatch({ userId, batchId: deleted.batch._id });

    const batches = await methods.listPendingGenerationBatches({ limit: 10 });

    expect(batches).toHaveLength(2);
    expect(batches.map((batch) => batch.prompt)).toEqual([
      'pending prompt',
      'other pending prompt',
    ]);
    expect(batches[0]).toMatchObject({
      _id: pending.batch._id,
      userId,
      topicId: topic._id,
      prompt: 'pending prompt',
      generations: [{ _id: pending.generations[0]._id, status: 'pending' }],
    });
  });
});
