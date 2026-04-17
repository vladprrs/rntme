import { describe, it, expect } from 'vitest';
import { createPdmResolver, parsePdm, validatePdm } from '@rntme/pdm';
import { validateQsm } from '@rntme/qsm';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import { expandChain, chainToSqlJoins } from '../../../../src/lower/sqlite/joins.js';

// ── Inline fixtures ──────────────────────────────────────────────────────────

const rawPdm = {
  entities: {
    Issue: {
      table: 'issues',
      fields: {
        id: { type: 'integer', nullable: false, column: 'id' },
        projectId: { type: 'integer', nullable: false, column: 'project_id' },
        title: { type: 'string', nullable: false, column: 'title' },
        status: { type: 'string', nullable: false, column: 'status' },
      },
      relations: {
        project: { to: 'Project', cardinality: 'one', localKey: 'projectId', foreignKey: 'id' },
      },
      keys: ['id'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['open'],
        transitions: { create: { from: null, to: 'open', affects: ['projectId', 'title'] } },
      },
    },
    Project: {
      table: 'projects',
      fields: {
        id: { type: 'integer', nullable: false, column: 'id' },
        name: { type: 'string', nullable: false, column: 'name' },
        status: { type: 'string', nullable: false, column: 'status' },
      },
      relations: {},
      keys: ['id'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['active'],
        transitions: { create: { from: null, to: 'active', affects: ['name'] } },
      },
    },
  },
};

const rawQsm = {
  projections: {
    IssueView: {
      backing: 'entity-mirror' as const,
      source: { entity: 'Issue' },
      keys: ['id'],
      grain: ['id'],
      exposed: ['id', 'projectId', 'title'],
    },
    ProjMirror: {
      backing: 'entity-mirror' as const,
      source: { entity: 'Project' },
      keys: ['id'],
      grain: ['id'],
      exposed: ['id', 'name'],
    },
  },
  relations: {
    'IssueView.project': {
      to: 'ProjMirror',
      localKey: 'projectId',
      foreignKey: 'id',
      cardinality: 'one' as const,
    },
  },
};

function buildFixtures(): { pdm: ValidatedPdm; qsm: ValidatedQsm } {
  const pdmParsed = parsePdm(rawPdm);
  if (!pdmParsed.ok) throw new Error(`parsePdm: ${JSON.stringify(pdmParsed.errors)}`);
  const pdmVal = validatePdm(pdmParsed.value);
  if (!pdmVal.ok) throw new Error(`validatePdm: ${JSON.stringify(pdmVal.errors)}`);
  const pdm = pdmVal.value;

  const qsmVal = validateQsm(rawQsm, createPdmResolver(pdm));
  if (!qsmVal.ok) throw new Error(`validateQsm: ${JSON.stringify(qsmVal.errors)}`);
  return { pdm, qsm: qsmVal.value };
}

const { pdm: miniPdm, qsm: miniQsm } = buildFixtures();

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('expandChain — QSM-based', () => {
  it('builds single-hop chain from IssueView to ProjMirror', () => {
    const chain = expandChain('issue', 'IssueView', ['issue', 'project'], miniQsm, miniPdm);
    expect(chain.steps).toHaveLength(1);
    expect(chain.steps[0]).toMatchObject({
      relation: 'project',
      fromProjection: 'IssueView',
      toProjection: 'ProjMirror',
      localKey: 'project_id',
      foreignKey: 'id',
      cardinality: 'one',
    });
  });

  it('returns chain with from/fromProjection metadata', () => {
    const chain = expandChain('issue', 'IssueView', ['issue', 'project'], miniQsm, miniPdm);
    expect(chain.from).toBe('issue');
    expect(chain.fromProjection).toBe('IssueView');
  });

  it('returns empty steps for a single-element path (no hops)', () => {
    const chain = expandChain('issue', 'IssueView', ['issue'], miniQsm, miniPdm);
    expect(chain.steps).toHaveLength(0);
  });

  it('throws NAV_NOT_ALLOWED for undeclared relation', () => {
    expect(() => expandChain('issue', 'IssueView', ['issue', 'unknown'], miniQsm, miniPdm)).toThrow(
      /NAV_NOT_ALLOWED/,
    );
  });

  it('throws NAV_FAN_OUT_NOT_ALLOWED for many-cardinality relation', () => {
    const qsmWithMany: ValidatedQsm = {
      ...miniQsm,
      relations: {
        ...miniQsm.relations,
        'IssueView.comments': {
          to: 'ProjMirror',
          localKey: 'projectId',
          foreignKey: 'id',
          cardinality: 'many',
        },
      },
    } as ValidatedQsm;
    expect(() => expandChain('issue', 'IssueView', ['issue', 'comments'], qsmWithMany, miniPdm)).toThrow(
      /NAV_FAN_OUT_NOT_ALLOWED/,
    );
  });
});

describe('chainToSqlJoins — QSM-based', () => {
  it('produces a LEFT JOIN for single-hop chain', () => {
    const chain = expandChain('issue', 'IssueView', ['issue', 'project'], miniQsm, miniPdm);
    const joins = chainToSqlJoins(chain, miniQsm);
    expect(joins).toHaveLength(1);
    expect(joins[0]).toMatchObject({
      kind: 'left',
      alias: 'project',
    });
  });

  it('join ON clause references correct local and foreign columns', () => {
    const chain = expandChain('issue', 'IssueView', ['issue', 'project'], miniQsm, miniPdm);
    const joins = chainToSqlJoins(chain, miniQsm);
    const on = joins[0]!.on;
    expect(on).toMatchObject({
      kind: 'op',
      op: 'eq',
      args: [
        { kind: 'col', table: 'issue', column: 'project_id' },
        { kind: 'col', table: 'project', column: 'id' },
      ],
    });
  });

  it('produces no joins for empty steps chain', () => {
    const chain = expandChain('issue', 'IssueView', ['issue'], miniQsm, miniPdm);
    const joins = chainToSqlJoins(chain, miniQsm);
    expect(joins).toHaveLength(0);
  });
});
