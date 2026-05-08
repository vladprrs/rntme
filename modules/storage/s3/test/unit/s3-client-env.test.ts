import { describe, expect, it } from 'vitest';
import { resolveS3OptionsFromEnv } from '../../src/s3-client.js';

describe('resolveS3OptionsFromEnv', () => {
  it('reads STORAGE_S3_* env vars', () => {
    const r = resolveS3OptionsFromEnv({
      STORAGE_S3_ACCESS_KEY_ID: 'k',
      STORAGE_S3_SECRET_ACCESS_KEY: 's',
      STORAGE_S3_BUCKET: 'b',
      STORAGE_S3_ENDPOINT: 'http://localhost:9000',
      STORAGE_S3_REGION: 'us-east-1',
      STORAGE_S3_FORCE_PATH_STYLE: 'true',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      accessKeyId: 'k',
      bucket: 'b',
      region: 'us-east-1',
    });
  });

  it('errors when bucket is missing', () => {
    const r = resolveS3OptionsFromEnv({
      STORAGE_S3_ACCESS_KEY_ID: 'k',
      STORAGE_S3_SECRET_ACCESS_KEY: 's',
    });
    expect(r.ok).toBe(false);
  });
});
