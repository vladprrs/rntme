import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';
import { runStructuralVisitor, type CheckBundle, type GraphCtx } from './visitor.js';

const checkCommandShapeFinal = (ctx: GraphCtx): void => {
  // ctx.hasEmit / ctx.hasResult are populated by the visitor itself during
  // the per-node walk — no extra pass needed here.
  if (!ctx.hasEmit) return;
  if (ctx.hasResult) return;

  if (ctx.graph.signature.output.type !== 'row<CommandResult>') {
    ctx.errors.push({
      layer: 'structural',
      code: ERROR_CODES.CMD_OUTPUT_SHAPE_INVALID,
      message: `command graph output must be "row<CommandResult>", got "${ctx.graph.signature.output.type}"`,
      location: { graphId: ctx.graph.id },
    });
  }

  const terminal = ctx.nodesById.get(ctx.graph.signature.output.from);
  if (!terminal || terminal.type !== 'emit') {
    ctx.errors.push({
      layer: 'structural',
      code: ERROR_CODES.CMD_EMIT_UNREACHABLE,
      message: `signature.output.from "${ctx.graph.signature.output.from}" must point to an emit node in a command graph`,
      location: { graphId: ctx.graph.id },
    });
  }
};

export const commandShapeBundle: CheckBundle = {
  post: [checkCommandShapeFinal],
};

export function checkCommandShape(spec: AuthoringSpecOutput): GraphIrError[] {
  return runStructuralVisitor(spec, undefined as never, undefined as never, [commandShapeBundle]);
}
