import type { Model } from 'mongoose';
import type { IHeziProvisioningError } from '~/types/heziProvisioningError';

export interface CreateHeziProvisioningErrorParams {
  userId: string;
  step: string;
  error: string;
  retryCount: number;
}

export interface CountHeziProvisioningErrorsParams {
  userId: string;
  step: string;
}

export function createHeziProvisioningErrorMethods(mongoose: typeof import('mongoose')) {
  function getModel(): Model<IHeziProvisioningError> {
    return mongoose.models.HeziProvisioningError as Model<IHeziProvisioningError>;
  }

  async function createHeziProvisioningError(
    params: CreateHeziProvisioningErrorParams,
  ): Promise<IHeziProvisioningError> {
    const HeziProvisioningError = getModel();
    const record = await new HeziProvisioningError(params).save();
    return record.toObject();
  }

  async function countHeziProvisioningErrors({
    userId,
    step,
  }: CountHeziProvisioningErrorsParams): Promise<number> {
    const HeziProvisioningError = getModel();
    return HeziProvisioningError.countDocuments({ userId, step });
  }

  return {
    createHeziProvisioningError,
    countHeziProvisioningErrors,
  };
}

export type HeziProvisioningErrorMethods = ReturnType<typeof createHeziProvisioningErrorMethods>;
