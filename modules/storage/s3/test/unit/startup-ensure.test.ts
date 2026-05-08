import { describe, expect, it, vi } from 'vitest';
import { ensureRustfsStorage } from '../../src/startup-ensure.js';

const storage = {
  version: '1.0' as const,
  routes: {
    docs: {
      id: 'docs',
      owner: { aggregate: 'Document', association: 'files' },
      maxSize: 1_000_000,
      allowedTypes: ['application/pdf'],
      maxCount: 5,
      auth: { requireRole: null },
      lifecycle: { expirePendingMs: 60_000, retainCommittedMs: 172_800_000 },
    },
  },
};

describe('ensureRustfsStorage', () => {
  it('creates missing bucket and applies CORS and lifecycle', async () => {
    const calls: string[] = [];
    const client = {
      headBucket: vi.fn(async () => {
        calls.push('headBucket');
        const error = new Error('not found') as Error & { $metadata?: { httpStatusCode?: number } };
        error.$metadata = { httpStatusCode: 404 };
        throw error;
      }),
      createBucket: vi.fn(async () => {
        calls.push('createBucket');
      }),
      putBucketCors: vi.fn(async () => {
        calls.push('putBucketCors');
      }),
      putBucketLifecycleConfiguration: vi.fn(async () => {
        calls.push('putBucketLifecycleConfiguration');
      }),
    };

    await ensureRustfsStorage({
      client,
      bucket: 'rntme-acme-commerce-default-storage',
      appOrigins: ['https://commerce.example.test'],
      storage,
      log: () => undefined,
    });

    expect(calls).toEqual(['headBucket', 'createBucket', 'putBucketCors', 'putBucketLifecycleConfiguration']);
    expect(client.putBucketCors).toHaveBeenCalledWith({
      Bucket: 'rntme-acme-commerce-default-storage',
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ['https://commerce.example.test'],
            AllowedMethods: ['PUT', 'GET', 'DELETE', 'HEAD'],
            AllowedHeaders: ['*'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    });
  });

  it('does not fail when lifecycle is unsupported by RustFS', async () => {
    const logs: string[] = [];
    await expect(
      ensureRustfsStorage({
        client: {
          headBucket: async () => undefined,
          createBucket: async () => undefined,
          putBucketCors: async () => undefined,
          putBucketLifecycleConfiguration: async () => {
            const error = new Error('not implemented') as Error & { $metadata?: { httpStatusCode?: number } };
            error.$metadata = { httpStatusCode: 501 };
            throw error;
          },
        },
        bucket: 'b',
        appOrigins: ['https://app.example.test'],
        storage,
        log: (message) => logs.push(message),
      }),
    ).resolves.toBeUndefined();
    expect(logs.join('\n')).toContain('lifecycle unsupported');
  });
});
