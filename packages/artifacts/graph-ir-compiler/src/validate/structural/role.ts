import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';
import { runStructuralVisitor, type CheckBundle, type GraphCtx } from './visitor.js';

const checkRoleAfterWalk = (ctx: GraphCtx): void => {
  // ctx.hasEmit is populated by the visitor itself during the per-node walk.
  const outputIsRowset = ctx.graph.signature.output.type.startsWith('rowset<');
  if (ctx.hasEmit && outputIsRowset) {
    ctx.errors.push({
      layer: 'structural',
      code: ERROR_CODES.GRAPH_MIXED_ROLE,
      message: 'graph has both rowset<T> output and >=1 emit node; pick one',
      location: { graphId: ctx.graph.id },
    });
  }
};

export const roleBundle: CheckBundle = {
  post: [checkRoleAfterWalk],
};

export function checkGraphRole(spec: AuthoringSpecOutput): GraphIrError[] {
  return runStructuralVisitor(spec, undefined as never, undefined as never, [roleBundle]);
}
