import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createInviteCodeMethods } from './inviteCode';
import inviteCodeSchema from '~/schema/inviteCode';
import type { IInviteCode } from '~/types/inviteCode';

let mongoServer: MongoMemoryServer;
let InviteCode: mongoose.Model<IInviteCode>;
let methods: ReturnType<typeof createInviteCodeMethods>;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  InviteCode =
    (mongoose.models.InviteCode as mongoose.Model<IInviteCode>) ||
    mongoose.model<IInviteCode>('InviteCode', inviteCodeSchema);
  methods = createInviteCodeMethods(mongoose);
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('inviteCode methods', () => {
  describe('validateInviteCode (read-only)', () => {
    it('returns not_found for unknown code', async () => {
      const r = await methods.validateInviteCode('NOPE12');
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('not_found');
    });

    it('returns disabled when enabled=false', async () => {
      await InviteCode.create({ code: 'OFF12345', enabled: false });
      const r = await methods.validateInviteCode('OFF12345');
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('disabled');
    });

    it('returns expired when expiresAt is past', async () => {
      await InviteCode.create({
        code: 'EXP12345',
        expiresAt: new Date(Date.now() - 60_000),
      });
      const r = await methods.validateInviteCode('EXP12345');
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('expired');
    });

    it('returns exhausted when usedCount >= maxUses', async () => {
      await InviteCode.create({
        code: 'EXH12345',
        maxUses: 1,
        usedCount: 1,
      });
      const r = await methods.validateInviteCode('EXH12345');
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('exhausted');
    });

    it('returns ok with record for valid code', async () => {
      await InviteCode.create({
        code: 'GOOD1234',
        maxUses: 1,
        quotaCode: 'NEWAPI-Q-001',
      });
      const r = await methods.validateInviteCode('GOOD1234');
      expect(r.ok).toBe(true);
      expect(r.record?.code).toBe('GOOD1234');
      expect(r.record?.quotaCode).toBe('NEWAPI-Q-001');
    });

    it('is case-insensitive (uppercases on lookup, schema stores upper)', async () => {
      await InviteCode.create({ code: 'CASETEST' });
      const r = await methods.validateInviteCode('  casetest  ');
      expect(r.ok).toBe(true);
    });
  });

  describe('consumeInviteCode (atomic)', () => {
    it('increments usedCount and pushes usedBy entry', async () => {
      await InviteCode.create({ code: 'CON12345', maxUses: 1 });
      const userId = new mongoose.Types.ObjectId();
      const updated = await methods.consumeInviteCode('CON12345', userId);
      expect(updated).not.toBeNull();
      expect(updated!.usedCount).toBe(1);
      expect(updated!.usedBy).toHaveLength(1);
      expect(String(updated!.usedBy[0].userId)).toBe(String(userId));
    });

    it('returns null when code is exhausted', async () => {
      await InviteCode.create({
        code: 'EXH12345',
        maxUses: 1,
        usedCount: 1,
      });
      const r = await methods.consumeInviteCode('EXH12345', new mongoose.Types.ObjectId());
      expect(r).toBeNull();
    });

    it('returns null when code is disabled', async () => {
      await InviteCode.create({ code: 'OFF12345', enabled: false });
      const r = await methods.consumeInviteCode('OFF12345', new mongoose.Types.ObjectId());
      expect(r).toBeNull();
    });

    it('returns null when code is expired', async () => {
      await InviteCode.create({
        code: 'EXP12345',
        expiresAt: new Date(Date.now() - 1000),
      });
      const r = await methods.consumeInviteCode('EXP12345', new mongoose.Types.ObjectId());
      expect(r).toBeNull();
    });

    it('treats maxUses=0 as unlimited', async () => {
      await InviteCode.create({ code: 'UNLIMITD', maxUses: 0, usedCount: 99 });
      const r = await methods.consumeInviteCode('UNLIMITD', new mongoose.Types.ObjectId());
      expect(r).not.toBeNull();
      expect(r!.usedCount).toBe(100);
    });

    it('race: only ONE of N concurrent consumers wins for maxUses=1', async () => {
      await InviteCode.create({ code: 'RACECODE', maxUses: 1 });
      const consumers = Array.from({ length: 8 }, () =>
        methods.consumeInviteCode('RACECODE', new mongoose.Types.ObjectId()),
      );
      const results = await Promise.all(consumers);
      const wins = results.filter((r) => r !== null);
      const losses = results.filter((r) => r === null);
      expect(wins).toHaveLength(1);
      expect(losses).toHaveLength(7);

      const final = await InviteCode.findOne({ code: 'RACECODE' }).lean();
      expect(final?.usedCount).toBe(1);
      expect(final?.usedBy).toHaveLength(1);
    });

    it('race: exactly maxUses winners for maxUses=3 across 10 consumers', async () => {
      await InviteCode.create({ code: 'RACECOD3', maxUses: 3 });
      const consumers = Array.from({ length: 10 }, () =>
        methods.consumeInviteCode('RACECOD3', new mongoose.Types.ObjectId()),
      );
      const results = await Promise.all(consumers);
      const wins = results.filter((r) => r !== null);
      expect(wins.length).toBe(3);

      const final = await InviteCode.findOne({ code: 'RACECOD3' }).lean();
      expect(final?.usedCount).toBe(3);
      expect(final?.usedBy).toHaveLength(3);
    });
  });

  describe('bulkUpsertInviteCodes', () => {
    it('inserts new codes and is idempotent on re-run', async () => {
      const r1 = await methods.bulkUpsertInviteCodes([
        { code: 'BULK0001', maxUses: 1, quotaCode: 'Q1' } as IInviteCode,
        { code: 'BULK0002', maxUses: 1 } as IInviteCode,
      ]);
      expect(r1.inserted).toBe(2);

      const r2 = await methods.bulkUpsertInviteCodes([
        { code: 'BULK0001', maxUses: 1, quotaCode: 'Q1' } as IInviteCode,
        { code: 'BULK0003', maxUses: 1 } as IInviteCode,
      ]);
      expect(r2.inserted).toBe(1);
      const all = await InviteCode.find({}).lean();
      expect(all).toHaveLength(3);
    });

    it('does not overwrite existing usedCount/quotaCode on re-upsert', async () => {
      await methods.bulkUpsertInviteCodes([
        { code: 'NOTOUCH1', maxUses: 5, quotaCode: 'OLD' } as IInviteCode,
      ]);
      // Simulate one consumption
      await methods.consumeInviteCode('NOTOUCH1', new mongoose.Types.ObjectId());

      // Re-seed should NOT reset usedCount or change quotaCode
      await methods.bulkUpsertInviteCodes([
        { code: 'NOTOUCH1', maxUses: 5, quotaCode: 'NEW' } as IInviteCode,
      ]);
      const after = await InviteCode.findOne({ code: 'NOTOUCH1' }).lean();
      expect(after?.usedCount).toBe(1);
      expect(after?.quotaCode).toBe('OLD');
    });
  });
});
