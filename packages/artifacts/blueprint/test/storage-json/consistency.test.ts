import { describe, expect, it } from 'bun:test';
import type { StorageJson, StorageRoute } from '../../src/types/storage-json.js';
import { validateStorageJsonConsistency } from '../../src/validate/storage/consistency.js';

const baseRoute = (over: Partial<StorageRoute> = {}): StorageRoute => ({
  id: 'r',
  owner: { aggregate: 'ticket', association: 'attachments' },
  maxSize: 10 * 1024 * 1024,
  allowedTypes: ['image/*'],
  maxCount: 5,
  auth: { requireRole: null },
  lifecycle: { expirePendingMs: 86_400_000, retainCommittedMs: null },
  ...over,
});

describe('validateStorageJsonConsistency', () => {
  it('rejects two routes that claim the same (aggregate, association)', () => {
    const sj: StorageJson = {
      version: '1.0',
      routes: {
        a: { ...baseRoute(), id: 'a' },
        b: { ...baseRoute(), id: 'b' },
      },
    };
    const r = validateStorageJsonConsistency(sj);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.at(0)?.code).toBe('STORAGE_CONSISTENCY_DUPLICATE_ASSOCIATION');
  });

  it('rejects expirePending below 1 minute', () => {
    const sj: StorageJson = {
      version: '1.0',
      routes: { r: { ...baseRoute(), lifecycle: { expirePendingMs: 30_000, retainCommittedMs: null } } },
    };
    const r = validateStorageJsonConsistency(sj);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.at(0)?.code).toBe('STORAGE_CONSISTENCY_PENDING_TTL_OUT_OF_RANGE');
  });

  it('rejects expirePending above 7 days', () => {
    const sj: StorageJson = {
      version: '1.0',
      routes: {
        r: { ...baseRoute(), lifecycle: { expirePendingMs: 8 * 86_400_000, retainCommittedMs: null } },
      },
    };
    const r = validateStorageJsonConsistency(sj);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.at(0)?.code).toBe('STORAGE_CONSISTENCY_PENDING_TTL_OUT_OF_RANGE');
  });

  it('rejects maxSize > 5 GB', () => {
    const sj: StorageJson = {
      version: '1.0',
      routes: { r: { ...baseRoute(), maxSize: 6 * 1024 * 1024 * 1024 } },
    };
    const r = validateStorageJsonConsistency(sj);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.at(0)?.code).toBe('STORAGE_CONSISTENCY_MAX_SIZE_TOO_LARGE');
  });

  it('rejects maxCount === 0', () => {
    const sj: StorageJson = {
      version: '1.0',
      routes: { r: { ...baseRoute(), maxCount: 0 } },
    };
    const r = validateStorageJsonConsistency(sj);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.at(0)?.code).toBe('STORAGE_CONSISTENCY_MAX_COUNT_INVALID');
  });

  it('passes for a well-formed file', () => {
    const sj: StorageJson = {
      version: '1.0',
      routes: { 'ticket-attachments': { ...baseRoute(), id: 'ticket-attachments' } },
    };
    expect(validateStorageJsonConsistency(sj).ok).toBe(true);
  });
});
