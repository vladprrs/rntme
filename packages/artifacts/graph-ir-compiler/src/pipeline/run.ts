import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import { parseAuthoringSpec } from '../parse/parse.js';
import type { AuthoringSpecOutput } from '../parse/schema.js';
import { validateStructural } from '../validate/structural/index.js';
import { validateSemantic } from '../validate/semantic/index.js';
import { normalize } from '../canonical/normalize.js';
import { buildSemanticPlan } from '../semantic-plan/build.js';
import { buildRelational } from '../relational/build.js';
import { lowerToSqlite } from '../lower/sqlite/lower.js';
import { emitSql } from '../lower/sqlite/emit.js';
import { parseGraphIrArtifacts } from '../explain/explain.js';
import type { CanonicalGraph } from '../types/canonical.js';
import type { SemanticPlan } from '../types/semantic-plan.js';
import type { RelOp } from '../types/relational.js';
import type { GraphIrError } from '../types/result.js';
import { ERROR_CODES } from '../types/result.js';
import { toGraphIrError } from '../types/errors.js';

/**
 * Intermediate artifacts produced during the compile pipeline.
 *
 * When `_runPipeline` is called with `{ collect: true }`, fields are populated
 * incrementally as each stage succeeds and remain available on failure paths so
 * `explain` can show the user how far the pipeline progressed. With
 * `{ collect: false }` the object is left empty — `compile` does not need it.
 */
export type PipelineArtifacts = {
  parsed?: AuthoringSpecOutput;
  canonical?: { graphs: Record<string, CanonicalGraph> };
  semanticPlan?: SemanticPlan;
  relational?: RelOp;
};

export type PipelineSuccess = {
  ok: true;
  artifacts: PipelineArtifacts;
  parsedSpec: AuthoringSpecOutput;
  pdm: ValidatedPdm;
  qsm: ValidatedQsm;
  canonical: { graphs: Record<string, CanonicalGraph> };
  graph: CanonicalGraph;
  semanticPlan: SemanticPlan;
  rel: RelOp;
  paramOrder: string[];
  sql: string;
};

export type PipelineFailure = {
  ok: false;
  artifacts: PipelineArtifacts;
  errors: readonly GraphIrError[];
};

export type PipelineResult = PipelineSuccess | PipelineFailure;

/**
 * Run the eight-stage graph-ir compile pipeline:
 *   parseAuthoringSpec → parseGraphIrArtifacts → validateStructural →
 *   normalize → validateSemantic → buildSemanticPlan → buildRelational →
 *   lowerToSqlite → emitSql.
 *
 * Shared by `compile` (which projects to `Result<CompileResult>`) and `explain`
 * (which projects to `ExplainOutput`). Errors and artifacts always flow back
 * through this function so the two callers can't drift when stages change.
 *
 * Module-internal: not re-exported from the package index.
 */
export function _runPipeline(
  rawSpec: unknown,
  rawPdm: unknown,
  rawQsm: unknown,
  opts: { collect: boolean },
): PipelineResult {
  const artifacts: PipelineArtifacts = {};
  const fail = (errors: readonly GraphIrError[]): PipelineFailure => ({
    ok: false,
    artifacts,
    errors,
  });

  const specR = parseAuthoringSpec(rawSpec);
  if (!specR.ok) return fail(specR.errors);
  if (opts.collect) artifacts.parsed = specR.value;

  const pq = parseGraphIrArtifacts(rawPdm, rawQsm);
  if (!pq.ok) return fail(pq.errors);
  const { pdm, qsm } = pq.value;

  const sv = validateStructural(specR.value, pdm, qsm);
  if (!sv.ok) return fail(sv.errors);

  let canonical;
  try {
    canonical = normalize(sv.value);
  } catch (e) {
    return fail([toGraphIrError(e, 'canonical')]);
  }
  if (opts.collect) artifacts.canonical = canonical;

  const graphIds = Object.keys(canonical.graphs);
  if (graphIds.length !== 1) {
    return fail([
      {
        layer: 'canonical',
        code: ERROR_CODES.STRUCT_DUPLICATE_GRAPH_ID,
        message: 'Tier 1 MVP compiles exactly one graph per call',
      },
    ]);
  }
  const graph = canonical.graphs[graphIds[0]!]!;

  const semR = validateSemantic(graph, pdm, qsm, sv.value.shapes);
  if (!semR.ok) return fail(semR.errors);

  const planR = buildSemanticPlan(graph, pdm, qsm);
  if (!planR.ok) return fail(planR.errors);
  if (opts.collect) artifacts.semanticPlan = planR.value;

  let rel;
  try {
    rel = buildRelational(planR.value);
  } catch (e) {
    return fail([toGraphIrError(e, 'relational')]);
  }
  if (opts.collect) artifacts.relational = rel;

  const predicateOptionalParams = new Set<string>(
    Object.entries(graph.signature.inputs)
      .filter(([, i]) => i.mode === 'predicate_optional')
      .map(([name]) => name),
  );

  let paramOrder;
  let sql;
  try {
    const lowered = lowerToSqlite(rel, { predicateOptionalParams, pdm, qsm });
    paramOrder = lowered.paramOrder;
    sql = emitSql(lowered.ast);
  } catch (e) {
    return fail([toGraphIrError(e, 'lowering')]);
  }

  return {
    ok: true,
    artifacts,
    parsedSpec: specR.value,
    pdm,
    qsm,
    canonical,
    graph,
    semanticPlan: planR.value,
    rel,
    paramOrder,
    sql,
  };
}
