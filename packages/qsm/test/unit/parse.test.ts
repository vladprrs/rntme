import { describe, expect, it } from 'vitest';
import { parseQsm } from '../../src/parse/parse.js';
import { ERROR_CODES } from '../../src/types/result.js';

const VALID_MINIMAL = {
  projections: {
    IssueView: {
      backing: 'entity-mirror',
      source: { entity: 'Issue' },
      keys: ['id'],
      grain: ['id'],
      exposed: ['id', 'title', 'status'],
      table: 'projection_issue',
    },
  },
  relationRoles: {
    'Issue.project': 'dimension',
  },
};

describe('parseQsm', () => {
  it('parses minimal valid QSM (object input)', () => {
    const r = parseQsm(VALID_MINIMAL);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.projections.IssueView?.source.entity).toBe('Issue');
    }
  });

  it('parses valid QSM (JSON string input)', () => {
    const r = parseQsm(JSON.stringify(VALID_MINIMAL));
    expect(r.ok).toBe(true);
  });

  it('rejects invalid JSON string', () => {
    const r = parseQsm('{"projections":');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]!.code).toBe(ERROR_CODES.QSM_PARSE_SCHEMA_VIOLATION);
      expect(r.errors[0]!.layer).toBe('parse');
    }
  });

  it('accepts empty projections/relationRoles via defaults', () => {
    const r = parseQsm({});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.projections).toEqual({});
      expect(r.value.relationRoles).toEqual({});
    }
  });

  it('accepts projection without backing (default applied downstream)', () => {
    const r = parseQsm({
      projections: {
        IssueView: {
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
        },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('rejects projection with unknown backing value', () => {
    const r = parseQsm({
      projections: {
        X: {
          backing: 'materialized-view',
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects projection with empty source.entity', () => {
    const r = parseQsm({
      projections: {
        X: {
          source: { entity: '' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('accepts source.pathPrefix (forwards-compat for derived projections)', () => {
    const r = parseQsm({
      projections: {
        X: {
          source: { entity: 'OrderItem', pathPrefix: 'orderItem.product.category' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
        },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('rejects extra top-level keys', () => {
    const r = parseQsm({ projections: {}, relationRoles: {}, extra: true });
    expect(r.ok).toBe(false);
  });

  it('rejects extra projection keys', () => {
    const r = parseQsm({
      projections: {
        X: {
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
          extra: 1,
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('accepts relationRoles with both fact and dimension', () => {
    const r = parseQsm({
      projections: {},
      relationRoles: {
        'OrderItem.order': 'fact',
        'OrderItem.product': 'dimension',
      },
    });
    expect(r.ok).toBe(true);
  });

  it('rejects relationRoles with unknown value', () => {
    const r = parseQsm({
      projections: {},
      relationRoles: { 'Issue.project': 'measure' },
    });
    expect(r.ok).toBe(false);
  });

  it('aggregates multiple errors, not fails-fast', () => {
    const r = parseQsm({
      projections: {
        X: {
          source: { entity: 123 },
          keys: 'not-array',
          grain: [],
          exposed: [],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.length).toBeGreaterThanOrEqual(2);
    }
  });
});
