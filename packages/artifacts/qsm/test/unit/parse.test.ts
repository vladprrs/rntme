import { describe, expect, it } from 'bun:test';
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
  relations: {
    'IssueView.project': { to: 'ProjMirror', localKey: 'projectId', foreignKey: 'id', cardinality: 'one' },
  },
};

describe('parseQsm', () => {
  it('parses minimal valid QSM (object input)', () => {
    const r = parseQsm(VALID_MINIMAL);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const src = r.value.projections.IssueView?.source;
      expect(src && 'entity' in src ? src.entity : undefined).toBe('Issue');
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

  it('accepts empty projections/relations via defaults', () => {
    const r = parseQsm({});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.projections).toEqual({});
      expect(r.value.relations).toEqual({});
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
    const r = parseQsm({ projections: {}, relations: {}, extra: true });
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

  it('accepts relations with cardinality one and many', () => {
    const r = parseQsm({
      projections: {},
      relations: {
        'IssueView.project': { to: 'ProjView', localKey: 'projectId', foreignKey: 'id', cardinality: 'one' },
        'IssueView.comments': { to: 'CommentView', localKey: 'id', foreignKey: 'issueId', cardinality: 'many' },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('accepts relations with optional role annotation', () => {
    const r = parseQsm({
      projections: {},
      relations: {
        'IssueView.project': { to: 'ProjView', localKey: 'projectId', foreignKey: 'id', cardinality: 'one', role: 'dimension' },
        'IssueView.facts': { to: 'FactView', localKey: 'id', foreignKey: 'issueId', cardinality: 'many', role: 'fact' },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('rejects relation with unknown cardinality value', () => {
    const r = parseQsm({
      projections: {},
      relations: { 'IssueView.project': { to: 'X', localKey: 'a', foreignKey: 'b', cardinality: 'multiple' } },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects relation with unknown role value', () => {
    const r = parseQsm({
      projections: {},
      relations: { 'IssueView.project': { to: 'X', localKey: 'a', foreignKey: 'b', cardinality: 'one', role: 'measure' } },
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
