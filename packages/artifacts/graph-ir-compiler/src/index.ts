import type Database from 'better-sqlite3';
import { executeCompiled, type ParamValues } from './execute/execute.js';
import { err, ok, type Result } from './types/result.js';
import type { ExplainOutput } from './explain/explain.js';
import { compileFailed } from './types/errors.js';
import { _runPipeline } from './pipeline/run.js';

export { CommandExecutionError } from './command-runtime/errors.js';
export type { EmitPlan } from './types/command.js';
export { deriveEventTypeName } from './emit/event-type.js';

export { ok, err, isOk, isErr, ERROR_CODES } from './types/result.js';
export type { Result, GraphIrError, ErrorCode, Layer, Ok, Err } from './types/result.js';
export { GraphIrCompileError, GraphIrInternalError, GraphIrRuntimeError } from './types/errors.js';
export {
  effectSummaryHasAction,
  effectSummaryHasLocalEmit,
} from './types/effects.js';
export type {
  CallEffect,
  EffectSummary,
  Exposure,
  LocalEmitEffect,
} from './types/effects.js';
export type {
  CompiledOperation,
  OperationCallClient,
  OperationExecutionContext,
  OperationRegistry,
  OperationRegistryEntry,
  OperationResult,
  OperationTarget,
  CorrelationCtx,
} from './types/operation.js';
export type { ValidatedPdm } from '@rntme/pdm';
export type { ValidatedQsm } from '@rntme/qsm';
export type { ExplainOutput } from './explain/explain.js';

export { parseAuthoringSpec } from './parse/parse.js';
export {
  compileOperation,
  compileOperationFromValidated,
  type CompileOperationOptions,
} from './operation/compile.js';
export { executeOperation } from './operation/execute.js';

export type {
  DerivedCompileResult,
  DerivedTableSchema,
  DerivedGroupColumn,
  DerivedMeasureColumn,
  DerivedColumnBinding,
  DerivedSqlType,
} from './types/projection.js';

export {
  compileProjectionGraph,
  compileProjectionGraphFromValidated,
  type CompileProjectionOpts,
} from './projection-compile.js';

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
  const r = _runPipeline(rawSpec, rawPdm, rawQsm, { collect: false });
  if (!r.ok) return err(r.errors);

  const { graph } = r;
  const optionalParams = Object.entries(graph.signature.inputs)
    .filter(([, i]) => i.mode === 'predicate_optional')
    .map(([name]) => name);

  const paramDefaults: Record<string, unknown> = {};
  for (const [name, decl] of Object.entries(graph.signature.inputs)) {
    if (decl.mode === 'defaulted' && decl.default !== undefined) {
      paramDefaults[name] = decl.default;
    }
  }

  const shapeName = graph.signature.output.type.replace(/^rowset<|^row<|>$/g, '');
  return ok({
    sql: r.sql,
    paramOrder: r.paramOrder,
    shape: { name: shapeName },
    optionalParams,
    paramDefaults,
  });
}

export function execute(
  compiled: CompileResult,
  paramValues: ParamValues,
  db: Database.Database,
): unknown[] {
  return executeCompiled(compiled, paramValues, db);
}

export { AuthoringSpecSchema } from './parse/schema.js';
export type { AuthoringSpecInput, AuthoringSpecOutput } from './parse/schema.js';

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

export function explain(rawSpec: unknown, rawPdm: unknown, rawQsm: unknown): ExplainOutput {
  const r = _runPipeline(rawSpec, rawPdm, rawQsm, { collect: true });
  if (!r.ok) return { ok: false, artifacts: r.artifacts, errors: r.errors };
  return {
    ok: true,
    value: {
      parsed: r.parsedSpec,
      canonical: r.canonical,
      semanticPlan: r.semanticPlan,
      relational: r.rel,
      sql: r.sql,
      paramOrder: r.paramOrder,
    },
  };
}
