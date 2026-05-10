import { openSqliteDatabase, type SqliteDatabase } from '@rntme/sqlite';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function makeDb(): SqliteDatabase {
  const db = openSqliteDatabase({ filename: ':memory:' });
  const sql = readFileSync(join(here, 'fixtures', 'commerce.sql'), 'utf8');
  db.exec(sql);
  return db;
}

export function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(here, 'fixtures', name), 'utf8')) as T;
}
