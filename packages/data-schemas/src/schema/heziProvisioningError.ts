import { Schema } from 'mongoose';
import type { IHeziProvisioningError } from '~/types/heziProvisioningError';

const heziProvisioningErrorSchema: Schema<IHeziProvisioningError> = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    step: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    error: {
      type: String,
      required: true,
      maxlength: 2048,
    },
    retryCount: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    tenantId: {
      type: String,
      index: true,
    },
  },
  { timestamps: true, collection: 'provisioning_errors' },
);

heziProvisioningErrorSchema.index({ userId: 1, step: 1, createdAt: -1 });

export default heziProvisioningErrorSchema;
