import { Schema } from 'mongoose';
import type { IGenerationBatch } from '~/types/generation';

const generationBatchSchema: Schema<IGenerationBatch> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    topicId: {
      type: Schema.Types.ObjectId,
      ref: 'GenerationTopic',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    model: {
      type: String,
      required: true,
      trim: true,
    },
    prompt: {
      type: String,
      required: true,
      trim: true,
      maxlength: 8000,
    },
    params: {
      type: Schema.Types.Mixed,
      default: {},
    },
    tenantId: {
      type: String,
      index: true,
    },
    deletedAt: {
      type: Date,
      index: true,
    },
  },
  { timestamps: true },
);

generationBatchSchema.index({ userId: 1, topicId: 1, deletedAt: 1, createdAt: -1 });

export default generationBatchSchema;
