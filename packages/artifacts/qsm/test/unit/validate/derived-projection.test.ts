import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
} from '@rntme/pdm';
import { parseQsm } from '../../../src/parse/parse.js';
import { validateStructural } from '../../../src/validate/structural.js';
import { validateCrossRef } from '../../../src/validate/cross-ref.js';
import { ERROR_CODES } from '../../../src/types/result.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', '..', 'fixtures');

function pdmResolver() {
  const parsed = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!parsed.ok) throw new Error('pdm parse failed');
  const validated = validatePdm(parsed.value);
  if (!validated.ok) throw new Error('pdm validate failed');
  return createPdmResolver(validated.value);
}

function runStructural(qsmInput: unknown) {
  const p = parseQsm(qsmInput);
  if (!p.ok) throw new Error('parse failed: ' + JSON.stringify(p.errors));
  return validateStructural(p.value);
}

function runXref(qsmInput: unknown) {
  const p = parseQsm(qsmInput);
  if (!p.ok) throw new Error('parse failed: ' + JSON.stringify(p.errors));
  const s = validateStructural(p.value);
  if (!s.ok) return s;
  return validateCrossRef(s.value, pdmResolver());
}

describe('derived projections — validator', () => {
  it('accepts backing="derived" with source:{ graph }, explicit table, non-empty exposed', () => {
    const r = runXref({
      projections: {
        ResolvedCount: {
          backing: 'derived',
          source: { graph: 'resolvedIssueCountByProject' },
          table: 'projection_resolved_count',
          keys: ['project_id'],
          grain: ['project_id'],
          exposed: ['project_id', 'n'],
        },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('rejects derived with source:{ entity } (wrong shape)', () => {
    const r = runStructural({
      projections: {
        X: {
          backing: 'derived',
          source: { entity: 'Issue' },
          table: 'projection_x',
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_DERIVED_SOURCE_SHAPE)).toBe(true);
    }
  });

  it('rejects derived with empty source.graph', () => {
    // Parser enforces non-empty graph at the Zod layer (min(1));
    // if somehow a whitespace-only value slipped through, the structural
    // layer also flags it.
    const p = parseQsm({
      projections: {
        X: {
          backing: 'derived',
          source: { graph: '' },
          table: 'projection_x',
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
        },
      },
    });
    expect(p.ok).toBe(false);
    if (!p.ok) {
      expect(p.errors.some((e) => e.code === ERROR_CODES.QSM_PARSE_SCHEMA_VIOLATION)).toBe(true);
    }
  });

  it('rejects derived without an explicit "table" — emits QSM_DERIVED_EXPOSED_OUT_OF_RANGE', () => {
    const r = runStructural({
      projections: {
        X: {
          backing: 'derived',
          source: { graph: 'g' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
          // no `table`
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_DERIVED_EXPOSED_OUT_OF_RANGE)).toBe(true);
    }
  });

  it('rejects derived with empty exposed', () => {
    const r = runStructural({
      projections: {
        X: {
          backing: 'derived',
          source: { graph: 'g' },
          table: 'projection_x',
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

  it('rejects entity-mirror with source:{ graph } (wrong shape)', () => {
    const r = runStructural({
      projections: {
        X: {
          backing: 'entity-mirror',
          source: { graph: 'g' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
        },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.code === ERROR_CODES.QSM_DERIVED_SOURCE_SHAPE)).toBe(true);
    }
  });

  it('existing entity-mirror projections continue to validate', () => {
    const r = runXref({
      projections: {
        IssueView: {
          backing: 'entity-mirror',
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'title', 'status'],
        },
      },
    });
    expect(r.ok).toBe(true);
  });
});
