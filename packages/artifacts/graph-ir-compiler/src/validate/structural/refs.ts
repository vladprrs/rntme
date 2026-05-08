import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';
import { runStructuralVisitor, type CheckBundle, type GraphCtx, type Node } from './visitor.js';

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

const computeHasRoot = (ctx: GraphCtx): void => {
  ctx.hasRoot = Object.values(ctx.graph.signature.inputs).some((i) => i.mode === 'root');
};

const checkInputRef = (node: Node, ctx: GraphCtx): void => {
  const input = nodeInput(node);
  if (input === undefined) return;
  if (input === '$root') {
    if (!ctx.hasRoot) {
      ctx.errors.push({
        layer: 'structural',
        code: ERROR_CODES.STRUCT_ROOT_REF_WITHOUT_ROOT_INPUT,
        message: `node "${node.id}" references $root but graph has no root input`,
        location: { graphId: ctx.graph.id, nodeId: node.id },
      });
    }
  } else if (!ctx.knownIds.has(input)) {
    ctx.errors.push({
      layer: 'structural',
      code: ERROR_CODES.STRUCT_INVALID_INPUT_REF,
      message: `node "${node.id}" references "${input}" which is not a prior node`,
      location: { graphId: ctx.graph.id, nodeId: node.id },
    });
  }
};

export const refsBundle: CheckBundle = {
  pre: [computeHasRoot],
  nodeAll: [checkInputRef],
};

export function checkRefs(spec: AuthoringSpecOutput): GraphIrError[] {
  return runStructuralVisitor(spec, undefined as never, undefined as never, [refsBundle]);
}
