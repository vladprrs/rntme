import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';
import { runStructuralVisitor, type CheckBundle, type GraphCtx, type Node } from './visitor.js';

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

const detectCycles = (ctx: GraphCtx): void => {
  const ids = ctx.knownIds; // populated by visitor during the walk
  const byId = ctx.nodesById; // populated by visitor during the walk
  const visiting = new Set<string>();
  const done = new Set<string>();

  const visit = (id: string, path: string[]): void => {
    if (done.has(id)) return;
    if (visiting.has(id)) {
      ctx.errors.push({
        layer: 'structural',
        code: ERROR_CODES.STRUCT_DAG_CYCLE,
        message: `cycle detected: ${[...path, id].join(' → ')}`,
        location: { graphId: ctx.graph.id, nodeId: id },
      });
      return;
    }
    visiting.add(id);
    const n = byId.get(id);
    if (n) for (const dep of incoming(n)) if (ids.has(dep)) visit(dep, [...path, id]);
    visiting.delete(id);
    done.add(id);
  };

  for (const n of ctx.graph.nodes) visit(n.id, []);
};

export const dagBundle: CheckBundle = {
  post: [detectCycles],
};

export function checkDag(spec: AuthoringSpecOutput): GraphIrError[] {
  return runStructuralVisitor(spec, undefined as never, undefined as never, [dagBundle]);
}
