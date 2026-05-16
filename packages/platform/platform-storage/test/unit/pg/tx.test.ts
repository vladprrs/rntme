import { describe, expect, it } from 'bun:test';
import { err, ok, type PlatformError, type Result } from '@rntme/platform-core';
import type { Pool, PoolClient, QueryResult } from 'pg';
import {
  withOptionalTransaction,
  withSystemRlsDisabled,
  withTransaction,
} from '../../../src/pg/tx.js';

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

describe('withOptionalTransaction', () => {
  it('reuses an existing transaction client without BEGIN/COMMIT', async () => {
    const client = new FakeClient();

    const result = await withOptionalTransaction<number, PlatformError>(
      client as unknown as PoolClient,
      async () => ok(7),
    );

    expect(result).toEqual(ok(7));
    expect(client.queries).toEqual([]);
    expect(client.released).toBe(false);
  });

  it('wraps a Pool callback in BEGIN/COMMIT on Result.ok', async () => {
    const client = new FakeClient();

    const result = await withOptionalTransaction<number, PlatformError>(
      fakePool(client),
      async () => ok(42),
    );

    expect(result).toEqual(ok(42));
    expect(client.queries).toEqual(['BEGIN', 'COMMIT']);
    expect(client.released).toBe(true);
  });

  it('rolls back on Result.err', async () => {
    const client = new FakeClient();

    const result = await withOptionalTransaction<number, PlatformError>(
      fakePool(client),
      async (): Promise<Result<number, PlatformError>> =>
        err([{ code: 'PLATFORM_INTERNAL', message: 'boom' }]),
    );

    expect(result.ok).toBe(false);
    expect(client.queries).toEqual(['BEGIN', 'ROLLBACK']);
    expect(client.released).toBe(true);
  });
});

describe('withSystemRlsDisabled', () => {
  it('issues SET LOCAL row_security = off on an existing transaction client', async () => {
    const client = new FakeClient();

    await withSystemRlsDisabled(client as unknown as PoolClient, async () => undefined);

    expect(client.queries).toEqual(['SET LOCAL row_security = off']);
    expect(client.released).toBe(false);
  });

  it('wraps a Pool callback in BEGIN, SET LOCAL row_security = off, COMMIT', async () => {
    const client = new FakeClient();

    await withSystemRlsDisabled(fakePool(client), async () => undefined);

    expect(client.queries).toEqual(['BEGIN', 'SET LOCAL row_security = off', 'COMMIT']);
    expect(client.released).toBe(true);
  });

  it('rolls back when the callback throws', async () => {
    const client = new FakeClient();

    await expect(
      withSystemRlsDisabled(fakePool(client), async () => {
        throw new Error('callback failure');
      }),
    ).rejects.toThrow('callback failure');

    expect(client.queries).toEqual(['BEGIN', 'SET LOCAL row_security = off', 'ROLLBACK']);
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
