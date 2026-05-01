import { describe, it, expect } from 'vitest';
import { classifyStatement } from '../../src/whitelist/classify.js';

const allowed = (sql: string) => expect(classifyStatement(sql).ok).toBe(true);
const rejected = (sql: string, code: string) => {
  const r = classifyStatement(sql);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.error.code).toBe(code);
};

describe('classifyStatement allowed', () => {
  it('simple SELECT', () => allowed('SELECT 1'));
  it('SELECT from table', () => allowed('SELECT * FROM events LIMIT 10'));
  it('WITH ... SELECT', () => allowed('WITH x AS (SELECT 1) SELECT * FROM x'));
  it('WITH RECURSIVE ... SELECT', () => allowed('WITH RECURSIVE t(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM t) SELECT n FROM t LIMIT 5'));
  it('EXPLAIN', () => allowed('EXPLAIN SELECT 1'));
  it('EXPLAIN QUERY PLAN', () => allowed('EXPLAIN QUERY PLAN SELECT 1'));
  it('leading whitespace + comment', () => allowed('  -- comment\n  SELECT 1'));
  it('PRAGMA table_info', () => allowed('PRAGMA table_info(events)'));
  it('PRAGMA schema_version', () => allowed('PRAGMA schema_version'));
});

describe('classifyStatement rejected — write forms', () => {
  it('INSERT', () => rejected('INSERT INTO events VALUES (1)', 'DB_STUDIO_READONLY_NOT_SELECT'));
  it('UPDATE', () => rejected('UPDATE events SET id=1', 'DB_STUDIO_READONLY_NOT_SELECT'));
  it('DELETE', () => rejected('DELETE FROM events', 'DB_STUDIO_READONLY_NOT_SELECT'));
  it('REPLACE', () => rejected('REPLACE INTO events VALUES (1)', 'DB_STUDIO_READONLY_NOT_SELECT'));
  it('CREATE TABLE', () => rejected('CREATE TABLE x (a INT)', 'DB_STUDIO_READONLY_NOT_SELECT'));
  it('DROP TABLE', () => rejected('DROP TABLE events', 'DB_STUDIO_READONLY_NOT_SELECT'));
  it('ALTER TABLE', () => rejected('ALTER TABLE events ADD COLUMN x INT', 'DB_STUDIO_READONLY_NOT_SELECT'));
  it('VACUUM', () => rejected('VACUUM', 'DB_STUDIO_READONLY_NOT_SELECT'));
});

describe('classifyStatement rejected — special codes', () => {
  it('ATTACH', () => rejected('ATTACH DATABASE ":memory:" AS evil', 'DB_STUDIO_READONLY_ATTACH_DENIED'));
  it('DETACH', () => rejected('DETACH DATABASE evil', 'DB_STUDIO_READONLY_ATTACH_DENIED'));
  it('BEGIN', () => rejected('BEGIN', 'DB_STUDIO_READONLY_TXN_DENIED'));
  it('COMMIT', () => rejected('COMMIT', 'DB_STUDIO_READONLY_TXN_DENIED'));
  it('ROLLBACK', () => rejected('ROLLBACK', 'DB_STUDIO_READONLY_TXN_DENIED'));
  it('SAVEPOINT', () => rejected('SAVEPOINT sp', 'DB_STUDIO_READONLY_TXN_DENIED'));
  it('PRAGMA writable_schema', () => rejected('PRAGMA writable_schema = 1', 'DB_STUDIO_READONLY_PRAGMA_DENIED'));
  it('PRAGMA journal_mode', () => rejected('PRAGMA journal_mode = WAL', 'DB_STUDIO_READONLY_PRAGMA_DENIED'));
  it('WITH + INSERT body', () =>
    rejected(
      "WITH x AS (INSERT INTO events VALUES (1) RETURNING id) SELECT * FROM x",
      'DB_STUDIO_READONLY_CTE_WRITE',
    ));
  it('WITH + UPDATE body', () =>
    rejected(
      "WITH x AS (UPDATE events SET id=1 RETURNING id) SELECT * FROM x",
      'DB_STUDIO_READONLY_CTE_WRITE',
    ));
});

describe('classifyStatement — shape errors', () => {
  it('empty', () => rejected('', 'DB_STUDIO_PARSE_SYNTAX'));
  it('whitespace only', () => rejected('   ', 'DB_STUDIO_PARSE_SYNTAX'));
  it('multiple statements', () =>
    rejected('SELECT 1; SELECT 2', 'DB_STUDIO_PARSE_MULTIPLE_STATEMENTS'));
});
