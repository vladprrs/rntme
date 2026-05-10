import { describe, expect, it, mock } from 'bun:test';
import { provisionAuto } from '../../src/provisioner/admin-mode.js';

const baseConfig = {
  bucketName: 'b',
  region: 'us-east-1',
  appOrigins: ['https://app.example'],
  backend: 'aws-s3' as const,
};

const noopLog = mock();

describe('provisionAuto', () => {
  it('creates bucket when HeadBucket says 404', async () => {
    const s3 = {
      headBucket: mock().mockRejectedValue({ $metadata: { httpStatusCode: 404 } }),
      createBucket: mock().mockResolvedValue(undefined),
      putBucketCors: mock().mockResolvedValue(undefined),
      putBucketLifecycleConfiguration: mock().mockResolvedValue(undefined),
    };
    const iam = {
      createUser: mock().mockResolvedValue({ UserName: 'u' }),
      putUserPolicy: mock().mockResolvedValue(undefined),
      createAccessKey: mock().mockResolvedValue({
        AccessKey: { AccessKeyId: 'AKIA', SecretAccessKey: 'SK' },
      }),
    };
    const r = await provisionAuto({
      config: baseConfig,
      lifecycleRules: [],
      s3,
      iam,
      projectSlug: 'demo',
      env: 'prod',
      log: noopLog,
    });
    expect(r.ok).toBe(true);
    expect(s3.createBucket).toHaveBeenCalled();
    expect(s3.putBucketCors).toHaveBeenCalled();
  });

  it('skips CreateBucket when HeadBucket says 200', async () => {
    const s3 = {
      headBucket: mock().mockResolvedValue(undefined),
      createBucket: mock(),
      putBucketCors: mock().mockResolvedValue(undefined),
      putBucketLifecycleConfiguration: mock().mockResolvedValue(undefined),
    };
    const iam = {
      createUser: mock().mockResolvedValue({}),
      putUserPolicy: mock().mockResolvedValue(undefined),
      createAccessKey: mock().mockResolvedValue({
        AccessKey: { AccessKeyId: 'AKIA', SecretAccessKey: 'SK' },
      }),
    };
    await provisionAuto({
      config: baseConfig,
      lifecycleRules: [],
      s3,
      iam,
      projectSlug: 'demo',
      env: 'prod',
      log: noopLog,
    });
    expect(s3.createBucket).not.toHaveBeenCalled();
  });

  it('uses fallback credentials for R2 IAM step', async () => {
    const s3 = {
      headBucket: mock().mockResolvedValue(undefined),
      putBucketCors: mock().mockResolvedValue(undefined),
      putBucketLifecycleConfiguration: mock().mockResolvedValue(undefined),
    };
    const r = await provisionAuto({
      config: { ...baseConfig, backend: 'cloudflare-r2' },
      lifecycleRules: [],
      s3,
      iam: null,
      projectSlug: 'demo',
      env: 'prod',
      adminFallbackCredentials: { accessKeyId: 'A', secretAccessKey: 'S' },
      log: noopLog,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.scopedCredentials.accessKeyId).toBe('A');
  });
});
