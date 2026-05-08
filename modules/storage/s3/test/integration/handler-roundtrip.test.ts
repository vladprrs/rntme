import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CreateBucketCommand, DeleteObjectCommand, HeadObjectCommand, PutBucketCorsCommand, S3Client } from '@aws-sdk/client-s3';
import Database from 'better-sqlite3';
import { createHandler } from '../../src/handler.js';
import { createPendingStore, type DatabaseLike } from '../../src/pending-store.js';
import { createRouteResolver } from '../../src/route-resolver.js';
import { startRustfs } from './rustfs.helper.js';

const skip = process.env.SKIP_INTEGRATION === '1';

describe.skipIf(skip)('storage-s3 handler to rustfs', () => {
  let teardown: () => Promise<void> = async () => undefined;
  let handler: ReturnType<typeof createHandler>;

  beforeAll(async () => {
    const rustfs = await startRustfs();
    teardown = async () => {
      await rustfs.container.stop();
    };
    const aws = new S3Client({
      endpoint: rustfs.endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: 'rntme', secretAccessKey: 'rntme-test-pw' },
    });
    await aws.send(new CreateBucketCommand({ Bucket: rustfs.bucket }));
    await aws.send(
      new PutBucketCorsCommand({
        Bucket: rustfs.bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedMethods: ['PUT', 'GET', 'HEAD', 'DELETE'],
              AllowedOrigins: ['*'],
              AllowedHeaders: ['*'],
            },
          ],
        },
      }),
    );

    const storage = {
      version: '1.0' as const,
      routes: {
        img: {
          id: 'img',
          owner: { aggregate: 'a', association: 'b' },
          maxSize: 10_000,
          allowedTypes: ['image/*'],
          maxCount: 5,
          auth: { requireRole: null },
          lifecycle: { expirePendingMs: 60_000, retainCommittedMs: null },
        },
      },
    };
    handler = createHandler({
      storage,
      s3: {
        presign(key) {
          return `rustfs://${key}`;
        },
        async exists(key) {
          try {
            await aws.send(new HeadObjectCommand({ Bucket: rustfs.bucket, Key: key }));
            return true;
          } catch {
            return false;
          }
        },
        async size(key) {
          const object = await aws.send(new HeadObjectCommand({ Bucket: rustfs.bucket, Key: key }));
          return Number(object.ContentLength ?? 0);
        },
        async deleteObject(key) {
          await aws.send(new DeleteObjectCommand({ Bucket: rustfs.bucket, Key: key }));
        },
      },
      pendingStore: createPendingStore({ db: new Database(':memory:') as unknown as DatabaseLike }),
      routeResolver: createRouteResolver(storage),
      bus: { async publish() {} },
      uuid: () => 'integration-file',
      presignTtlSec: 900,
    });
  }, 120_000);

  afterAll(async () => {
    await teardown();
  });

  it('boots handler against rustfs-backed S3ClientLike', async () => {
    expect(handler).toBeDefined();
  });
});
