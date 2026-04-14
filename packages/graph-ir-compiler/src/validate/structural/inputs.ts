import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

function isRowOrRowset(t: unknown): boolean {
  return typeof t === 'object' && t !== null && ('row' in t || 'rowset' in t);
}

export function checkInputs(spec: AuthoringSpecOutput): GraphIrError[] {
  const errs: GraphIrError[] = [];
  for (const graph of Object.values(spec.graphs)) {
    const rootEntries = Object.entries(graph.signature.inputs).filter(([, i]) => i.mode === 'root');
    if (rootEntries.length > 1) {
      errs.push({
        layer: 'structural',
        code: ERROR_CODES.STRUCT_MULTIPLE_ROOT_INPUTS,
        message: `graph has ${rootEntries.length} inputs with mode "root"; at most one is allowed`,
        location: { graphId: graph.id },
      });
    }
    for (const [name, decl] of rootEntries) {
      if (!isRowOrRowset(decl.type)) {
        errs.push({
          layer: 'structural',
          code: ERROR_CODES.STRUCT_ROOT_INPUT_TYPE,
          message: `root input "${name}" must have type row<T> or rowset<T>`,
          location: { graphId: graph.id, path: `signature.inputs.${name}` },
        });
      }
    }
  }
  return errs;
}
