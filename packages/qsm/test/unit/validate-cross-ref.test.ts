import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
} from '@rntme/pdm';
import { parseQsm } from '../../src/parse/parse.js';
import { validateStructural } from '../../src/validate/structural.js';
import { validateCrossRef } from '../../src/validate/cross-ref.js';
import { ERROR_CODES } from '../../src/types/result.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function pdmResolver() {
  const parsed = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!parsed.ok) throw new Error('pdm parse failed');
  const validated = validatePdm(parsed.value);
  if (!validated.ok) throw new Error('pdm validate failed');
  return createPdmResolver(validated.value);
}

function runXref(qsmInput: unknown) {
  const resolver = pdmResolver();
  const p = parseQsm(qsmInput);
  if (!p.ok) throw new Error('parse failed: ' + JSON.stringify(p.errors));
  const s = validateStructural(p.value);
  if (!s.ok) throw new Error('structural failed: ' + JSON.stringify(s.errors));
  return validateCrossRef(s.value, resolver);
}

const VALID_MIRROR = {
  projections: {
    IssueView: {
      backing: 'entity-mirror',
      source: { entity: 'Issue' },
      keys: ['id'],
      grain: ['id'],
      exposed: ['id', 'title', 'status', 'priority', 'storyPoints', 'assigneeId', 'reporterId', 'projectId', 'resolvedAt'],
    },
  },
  relationRoles: { 'Issue.project': 'dimension' },
};

describe('validateCrossRef', () => {
  it('accepts entity-mirror on Issue with full exposed set', () => {
    const r = runXref(VALID_MIRROR);
    expect(r.ok).toBe(true);
  });

  it('rejects source.entity that does not exist in PDM', () => {
    const r = runXref({
      projections: {
        X: {
          backing: 'entity-mirror',
          source: { entity: 'Unknown' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_XREF_SOURCE_UNKNOWN_ENTITY)).toBe(true);
    }
  });

  it('rejects keys field not declared on entity', () => {
    const r = runXref({
      projections: {
        X: {
          backing: 'entity-mirror',
          source: { entity: 'Issue' },
          keys: ['bogus'],
          grain: ['bogus'],
          exposed: ['id'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_XREF_KEY_UNKNOWN_FIELD)).toBe(true);
    }
  });

  it('rejects grain field not on entity', () => {
    const r = runXref({
      projections: {
        X: {
          backing: 'entity-mirror',
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['bogus'],
          exposed: ['id'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_XREF_GRAIN_UNKNOWN_FIELD)).toBe(true);
    }
  });

  it('rejects exposed field not on entity', () => {
    const r = runXref({
      projections: {
        X: {
          backing: 'entity-mirror',
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['bogus'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_XREF_EXPOSED_UNKNOWN_FIELD)).toBe(true);
    }
  });

  it('rejects exposed field that is generated', () => {
    const r = runXref({
      projections: {
        X: {
          backing: 'entity-mirror',
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'createdAt'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_XREF_EXPOSED_INCLUDES_GENERATED)).toBe(true);
    }
  });

  it('rejects backing: "derived" (tier 2 not supported)', () => {
    const r = runXref({
      projections: {
        X: {
          backing: 'derived',
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_BACKING_DERIVED_NOT_SUPPORTED)).toBe(true);
    }
  });

  it('rejects entity-mirror on entity without stateMachine', () => {
    const r = runXref({
      projections: {
        ProjectView: {
          backing: 'entity-mirror',
          source: { entity: 'Project' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'key', 'name'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_XREF_ENTITY_MIRROR_REQUIRES_STATE_MACHINE)).toBe(true);
    }
  });

  it('rejects entity-mirror whose keys differ from entity keys', () => {
    const r = runXref({
      projections: {
        X: {
          backing: 'entity-mirror',
          source: { entity: 'Issue' },
          keys: ['title'], // Issue.keys is ["id"]
          grain: ['title'],
          exposed: ['id'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_XREF_ENTITY_MIRROR_KEYS_MISMATCH)).toBe(true);
    }
  });

  it('rejects entity-mirror whose grain differs from keys', () => {
    const r = runXref({
      projections: {
        X: {
          backing: 'entity-mirror',
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id', 'title'],
          exposed: ['id', 'title'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_XREF_ENTITY_MIRROR_GRAIN_MISMATCH)).toBe(true);
    }
  });

  it('rejects two entity-mirror projections on the same entity', () => {
    const r = runXref({
      projections: {
        A: {
          backing: 'entity-mirror',
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
          table: 'proj_a',
        },
        B: {
          backing: 'entity-mirror',
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
          table: 'proj_b',
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_XREF_ENTITY_MIRROR_DUPLICATE)).toBe(true);
    }
  });

  it('rejects relationRole on unknown entity', () => {
    const r = runXref({
      projections: { IssueView: VALID_MIRROR.projections.IssueView },
      relationRoles: { 'Unknown.project': 'dimension' },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_XREF_RELATION_ROLE_UNKNOWN_ENTITY)).toBe(true);
    }
  });

  it('rejects relationRole on unknown relation of known entity', () => {
    const r = runXref({
      projections: { IssueView: VALID_MIRROR.projections.IssueView },
      relationRoles: { 'Issue.bogus': 'dimension' },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_XREF_RELATION_ROLE_UNKNOWN_RELATION)).toBe(true);
    }
  });

  it('aggregates multiple xref errors in one pass', () => {
    const r = runXref({
      projections: {
        X: {
          backing: 'entity-mirror',
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['a', 'b'],
          exposed: ['c'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBeGreaterThanOrEqual(3);
  });
});
