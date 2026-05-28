import type { Document } from 'mongoose';

export interface IHeziProvisioningError extends Document {
  userId: string;
  step: string;
  error: string;
  retryCount: number;
  tenantId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
