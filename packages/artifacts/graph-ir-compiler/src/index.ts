import type Database from 'better-sqlite3';
import { parseAuthoringSpec } from './parse/parse.js';
import { validateStructural } from './validate/structural/index.js';
import { validateSemantic } from './validate/semantic/index.js';
import { normalize } from './canonical/normalize.js';
import { buildSemanticPlan } from './semantic-plan/build.js';
import { buildRelational } from './relational/build.js';
import { lowerToSqlite } from './lower/sqlite/lower.js';
import { emitSql } from './lower/sqlite/emit.js';
import { executeCompiled, type ParamValues } from './execute/execute.js';
import { err, ok, ERROR_CODES, type Result } from './types/result.js';
import { parseGraphIrArtifacts, type ExplainArtifacts, type ExplainOutput } from './explain/explain.js';
import { compileCommand } from './command-runtime/compile.js';
import { executeCommand, type ExecuteCommandContext, type CorrelationCtx } from './command-runtime/execute.js';
import type { CommandResult } from './types/command.js';
import { compileFailed, toGraphIrError } from './types/errors.js';

export { compileCommand };
export { executeCommand, type ExecuteCommandContext, type CorrelationCtx };
export { CommandExecutionError } from './command-runtime/errors.js';
export type { CommandResult, CompiledCommand, EmitPlan } from './types/command.js';
export { inferRole, type GraphRole } from './role/infer.js';
export { deriveEventTypeName } from './emit/event-type.js';

export { ok, err, isOk, isErr, ERROR_CODES } from './types/result.js';
export type { Result, GraphIrError, ErrorCode, Layer, Ok, Err } from './types/result.js';
export { GraphIrCompileError, GraphIrInternalError, GraphIrRuntimeError } from './types/errors.js';
export type { ValidatedPdm } from '@rntme/pdm';
export type { ValidatedQsm } from '@rntme/qsm';
export type { ExplainOutput } from './explain/explain.js';

export { parseAuthoringSpec } from './parse/parse.js';
export { validateStructural } from './validate/structural/index.js';
export { validateSemantic } from './validate/semantic/index.js';
export { normalize } from './canonical/normalize.js';

export type {
  DerivedCompileResult,
  DerivedTableSchema,
  DerivedGroupColumn,
  DerivedMeasureColumn,
  DerivedColumnBinding,
  DerivedSqlType,
} from './types/projection.js';

export { compileProjectionGraph, type CompileProjectionOpts } from './projection-compile.js';

export const VERSION = '0.0.0';

export type CompileOptions = { target?: 'sqlite' };

export type CompileResult = {
  sql: string;
  paramOrder: string[];
  shape: { name: string };
  optionalParams: string[];
  paramDefaults: Record<string, unknown>;
};

export function compile(
  rawSpec: unknown,
  rawPdm: unknown,
  rawQsm: unknown,
  _options?: CompileOptions,
): Result<CompileResult> {
  const specR = parseAuthoringSpec(rawSpec);
  if (!specR.ok) return specR;

  const pq = parseGraphIrArtifacts(rawPdm, rawQsm);
  if (!pq.ok) return pq;
  const { pdm, qsm } = pq.value;

  const sv = validateStructural(specR.value, pdm, qsm);
  if (!sv.ok) return sv;

  let canonical;
  try {
    canonical = normalize(sv.value);
  } catch (e) {
    return err([toGraphIrError(e, 'canonical')]);
  }

  const { graphs } = canonical;
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

  const semR = validateSemantic(graph, pdm, qsm, sv.value.shapes);
  if (!semR.ok) return semR;

  const planR = buildSemanticPlan(graph, pdm, qsm);
  if (!planR.ok) return planR;
  let rel;
  try {
    rel = buildRelational(planR.value);
  } catch (e) {
    return err([toGraphIrError(e, 'relational')]);
  }

  const predicateOptionalParams = new Set<string>(
    Object.entries(graph.signature.inputs)
      .filter(([, i]) => i.mode === 'predicate_optional')
      .map(([name]) => name),
  );
  const optionalParams = [...predicateOptionalParams];

  const paramDefaults: Record<string, unknown> = {};
  for (const [name, decl] of Object.entries(graph.signature.inputs)) {
    if (decl.mode === 'defaulted' && decl.default !== undefined) {
      paramDefaults[name] = decl.default;
    }
  }

  let ast;
  let paramOrder;
  let sql;
  try {
    ({ ast, paramOrder } = lowerToSqlite(rel, { predicateOptionalParams, pdm, qsm }));
    sql = emitSql(ast);
  } catch (e) {
    return err([toGraphIrError(e, 'lowering')]);
  }

  const shapeName = graph.signature.output.type.replace(/^rowset<|^row<|>$/g, '');
  return ok({ sql, paramOrder, shape: { name: shapeName }, optionalParams, paramDefaults });
}

export function execute(
  compiled: CompileResult,
  paramValues: ParamValues,
  db: Database.Database,
): unknown[] {
  return executeCompiled(compiled, paramValues, db);
}

export { AuthoringSpecSchema } from './parse/schema.js';

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
    throw compileFailed(r.errors);
  }
  return execute(r.value, paramValues, db);
}

export function runCommand(
  rawSpec: unknown,
  rawPdm: unknown,
  rawQsm: unknown,
  paramValues: Record<string, unknown>,
  ctx: ExecuteCommandContext,
): CommandResult {
  const r = compileCommand(rawSpec, rawPdm, rawQsm);
  if (!r.ok) throw compileFailed(r.errors);
  return executeCommand(r.value, paramValues, ctx);
}

export function explain(rawSpec: unknown, rawPdm: unknown, rawQsm: unknown): ExplainOutput {
  const artifacts: ExplainArtifacts = {};

  const specR = parseAuthoringSpec(rawSpec);
  if (!specR.ok) return { ok: false, artifacts, errors: specR.errors };
  artifacts.parsed = specR.value;

  const pq = parseGraphIrArtifacts(rawPdm, rawQsm);
  if (!pq.ok) return { ok: false, artifacts, errors: pq.errors };

  const { pdm, qsm } = pq.value;

  const sv = validateStructural(specR.value, pdm, qsm);
  if (!sv.ok) return { ok: false, artifacts, errors: sv.errors };

  let canonical;
  try {
    canonical = normalize(sv.value);
  } catch (e) {
    return { ok: false, artifacts, errors: [toGraphIrError(e, 'canonical')] };
  }
  artifacts.canonical = canonical;

  const graphIds = Object.keys(canonical.graphs);
  if (graphIds.length !== 1) {
    return {
      ok: false,
      artifacts,
      errors: [
        {
          layer: 'canonical',
          code: ERROR_CODES.STRUCT_DUPLICATE_GRAPH_ID,
          message: 'Tier 1 MVP compiles exactly one graph per call',
        },
      ],
    };
  }
  const graph = canonical.graphs[graphIds[0]!]!;

  const semR = validateSemantic(graph, pdm, qsm, sv.value.shapes);
  if (!semR.ok) return { ok: false, artifacts, errors: semR.errors };

  const planR = buildSemanticPlan(graph, pdm, qsm);
  if (!planR.ok) return { ok: false, artifacts, errors: planR.errors };
  artifacts.semanticPlan = planR.value;

  let rel;
  try {
    rel = buildRelational(planR.value);
  } catch (e) {
    return { ok: false, artifacts, errors: [toGraphIrError(e, 'relational')] };
  }
  artifacts.relational = rel;

  const predicateOptionalParams = new Set<string>(
    Object.entries(graph.signature.inputs)
      .filter(([, i]) => i.mode === 'predicate_optional')
      .map(([name]) => name),
  );

  let ast;
  let paramOrder;
  let sql;
  try {
    ({ ast, paramOrder } = lowerToSqlite(rel, { predicateOptionalParams, pdm, qsm }));
    sql = emitSql(ast);
  } catch (e) {
    return { ok: false, artifacts, errors: [toGraphIrError(e, 'lowering')] };
  }

  return {
    ok: true,
    value: {
      parsed: specR.value,
      canonical,
      semanticPlan: planR.value,
      relational: rel,
      sql,
      paramOrder,
    },
  };
}
