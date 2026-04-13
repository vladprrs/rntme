import type BetterSqlite3 from 'better-sqlite3';

export type ParamValues = Record<string, unknown>;

export type CompiledForExecute = {
  sql: string;
  paramOrder: string[];
};

export function executeCompiled(
  compiled: CompiledForExecute,
  paramValues: ParamValues,
  db: BetterSqlite3.Database,
): unknown[] {
  const positional = compiled.paramOrder.map((name) => {
    if (!(name in paramValues)) {
      throw Object.assign(new Error(`missing required param "${name}"`), {
        code: 'RUNTIME_MISSING_REQUIRED_PARAM',
      });
    }
    const v = paramValues[name];
    return v === undefined ? null : v;
  });
  try {
    const stmt = db.prepare(compiled.sql);
    return stmt.all(...positional);
  } catch (e) {
    throw Object.assign(new Error(e instanceof Error ? e.message : 'sqlite error'), {
      code: 'RUNTIME_SQLITE_ERROR',
    });
  }
}
