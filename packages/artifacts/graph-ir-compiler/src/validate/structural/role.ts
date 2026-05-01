import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

export function checkGraphRole(spec: AuthoringSpecOutput): GraphIrError[] {
  const errs: GraphIrError[] = [];
  for (const graph of Object.values(spec.graphs)) {
    const hasEmit = graph.nodes.some((n) => n.type === 'emit');
    const outputIsRowset = graph.signature.output.type.startsWith('rowset<');
    if (hasEmit && outputIsRowset) {
      errs.push({
        layer: 'structural',
        code: ERROR_CODES.GRAPH_MIXED_ROLE,
        message: 'graph has both rowset<T> output and >=1 emit node; pick one',
        location: { graphId: graph.id },
      });
    }
  }
  return errs;
}
