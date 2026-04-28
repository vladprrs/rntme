import type BetterSqlite3 from 'better-sqlite3';
import { runtimeError } from '../types/errors.js';

export type ParamValues = Record<string, unknown>;

export type CompiledForExecute = {
  sql: string;
  paramOrder: string[];
  optionalParams?: string[];
  paramDefaults?: Record<string, unknown>;
};

export function executeCompiled(
  compiled: CompiledForExecute,
  paramValues: ParamValues,
  db: BetterSqlite3.Database,
): unknown[] {
  const optionalSet = compiled.optionalParams?.length ? new Set(compiled.optionalParams) : undefined;
  const defaults = compiled.paramDefaults ?? {};

  const positional = compiled.paramOrder.map((name) => {
    if (Object.prototype.hasOwnProperty.call(paramValues, name)) {
      const v = paramValues[name];
      return v === undefined ? null : v;
    }
    if (Object.hasOwn(defaults, name)) {
      return defaults[name];
    }
    if (optionalSet?.has(name)) {
      return null;
    }
    throw runtimeError('RUNTIME_MISSING_REQUIRED_PARAM', `missing required param "${name}"`);
  });
  try {
    const stmt = db.prepare(compiled.sql);
    return stmt.all(...positional);
  } catch (e) {
    throw runtimeError('RUNTIME_SQLITE_ERROR', e instanceof Error ? e.message : 'sqlite error');
  }
}
