import { describe, expect, it, mock } from 'bun:test';
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
      headBucket: mock().mockResolvedValue(undefined),
      putObject: mock().mockResolvedValue(undefined),
      headObject: mock().mockResolvedValue(undefined),
      deleteObject: mock().mockResolvedValue(undefined),
    };
    const r = await provisionManual({
      s3,
      config,
      scopedCredentials: { accessKeyId: 'a', secretAccessKey: 's' },
      log: mock(),
    });
    expect(r.ok).toBe(true);
  });

  it('STORAGE_PROVISIONER_VALIDATION_FAILED when HeadBucket 403', async () => {
    const s3 = {
      headBucket: mock().mockRejectedValue({ $metadata: { httpStatusCode: 403 } }),
      putObject: mock(),
      headObject: mock(),
      deleteObject: mock(),
    };
    const r = await provisionManual({
      s3,
      config,
      scopedCredentials: { accessKeyId: 'a', secretAccessKey: 's' },
      log: mock(),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('STORAGE_PROVISIONER_VALIDATION_FAILED');
  });
});
