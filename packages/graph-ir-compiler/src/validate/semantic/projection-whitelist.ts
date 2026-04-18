import type { CanonicalGraph } from '../../types/canonical.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

const ALLOWED_KINDS = new Set(['findMany', 'filter', 'map', 'reduce']);
const ALLOWED_AGG = new Set(['count', 'sum']);

function containsExists(expr: unknown): boolean {
  if (!expr || typeof expr !== 'object') return false;
  if (!Array.isArray(expr) && 'exists' in (expr as Record<string, unknown>)) return true;
  if (Array.isArray(expr)) return expr.some(containsExists);
  return Object.values(expr as Record<string, unknown>).some(containsExists);
}

export function validateProjectionWhitelist(graph: CanonicalGraph): GraphIrError[] {
  const errors: GraphIrError[] = [];

  if (Object.keys(graph.signature.inputs).length > 0) {
    errors.push({
      layer: 'semantic',
      code: ERROR_CODES.PROJ_SEMANTIC_UNSUPPORTED_OP,
      message: 'projection-role graphs must have empty signature.inputs in MVP',
      hint: 'projection graphs take no inputs',
      location: { graphId: graph.id },
    });
  }

  for (const node of graph.nodes) {
    if (!ALLOWED_KINDS.has(node.kind)) {
      errors.push({
        layer: 'semantic',
        code: ERROR_CODES.PROJ_SEMANTIC_UNSUPPORTED_OP,
        message: `node kind "${node.kind}" is not supported in projection-role graphs`,
        hint: 'projection graphs support findMany, filter, map, reduce only (MVP)',
        location: { graphId: graph.id, nodeId: node.id },
      });
      continue;
    }
    if (node.kind === 'reduce') {
      for (const [name, m] of Object.entries(node.measures)) {
        if (!ALLOWED_AGG.has(m.fn)) {
          errors.push({
            layer: 'semantic',
            code: ERROR_CODES.PROJ_SEMANTIC_UNSUPPORTED_AGG,
            message: `measure "${name}" uses fn="${m.fn}"; only count, sum are allowed in projection-role graphs (MVP)`,
            location: { graphId: graph.id, nodeId: node.id },
          });
        }
      }
      for (const [name, g] of Object.entries(node.group)) {
        if (typeof g !== 'string') {
          errors.push({
            layer: 'semantic',
            code: ERROR_CODES.PROJ_SEMANTIC_UNSUPPORTED_GROUP,
            message: `group key "${name}" is not a field-path; expression group keys are not allowed in projection-role graphs (MVP)`,
            location: { graphId: graph.id, nodeId: node.id },
          });
        }
      }
    }
    if (node.kind === 'filter' && containsExists(node.expr)) {
      errors.push({
        layer: 'semantic',
        code: ERROR_CODES.PROJ_SEMANTIC_UNSUPPORTED_OP,
        message: 'filter with exists-subquery is not allowed in projection-role graphs (MVP)',
        hint: 'exists-subquery not supported in projection role',
        location: { graphId: graph.id, nodeId: node.id },
      });
    }
  }
  return errors;
}
