const { DEFAULT_INVITE_QUOTA, buildInviteDocs, createInviteQuotaCodes } = require('./InviteSeeder');

describe('InviteSeeder', () => {
  test('defaults new invite batches to the PRD launch quota', () => {
    expect(DEFAULT_INVITE_QUOTA).toBe(250000000);
  });

  test('binds one generated NewAPI redemption code to each invite code', async () => {
    const createRedemptionCodes = jest.fn().mockResolvedValue(['redeem-a', 'redeem-b']);

    const quotaCodes = await createInviteQuotaCodes({
      count: 2,
      note: 'launch',
      quota: DEFAULT_INVITE_QUOTA,
      createRedemptionCodes,
      timestamp: 1779939600000,
    });
    const docs = buildInviteDocs({
      codes: ['AAAABBBBCC', 'DDDDEEEEFF'],
      note: 'launch',
      tenantId: '',
      quotaCodes,
    });

    expect(createRedemptionCodes).toHaveBeenCalledWith({
      name: 'hezi_launch_17799396',
      quota: 250000000,
      count: 2,
    });
    expect(docs).toEqual([
      expect.objectContaining({ code: 'AAAABBBBCC', quotaCode: 'redeem-a' }),
      expect.objectContaining({ code: 'DDDDEEEEFF', quotaCode: 'redeem-b' }),
    ]);
  });
});
