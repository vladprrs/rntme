import { describe, expect, it } from 'bun:test';
import { validateStorageJson } from '../../src/validate/storage/index.js';

const pdm = { entities: { ticket: {}, candidate: {} } };

const goodFile = JSON.stringify({
  version: '1.0',
  routes: {
    'ticket-attachments': {
      owner: { aggregate: 'ticket', association: 'attachments' },
      maxSize: '10MB',
      allowedTypes: ['image/*', 'application/pdf'],
      maxCount: 5,
      auth: { requireRole: ['member', 'admin'] },
      lifecycle: { expirePending: '24h', retainCommitted: null },
    },
    'candidate-cv': {
      owner: { aggregate: 'candidate', association: 'cv' },
      maxSize: '20MB',
      allowedTypes: ['application/pdf'],
      maxCount: 1,
      auth: { requireRole: ['recruiter'] },
      lifecycle: { expirePending: '1h', retainCommitted: null },
    },
  },
});

describe('validateStorageJson - end to end (fail-fast)', () => {
  it('produces a ValidatedStorageJson on a well-formed file', () => {
    const r = validateStorageJson(goodFile, pdm as never);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Object.keys(r.value.routes).sort()).toEqual(['candidate-cv', 'ticket-attachments']);
  });

  it('returns parse error when JSON is malformed (does not run later layers)', () => {
    const r = validateStorageJson('{', pdm as never);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.at(0)?.code).toBe('STORAGE_PARSE_INVALID_JSON');
  });

  it('returns references error when PDM is missing the aggregate (does not reach consistency)', () => {
    const r = validateStorageJson(goodFile, { entities: { ticket: {} } } as never);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.at(0)?.code).toBe('STORAGE_REFERENCES_AGGREGATE_NOT_FOUND');
  });
});
