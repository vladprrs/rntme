import type { Pool, PoolClient } from 'pg';

export type TxClient = PoolClient & { __tx: true };

type ResultErrLike = {
  readonly ok: false;
  readonly errors: readonly unknown[];
};

export async function withTransaction<T>(
  pool: Pool,
  orgId: string | null,
  fn: (client: TxClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // SET LOCAL only accepts literal constants, not bound parameters.
    // set_config(name, value, is_local=true) is the equivalent that
    // does accept parameters.
    if (orgId) await client.query(`SELECT set_config('app.org_id', $1, true)`, [orgId]);
    const out = await fn(client as TxClient);
    if (isResultErrLike(out)) {
      await client.query('ROLLBACK');
      return out;
    }
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

function isResultErrLike(value: unknown): value is ResultErrLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { readonly ok?: unknown }).ok === false &&
    Array.isArray((value as { readonly errors?: unknown }).errors)
  );
}
