import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';
import { runStructuralVisitor, type CheckBundle, type GraphCtx, type Node } from './visitor.js';

const distinctUnsupported = (node: Node, ctx: GraphCtx): void => {
  ctx.errors.push({
    layer: 'structural',
    code: ERROR_CODES.TIER1_UNSUPPORTED_NODE,
    message: 'node type "distinct" is not supported in MVP Tier 1',
    location: { graphId: ctx.graph.id, nodeId: node.id },
    hint: 'Planned for Tier 2.',
  });
};

const lookupOneUnsupported = (node: Node, ctx: GraphCtx): void => {
  ctx.errors.push({
    layer: 'structural',
    code: ERROR_CODES.TIER1_UNSUPPORTED_NODE,
    message: 'node type "lookupOne" is not supported in MVP Tier 1',
    location: { graphId: ctx.graph.id, nodeId: node.id },
    hint: 'Planned for Tier 2.',
  });
};

const filterPredicateUnsupported = (node: Node, ctx: GraphCtx): void => {
  if (node.type === 'filter' && node.config.predicate !== undefined) {
    ctx.errors.push({
      layer: 'structural',
      code: ERROR_CODES.TIER1_UNSUPPORTED_NODE,
      message: 'filter.predicate (named predicate graph) is not supported in MVP Tier 1',
      location: { graphId: ctx.graph.id, nodeId: node.id },
      hint: 'Use inline filter.expr instead.',
    });
  }
};

export const tier1NodesBundle: CheckBundle = {
  nodeByKind: {
    distinct: [distinctUnsupported],
    lookupOne: [lookupOneUnsupported],
    filter: [filterPredicateUnsupported],
  },
};

export function checkTier1Nodes(spec: AuthoringSpecOutput): GraphIrError[] {
  return runStructuralVisitor(spec, undefined as never, undefined as never, [tier1NodesBundle]);
}
