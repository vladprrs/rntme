import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

export function checkIds(spec: AuthoringSpecOutput): GraphIrError[] {
  const errs: GraphIrError[] = [];
  for (const [graphKey, graph] of Object.entries(spec.graphs)) {
    if (graph.id !== graphKey) {
      errs.push({
        layer: 'structural',
        code: ERROR_CODES.STRUCT_DUPLICATE_GRAPH_ID,
        message: `graph key "${graphKey}" does not match graph.id "${graph.id}"`,
        location: { graphId: graphKey },
      });
    }
    const seen = new Set<string>();
    for (const node of graph.nodes) {
      if (seen.has(node.id)) {
        errs.push({
          layer: 'structural',
          code: ERROR_CODES.STRUCT_DUPLICATE_NODE_ID,
          message: `duplicate node id "${node.id}"`,
          location: { graphId: graph.id, nodeId: node.id },
        });
      }
      seen.add(node.id);
    }
  }
  return errs;
}
