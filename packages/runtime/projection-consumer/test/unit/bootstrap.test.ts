import { describe, it, expect, afterEach } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openSqliteDatabase, type SqliteDatabase } from '@rntme/sqlite';
import { parsePdm, validatePdm, createPdmResolver } from '@rntme/pdm';
import { parseQsm, validateQsm, generateProjectionDdl } from '@rntme/qsm';
import { bootstrapProjections } from '../../src/store/bootstrap.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

let db: SqliteDatabase | undefined;

afterEach(() => {
  db?.close();
  db = undefined;
});

function setup() {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error(JSON.stringify(pdmRaw.errors));
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error(JSON.stringify(pdm.errors));
  const resolver = createPdmResolver(pdm.value);

  const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
  if (!qsmRaw.ok) throw new Error(JSON.stringify(qsmRaw.errors));
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error(JSON.stringify(qsm.errors));

  return { ddls: generateProjectionDdl(qsm.value, resolver) };
}

describe('bootstrapProjections', () => {
  it('creates one table per projection with the declared name', () => {
    db = openSqliteDatabase({ filename: ':memory:' });
    const { ddls } = setup();
    bootstrapProjections(db, ddls);
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`)
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toContain('projection_issue');
  });

  it('projection table has all mirror columns plus idempotency', () => {
    db = openSqliteDatabase({ filename: ':memory:' });
    const { ddls } = setup();
    bootstrapProjections(db, ddls);
    const tableName = ddls[0]!.tableName;
    const cols = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toEqual(
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
        'resolved_at',
        'created_at',
        'last_event_id',
        'last_event_version',
        'applied_at',
      ]),
    );
  });

  it('creates declared indexes', () => {
    db = openSqliteDatabase({ filename: ':memory:' });
    const { ddls } = setup();
    bootstrapProjections(db, ddls);
    const idx = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name NOT LIKE 'sqlite_autoindex%'`,
      )
      .all(ddls[0]!.tableName) as { name: string }[];
    expect(idx.map((r) => r.name)).toContain('idx_projection_issue_status');
  });

  it('idempotent twice', () => {
    const conn = openSqliteDatabase({ filename: ':memory:' });
    db = conn;
    const { ddls } = setup();
    bootstrapProjections(conn, ddls);
    expect(() => bootstrapProjections(conn, ddls)).not.toThrow();
  });
});
