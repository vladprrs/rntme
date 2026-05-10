import { openSqliteDatabase } from '@rntme/sqlite';
import type { DbDriver, DbHandle, DbOpenOpts } from './interfaces.js';

export class BunSqliteDriver implements DbDriver {
  open(opts: DbOpenOpts): DbHandle {
    return openSqliteDatabase({ filename: opts.path });
  }
}
