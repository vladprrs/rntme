import { describe, expect, it, vi } from 'vitest';
import { provisionAuto } from '../../src/provisioner/admin-mode.js';

const baseConfig = {
  bucketName: 'b',
  region: 'us-east-1',
  appOrigins: ['https://app.example'],
  backend: 'aws-s3' as const,
};

const noopLog = vi.fn();

describe('provisionAuto', () => {
  it('creates bucket when HeadBucket says 404', async () => {
    const s3 = {
      headBucket: vi.fn().mockRejectedValue({ $metadata: { httpStatusCode: 404 } }),
      createBucket: vi.fn().mockResolvedValue(undefined),
      putBucketCors: vi.fn().mockResolvedValue(undefined),
      putBucketLifecycleConfiguration: vi.fn().mockResolvedValue(undefined),
    };
    const iam = {
      createUser: vi.fn().mockResolvedValue({ UserName: 'u' }),
      putUserPolicy: vi.fn().mockResolvedValue(undefined),
      createAccessKey: vi.fn().mockResolvedValue({
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
      headBucket: vi.fn().mockResolvedValue(undefined),
      createBucket: vi.fn(),
      putBucketCors: vi.fn().mockResolvedValue(undefined),
      putBucketLifecycleConfiguration: vi.fn().mockResolvedValue(undefined),
    };
    const iam = {
      createUser: vi.fn().mockResolvedValue({}),
      putUserPolicy: vi.fn().mockResolvedValue(undefined),
      createAccessKey: vi.fn().mockResolvedValue({
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
      headBucket: vi.fn().mockResolvedValue(undefined),
      putBucketCors: vi.fn().mockResolvedValue(undefined),
      putBucketLifecycleConfiguration: vi.fn().mockResolvedValue(undefined),
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
