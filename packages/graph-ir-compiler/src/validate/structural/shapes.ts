import type { AuthoringSpecOutput } from '../../parse/schema.js';
import type { Pdm } from '../../types/pdm.js';
import type { Qsm } from '../../types/qsm.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

export function shapeExists(
  name: string,
  spec: Pick<AuthoringSpecOutput, 'shapes'>,
  pdm: Pdm,
  qsm: Qsm,
): boolean {
  return name in spec.shapes || name in pdm.entities || name in qsm.projections;
}

export function checkShapes(spec: AuthoringSpecOutput, pdm: Pdm, qsm: Qsm): GraphIrError[] {
  const errs: GraphIrError[] = [];
  for (const graph of Object.values(spec.graphs)) {
    for (const node of graph.nodes) {
      if (node.type === 'map' || node.type === 'reduce') {
        const into = node.config.into;
        if (!shapeExists(into, spec, pdm, qsm)) {
          errs.push({
            layer: 'structural',
            code: ERROR_CODES.STRUCT_UNKNOWN_SHAPE,
            message: `shape "${into}" is not defined in shapes, PDM, or QSM`,
            location: { graphId: graph.id, nodeId: node.id },
          });
        }
      }
    }
  }
  return errs;
}
