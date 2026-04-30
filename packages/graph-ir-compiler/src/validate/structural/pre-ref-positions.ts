import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

function containsPreRef(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsPreRef);
  const obj = value as Record<string, unknown>;
  if (typeof obj.$pre === 'string') return true;
  return Object.values(obj).some(containsPreRef);
}

export function checkPreRefPositions(spec: AuthoringSpecOutput): GraphIrError[] {
  const errs: GraphIrError[] = [];
  for (const graph of Object.values(spec.graphs)) {
    for (const node of graph.nodes) {
      if (node.type === 'findMany' && containsPreRef(node.config.source)) {
        errs.push({
          layer: 'structural',
          code: ERROR_CODES.GRAPH_IR_PRE_REF_NOT_ALLOWED_IN_SOURCE,
          message: '$pre references are not allowed in findMany source positions',
          location: { graphId: graph.id, nodeId: node.id, path: 'config.source' },
        });
      }
      if (node.type === 'emit') {
        if (containsPreRef(node.config.aggregateId)) {
          errs.push({
            layer: 'structural',
            code: ERROR_CODES.GRAPH_IR_PRE_REF_NOT_ALLOWED_IN_AGGREGATE_ID,
            message: '$pre references are not allowed in emit.aggregateId',
            location: { graphId: graph.id, nodeId: node.id, path: 'config.aggregateId' },
          });
        }
        if (containsPreRef(node.config.transition)) {
          errs.push({
            layer: 'structural',
            code: ERROR_CODES.GRAPH_IR_PRE_REF_NOT_ALLOWED_IN_TRANSITION,
            message: '$pre references are not allowed in emit.transition',
            location: { graphId: graph.id, nodeId: node.id, path: 'config.transition' },
          });
        }
      }
    }
  }
  return errs;
}
