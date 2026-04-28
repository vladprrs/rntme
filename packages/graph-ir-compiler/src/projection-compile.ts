import { parseAuthoringSpec } from './parse/parse.js';
import { validateStructural } from './validate/structural/index.js';
import { validateSemantic } from './validate/semantic/index.js';
import { normalize } from './canonical/normalize.js';
import { buildSemanticPlan } from './semantic-plan/build.js';
import { inferRole } from './role/infer.js';
import { resolveSources } from './validate/semantic/sources.js';
import { lowerToEventDelta } from './lower/sqlite/event-delta/lower.js';
import { parseGraphIrArtifacts } from './explain/explain.js';
import type { CanonicalGraph, CanonicalFilter } from './types/canonical.js';
import type { Expr } from './types/authoring.js';
import type { DerivedCompileResult } from './types/projection.js';
import { err, ok, ERROR_CODES, type GraphIrError, type Result } from './types/result.js';
import { toGraphIrError } from './types/errors.js';

export type CompileProjectionOpts = Readonly<{
  graphId: string;
  projectionTable: string;
}>;

/**
 * Compile a single projection-role graph (event-source → reduce) into a
 * `DerivedCompileResult` consumable by `@rntme/projection-consumer`.
 *
 * Pipeline: parse → structural → canonical → semantic (incl. projection-whitelist)
 * → semantic-plan → lowerToEventDelta. Fails when the inferred role is not
 * `'projection'` (with `PROJ_ROLE_UNINFERRABLE`).
 */
export function compileProjectionGraph(
  rawSpec: unknown,
  rawPdm: unknown,
  rawQsm: unknown,
  opts: CompileProjectionOpts,
): Result<DerivedCompileResult> {
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
  const graph = graphs[opts.graphId];
  if (!graph) {
    return err([
      {
        layer: 'canonical',
        code: ERROR_CODES.STRUCT_DUPLICATE_GRAPH_ID,
        message: `graphId "${opts.graphId}" not found in spec`,
        hint: `available: ${Object.keys(graphs).join(', ') || '(none)'}`,
      },
    ]);
  }

  const roleR = inferRole(graph);
  if (!roleR.ok || roleR.value !== 'projection') {
    const hint = !roleR.ok ? roleR.errors[0]?.message : `inferred role "${roleR.value}"`;
    return err([
      {
        layer: 'semantic',
        code: ERROR_CODES.PROJ_ROLE_UNINFERRABLE,
        message: `graph "${graph.id}" is not a projection-role graph`,
        hint: hint ?? undefined,
        location: { graphId: graph.id },
      } as GraphIrError,
    ]);
  }

  const semR = validateSemantic(graph, pdm, qsm, sv.value.shapes);
  if (!semR.ok) return semR;

  // Locate the event-source alias for the single findMany in the graph.
  const sourcesR = resolveSources(graph, pdm, qsm);
  if (!sourcesR.ok) return sourcesR;
  const findManyNode = graph.nodes.find((n) => n.kind === 'findMany');
  if (!findManyNode) {
    return err([
      {
        layer: 'semantic',
        code: ERROR_CODES.PROJ_ROLE_UNINFERRABLE,
        message: `projection graph "${graph.id}" has no findMany node`,
        location: { graphId: graph.id },
      },
    ]);
  }
  const src = sourcesR.value.get(findManyNode.id);
  if (!src || src.kind !== 'eventType') {
    return err([
      {
        layer: 'semantic',
        code: ERROR_CODES.PROJ_ROLE_UNINFERRABLE,
        message: `projection graph "${graph.id}" must have a findMany with eventType source`,
        location: { graphId: graph.id, nodeId: findManyNode.id },
      },
    ]);
  }

  const planR = buildSemanticPlan(graph, pdm, qsm);
  if (!planR.ok) return planR;

  const filterExpr = extractFilterExpr(graph);

  try {
    const result = lowerToEventDelta(planR.value, pdm, src, opts.projectionTable, filterExpr);
    return ok(result);
  } catch (e) {
    const graphIrError = toGraphIrError(e, 'lowering');
    return err([
      {
        ...graphIrError,
        location: graphIrError.location ?? { graphId: graph.id },
      },
    ]);
  }
}

/**
 * Extract the single filter node's expression (if any) from a projection graph.
 * Returns null when the graph has no filter node. Projection-role graphs in
 * MVP allow at most one filter between findMany and reduce (enforced by the
 * whitelist: only findMany/filter/map/reduce kinds, and the DAG is linear).
 */
function extractFilterExpr(graph: CanonicalGraph): Expr | null {
  const filterNode = graph.nodes.find((n): n is CanonicalFilter => n.kind === 'filter');
  return filterNode ? filterNode.expr : null;
}
