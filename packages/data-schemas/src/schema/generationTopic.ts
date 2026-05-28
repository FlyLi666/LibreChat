import { Schema } from 'mongoose';
import type { IGenerationTopic } from '~/types/generation';

const generationTopicSchema: Schema<IGenerationTopic> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    coverUrl: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['image', 'video'],
      required: true,
      default: 'image',
      index: true,
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

generationTopicSchema.index({ userId: 1, deletedAt: 1, updatedAt: -1 });

export default generationTopicSchema;
