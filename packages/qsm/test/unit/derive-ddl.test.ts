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
import { validateQsm } from '../../src/validate/index.js';
import { generateProjectionDdl } from '../../src/derive/ddl.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup(qsmInput: unknown) {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error('pdm parse');
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error('pdm validate');
  const resolver = createPdmResolver(pdm.value);

  const qsmRaw = parseQsm(qsmInput);
  if (!qsmRaw.ok) throw new Error('qsm parse');
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error('qsm validate: ' + JSON.stringify(qsm.errors));
  return { qsm: qsm.value, resolver };
}

const QSM_ISSUE_MIRROR = {
  projections: {
    IssueView: {
      backing: 'entity-mirror',
      source: { entity: 'Issue' },
      keys: ['id'],
      grain: ['id'],
      exposed: ['id', 'title', 'status', 'priority', 'storyPoints', 'assigneeId', 'reporterId', 'projectId', 'resolvedAt'],
    },
  },
  relationRoles: {},
};

describe('generateProjectionDdl', () => {
  it('produces one spec per projection', () => {
    const { qsm, resolver } = setup(QSM_ISSUE_MIRROR);
    const ddls = generateProjectionDdl(qsm, resolver);
    expect(ddls).toHaveLength(1);
    expect(ddls[0]!.projectionName).toBe('IssueView');
    expect(ddls[0]!.tableName).toBe('projection_issueview');
  });

  it('uses explicit table name when provided', () => {
    const { qsm, resolver } = setup({
      projections: {
        IssueView: {
          backing: 'entity-mirror',
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id'],
          table: 'projection_issue',
        },
      },
      relationRoles: {},
    });
    const ddls = generateProjectionDdl(qsm, resolver);
    expect(ddls[0]!.tableName).toBe('projection_issue');
  });

  it('mirrors all entity fields including generated', () => {
    const { qsm, resolver } = setup(QSM_ISSUE_MIRROR);
    const ddl = generateProjectionDdl(qsm, resolver)[0]!;
    const names = ddl.columns.map((c) => c.name);
    // Issue entity has: id, projectId, reporterId, assigneeId, sprintId, title, status, priority, storyPoints, createdAt, resolvedAt
    // Column names are snake_case from PDM field.column mapping
    expect(names).toContain('id');
    expect(names).toContain('status');
    expect(names).toContain('created_at'); // generated "createdAt" still mirrored
    expect(names).toContain('resolved_at');
  });

  it('marks key columns as primaryKey', () => {
    const { qsm, resolver } = setup(QSM_ISSUE_MIRROR);
    const ddl = generateProjectionDdl(qsm, resolver)[0]!;
    const id = ddl.columns.find((c) => c.name === 'id')!;
    expect(id.primaryKey).toBe(true);
    expect(id.sqlType).toBe('INTEGER');
    expect(id.nullable).toBe(false);
    const status = ddl.columns.find((c) => c.name === 'status')!;
    expect(status.primaryKey).toBe(false);
  });

  it('always emits idempotency columns', () => {
    const { qsm, resolver } = setup(QSM_ISSUE_MIRROR);
    const ddl = generateProjectionDdl(qsm, resolver)[0]!;
    const names = ddl.idempotencyColumns.map((c) => c.name);
    expect(names).toEqual(['last_event_id', 'last_event_version', 'applied_at']);
    expect(ddl.idempotencyColumns.every((c) => !c.nullable)).toBe(true);
  });

  it('emits stateField index when entity has stateMachine', () => {
    const { qsm, resolver } = setup(QSM_ISSUE_MIRROR);
    const ddl = generateProjectionDdl(qsm, resolver)[0]!;
    expect(ddl.indexes).toHaveLength(1);
    expect(ddl.indexes[0]!.name).toBe('idx_projection_issueview_status');
    expect(ddl.indexes[0]!.columns).toEqual(['status']);
  });

  it('rendered createTableSql contains all mirror + idempotency columns', () => {
    const { qsm, resolver } = setup(QSM_ISSUE_MIRROR);
    const ddl = generateProjectionDdl(qsm, resolver)[0]!;
    expect(ddl.createTableSql).toContain('CREATE TABLE projection_issueview');
    expect(ddl.createTableSql).toContain('id INTEGER NOT NULL PRIMARY KEY');
    expect(ddl.createTableSql).toContain('status TEXT NOT NULL');
    expect(ddl.createTableSql).toContain('last_event_id TEXT NOT NULL');
    expect(ddl.createTableSql).toContain('last_event_version INTEGER NOT NULL');
    expect(ddl.createTableSql).toContain('applied_at TEXT NOT NULL');
  });

  it('rendered createIndexSql matches indexes array', () => {
    const { qsm, resolver } = setup(QSM_ISSUE_MIRROR);
    const ddl = generateProjectionDdl(qsm, resolver)[0]!;
    expect(ddl.createIndexSql).toHaveLength(1);
    expect(ddl.createIndexSql[0]).toBe('CREATE INDEX idx_projection_issueview_status ON projection_issueview(status);');
  });

  it('maps PDM types to SQL types correctly', () => {
    const { qsm, resolver } = setup(QSM_ISSUE_MIRROR);
    const ddl = generateProjectionDdl(qsm, resolver)[0]!;
    const story = ddl.columns.find((c) => c.name === 'story_points')!;
    expect(story.sqlType).toBe('INTEGER');
    const title = ddl.columns.find((c) => c.name === 'title')!;
    expect(title.sqlType).toBe('TEXT');
    const resolvedAt = ddl.columns.find((c) => c.name === 'resolved_at')!;
    expect(resolvedAt.sqlType).toBe('TEXT');
    expect(resolvedAt.nullable).toBe(true);
  });
});
