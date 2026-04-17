/**
 * Shared three-entity PDM + QSM fixture for alias-collision and dedup tests.
 *
 * Scenario: Issue → Sprint → Project (two-hop) and Issue → Project (direct).
 * Both paths reach ProjMirror via different parents, so they must receive
 * distinct join aliases ("sprint_project" vs "project").
 *
 * Used by: joins-qsm.test.ts (multi-hop alias tests) and joins-dedup.test.ts
 * (bug_007 / bug_010 integration tests).
 */
import { createPdmResolver, parsePdm, validatePdm } from '@rntme/pdm';
import { validateQsm } from '@rntme/qsm';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';

const rawPdm = {
  entities: {
    Issue: {
      table: 'issues',
      fields: {
        id: { type: 'integer', nullable: false, column: 'id' },
        projectId: { type: 'integer', nullable: false, column: 'project_id' },
        sprintId: { type: 'integer', nullable: false, column: 'sprint_id' },
        title: { type: 'string', nullable: false, column: 'title' },
        status: { type: 'string', nullable: false, column: 'status' },
      },
      relations: {
        project: { to: 'Project', cardinality: 'one', localKey: 'projectId', foreignKey: 'id' },
        sprint: { to: 'Sprint', cardinality: 'one', localKey: 'sprintId', foreignKey: 'id' },
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
        key: { type: 'string', nullable: false, column: 'key' },
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
    Sprint: {
      table: 'sprints',
      fields: {
        id: { type: 'integer', nullable: false, column: 'id' },
        projectId: { type: 'integer', nullable: false, column: 'project_id' },
        name: { type: 'string', nullable: false, column: 'name' },
        status: { type: 'string', nullable: false, column: 'status' },
      },
      relations: {
        project: { to: 'Project', cardinality: 'one', localKey: 'projectId', foreignKey: 'id' },
      },
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
      exposed: ['id', 'projectId', 'sprintId', 'title'],
    },
    ProjMirror: {
      backing: 'entity-mirror' as const,
      source: { entity: 'Project' },
      keys: ['id'],
      grain: ['id'],
      exposed: ['id', 'name', 'key'],
    },
    SprintMirror: {
      backing: 'entity-mirror' as const,
      source: { entity: 'Sprint' },
      keys: ['id'],
      grain: ['id'],
      exposed: ['id', 'projectId', 'name'],
    },
  },
  relations: {
    'IssueView.project': {
      to: 'ProjMirror',
      localKey: 'projectId',
      foreignKey: 'id',
      cardinality: 'one' as const,
    },
    'IssueView.sprint': {
      to: 'SprintMirror',
      localKey: 'sprintId',
      foreignKey: 'id',
      cardinality: 'one' as const,
    },
    'SprintMirror.project': {
      to: 'ProjMirror',
      localKey: 'projectId',
      foreignKey: 'id',
      cardinality: 'one' as const,
    },
  },
};

export function buildIssueSprintProjectFixtures(): { pdm: ValidatedPdm; qsm: ValidatedQsm } {
  const pdmParsed = parsePdm(rawPdm);
  if (!pdmParsed.ok) throw new Error(`parsePdm: ${JSON.stringify(pdmParsed.errors)}`);
  const pdmVal = validatePdm(pdmParsed.value);
  if (!pdmVal.ok) throw new Error(`validatePdm: ${JSON.stringify(pdmVal.errors)}`);
  const pdm = pdmVal.value;
  const qsmVal = validateQsm(rawQsm, createPdmResolver(pdm));
  if (!qsmVal.ok) throw new Error(`validateQsm: ${JSON.stringify(qsmVal.errors)}`);
  return { pdm, qsm: qsmVal.value };
}

export const issueSprintProjectFixtures: { pdm: ValidatedPdm; qsm: ValidatedQsm } =
  buildIssueSprintProjectFixtures();
