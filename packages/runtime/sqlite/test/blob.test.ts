import { describe, expect, it } from 'bun:test';

import { toBuffer, toUint8Array } from '../src/blob.js';
import { openSqliteDatabase } from '../src/database.js';

describe('Sqlite BLOB normalization', () => {
  it('round-trips BLOBs and returns Buffer-compatible values via toBuffer', () => {
    const db = openSqliteDatabase({ filename: ':memory:' });
    db.exec(`CREATE TABLE b (k TEXT PRIMARY KEY, v BLOB)`);
    const payload = Buffer.from('hello world', 'utf8');
    db.prepare<[string, Buffer], never>('INSERT INTO b (k, v) VALUES (?, ?)').run('k1', payload);
    const row = db.prepare<[string], { v: Uint8Array | Buffer }>(
      'SELECT v FROM b WHERE k=?',
    ).get('k1');
    expect(row).toBeDefined();
    const buf = toBuffer(row!.v);
    expect(buf.toString('utf8')).toBe('hello world');
    db.close();
  });

  it('toUint8Array accepts Buffer or Uint8Array', () => {
    const a = toUint8Array(Buffer.from([1, 2, 3]));
    expect(Array.from(a)).toEqual([1, 2, 3]);
    const b = toUint8Array(new Uint8Array([4, 5]));
    expect(Array.from(b)).toEqual([4, 5]);
  });
});
