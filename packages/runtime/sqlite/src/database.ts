import { Database as BunDatabase } from 'bun:sqlite';
import type { SQLQueryBindings } from 'bun:sqlite';

export type SqliteRunResult = {
  readonly changes: number;
  readonly lastInsertRowid: number | bigint;
};

export type SqliteParamValue = Exclude<SQLQueryBindings, Record<string, unknown>>;
export type SqliteNamedParams = Record<string, SqliteParamValue>;
export type SqliteParams = readonly SqliteParamValue[] | SqliteNamedParams | undefined;

export interface SqliteStatement<P extends SqliteParams = SqliteParams, R = unknown> {
  run(...args: P extends readonly unknown[] ? P : [P]): SqliteRunResult;
  get(...args: P extends readonly unknown[] ? P : [P]): R | undefined;
  all(...args: P extends readonly unknown[] ? P : [P]): R[];
  finalize(): void;
}

export interface SqliteTransaction<A extends readonly unknown[], R> {
  (...args: A): R;
  immediate(...args: A): R;
  exclusive(...args: A): R;
  deferred(...args: A): R;
}

export interface SqliteDatabase {
  prepare<P extends SqliteParams = SqliteParams, R = unknown>(sql: string): SqliteStatement<P, R>;
  exec(sql: string): void;
  pragma(stmt: string): void;
  transaction<A extends readonly unknown[], R>(fn: (...args: A) => R): SqliteTransaction<A, R>;
  close(): void;
  raw(): BunDatabase;
}

export type OpenSqliteOptions = Readonly<{
  filename: string | ':memory:';
  readonly?: boolean;
  strict?: boolean;
}>;

export function openSqliteDatabase(opts: OpenSqliteOptions): SqliteDatabase {
  const db = new BunDatabase(opts.filename, {
    readonly: opts.readonly ?? false,
    strict: opts.strict ?? true,
    create: !opts.readonly,
  });

  return {
    prepare<P extends SqliteParams = SqliteParams, R = unknown>(sql: string): SqliteStatement<P, R> {
      const stmt = db.prepare<R, SQLQueryBindings[]>(sql);
      return {
        run(...args: unknown[]) {
          const result = isNamedParamCall(args)
            ? stmt.run(args[0] as SQLQueryBindings)
            : stmt.run(...toSqliteArgs(args));
          return {
            changes: Number(result.changes),
            lastInsertRowid: result.lastInsertRowid,
          };
        },
        get(...args: unknown[]) {
          const row = isNamedParamCall(args)
            ? stmt.get(args[0] as SQLQueryBindings)
            : stmt.get(...toSqliteArgs(args));
          return row ?? undefined;
        },
        all(...args: unknown[]) {
          return isNamedParamCall(args)
            ? stmt.all(args[0] as SQLQueryBindings)
            : stmt.all(...toSqliteArgs(args));
        },
        finalize() {
          stmt.finalize();
        },
      } as SqliteStatement<P, R>;
    },
    exec(sql) {
      db.exec(sql);
    },
    pragma(stmt) {
      db.exec(`PRAGMA ${stmt}`);
    },
    transaction<A extends readonly unknown[], R>(fn: (...args: A) => R): SqliteTransaction<A, R> {
      return db.transaction(fn as unknown as (...args: unknown[]) => R) as unknown as SqliteTransaction<A, R>;
    },
    close() {
      db.close();
    },
    raw() {
      return db;
    },
  };
}

function toSqliteArgs(args: readonly unknown[]): SQLQueryBindings[] {
  return args as SQLQueryBindings[];
}

function isNamedParamCall(args: readonly unknown[]): boolean {
  return args.length === 1 && isParamObject(args[0]);
}

function isParamObject(v: unknown): v is SqliteNamedParams {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array);
}
