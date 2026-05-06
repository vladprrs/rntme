import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

type Node = AuthoringSpecOutput['graphs'][string]['nodes'][number];

function incoming(n: Node): string[] {
  switch (n.type) {
    case 'filter':
    case 'map':
    case 'reduce':
    case 'sort':
    case 'limit':
    case 'distinct':
    case 'lookupOne': {
      const input = (n.config as { input?: string }).input;
      return input && input !== '$root' ? [input] : [];
    }
    default:
      return [];
  }
}

export function checkDag(spec: AuthoringSpecOutput): GraphIrError[] {
  const errs: GraphIrError[] = [];
  for (const graph of Object.values(spec.graphs)) {
    const ids = new Set(graph.nodes.map((n) => n.id));
    const visiting = new Set<string>();
    const done = new Set<string>();
    const byId = new Map(graph.nodes.map((n) => [n.id, n] as const));

    const visit = (id: string, path: string[]): void => {
      if (done.has(id)) return;
      if (visiting.has(id)) {
        errs.push({
          layer: 'structural',
          code: ERROR_CODES.STRUCT_DAG_CYCLE,
          message: `cycle detected: ${[...path, id].join(' → ')}`,
          location: { graphId: graph.id, nodeId: id },
        });
        return;
      }
      visiting.add(id);
      const n = byId.get(id);
      if (n) for (const dep of incoming(n)) if (ids.has(dep)) visit(dep, [...path, id]);
      visiting.delete(id);
      done.add(id);
    };

    for (const n of graph.nodes) visit(n.id, []);
  }
  return errs;
}
