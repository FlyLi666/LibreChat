import type { Document, Types } from 'mongoose';

export interface IInviteCodeUsage {
  userId: Types.ObjectId;
  usedAt: Date;
}

export interface IInviteCode extends Document {
  /** Invite code string, uppercased on save, unique. */
  code: string;
  /** Admin user who created this code. */
  createdBy?: Types.ObjectId;
  /** Optional admin-only memo, e.g. "given to professor Zhang". */
  note?: string;
  /** Whether the code can still be used (soft-disable). */
  enabled: boolean;
  /** Max number of times this code can be redeemed. 0 = unlimited. Default 1. */
  maxUses: number;
  /** Current redemption count. */
  usedCount: number;
  /** History of redemptions. */
  usedBy: IInviteCodeUsage[];
  /**
   * Optional NewAPI redemption code that gets auto-redeemed for the user
   * after registration completes. If empty, no quota is auto-granted.
   */
  quotaCode?: string;
  /** Optional expiration timestamp. */
  expiresAt?: Date;
  /** Tenant scope, set automatically by tenantIsolation plugin. */
  tenantId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
