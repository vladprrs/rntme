import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

type Node = AuthoringSpecOutput['graphs'][string]['nodes'][number];

function inputRef(n: Node): string | undefined {
  if (n.type === 'findMany') return undefined;
  return (n.config as { input?: string }).input;
}

export function checkOutputFrom(spec: AuthoringSpecOutput): GraphIrError[] {
  const errs: GraphIrError[] = [];
  for (const graph of Object.values(spec.graphs)) {
    const { from } = graph.signature.output;
    const node = graph.nodes.find((n) => n.id === from);
    if (!node) {
      errs.push({
        layer: 'structural',
        code: ERROR_CODES.STRUCT_INVALID_OUTPUT_FROM,
        message: `signature.output.from "${from}" does not match any node id`,
        location: { graphId: graph.id },
      });
      continue;
    }
    const consumed = new Set(
      graph.nodes.map(inputRef).filter((x): x is string => typeof x === 'string' && x !== '$root'),
    );
    if (consumed.has(from)) {
      errs.push({
        layer: 'structural',
        code: ERROR_CODES.STRUCT_INVALID_OUTPUT_FROM,
        message: `signature.output.from "${from}" is consumed by another node and is not terminal`,
        location: { graphId: graph.id, nodeId: from },
      });
    }
  }
  return errs;
}
