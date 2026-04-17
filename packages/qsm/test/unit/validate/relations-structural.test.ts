import { describe, it, expect } from 'vitest';
import { validateStructural } from '../../../src/validate/structural.js';

describe('validateStructural — relations', () => {
  it('accepts well-formed relations', () => {
    const r = validateStructural({
      projections: {
        IssueView: { source: { entity: 'Issue' }, keys: ['id'], grain: ['id'], exposed: ['id'] },
        ProjMirror: { source: { entity: 'Project' }, keys: ['id'], grain: ['id'], exposed: ['id'] },
      },
      relations: {
        'IssueView.project': { to: 'ProjMirror', localKey: 'projectId', foreignKey: 'id', cardinality: 'one' },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('flags malformed key', () => {
    const r = validateStructural({
      projections: {
        IssueView: { source: { entity: 'Issue' }, keys: ['id'], grain: ['id'], exposed: ['id'] },
      },
      relations: {
        'BadKey': { to: 'X', localKey: 'a', foreignKey: 'b', cardinality: 'one' },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'QSM_RELATION_KEY_MALFORMED')).toBe(true);
    }
  });

  it('flags lowercase-start ProjectionName in key', () => {
    const r = validateStructural({
      projections: {
        IssueView: { source: { entity: 'Issue' }, keys: ['id'], grain: ['id'], exposed: ['id'] },
      },
      relations: {
        'issueView.project': { to: 'X', localKey: 'a', foreignKey: 'b', cardinality: 'one' },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === 'QSM_RELATION_KEY_MALFORMED')).toBe(true);
    }
  });

  it('allows relation with optional role annotation', () => {
    const r = validateStructural({
      projections: {
        IssueView: { source: { entity: 'Issue' }, keys: ['id'], grain: ['id'], exposed: ['id'] },
        ProjMirror: { source: { entity: 'Project' }, keys: ['id'], grain: ['id'], exposed: ['id'] },
      },
      relations: {
        'IssueView.project': { to: 'ProjMirror', localKey: 'projectId', foreignKey: 'id', cardinality: 'one', role: 'dimension' },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('accepts empty relations map', () => {
    const r = validateStructural({
      projections: {
        IssueView: { source: { entity: 'Issue' }, keys: ['id'], grain: ['id'], exposed: ['id'] },
      },
      relations: {},
    });
    expect(r.ok).toBe(true);
  });
});
