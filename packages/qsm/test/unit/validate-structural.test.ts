import { describe, expect, it } from 'vitest';
import { parseQsm } from '../../src/parse/parse.js';
import { validateStructural } from '../../src/validate/structural.js';
import { ERROR_CODES } from '../../src/types/result.js';

function parseAndStructural(input: unknown) {
  const p = parseQsm(input);
  if (!p.ok) throw new Error('parse failed: ' + JSON.stringify(p.errors));
  return validateStructural(p.value);
}

const VALID = {
  projections: {
    IssueView: {
      backing: 'entity-mirror',
      source: { entity: 'Issue' },
      keys: ['id'],
      grain: ['id'],
      exposed: ['id', 'title', 'status'],
    },
  },
  relations: {
    'IssueView.project': { to: 'ProjMirror', localKey: 'projectId', foreignKey: 'id', cardinality: 'one' },
  },
};

describe('validateStructural', () => {
  it('accepts valid QSM', () => {
    const r = parseAndStructural(VALID);
    expect(r.ok).toBe(true);
  });

  it('rejects empty keys', () => {
    const r = parseAndStructural({
      projections: {
        X: {
          source: { entity: 'Issue' },
          keys: [],
          grain: ['id'],
          exposed: ['id'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_STRUCT_PROJECTION_KEYS_EMPTY)).toBe(true);
    }
  });

  it('rejects empty grain', () => {
    const r = parseAndStructural({
      projections: {
        X: {
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: [],
          exposed: ['id'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_STRUCT_PROJECTION_GRAIN_EMPTY)).toBe(true);
    }
  });

  it('rejects empty exposed', () => {
    const r = parseAndStructural({
      projections: {
        X: {
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: [],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_STRUCT_PROJECTION_EXPOSED_EMPTY)).toBe(true);
    }
  });

  it('rejects duplicate keys within a projection', () => {
    const r = parseAndStructural({
      projections: {
        X: {
          source: { entity: 'Issue' },
          keys: ['id', 'id'],
          grain: ['id'],
          exposed: ['id'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_STRUCT_PROJECTION_DUPLICATE_KEY)).toBe(true);
    }
  });

  it('rejects duplicate grain columns', () => {
    const r = parseAndStructural({
      projections: {
        X: {
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id', 'id'],
          exposed: ['id'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_STRUCT_PROJECTION_DUPLICATE_GRAIN)).toBe(true);
    }
  });

  it('rejects duplicate exposed columns', () => {
    const r = parseAndStructural({
      projections: {
        X: {
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'id'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_STRUCT_PROJECTION_DUPLICATE_EXPOSED)).toBe(true);
    }
  });

  it('rejects two projections resolving to the same table name', () => {
    const r = parseAndStructural({
      projections: {
        A: {
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
          table: 'same_table',
        },
        B: {
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
          table: 'same_table',
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_STRUCT_DUPLICATE_TABLE)).toBe(true);
    }
  });

  it('rejects relation key not matching ProjectionName.relationName format', () => {
    const r = parseAndStructural({
      projections: {},
      relations: { not_valid: { to: 'X', localKey: 'a', foreignKey: 'b', cardinality: 'one' } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_RELATION_KEY_MALFORMED)).toBe(true);
    }
  });

  it('aggregates multiple structural errors across projections', () => {
    const r = parseAndStructural({
      projections: {
        A: { source: { entity: 'Issue' }, keys: [], grain: ['id'], exposed: ['id'] },
        B: { source: { entity: 'Issue' }, keys: ['id'], grain: [], exposed: ['id'] },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });
});
