import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';
import { runStructuralVisitor, type CheckBundle, type GraphCtx, type Node } from './visitor.js';

function inputRef(n: Node): string | undefined {
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

const collectConsumed = (node: Node, ctx: GraphCtx): void => {
  const ref = inputRef(node);
  if (typeof ref === 'string' && ref !== '$root') ctx.consumedInputs.add(ref);
};

const checkOutputFromTerminal = (ctx: GraphCtx): void => {
  const { from } = ctx.graph.signature.output;
  const node = ctx.nodesById.get(from);
  if (!node) {
    ctx.errors.push({
      layer: 'structural',
      code: ERROR_CODES.STRUCT_INVALID_OUTPUT_FROM,
      message: `signature.output.from "${from}" does not match any node id`,
      location: { graphId: ctx.graph.id },
    });
    return;
  }
  if (ctx.consumedInputs.has(from)) {
    ctx.errors.push({
      layer: 'structural',
      code: ERROR_CODES.STRUCT_INVALID_OUTPUT_FROM,
      message: `signature.output.from "${from}" is consumed by another node and is not terminal`,
      location: { graphId: ctx.graph.id, nodeId: from },
    });
  }
};

export const outputFromBundle: CheckBundle = {
  nodeAll: [collectConsumed],
  post: [checkOutputFromTerminal],
};

export function checkOutputFrom(spec: AuthoringSpecOutput): GraphIrError[] {
  return runStructuralVisitor(spec, undefined as never, undefined as never, [outputFromBundle]);
}
