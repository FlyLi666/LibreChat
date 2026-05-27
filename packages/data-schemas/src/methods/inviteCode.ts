import type { Model, Types } from 'mongoose';
import type { IInviteCode } from '~/types/inviteCode';

export interface ValidateInviteCodeResult {
  ok: boolean;
  /** When ok=false, one of: not_found | disabled | exhausted | expired */
  reason?: 'not_found' | 'disabled' | 'exhausted' | 'expired';
  /** When ok=true, the underlying record (lean) so caller can use quotaCode etc. */
  record?: IInviteCode;
}

export function createInviteCodeMethods(mongoose: typeof import('mongoose')) {
  function getModel(): Model<IInviteCode> {
    return mongoose.models.InviteCode as Model<IInviteCode>;
  }

  /**
   * Look up by code (case-insensitive — schema uppercases on save).
   */
  async function findInviteCodeByCode(code: string): Promise<IInviteCode | null> {
    if (!code) return null;
    const InviteCode = getModel();
    return InviteCode.findOne({ code: code.trim().toUpperCase() }).lean<IInviteCode>();
  }

  /**
   * Validate a code without consuming it. Used at registration `before` step.
   */
  async function validateInviteCode(code: string): Promise<ValidateInviteCodeResult> {
    const record = await findInviteCodeByCode(code);
    if (!record) return { ok: false, reason: 'not_found' };
    if (!record.enabled) return { ok: false, reason: 'disabled' };
    if (record.expiresAt && record.expiresAt < new Date()) {
      return { ok: false, reason: 'expired' };
    }
    if (record.maxUses > 0 && record.usedCount >= record.maxUses) {
      return { ok: false, reason: 'exhausted' };
    }
    return { ok: true, record };
  }

  /**
   * Atomically consume a code: increments usedCount, pushes usedBy entry,
   * conditional on (enabled, not expired, usedCount < maxUses or unlimited).
   * Returns the updated doc on success; null if the conditional matched nothing
   * (someone else consumed it concurrently, or it was disabled in between).
   */
  async function consumeInviteCode(
    code: string,
    userId: Types.ObjectId | string,
  ): Promise<IInviteCode | null> {
    if (!code) return null;
    const InviteCode = getModel();
    const now = new Date();
    const normalized = code.trim().toUpperCase();

    // Build filter that enforces all preconditions atomically
    const filter: Record<string, unknown> = {
      code: normalized,
      enabled: true,
      $and: [
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: now } },
          ],
        },
        {
          $or: [
            { maxUses: 0 },
            { $expr: { $lt: ['$usedCount', '$maxUses'] } },
          ],
        },
      ],
    };

    const updated = await InviteCode.findOneAndUpdate(
      filter,
      {
        $inc: { usedCount: 1 },
        $push: { usedBy: { userId, usedAt: now } },
      },
      { new: true },
    ).lean<IInviteCode>();

    return updated;
  }

  /**
   * Admin-side: bulk seed a list of codes. Used by SQL/script to create the first
   * batch of 10 codes (each pre-bound to a NewAPI redemption code).
   * Skips duplicates silently (caller can diff before/after counts).
   */
  async function bulkUpsertInviteCodes(
    codes: Array<Pick<IInviteCode, 'code' | 'note' | 'quotaCode' | 'maxUses' | 'expiresAt'>>,
  ): Promise<{ inserted: number; skipped: number }> {
    if (!codes.length) return { inserted: 0, skipped: 0 };
    const InviteCode = getModel();
    const ops = codes.map((c) => ({
      updateOne: {
        filter: { code: c.code.trim().toUpperCase() },
        update: {
          $setOnInsert: {
            code: c.code.trim().toUpperCase(),
            note: c.note,
            quotaCode: c.quotaCode,
            maxUses: c.maxUses ?? 1,
            expiresAt: c.expiresAt,
            enabled: true,
            usedCount: 0,
            usedBy: [],
          },
        },
        upsert: true,
      },
    }));
    const res = await InviteCode.bulkWrite(ops, { ordered: false });
    return {
      inserted: res.upsertedCount ?? 0,
      skipped: codes.length - (res.upsertedCount ?? 0),
    };
  }

  return {
    findInviteCodeByCode,
    validateInviteCode,
    consumeInviteCode,
    bulkUpsertInviteCodes,
  };
}

export type InviteCodeMethods = ReturnType<typeof createInviteCodeMethods>;
