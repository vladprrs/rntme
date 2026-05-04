import { describe, expect, it } from 'vitest';
import { err, type PlatformError, type Result } from '@rntme/platform-core';
import type { Pool, PoolClient, QueryResult } from 'pg';
import { withTransaction } from '../../../src/pg/tx.js';

describe('withTransaction', () => {
  it('rolls back when the callback returns Result.err', async () => {
    const client = new FakeClient();

    const result = await withTransaction(
      fakePool(client),
      'org-1',
      async (): Promise<Result<void, PlatformError>> =>
        err([{ code: 'PLATFORM_INTERNAL', message: 'synthetic failure' }]),
    );

    expect(result.ok).toBe(false);
    expect(client.queries).toEqual([
      `BEGIN`,
      `SELECT set_config('app.org_id', $1, true)`,
      `ROLLBACK`,
    ]);
    expect(client.released).toBe(true);
  });
});

class FakeClient {
  readonly queries: string[] = [];
  released = false;

  async query(sql: string): Promise<QueryResult> {
    this.queries.push(sql);
    return { command: '', rowCount: 0, oid: 0, fields: [], rows: [] };
  }

  release(): void {
    this.released = true;
  }
}

function fakePool(client: FakeClient): Pool {
  return {
    connect: async () => client as unknown as PoolClient,
  } as Pool;
}
