import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createHeziProvisioningErrorMethods } from './heziProvisioningError';
import heziProvisioningErrorSchema from '~/schema/heziProvisioningError';
import type { IHeziProvisioningError } from '~/types/heziProvisioningError';

let mongoServer: MongoMemoryServer;
let methods: ReturnType<typeof createHeziProvisioningErrorMethods>;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  if (!mongoose.models.HeziProvisioningError) {
    mongoose.model<IHeziProvisioningError>('HeziProvisioningError', heziProvisioningErrorSchema);
  }
  methods = createHeziProvisioningErrorMethods(mongoose);
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('heziProvisioningError methods', () => {
  it('uses the PRD collection name', () => {
    expect(mongoose.models.HeziProvisioningError.collection.name).toBe('provisioning_errors');
  });

  it('creates records and counts retries per user and step', async () => {
    await methods.createHeziProvisioningError({
      userId: 'user1',
      step: 'login_fallback',
      error: 'NewAPI unavailable',
      retryCount: 1,
    });
    await methods.createHeziProvisioningError({
      userId: 'user1',
      step: 'login_fallback',
      error: 'NewAPI unavailable again',
      retryCount: 2,
    });
    await methods.createHeziProvisioningError({
      userId: 'user1',
      step: 'delete_cleanup',
      error: 'delete failed',
      retryCount: 1,
    });

    await expect(
      methods.countHeziProvisioningErrors({ userId: 'user1', step: 'login_fallback' }),
    ).resolves.toBe(2);
  });
});
