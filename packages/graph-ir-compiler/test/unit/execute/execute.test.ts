import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { executeCompiled } from '../../../src/execute/execute.js';

describe('executeCompiled', () => {
  it('throws RUNTIME_SQLITE_ERROR for malformed SQL', () => {
    const db = new Database(':memory:');
    try {
      const compiled = { sql: 'SELECT FROM', paramOrder: [] };
      try {
        executeCompiled(compiled, {}, db);
        throw new Error('expected throw');
      } catch (e) {
        expect((e as { code?: string }).code).toBe('RUNTIME_SQLITE_ERROR');
        expect((e as Error).message).toMatch(/syntax/i);
      }
    } finally {
      db.close();
    }
  });
});
