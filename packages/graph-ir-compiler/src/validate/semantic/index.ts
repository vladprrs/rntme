import type { CanonicalGraph } from '../../types/canonical.js';
import type { Pdm } from '../../types/pdm.js';
import type { Qsm } from '../../types/qsm.js';
import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { resolveSources } from './sources.js';
import { checkMapShapeConformance } from './shape-conformance.js';
import { checkReduce } from './aggregate-phase.js';
import { inferExprType, type ParamMap } from './types.js';
import { err, ok, ERROR_CODES, type GraphIrError, type Result } from '../../types/result.js';
import type { Scope } from './scope.js';

export function validateSemantic(
  graph: CanonicalGraph,
  pdm: Pdm,
  qsm: Qsm,
  shapes?: AuthoringSpecOutput['shapes'],
): Result<CanonicalGraph> {
  const sourcesR = resolveSources(graph, pdm, qsm);
  if (!sourcesR.ok) return sourcesR;

  const params: ParamMap = new Map();
  for (const [name, decl] of Object.entries(graph.signature.inputs)) {
    if (decl.mode === 'root') continue;
    if (typeof decl.type !== 'string') continue;
    const nullable = decl.mode === 'nullable' || decl.mode === 'predicate_optional';
    params.set(name, { type: decl.type, nullable });
  }

  const errors: GraphIrError[] = [];
  let scope: Scope = { aliases: new Map() };
  const scopeAtNode = new Map<string, Scope>();
  const shapesMap: AuthoringSpecOutput['shapes'] = shapes ?? {};

  for (const node of graph.nodes) {
    const snap: Scope = { aliases: new Map(scope.aliases) };
    if (scope.shapeFields) snap.shapeFields = new Map(scope.shapeFields);
    scopeAtNode.set(node.id, snap);

    if (node.kind === 'findMany') {
      const src = sourcesR.value.get(node.id);
      if (src) scope = { aliases: new Map([[src.alias, { entity: src.entity }]]) };
    } else if (node.kind === 'filter') {
      const r = inferExprType(node.expr, scope, pdm, params);
      if (!r.ok) errors.push(...r.errors);
      else if (r.value.type !== 'boolean') {
        errors.push({
          layer: 'semantic',
          code: ERROR_CODES.SEM_TYPE_MISMATCH,
          message: `filter expr must be boolean, got ${r.value.type}`,
          location: { graphId: graph.id, nodeId: node.id },
        });
      }
    } else if (node.kind === 'reduce') {
      const sh = shapes?.[node.into];
      if (sh?.fields) {
        scope = {
          aliases: new Map(),
          shapeFields: new Map(
            Object.entries(sh.fields).map(([k, f]) => [k, { type: f.type, nullable: f.nullable }]),
          ),
        };
      }
    }
  }

  errors.push(
    ...checkReduce(graph, shapesMap, pdm, qsm, (id) => scopeAtNode.get(id) ?? { aliases: new Map() }, params),
  );

  errors.push(...checkMapShapeConformance(graph, shapes, pdm, qsm, params, sourcesR.value));

  return errors.length ? err(errors) : ok(graph);
}
