import { describe, it, expect } from 'vitest';
import { createPdmResolver, parsePdm, validatePdm } from '@rntme/pdm';
import { validateQsm } from '@rntme/qsm';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import { expandChain, chainToSqlJoins } from '../../../../src/lower/sqlite/joins.js';
import { issueSprintProjectFixtures } from './fixtures/issue-sprint-project.js';

// ── Inline fixtures ──────────────────────────────────────────────────────────

const rawPdm = {
  entities: {
    Issue: {
      ownerService: 'issue-tracker',
      kind: 'owned',
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
      ownerService: 'issue-tracker',
      kind: 'owned',
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

// ── Multi-hop / alias-collision fixtures ─────────────────────────────────────
//
// Scenario: IssueView.sprint → SprintMirror, SprintMirror.project → ProjMirror
// and separately IssueView.project → ProjMirror.  Both paths reach ProjMirror
// via a different parent, so they must get distinct aliases.
//
// Shared with joins-dedup.test.ts via the extracted fixture module.

const { pdm: multiPdm, qsm: multiQsm } = issueSprintProjectFixtures;

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

// ── Tests: path-qualified aliases (bug_007) ───────────────────────────────────

describe('expandChain — path-qualified toAlias (bug_007)', () => {
  it('single-hop path produces bare relation name as alias', () => {
    // path ['issue', 'project'] → i=1 → path.slice(1, 2).join('_') = 'project'
    const chain = expandChain('issue', 'IssueView', ['issue', 'project'], multiQsm, multiPdm);
    expect(chain.steps).toHaveLength(1);
    expect(chain.steps[0]!.toAlias).toBe('project');
  });

  it('two-hop path produces underscore-joined alias for each step', () => {
    // path ['issue', 'sprint', 'project']
    //   step i=1: path.slice(1, 2).join('_') = 'sprint'
    //   step i=2: path.slice(1, 3).join('_') = 'sprint_project'
    const chain = expandChain('issue', 'IssueView', ['issue', 'sprint', 'project'], multiQsm, multiPdm);
    expect(chain.steps).toHaveLength(2);
    expect(chain.steps[0]!.toAlias).toBe('sprint');
    expect(chain.steps[1]!.toAlias).toBe('sprint_project');
  });
});

describe('chainToSqlJoins — collision-free aliases for multi-hop (bug_007)', () => {
  it('two-hop chain produces joins with aliases sprint and sprint_project', () => {
    const chain = expandChain('issue', 'IssueView', ['issue', 'sprint', 'project'], multiQsm, multiPdm);
    const joins = chainToSqlJoins(chain, multiQsm);
    expect(joins).toHaveLength(2);
    expect(joins[0]!.alias).toBe('sprint');
    expect(joins[1]!.alias).toBe('sprint_project');
  });

  it('two-hop chain second join ON references sprint alias, not issue alias', () => {
    const chain = expandChain('issue', 'IssueView', ['issue', 'sprint', 'project'], multiQsm, multiPdm);
    const joins = chainToSqlJoins(chain, multiQsm);
    // Second join: sprint_project ON sprint.project_id = sprint_project.id
    expect(joins[1]!.on).toMatchObject({
      kind: 'op',
      op: 'eq',
      args: [
        { kind: 'col', table: 'sprint', column: 'project_id' },
        { kind: 'col', table: 'sprint_project', column: 'id' },
      ],
    });
  });
});
