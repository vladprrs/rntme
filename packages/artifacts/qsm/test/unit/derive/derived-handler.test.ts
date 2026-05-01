import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
  deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm } from '../../../src/parse/parse.js';
import { validateQsm } from '../../../src/validate/index.js';
import {
  deriveProjectionHandler,
  deriveDerivedProjectionSpecs,
} from '../../../src/derive/handler.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', '..', 'fixtures');

function setup(qsmInput: unknown) {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error('pdm parse');
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error('pdm validate');
  const resolver = createPdmResolver(pdm.value);
  const events = deriveEventTypes(pdm.value);

  const qsmRaw = parseQsm(qsmInput);
  if (!qsmRaw.ok) throw new Error('qsm parse: ' + JSON.stringify(qsmRaw.errors));
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error('qsm validate: ' + JSON.stringify(qsm.errors));
  return { qsm: qsm.value, resolver, events };
}

const MIXED_QSM = {
  projections: {
    IssueView: {
      backing: 'entity-mirror',
      source: { entity: 'Issue' },
      keys: ['id'],
      grain: ['id'],
      exposed: ['id', 'title', 'status'],
    },
    resolvedIssueCountByProject: {
      backing: 'derived',
      source: { graph: 'resolvedIssueCountByProject' },
      table: 'projection_resolved_count',
      keys: ['project_id'],
      grain: ['project_id'],
      exposed: ['project_id', 'n'],
    },
  },
};

describe('handler derivation split', () => {
  it('deriveProjectionHandler returns only entity-mirror handlers', () => {
    const { qsm, resolver, events } = setup(MIXED_QSM);
    const handlers = deriveProjectionHandler(qsm, resolver, events);
    expect(handlers).toHaveLength(1);
    expect(handlers[0]!.projectionName).toBe('IssueView');
    expect(handlers[0]!.aggregateType).toBe('Issue');
  });

  it('deriveDerivedProjectionSpecs returns only derived projection specs', () => {
    const { qsm } = setup(MIXED_QSM);
    const specs = deriveDerivedProjectionSpecs(qsm);
    expect(specs).toHaveLength(1);
    expect(specs[0]).toEqual({
      projectionName: 'resolvedIssueCountByProject',
      tableName: 'projection_resolved_count',
      graphId: 'resolvedIssueCountByProject',
    });
  });

  it('deriveDerivedProjectionSpecs returns [] when no derived projections exist', () => {
    const { qsm } = setup({
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
    const specs = deriveDerivedProjectionSpecs(qsm);
    expect(specs).toEqual([]);
  });

  it('deriveDerivedProjectionSpecs emits one spec per derived projection, preserving order', () => {
    const { qsm } = setup({
      projections: {
        a: {
          backing: 'derived',
          source: { graph: 'graphA' },
          table: 't_a',
          keys: ['k'],
          grain: ['k'],
          exposed: ['k'],
        },
        b: {
          backing: 'derived',
          source: { graph: 'graphB' },
          table: 't_b',
          keys: ['k'],
          grain: ['k'],
          exposed: ['k'],
        },
      },
    });
    const specs = deriveDerivedProjectionSpecs(qsm);
    expect(specs).toHaveLength(2);
    expect(specs.map((s) => s.graphId)).toEqual(['graphA', 'graphB']);
    expect(specs.map((s) => s.tableName)).toEqual(['t_a', 't_b']);
  });
});
