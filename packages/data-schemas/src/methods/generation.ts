import type { Model, Types } from 'mongoose';
import type {
  IGeneration,
  IGenerationAsset,
  IGenerationBatch,
  IGenerationBatchWithGenerations,
  IGenerationTopic,
  GenerationTopicType,
} from '~/types/generation';

type ObjectIdLike = Types.ObjectId | string;

export interface CreateGenerationTopicParams {
  userId: ObjectIdLike;
  title: string;
  type?: GenerationTopicType;
  coverUrl?: string;
}

export interface ListGenerationTopicsParams {
  userId: ObjectIdLike;
}

export interface CreateGenerationBatchParams {
  userId: ObjectIdLike;
  topicId: ObjectIdLike;
  provider: string;
  model: string;
  prompt: string;
  params?: Record<string, unknown>;
  imageNum?: number;
}

export interface MarkGenerationSucceededParams {
  userId: ObjectIdLike;
  generationId: ObjectIdLike;
  asset: IGenerationAsset;
  seed?: number;
  fileId?: string;
}

export function createGenerationMethods(mongoose: typeof import('mongoose')) {
  function topics(): Model<IGenerationTopic> {
    return mongoose.models.GenerationTopic as Model<IGenerationTopic>;
  }

  function batches(): Model<IGenerationBatch> {
    return mongoose.models.GenerationBatch as Model<IGenerationBatch>;
  }

  function generations(): Model<IGeneration> {
    return mongoose.models.Generation as Model<IGeneration>;
  }

  async function createGenerationTopic({
    userId,
    title,
    type = 'image',
    coverUrl,
  }: CreateGenerationTopicParams): Promise<IGenerationTopic> {
    const doc = await new (topics())({ userId, title, type, coverUrl }).save();
    return doc.toObject();
  }

  async function listGenerationTopics({
    userId,
  }: ListGenerationTopicsParams): Promise<IGenerationTopic[]> {
    return topics()
      .find({ userId, deletedAt: { $exists: false } })
      .sort({ updatedAt: -1, _id: -1 })
      .lean<IGenerationTopic[]>();
  }

  async function updateGenerationTopic(params: {
    userId: ObjectIdLike;
    topicId: ObjectIdLike;
    title?: string;
    coverUrl?: string;
  }): Promise<IGenerationTopic | null> {
    const { userId, topicId, title, coverUrl } = params;
    const $set: Record<string, unknown> = {};
    if (title != null) {
      $set.title = title;
    }
    if (coverUrl != null) {
      $set.coverUrl = coverUrl;
    }
    if (Object.keys($set).length === 0) {
      return topics().findOne({ _id: topicId, userId }).lean<IGenerationTopic>();
    }
    return topics()
      .findOneAndUpdate(
        { _id: topicId, userId, deletedAt: { $exists: false } },
        { $set },
        { new: true },
      )
      .lean<IGenerationTopic>();
  }

  async function getGenerationTopic({
    userId,
    topicId,
  }: {
    userId: ObjectIdLike;
    topicId: ObjectIdLike;
  }): Promise<IGenerationTopic | null> {
    return topics()
      .findOne({ _id: topicId, userId, deletedAt: { $exists: false } })
      .lean<IGenerationTopic>();
  }

  async function deleteGenerationTopic({
    userId,
    topicId,
  }: {
    userId: ObjectIdLike;
    topicId: ObjectIdLike;
  }): Promise<IGenerationTopic | null> {
    return topics()
      .findOneAndUpdate(
        { _id: topicId, userId, deletedAt: { $exists: false } },
        { $set: { deletedAt: new Date() } },
        { new: true },
      )
      .lean<IGenerationTopic>();
  }

  async function createGenerationBatchWithGenerations({
    userId,
    topicId,
    provider,
    model,
    prompt,
    params = {},
    imageNum = 1,
  }: CreateGenerationBatchParams): Promise<{
    batch: IGenerationBatch;
    generations: IGeneration[];
  }> {
    const batchDoc = await new (batches())({
      userId,
      topicId,
      provider,
      model,
      prompt,
      params,
    }).save();
    const count = Math.min(Math.max(Number(imageNum) || 1, 1), 4);
    const rows = await generations().insertMany(
      Array.from({ length: count }, () => ({
        userId,
        batchId: batchDoc._id,
        status: 'pending',
      })),
    );
    return {
      batch: batchDoc.toObject(),
      generations: rows.map((row) => row.toObject()),
    };
  }

  async function listGenerationBatches({
    userId,
    topicId,
  }: {
    userId: ObjectIdLike;
    topicId: ObjectIdLike;
  }): Promise<IGenerationBatchWithGenerations[]> {
    const batchRows = await batches()
      .find({ userId, topicId, deletedAt: { $exists: false } })
      .sort({ createdAt: -1, _id: -1 })
      .lean<IGenerationBatch[]>();

    const generationRows = await generations()
      .find({
        userId,
        batchId: { $in: batchRows.map((batch) => batch._id) },
        deletedAt: { $exists: false },
      })
      .sort({ createdAt: 1, _id: 1 })
      .lean<IGeneration[]>();

    const byBatch = new Map<string, IGeneration[]>();
    for (const generation of generationRows) {
      const key = String(generation.batchId);
      byBatch.set(key, [...(byBatch.get(key) ?? []), generation]);
    }

    return batchRows.map((batch) => ({
      ...batch,
      generations: byBatch.get(String(batch._id)) ?? [],
    })) as IGenerationBatchWithGenerations[];
  }

  async function listPendingGenerationBatches({
    limit = 25,
  }: {
    limit?: number;
  } = {}): Promise<IGenerationBatchWithGenerations[]> {
    const batchLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const generationRows = await generations()
      .find({ status: 'pending', deletedAt: { $exists: false } })
      .sort({ createdAt: 1, _id: 1 })
      .limit(batchLimit * 4)
      .lean<IGeneration[]>();

    const generationsByBatch = new Map<string, IGeneration[]>();
    const batchIds: ObjectIdLike[] = [];
    for (const generation of generationRows) {
      const key = String(generation.batchId);
      if (!generationsByBatch.has(key)) {
        generationsByBatch.set(key, []);
        batchIds.push(generation.batchId);
      }
      generationsByBatch.get(key)?.push(generation);
    }
    if (batchIds.length === 0) {
      return [];
    }

    const batchRows = await batches()
      .find({ _id: { $in: batchIds }, deletedAt: { $exists: false } })
      .lean<IGenerationBatch[]>();
    const batchById = new Map(batchRows.map((batch) => [String(batch._id), batch]));

    return batchIds
      .map((batchId) => {
        const batch = batchById.get(String(batchId));
        if (!batch) {
          return null;
        }
        return {
          ...batch,
          generations: generationsByBatch.get(String(batchId)) ?? [],
        };
      })
      .filter(Boolean)
      .slice(0, batchLimit) as IGenerationBatchWithGenerations[];
  }

  async function markGenerationSucceeded({
    userId,
    generationId,
    asset,
    seed,
    fileId,
  }: MarkGenerationSucceededParams): Promise<IGeneration | null> {
    return generations()
      .findOneAndUpdate(
        { _id: generationId, userId, deletedAt: { $exists: false } },
        {
          $set: {
            status: 'succeeded',
            asset,
            seed,
            fileId,
          },
          $unset: { error: '' },
        },
        { new: true },
      )
      .lean<IGeneration>();
  }

  async function markGenerationFailed({
    userId,
    generationId,
    error,
  }: {
    userId: ObjectIdLike;
    generationId: ObjectIdLike;
    error: string;
  }): Promise<IGeneration | null> {
    return generations()
      .findOneAndUpdate(
        { _id: generationId, userId, deletedAt: { $exists: false } },
        { $set: { status: 'failed', error: error.slice(0, 2048) } },
        { new: true },
      )
      .lean<IGeneration>();
  }

  async function deleteGenerationBatch({
    userId,
    batchId,
  }: {
    userId: ObjectIdLike;
    batchId: ObjectIdLike;
  }): Promise<IGenerationBatch | null> {
    return batches()
      .findOneAndUpdate(
        { _id: batchId, userId, deletedAt: { $exists: false } },
        { $set: { deletedAt: new Date() } },
        { new: true },
      )
      .lean<IGenerationBatch>();
  }

  async function deleteGeneration({
    userId,
    generationId,
  }: {
    userId: ObjectIdLike;
    generationId: ObjectIdLike;
  }): Promise<IGeneration | null> {
    return generations()
      .findOneAndUpdate(
        { _id: generationId, userId, deletedAt: { $exists: false } },
        { $set: { deletedAt: new Date() } },
        { new: true },
      )
      .lean<IGeneration>();
  }

  return {
    createGenerationTopic,
    listGenerationTopics,
    updateGenerationTopic,
    getGenerationTopic,
    deleteGenerationTopic,
    createGenerationBatchWithGenerations,
    listGenerationBatches,
    listPendingGenerationBatches,
    markGenerationSucceeded,
    markGenerationFailed,
    deleteGenerationBatch,
    deleteGeneration,
  };
}

export type GenerationMethods = ReturnType<typeof createGenerationMethods>;
