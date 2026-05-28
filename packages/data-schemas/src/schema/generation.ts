import { Schema } from 'mongoose';
import type { IGeneration } from '~/types/generation';

const generationAssetSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
    },
    width: Number,
    height: Number,
    mimeType: {
      type: String,
      default: 'image/png',
    },
  },
  { _id: false },
);

const generationSchema: Schema<IGeneration> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: 'GenerationBatch',
      required: true,
      index: true,
    },
    asyncTaskId: {
      type: String,
      trim: true,
    },
    fileId: {
      type: String,
      trim: true,
    },
    seed: Number,
    status: {
      type: String,
      enum: ['pending', 'succeeded', 'failed'],
      required: true,
      default: 'pending',
      index: true,
    },
    error: {
      type: String,
      maxlength: 2048,
    },
    asset: generationAssetSchema,
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

generationSchema.index({ userId: 1, batchId: 1, deletedAt: 1, createdAt: 1 });

export default generationSchema;
