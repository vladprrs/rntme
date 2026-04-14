import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Database from 'better-sqlite3';
import { parsePdm, validatePdm, createPdmResolver } from '@rntme/pdm';
import { parseQsm, validateQsm, generateProjectionDdl } from '@rntme/qsm';
import { bootstrapProjections } from '../../src/store/bootstrap.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function readFixture(name: string): string {
  return readFileSync(join(fixtureDir, name), 'utf8');
}

function loadIssueTrackerDdls() {
  const pdmRaw = parsePdm(readFixture('issue-tracker.pdm.json'));
  if (!pdmRaw.ok) throw new Error(JSON.stringify(pdmRaw.errors));
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error(JSON.stringify(pdm.errors));
  const resolver = createPdmResolver(pdm.value);

  const qsmRaw = parseQsm(readFixture('issue-tracker.qsm.json'));
  if (!qsmRaw.ok) throw new Error(JSON.stringify(qsmRaw.errors));
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error(JSON.stringify(qsm.errors));

  return generateProjectionDdl(qsm.value, resolver);
}

describe('bootstrapProjections', () => {
  it('creates the projection table from issue-tracker ProjectionDdlSpec', () => {
    const db = new Database(':memory:');
    const ddls = loadIssueTrackerDdls();
    bootstrapProjections(db, ddls);
    const row = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
      .get(ddls[0]!.tableName) as { name: string } | undefined;
    expect(row?.name).toBe('projection_issue');
    db.close();
  });

  it('is idempotent when run twice (IF NOT EXISTS)', () => {
    const db = new Database(':memory:');
    const ddls = loadIssueTrackerDdls();
    bootstrapProjections(db, ddls);
    expect(() => bootstrapProjections(db, ddls)).not.toThrow();
    db.close();
  });

  it('creates indexes from createIndexSql on the projection table', () => {
    const db = new Database(':memory:');
    const ddls = loadIssueTrackerDdls();
    bootstrapProjections(db, ddls);
    const indexes = db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND name NOT LIKE 'sqlite_autoindex%'`,
      )
      .all(ddls[0]!.tableName) as { name: string }[];
    expect(indexes.length).toBe(ddls[0]!.createIndexSql.length);
    expect(indexes.some((i) => i.name.includes('status'))).toBe(true);
    db.close();
  });

  it('materializes idempotency columns on the mirrored table', () => {
    const db = new Database(':memory:');
    const ddls = loadIssueTrackerDdls();
    bootstrapProjections(db, ddls);
    const cols = db.prepare(`PRAGMA table_info(${ddls[0]!.tableName})`).all() as { name: string }[];
    const names = cols.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['last_event_id', 'last_event_version', 'applied_at']));
    db.close();
  });
});
