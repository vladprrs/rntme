import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';
import { nodeInputRef, runStructuralVisitor, type CheckBundle, type GraphCtx } from './visitor.js';

const detectCycles = (ctx: GraphCtx): void => {
  const ids = ctx.knownIds;
  const byId = ctx.nodesById;
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
    if (n) {
      const dep = nodeInputRef(n);
      if (dep && dep !== '$root' && ids.has(dep)) visit(dep, [...path, id]);
    }
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
