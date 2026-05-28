import generationSchema from '~/schema/generation';
import generationBatchSchema from '~/schema/generationBatch';
import generationTopicSchema from '~/schema/generationTopic';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import type { IGeneration, IGenerationBatch, IGenerationTopic } from '~/types/generation';

export function createGenerationTopicModel(mongoose: typeof import('mongoose')) {
  applyTenantIsolation(generationTopicSchema);
  return (
    mongoose.models.GenerationTopic ||
    mongoose.model<IGenerationTopic>('GenerationTopic', generationTopicSchema)
  );
}

export function createGenerationBatchModel(mongoose: typeof import('mongoose')) {
  applyTenantIsolation(generationBatchSchema);
  return (
    mongoose.models.GenerationBatch ||
    mongoose.model<IGenerationBatch>('GenerationBatch', generationBatchSchema)
  );
}

export function createGenerationModel(mongoose: typeof import('mongoose')) {
  applyTenantIsolation(generationSchema);
  return mongoose.models.Generation || mongoose.model<IGeneration>('Generation', generationSchema);
}
