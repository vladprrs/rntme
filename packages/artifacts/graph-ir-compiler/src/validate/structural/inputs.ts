import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';
import { runStructuralVisitor, type CheckBundle, type GraphCtx } from './visitor.js';

function isRowOrRowset(t: unknown): boolean {
  return typeof t === 'object' && t !== null && ('row' in t || 'rowset' in t);
}

const checkRootInputs = (ctx: GraphCtx): void => {
  const rootEntries = Object.entries(ctx.graph.signature.inputs).filter(
    ([, i]) => i.mode === 'root',
  );
  if (rootEntries.length > 1) {
    ctx.errors.push({
      layer: 'structural',
      code: ERROR_CODES.STRUCT_MULTIPLE_ROOT_INPUTS,
      message: `graph has ${rootEntries.length} inputs with mode "root"; at most one is allowed`,
      location: { graphId: ctx.graph.id },
    });
  }
  for (const [name, decl] of rootEntries) {
    if (!isRowOrRowset(decl.type)) {
      ctx.errors.push({
        layer: 'structural',
        code: ERROR_CODES.STRUCT_ROOT_INPUT_TYPE,
        message: `root input "${name}" must have type row<T> or rowset<T>`,
        location: { graphId: ctx.graph.id, path: `signature.inputs.${name}` },
      });
    }
  }
};

export const inputsBundle: CheckBundle = {
  pre: [checkRootInputs],
};

export function checkInputs(spec: AuthoringSpecOutput): GraphIrError[] {
  return runStructuralVisitor(spec, undefined as never, undefined as never, [inputsBundle]);
}
