import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';
import { runStructuralVisitor, type CheckBundle, type GraphCtx, type Node } from './visitor.js';

const checkGraphIdMatchesKey = (ctx: GraphCtx): void => {
  if (ctx.graph.id !== ctx.graphKey) {
    ctx.errors.push({
      layer: 'structural',
      code: ERROR_CODES.STRUCT_DUPLICATE_GRAPH_ID,
      message: `graph key "${ctx.graphKey}" does not match graph.id "${ctx.graph.id}"`,
      location: { graphId: ctx.graphKey },
    });
  }
};

const checkDuplicateNodeId = (node: Node, ctx: GraphCtx): void => {
  // The visitor populates `knownIds` only with prior nodes when this hook
  // fires, so `has` cleanly means "id already used".
  if (ctx.knownIds.has(node.id)) {
    ctx.errors.push({
      layer: 'structural',
      code: ERROR_CODES.STRUCT_DUPLICATE_NODE_ID,
      message: `duplicate node id "${node.id}"`,
      location: { graphId: ctx.graph.id, nodeId: node.id },
    });
  }
};

export const idsBundle: CheckBundle = {
  pre: [checkGraphIdMatchesKey],
  nodeAll: [checkDuplicateNodeId],
};

export function checkIds(spec: AuthoringSpecOutput): GraphIrError[] {
  return runStructuralVisitor(spec, undefined as never, undefined as never, [idsBundle]);
}
