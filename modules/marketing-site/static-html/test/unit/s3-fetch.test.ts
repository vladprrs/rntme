import { createHash } from 'node:crypto';
import { describe, expect, it, mock } from 'bun:test';
import { fetchAndVerifyBundle } from '../../src/s3-fetch.js';

describe('fetchAndVerifyBundle', () => {
  it('returns BUNDLE_NOT_FOUND when S3 GetObject throws NoSuchKey', async () => {
    const client = { send: mock(async () => { throw Object.assign(new Error('not found'), { name: 'NoSuchKey' }); }) };

    const result = await fetchAndVerifyBundle(client, { bucket: 'b', key: 'k', sha256: 'a'.repeat(64) });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('MARKETING_SITE_PROVISION_BUNDLE_NOT_FOUND');
  });

  it('returns HASH_MISMATCH when sha256 differs', async () => {
    const body = Buffer.from('hello');
    const client = { send: mock(async () => ({ Body: { transformToByteArray: async () => body } })) };

    const result = await fetchAndVerifyBundle(client, { bucket: 'b', key: 'k', sha256: 'a'.repeat(64) });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('MARKETING_SITE_PROVISION_HASH_MISMATCH');
  });

  it('returns bundle bytes on hash match', async () => {
    const body = Buffer.from('hello');
    const sha256 = createHash('sha256').update(body).digest('hex');
    const client = { send: mock(async () => ({ Body: { transformToByteArray: async () => body } })) };

    const result = await fetchAndVerifyBundle(client, { bucket: 'b', key: 'k', sha256 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.equals(body)).toBe(true);
  });
});
