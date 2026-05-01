import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

function scanExpr(node: unknown, onBad: (what: string) => void): void {
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((c) => scanExpr(c, onBad));
    return;
  }
  const obj = node as Record<string, unknown>;
  if ('exists' in obj) {
    onBad('exists');
    return;
  }
  if ('$list' in obj) {
    onBad('$list');
    return;
  }
  if ('in' in obj) {
    onBad('in');
    return;
  }
  for (const v of Object.values(obj)) scanExpr(v, onBad);
}

export function checkTier1Expr(spec: AuthoringSpecOutput): GraphIrError[] {
  const errs: GraphIrError[] = [];
  const record = (graphId: string, nodeId: string, what: string) => {
    errs.push({
      layer: 'structural',
      code: ERROR_CODES.TIER1_UNSUPPORTED_EXPR,
      message: `EXPR operator "${what}" is not supported in MVP Tier 1`,
      location: { graphId, nodeId },
      hint: 'Planned for Tier 2.',
    });
  };

  for (const graph of Object.values(spec.graphs)) {
    for (const node of graph.nodes) {
      if (node.type === 'filter' && node.config.expr !== undefined) {
        scanExpr(node.config.expr, (w) => record(graph.id, node.id, w));
      }
      if (node.type === 'map') {
        for (const [field, value] of Object.entries(node.config.fields)) {
          if (typeof value === 'object' && value !== null && 'lookup' in value) {
            errs.push({
              layer: 'structural',
              code: ERROR_CODES.TIER1_UNSUPPORTED_EXPR,
              message: `lookup in map.fields is not supported in MVP Tier 1`,
              location: { graphId: graph.id, nodeId: node.id, path: `fields.${field}` },
              hint: 'Planned for Tier 2.',
            });
            continue;
          }
          scanExpr(value, (w) => record(graph.id, node.id, w));
        }
      }
      if (node.type === 'reduce') {
        for (const m of Object.values(node.config.measures)) {
          if (m.expr !== undefined) scanExpr(m.expr, (w) => record(graph.id, node.id, w));
        }
      }
    }
  }
  return errs;
}
