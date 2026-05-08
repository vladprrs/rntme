import { describe, expect, it, vi } from 'vitest';
import { provisionManual } from '../../src/provisioner/manual-mode.js';

const config = {
  bucketName: 'b',
  region: 'us-east-1',
  appOrigins: ['x'],
  backend: 'aws-s3' as const,
};

describe('provisionManual', () => {
  it('passes when smoke write/read/delete all succeed', async () => {
    const s3 = {
      headBucket: vi.fn().mockResolvedValue(undefined),
      putObject: vi.fn().mockResolvedValue(undefined),
      headObject: vi.fn().mockResolvedValue(undefined),
      deleteObject: vi.fn().mockResolvedValue(undefined),
    };
    const r = await provisionManual({
      s3,
      config,
      scopedCredentials: { accessKeyId: 'a', secretAccessKey: 's' },
      log: vi.fn(),
    });
    expect(r.ok).toBe(true);
  });

  it('STORAGE_PROVISIONER_VALIDATION_FAILED when HeadBucket 403', async () => {
    const s3 = {
      headBucket: vi.fn().mockRejectedValue({ $metadata: { httpStatusCode: 403 } }),
      putObject: vi.fn(),
      headObject: vi.fn(),
      deleteObject: vi.fn(),
    };
    const r = await provisionManual({
      s3,
      config,
      scopedCredentials: { accessKeyId: 'a', secretAccessKey: 's' },
      log: vi.fn(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('STORAGE_PROVISIONER_VALIDATION_FAILED');
  });
});
