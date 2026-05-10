import { describe, it, expect } from 'bun:test';
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

  it('accepts lowercase-start projection name in key (snake_case projections are valid)', () => {
    // RELATION_KEY_RE was relaxed to allow snake_case projection names such as
    // issue_view, project_mirror, etc. — lowercase-start is therefore permitted.
    const r = validateStructural({
      projections: {
        issue_view: { source: { entity: 'Issue' }, keys: ['id'], grain: ['id'], exposed: ['id'] },
      },
      relations: {
        'issue_view.project': { to: 'X', localKey: 'a', foreignKey: 'b', cardinality: 'one' },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('flags digit-leading segment in relation key', () => {
    const r = validateStructural({
      projections: {
        IssueView: { source: { entity: 'Issue' }, keys: ['id'], grain: ['id'], exposed: ['id'] },
      },
      relations: {
        '1issueView.project': { to: 'X', localKey: 'a', foreignKey: 'b', cardinality: 'one' },
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
