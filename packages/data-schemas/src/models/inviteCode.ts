import inviteCodeSchema from '~/schema/inviteCode';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import type { IInviteCode } from '~/types/inviteCode';

export function createInviteCodeModel(mongoose: typeof import('mongoose')) {
  applyTenantIsolation(inviteCodeSchema);
  return (
    mongoose.models.InviteCode || mongoose.model<IInviteCode>('InviteCode', inviteCodeSchema)
  );
}
