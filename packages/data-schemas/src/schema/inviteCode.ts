import { Schema } from 'mongoose';
import type { IInviteCode } from '~/types/inviteCode';

const inviteCodeUsageSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    usedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { _id: false },
);

const inviteCodeSchema: Schema<IInviteCode> = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 4,
      maxlength: 64,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    note: {
      type: String,
      trim: true,
    },
    enabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    maxUses: {
      type: Number,
      required: true,
      default: 1,
      min: 0,
    },
    usedCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    usedBy: {
      type: [inviteCodeUsageSchema],
      default: [],
    },
    quotaCode: {
      type: String,
      trim: true,
    },
    expiresAt: {
      type: Date,
    },
    tenantId: {
      type: String,
      index: true,
    },
  },
  { timestamps: true },
);

export default inviteCodeSchema;
