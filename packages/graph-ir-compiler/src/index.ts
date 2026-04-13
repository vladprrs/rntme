import type Database from 'better-sqlite3';
import { parseAuthoringSpec } from './parse/parse.js';
import { PdmSchema, type Pdm } from './types/pdm.js';
import { QsmSchema, type Qsm } from './types/qsm.js';
import { validateStructural } from './validate/structural/index.js';
import { validateSemantic } from './validate/semantic/index.js';
import { normalize } from './canonical/normalize.js';
import { buildSemanticPlan } from './semantic-plan/build.js';
import { buildRelational } from './relational/build.js';
import { lowerToSqlite } from './lower/sqlite/lower.js';
import { emitSql } from './lower/sqlite/emit.js';
import { executeCompiled, type ParamValues } from './execute/execute.js';
import { err, ok, ERROR_CODES, type Result } from './types/result.js';

export { ok, err, isOk, isErr, ERROR_CODES } from './types/result.js';
export type { Result, GraphIrError, ErrorCode, Layer, Ok, Err } from './types/result.js';
export type { Pdm } from './types/pdm.js';
export type { Qsm } from './types/qsm.js';

export const VERSION = '0.0.0';

export type CompileOptions = { target?: 'sqlite' };

export type CompileResult = {
  sql: string;
  paramOrder: string[];
  shape: { name: string };
};

export function compile(
  rawSpec: unknown,
  rawPdm: unknown,
  rawQsm: unknown,
  _options?: CompileOptions,
): Result<CompileResult> {
  const specR = parseAuthoringSpec(rawSpec);
  if (!specR.ok) return specR;

  const pdmR = PdmSchema.safeParse(rawPdm);
  if (!pdmR.success) {
    return err([
      {
        layer: 'parse',
        code: ERROR_CODES.PARSE_SCHEMA_VIOLATION,
        message: 'PDM failed schema validation',
      },
    ]);
  }
  const qsmR = QsmSchema.safeParse(rawQsm);
  if (!qsmR.success) {
    return err([
      {
        layer: 'parse',
        code: ERROR_CODES.PARSE_SCHEMA_VIOLATION,
        message: 'QSM failed schema validation',
      },
    ]);
  }

  const pdm: Pdm = pdmR.data;
  const qsm: Qsm = qsmR.data;

  const sv = validateStructural(specR.value, pdm, qsm);
  if (!sv.ok) return sv;

  const { graphs } = normalize(sv.value);
  const graphIds = Object.keys(graphs);
  if (graphIds.length !== 1) {
    return err([
      {
        layer: 'canonical',
        code: ERROR_CODES.STRUCT_DUPLICATE_GRAPH_ID,
        message: 'Tier 1 MVP compiles exactly one graph per call',
      },
    ]);
  }
  const graph = graphs[graphIds[0]!]!;

  const semR = validateSemantic(graph, pdm, qsm);
  if (!semR.ok) return semR;

  const planR = buildSemanticPlan(graph, pdm, qsm);
  if (!planR.ok) return planR;
  const rel = buildRelational(planR.value);
  const { ast, paramOrder } = lowerToSqlite(rel);
  const sql = emitSql(ast);

  const shapeName = graph.signature.output.type.replace(/^rowset<|^row<|>$/g, '');
  return ok({ sql, paramOrder, shape: { name: shapeName } });
}

export function execute(
  compiled: CompileResult,
  paramValues: ParamValues,
  db: Database.Database,
): unknown[] {
  return executeCompiled(compiled, paramValues, db);
}

export function run(
  rawSpec: unknown,
  rawPdm: unknown,
  rawQsm: unknown,
  paramValues: ParamValues,
  db: Database.Database,
  options?: CompileOptions,
): unknown[] {
  const r = compile(rawSpec, rawPdm, rawQsm, options);
  if (!r.ok) {
    throw Object.assign(new Error('compile failed'), { errors: r.errors });
  }
  return execute(r.value, paramValues, db);
}
