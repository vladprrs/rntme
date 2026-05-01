import Database from 'better-sqlite3';
import type { DbDriver, DbHandle, DbOpenOpts } from './interfaces.js';

export class BetterSqliteDriver implements DbDriver {
  open(opts: DbOpenOpts): DbHandle {
    return new Database(opts.path);
  }
}
