import type { AuthoringSpecOutput } from '../../parse/schema.js';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

export function shapeExists(
  name: string,
  spec: Pick<AuthoringSpecOutput, 'shapes'>,
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
): boolean {
  return name in spec.shapes || name in pdm.entities || name in qsm.projections;
}

export function checkShapes(
  spec: AuthoringSpecOutput,
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
): GraphIrError[] {
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
