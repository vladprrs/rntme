import { describe, expect, it } from 'bun:test';

import { openSqliteDatabase } from '../src/database.js';

describe('SqliteDatabase port', () => {
  it('opens an in-memory database and runs WAL pragma', () => {
    const db = openSqliteDatabase({ filename: ':memory:' });
    db.pragma('journal_mode = WAL');
    db.close();
  });

  it('prepares with positional and named params and returns RunResult', () => {
    const db = openSqliteDatabase({ filename: ':memory:' });
    db.exec(`CREATE TABLE t (id INTEGER PRIMARY KEY, v INTEGER, n TEXT)`);
    const insertPos = db.prepare<[number, string], never>(
      'INSERT INTO t (v, n) VALUES (?, ?)',
    );
    const r1 = insertPos.run(10, 'a');
    expect(r1.changes).toBe(1);
    expect(typeof r1.lastInsertRowid === 'number' || typeof r1.lastInsertRowid === 'bigint').toBe(true);

    const insertNamed = db.prepare<{ v: number; n: string }, never>(
      'INSERT INTO t (v, n) VALUES (@v, @n)',
    );
    insertNamed.run({ v: 20, n: 'b' });

    const all = db.prepare<[], { v: number; n: string }>(
      'SELECT v, n FROM t ORDER BY id ASC',
    ).all();
    expect(all).toEqual([
      { v: 10, n: 'a' },
      { v: 20, n: 'b' },
    ]);
    db.close();
  });

  it('runs transactions and propagates errors', () => {
    const db = openSqliteDatabase({ filename: ':memory:' });
    db.exec(`CREATE TABLE t (id INTEGER PRIMARY KEY)`);
    const insert = db.prepare<[number], never>('INSERT INTO t (id) VALUES (?)');
    const tx = db.transaction((ids: readonly number[]) => {
      for (const id of ids) insert.run(id);
      return ids.length;
    });
    expect(tx.immediate([1, 2, 3])).toBe(3);
    expect(() => tx.immediate([1])).toThrow(/UNIQUE/);
    const count = db.prepare<[], { c: number }>('SELECT COUNT(*) AS c FROM t').get();
    expect(count?.c).toBe(3);
    db.close();
  });

  it('exposes a changes RunResult for UPDATE statements', () => {
    const db = openSqliteDatabase({ filename: ':memory:' });
    db.exec(`CREATE TABLE t (id INTEGER PRIMARY KEY, v INTEGER)`);
    db.prepare<[number, number], never>('INSERT INTO t (id, v) VALUES (?, ?)').run(1, 10);
    const r = db.prepare<[number, number], never>('UPDATE t SET v=? WHERE id=?').run(99, 1);
    expect(r.changes).toBe(1);
    db.close();
  });
});
