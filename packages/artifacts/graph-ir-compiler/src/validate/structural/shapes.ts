import type { AuthoringSpecOutput } from '../../parse/schema.js';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';
import { runStructuralVisitor, type CheckBundle, type GraphCtx, type Node } from './visitor.js';

export function shapeExists(
  name: string,
  spec: Pick<AuthoringSpecOutput, 'shapes'>,
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
): boolean {
  return name in spec.shapes || name in pdm.entities || name in qsm.projections;
}

const checkMapReduceInto = (node: Node, ctx: GraphCtx): void => {
  if (node.type !== 'map' && node.type !== 'reduce') return;
  const into = node.config.into;
  if (!shapeExists(into, ctx.spec, ctx.pdm, ctx.qsm)) {
    ctx.errors.push({
      layer: 'structural',
      code: ERROR_CODES.STRUCT_UNKNOWN_SHAPE,
      message: `shape "${into}" is not defined in shapes, PDM, or QSM`,
      location: { graphId: ctx.graph.id, nodeId: node.id },
    });
  }
};

export const shapesBundle: CheckBundle = {
  nodeByKind: {
    map: [checkMapReduceInto],
    reduce: [checkMapReduceInto],
  },
};

export function checkShapes(spec: AuthoringSpecOutput, pdm: ValidatedPdm, qsm: ValidatedQsm): GraphIrError[] {
  return runStructuralVisitor(spec, pdm, qsm, [shapesBundle]);
}
