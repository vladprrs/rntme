import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { createPdmResolver, parsePdm, validatePdm } from '@rntme/pdm';
import {
  createQsmResolver,
  generateProjectionDdl,
  parseQsm,
  validateQsm,
  type ProjectionDdlSpec,
} from '../../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

let db: Database.Database | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

function readFixture(name: string): string {
  return readFileSync(join(fixtureDir, name), 'utf8');
}

function validateFixture(rawQsm: unknown) {
  const pdmParsed = parsePdm(readFixture('issue-tracker.pdm.json'));
  if (!pdmParsed.ok) throw new Error(JSON.stringify(pdmParsed.errors));
  const pdm = validatePdm(pdmParsed.value);
  if (!pdm.ok) throw new Error(JSON.stringify(pdm.errors));
  const pdmResolver = createPdmResolver(pdm.value);

  const qsmParsed = parseQsm(rawQsm);
  if (!qsmParsed.ok) throw new Error(JSON.stringify(qsmParsed.errors));
  const qsm = validateQsm(qsmParsed.value, pdmResolver);
  if (!qsm.ok) throw new Error(JSON.stringify(qsm.errors));

  return {
    qsm: qsm.value,
    qsmResolver: createQsmResolver(qsm.value),
    ddls: generateProjectionDdl(qsm.value, pdmResolver),
  };
}

function bootstrapProjectionTables(conn: Database.Database, ddls: readonly ProjectionDdlSpec[]): void {
  for (const spec of ddls) {
    conn.exec(toIfNotExists(spec.createTableSql));
    for (const indexSql of spec.createIndexSql) {
      conn.exec(toIfNotExists(indexSql));
    }
  }
}

function toIfNotExists(sql: string): string {
  return sql
    .replace(/^CREATE TABLE(?!\s+IF NOT EXISTS)/i, 'CREATE TABLE IF NOT EXISTS')
    .replace(/^CREATE INDEX(?!\s+IF NOT EXISTS)/i, 'CREATE INDEX IF NOT EXISTS');
}

function tableNames(conn: Database.Database): string[] {
  const rows = conn
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
    .all() as { name: string }[];
  return rows.map((row) => row.name);
}

function indexNames(conn: Database.Database, tableName: string): string[] {
  const rows = conn
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name NOT LIKE 'sqlite_autoindex%' ORDER BY name`,
    )
    .all(tableName) as { name: string }[];
  return rows.map((row) => row.name);
}

function tableInfo(conn: Database.Database, tableName: string): { name: string; pk: number }[] {
  return conn.prepare(`PRAGMA table_info("${tableName.replace(/"/g, '""')}")`).all() as {
    name: string;
    pk: number;
  }[];
}

function insertIssueRow(conn: Database.Database, tableName: string): void {
  conn.prepare(
    `INSERT INTO "${tableName.replace(/"/g, '""')}" (
      id,
      project_id,
      reporter_id,
      assignee_id,
      sprint_id,
      title,
      status,
      priority,
      story_points,
      created_at,
      resolved_at,
      last_event_id,
      last_event_version,
      applied_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    101,
    7,
    12,
    null,
    null,
    'Keep QSM DDL honest',
    'open',
    'high',
    5,
    '2026-05-04T00:00:00.000Z',
    null,
    'evt-101',
    1,
    '2026-05-04T00:00:01.000Z',
  );
}

describe('QSM DDL SQLite bootstrap integration', () => {
  it('boots the explicit issue-tracker projection table with mirror and idempotency columns', () => {
    const rawQsm = readFixture('issue-tracker.qsm.json');
    const { ddls, qsmResolver } = validateFixture(rawQsm);
    const ddl = ddls[0]!;
    db = new Database(':memory:');

    bootstrapProjectionTables(db, ddls);
    bootstrapProjectionTables(db, ddls);

    expect(ddl.tableName).toBe('projection_issue');
    expect(tableNames(db)).toContain('projection_issue');
    const columns = tableInfo(db, 'projection_issue').map((column) => column.name);
    expect(columns).toEqual(
      expect.arrayContaining([
        'id',
        'project_id',
        'reporter_id',
        'assignee_id',
        'sprint_id',
        'title',
        'status',
        'priority',
        'story_points',
        'created_at',
        'resolved_at',
        'last_event_id',
        'last_event_version',
        'applied_at',
      ]),
    );
    expect(indexNames(db, 'projection_issue')).toContain('idx_projection_issue_status');

    const mirror = qsmResolver.findEntityMirror('Issue');
    expect(mirror?.table).toBe(ddl.tableName);
    insertIssueRow(db, mirror!.table);
    const row = db
      .prepare(`SELECT title, last_event_version FROM "${mirror!.table}" WHERE id = ?`)
      .get(101) as { title: string; last_event_version: number };
    expect(row).toEqual({ title: 'Keep QSM DDL honest', last_event_version: 1 });
  });

  it('uses the PDM entity table when an entity-mirror projection omits table', () => {
    const { ddls, qsmResolver } = validateFixture({
      projections: {
        IssueView: {
          backing: 'entity-mirror',
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: [
            'id',
            'title',
            'status',
            'priority',
            'storyPoints',
            'assigneeId',
            'reporterId',
            'projectId',
            'resolvedAt',
          ],
        },
      },
      relations: {},
    });
    const ddl = ddls[0]!;
    db = new Database(':memory:');

    bootstrapProjectionTables(db, ddls);

    expect(ddl.tableName).toBe('issues');
    expect(qsmResolver.findEntityMirror('Issue')?.table).toBe('issues');
    expect(tableNames(db)).toContain('issues');
    expect(tableNames(db)).not.toContain('projection_issueview');
    insertIssueRow(db, 'issues');
    const row = db.prepare(`SELECT status FROM "issues" WHERE id = ?`).get(101) as {
      status: string;
    };
    expect(row.status).toBe('open');
  });

  it('boots composite-key mirror DDL as executable SQLite', () => {
    const { ddls } = validateFixture({
      projections: {
        AssignmentView: {
          backing: 'entity-mirror',
          source: { entity: 'IssueAssignment' },
          keys: ['issueId', 'userId'],
          grain: ['issueId', 'userId'],
          exposed: ['issueId', 'userId', 'role', 'status'],
        },
      },
      relations: {},
    });
    const ddl = ddls[0]!;
    db = new Database(':memory:');

    bootstrapProjectionTables(db, ddls);

    expect(ddl.tableName).toBe('issue_assignments');
    const keyColumns = tableInfo(db, 'issue_assignments')
      .filter((column) => column.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((column) => column.name);
    expect(keyColumns).toEqual(['issue_id', 'user_id']);
    expect(indexNames(db, 'issue_assignments')).toContain('idx_issue_assignments_status');

    db.prepare(
      `INSERT INTO "issue_assignments" (
        issue_id,
        user_id,
        role,
        status,
        last_event_id,
        last_event_version,
        applied_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(101, 12, 'owner', 'pending', 'evt-assignment', 1, '2026-05-04T00:00:02.000Z');
    const row = db
      .prepare(`SELECT role FROM "issue_assignments" WHERE issue_id = ? AND user_id = ?`)
      .get(101, 12) as { role: string };
    expect(row.role).toBe('owner');
  });
});
