import { describe, expect, it } from 'bun:test';
import type { StorageJson } from '../../src/types/storage-json.js';
import { validateStorageJsonReferences } from '../../src/validate/storage/references.js';

function pdm(entities: string[]): { entities: Record<string, unknown> } {
  return { entities: Object.fromEntries(entities.map((name) => [name, {}])) };
}

const sj: StorageJson = {
  version: '1.0',
  routes: {
    'ticket-attachments': {
      id: 'ticket-attachments',
      owner: { aggregate: 'ticket', association: 'attachments' },
      maxSize: 10 * 1024 * 1024,
      allowedTypes: ['image/*'],
      maxCount: 5,
      auth: { requireRole: ['member'] },
      lifecycle: { expirePendingMs: 86_400_000, retainCommittedMs: null },
    },
  },
};

describe('validateStorageJsonReferences', () => {
  it('rejects when owner.aggregate is not a PDM entity', () => {
    const r = validateStorageJsonReferences(sj, pdm(['note']) as never);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.at(0)?.code).toBe('STORAGE_REFERENCES_AGGREGATE_NOT_FOUND');
  });

  it('passes when every owner.aggregate is a PDM entity', () => {
    const r = validateStorageJsonReferences(sj, pdm(['ticket']) as never);
    expect(r.ok).toBe(true);
  });
});
