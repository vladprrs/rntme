import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

export function checkCommandShape(spec: AuthoringSpecOutput): GraphIrError[] {
  const errs: GraphIrError[] = [];
  for (const graph of Object.values(spec.graphs)) {
    const hasEmit = graph.nodes.some((n) => n.type === 'emit');
    if (!hasEmit) continue;

    if (graph.signature.output.type !== 'row<CommandResult>') {
      errs.push({
        layer: 'structural',
        code: ERROR_CODES.CMD_OUTPUT_SHAPE_INVALID,
        message: `command graph output must be "row<CommandResult>", got "${graph.signature.output.type}"`,
        location: { graphId: graph.id },
      });
    }

    const terminal = graph.nodes.find((n) => n.id === graph.signature.output.from);
    if (!terminal || terminal.type !== 'emit') {
      errs.push({
        layer: 'structural',
        code: ERROR_CODES.CMD_EMIT_UNREACHABLE,
        message: `signature.output.from "${graph.signature.output.from}" must point to an emit node in a command graph`,
        location: { graphId: graph.id },
      });
    }
  }
  return errs;
}
