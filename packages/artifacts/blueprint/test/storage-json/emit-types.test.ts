import { describe, expect, it } from 'vitest';
import { emitStorageRouteIdTypes } from '../../src/emit/storage-route-id-types.js';

describe('emitStorageRouteIdTypes', () => {
  it('emits never for empty storage artifacts', () => {
    expect(emitStorageRouteIdTypes({}).storageRouteIdUnion).toBe('never');
  });

  it('emits a union of route ids across services', () => {
    const storage = {
      version: '1.0' as const,
      routes: {
        attachments: {
          id: 'attachments',
          owner: { aggregate: 'Ticket', association: 'attachments' },
          maxSize: 1,
          allowedTypes: ['*/*'],
          maxCount: 1,
          auth: { requireRole: null },
          lifecycle: { expirePendingMs: 60_000, retainCommittedMs: null },
        },
        avatars: {
          id: 'avatars',
          owner: { aggregate: 'User', association: 'avatar' },
          maxSize: 1,
          allowedTypes: ['image/*'],
          maxCount: 1,
          auth: { requireRole: null },
          lifecycle: { expirePendingMs: 60_000, retainCommittedMs: null },
        },
      },
    };

    const result = emitStorageRouteIdTypes({ crm: storage as never });

    expect(result.storageRouteIdUnion).toBe('"attachments" | "avatars"');
    expect(result.routeAggregateMap).toEqual({ attachments: 'Ticket', avatars: 'User' });
  });
});
