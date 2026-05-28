import heziProvisioningErrorSchema from '~/schema/heziProvisioningError';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import type { IHeziProvisioningError } from '~/types/heziProvisioningError';

export function createHeziProvisioningErrorModel(mongoose: typeof import('mongoose')) {
  applyTenantIsolation(heziProvisioningErrorSchema);
  return (
    mongoose.models.HeziProvisioningError ||
    mongoose.model<IHeziProvisioningError>('HeziProvisioningError', heziProvisioningErrorSchema)
  );
}
