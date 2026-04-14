import Database from 'better-sqlite3';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { EventEnvelope } from '../types/envelope.js';
import type { AppendRequest, AppendResult } from '../types/append.js';
import type { EventStore, ReadFromOptions } from './interface.js';
import { applyEventStoreSchema } from './schema.js';

export type SqliteEventStoreOptions = Readonly<{
  filename: string;
  applySchema?: boolean;
  busyTimeoutMs?: number;
}>;

export class SqliteEventStore implements EventStore {
  private readonly db: BetterSqliteDatabase;

  constructor(options: SqliteEventStoreOptions) {
    this.db = new Database(options.filename);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma(`busy_timeout = ${options.busyTimeoutMs ?? 5000}`);
    this.db.pragma('foreign_keys = ON');
    if (options.applySchema !== false) {
      applyEventStoreSchema(this.db);
    }
  }

  close(): void {
    this.db.close();
  }

  /** Test / advanced use only: direct handle for fixtures or custom queries. */
  rawDb(): BetterSqliteDatabase {
    return this.db;
  }

  appendEvents(_requests: readonly AppendRequest[]): AppendResult[] {
    throw new Error('not implemented — Task 5');
  }
  readStream(_stream: string): EventEnvelope[] {
    throw new Error('not implemented — Task 8');
  }
  readFrom(_opts: ReadFromOptions): EventEnvelope[] {
    throw new Error('not implemented — Task 9');
  }
  readCursor(_relayId: string): number {
    throw new Error('not implemented — Task 10');
  }
  writeCursor(_relayId: string, _lastEventId: number): void {
    throw new Error('not implemented — Task 10');
  }
}
