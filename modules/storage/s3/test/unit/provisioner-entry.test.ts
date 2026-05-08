import { describe, expect, it, vi } from 'vitest';
import { storageS3Provisioner } from '../../src/provisioner/index.js';

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: vi.fn().mockResolvedValue(undefined) })),
  HeadBucketCommand: vi.fn(),
  CreateBucketCommand: vi.fn(),
  PutBucketCorsCommand: vi.fn(),
  PutBucketLifecycleConfigurationCommand: vi.fn(),
  PutObjectCommand: vi.fn(),
  HeadObjectCommand: vi.fn(),
  DeleteObjectCommand: vi.fn(),
}));

vi.mock('@aws-sdk/client-iam', () => ({
  IAMClient: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({ AccessKey: { AccessKeyId: 'AKIA', SecretAccessKey: 'SK' } }),
  })),
  CreateUserCommand: vi.fn(),
  PutUserPolicyCommand: vi.fn(),
  CreateAccessKeyCommand: vi.fn(),
}));

describe('storageS3Provisioner', () => {
  const baseInput = {
    publicConfig: {
      bucketName: 'b',
      region: 'us-east-1',
      appOrigins: ['https://example'],
      backend: 'aws-s3' as const,
    },
    log: () => undefined,
    signal: new AbortController().signal,
  };

  it('returns STORAGE_PROVISIONER_VALIDATION_FAILED when no creds at all', async () => {
    const r = await storageS3Provisioner.provision({ ...baseInput, targetSecrets: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].code).toBe('STORAGE_PROVISIONER_VALIDATION_FAILED');
  });

  it('selects auto-mode when s3Admin is supplied', async () => {
    const r = await storageS3Provisioner.provision({
      ...baseInput,
      targetSecrets: { s3Admin: { accessKeyId: 'A', secretAccessKey: 'S' } },
    });
    expect(r.ok).toBe(true);
  });

  it('selects manual-mode when s3Scoped is supplied without s3Admin', async () => {
    const r = await storageS3Provisioner.provision({
      ...baseInput,
      targetSecrets: { s3Scoped: { accessKeyId: 'A', secretAccessKey: 'S' } },
    });
    expect(r.ok).toBe(true);
  });
});
