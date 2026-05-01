import Database from 'better-sqlite3';

export type DbHandle = Database.Database;

/**
 * Given an open writable handle, produce a companion read-only handle when the
 * backing store is a persistent file, or reuse the writable handle when it is
 * `:memory:`. In-memory mode relies on the SQL whitelist as its only guard.
 */
export function openReadonlyCompanion(writable: DbHandle): DbHandle {
  const filename = writable.name; // better-sqlite3 exposes `.name`; `:memory:` or file path
  if (!filename || filename === ':memory:' || filename === '') {
    return writable;
  }
  return new Database(filename, { readonly: true, fileMustExist: true });
}
