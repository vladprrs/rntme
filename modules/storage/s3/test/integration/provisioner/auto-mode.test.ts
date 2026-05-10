import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { storageS3Provisioner } from '../../../src/provisioner/index.js';
import { startMinio } from './minio.helper.js';

const skip = process.env.SKIP_INTEGRATION === '1';

describe.skipIf(skip)('provisioner auto-mode against MinIO', () => {
  let teardown: () => Promise<void> = async () => undefined;
  let endpoint = '';
  let creds = { accessKeyId: '', secretAccessKey: '' };

  beforeAll(async () => {
    const minio = await startMinio();
    teardown = async () => {
      await minio.container.stop();
    };
    endpoint = minio.endpoint;
    creds = { accessKeyId: minio.rootUser, secretAccessKey: minio.rootPassword };
  }, 120_000);

  afterAll(async () => {
    await teardown();
  });

  it('reconciles bucket, CORS, lifecycle, and returns scoped credentials', async () => {
    const result = await storageS3Provisioner.provision({
      publicConfig: {
        bucketName: 'rntme-s3-test',
        region: 'us-east-1',
        appOrigins: ['https://app.example'],
        endpoint,
        forcePathStyle: true,
        backend: 'minio',
      },
      targetSecrets: { s3Admin: creds, projectSlug: 'demo', env: 'test' },
      serviceArtifacts: {},
      log: () => undefined,
      signal: new globalThis.AbortController().signal,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.secretOutputs.scopedCredentials).toEqual(creds);
      expect(result.value.publicOutputs.bucketName).toBe('rntme-s3-test');
    }
  });
});
