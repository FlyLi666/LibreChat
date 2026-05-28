import type { Document, Types } from 'mongoose';

export type GenerationTopicType = 'image' | 'video';
export type GenerationStatus = 'pending' | 'succeeded' | 'failed';

export interface IGenerationAsset {
  url: string;
  width?: number;
  height?: number;
  mimeType?: string;
}

export interface IGenerationTopic extends Document {
  userId: Types.ObjectId;
  title: string;
  coverUrl?: string;
  type: GenerationTopicType;
  tenantId?: string;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IGenerationBatch extends Document {
  userId: Types.ObjectId;
  topicId: Types.ObjectId;
  provider: string;
  model: string;
  prompt: string;
  params: Record<string, unknown>;
  tenantId?: string;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IGeneration extends Document {
  userId: Types.ObjectId;
  batchId: Types.ObjectId;
  asyncTaskId?: string;
  fileId?: string;
  seed?: number;
  status: GenerationStatus;
  error?: string;
  asset?: IGenerationAsset;
  tenantId?: string;
  deletedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IGenerationBatchWithGenerations extends IGenerationBatch {
  generations: IGeneration[];
}
