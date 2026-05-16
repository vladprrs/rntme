import type { Pool, PoolClient } from 'pg';
import type { PgQueryable } from './pool.js';

export type TxClient = PoolClient & { __tx: true };

/**
 * Structural shape compatible with `Result<T, E>` from `@rntme/platform-core`.
 * Kept local so `pg/` stays a leaf utility with no cross-package import.
 */
export type ResultLike<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly errors: readonly E[] };

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

/**
 * Runs `fn` inside a transaction when `db` is a Pool; otherwise reuses the
 * caller-supplied transaction client as-is.
 *
 * Commits on `Result.ok`, rolls back on `Result.err`. Used by repos whose
 * write paths must compose with an outer caller's transaction.
 */
export async function withOptionalTransaction<T, E>(
  db: PgQueryable,
  fn: (db: PgQueryable) => Promise<ResultLike<T, E>>,
): Promise<ResultLike<T, E>> {
  if (!isPool(db)) return fn(db);

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    if (result.ok) {
      await client.query('COMMIT');
    } else {
      await client.query('ROLLBACK');
    }
    return result;
  } catch (cause) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failures and surface the original error below
    }
    throw cause;
  } finally {
    client.release();
  }
}

/**
 * Runs `fn` with `row_security = off` scoped to a transaction. When `db` is a
 * Pool we open a fresh transaction; when `db` is already a transaction client
 * we issue `SET LOCAL` directly so the setting reverts at the caller's commit
 * or rollback.
 *
 * Always tx-scoped — `SET LOCAL` is required so admin/system sweeps cannot
 * accidentally leak the disabled-RLS state onto a pooled connection that is
 * later reused for tenant-scoped queries.
 */
export async function withSystemRlsDisabled<T>(
  db: PgQueryable,
  fn: (db: PgQueryable) => Promise<T>,
): Promise<T> {
  if (!isPool(db)) {
    await db.query('SET LOCAL row_security = off');
    return fn(db);
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL row_security = off');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (cause) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback failures and surface the original error below
    }
    throw cause;
  } finally {
    client.release();
  }
}

function isPool(db: PgQueryable): db is Pool {
  // PoolClient exposes `release()`; Pool does not. The inverse check keeps the
  // helper safe even if a future pg-mock-like double adds extra methods.
  return typeof (db as { release?: unknown }).release !== 'function';
}
