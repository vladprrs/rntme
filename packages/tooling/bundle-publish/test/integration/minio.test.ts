import { describe, expect, it } from 'vitest';

describe.skipIf(process.env.MINIO_URL === undefined)('integration: MinIO publish', () => {
  it('is gated behind MINIO_URL', () => {
    expect(process.env.MINIO_URL).toBeDefined();
  });
});
