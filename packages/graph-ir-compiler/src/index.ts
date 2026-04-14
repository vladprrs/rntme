import type Database from 'better-sqlite3';
import { createPdmResolver, parsePdm, validatePdm } from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
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
import type { ExplainArtifacts, ExplainOutput } from './explain/explain.js';

export { ok, err, isOk, isErr, ERROR_CODES } from './types/result.js';
export type { Result, GraphIrError, ErrorCode, Layer, Ok, Err } from './types/result.js';
export type { ValidatedPdm } from '@rntme/pdm';
export type { ValidatedQsm } from '@rntme/qsm';
export type { ExplainOutput } from './explain/explain.js';

export const VERSION = '0.0.0';

function parseValidatedArtifacts(
  rawPdm: unknown,
  rawQsm: unknown,
): Result<{ pdm: ValidatedPdm; qsm: ValidatedQsm }> {
  const pdmParse = parsePdm(rawPdm);
  if (!pdmParse.ok) {
    return err([
      {
        layer: 'parse',
        code: ERROR_CODES.PARSE_SCHEMA_VIOLATION,
        message: 'PDM failed schema validation',
      },
    ]);
  }
  const pdmVal = validatePdm(pdmParse.value);
  if (!pdmVal.ok) {
    return err([
      {
        layer: 'parse',
        code: ERROR_CODES.PARSE_SCHEMA_VIOLATION,
        message: pdmVal.errors[0]?.message ?? 'PDM validation failed',
      },
    ]);
  }
  const pdm = pdmVal.value;
  const qsmParse = parseQsm(rawQsm);
  if (!qsmParse.ok) {
    return err([
      {
        layer: 'parse',
        code: ERROR_CODES.PARSE_SCHEMA_VIOLATION,
        message: 'QSM failed schema validation',
      },
    ]);
  }
  const qsmVal = validateQsm(qsmParse.value, createPdmResolver(pdm));
  if (!qsmVal.ok) {
    return err([
      {
        layer: 'parse',
        code: ERROR_CODES.PARSE_SCHEMA_VIOLATION,
        message: qsmVal.errors[0]?.message ?? 'QSM validation failed',
      },
    ]);
  }
  return ok({ pdm, qsm: qsmVal.value });
}

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

  const artifactsR = parseValidatedArtifacts(rawPdm, rawQsm);
  if (!artifactsR.ok) return artifactsR;
  const { pdm, qsm } = artifactsR.value;

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

  const semR = validateSemantic(graph, pdm, qsm, sv.value.shapes);
  if (!semR.ok) return semR;

  const planR = buildSemanticPlan(graph, pdm, qsm);
  if (!planR.ok) return planR;
  const rel = buildRelational(planR.value);

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

  const { ast, paramOrder } = lowerToSqlite(rel, { predicateOptionalParams, pdm });
  const sql = emitSql(ast);

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

export function explain(rawSpec: unknown, rawPdm: unknown, rawQsm: unknown): ExplainOutput {
  const artifacts: ExplainArtifacts = {};

  const specR = parseAuthoringSpec(rawSpec);
  if (!specR.ok) return { ok: false, artifacts, errors: specR.errors };
  artifacts.parsed = specR.value;

  const artifactsR = parseValidatedArtifacts(rawPdm, rawQsm);
  if (!artifactsR.ok) {
    return { ok: false, artifacts, errors: artifactsR.errors };
  }
  const { pdm, qsm } = artifactsR.value;

  const sv = validateStructural(specR.value, pdm, qsm);
  if (!sv.ok) return { ok: false, artifacts, errors: sv.errors };

  const canonical = normalize(sv.value);
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

  const rel = buildRelational(planR.value);
  artifacts.relational = rel;

  const predicateOptionalParams = new Set<string>(
    Object.entries(graph.signature.inputs)
      .filter(([, i]) => i.mode === 'predicate_optional')
      .map(([name]) => name),
  );

  const { ast, paramOrder } = lowerToSqlite(rel, { predicateOptionalParams, pdm });
  const sql = emitSql(ast);

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
