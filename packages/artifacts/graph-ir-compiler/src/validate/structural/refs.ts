import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

type Node = AuthoringSpecOutput['graphs'][string]['nodes'][number];

function nodeInput(n: Node): string | undefined {
  switch (n.type) {
    case 'filter':
    case 'map':
    case 'reduce':
    case 'sort':
    case 'limit':
    case 'distinct':
    case 'lookupOne':
      return (n.config as { input?: string }).input;
    default:
      return undefined;
  }
}

export function checkRefs(spec: AuthoringSpecOutput): GraphIrError[] {
  const errs: GraphIrError[] = [];
  for (const graph of Object.values(spec.graphs)) {
    const hasRoot = Object.values(graph.signature.inputs).some((i) => i.mode === 'root');
    const knownSoFar = new Set<string>();
    for (const node of graph.nodes) {
      const input = nodeInput(node);
      if (input !== undefined) {
        if (input === '$root') {
          if (!hasRoot) {
            errs.push({
              layer: 'structural',
              code: ERROR_CODES.STRUCT_ROOT_REF_WITHOUT_ROOT_INPUT,
              message: `node "${node.id}" references $root but graph has no root input`,
              location: { graphId: graph.id, nodeId: node.id },
            });
          }
        } else if (!knownSoFar.has(input)) {
          errs.push({
            layer: 'structural',
            code: ERROR_CODES.STRUCT_INVALID_INPUT_REF,
            message: `node "${node.id}" references "${input}" which is not a prior node`,
            location: { graphId: graph.id, nodeId: node.id },
          });
        }
      }
      knownSoFar.add(node.id);
    }
  }
  return errs;
}
