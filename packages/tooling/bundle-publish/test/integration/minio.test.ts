import { describe, expect, it } from 'bun:test';

describe.skipIf(process.env.MINIO_URL === undefined)('integration: MinIO publish', () => {
  it('is gated behind MINIO_URL', () => {
    expect(process.env.MINIO_URL).toBeDefined();
  });
});
