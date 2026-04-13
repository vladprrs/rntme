import type { CanonicalGraph } from '../../types/canonical.js';
import type { Pdm } from '../../types/pdm.js';
import type { Qsm } from '../../types/qsm.js';
import { resolveSources } from './sources.js';
import { inferExprType, type ParamMap } from './types.js';
import { err, ok, ERROR_CODES, type GraphIrError, type Result } from '../../types/result.js';
import type { Scope } from './scope.js';

export function validateSemantic(graph: CanonicalGraph, pdm: Pdm, qsm: Qsm): Result<CanonicalGraph> {
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

  for (const node of graph.nodes) {
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
    }
  }

  return errors.length ? err(errors) : ok(graph);
}
