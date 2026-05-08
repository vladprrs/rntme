import type { AuthoringSpecOutput } from '../../parse/schema.js';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';
import { runStructuralVisitor, type CheckBundle, type GraphCtx, type Node } from './visitor.js';

function resolveShapeFieldNames(
  name: string,
  spec: AuthoringSpecOutput,
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
): string[] | undefined {
  if (name in spec.shapes) {
    const shape = spec.shapes[name];
    return shape ? Object.keys(shape.fields) : undefined;
  }
  if (name in pdm.entities) {
    const entity = pdm.entities[name];
    return entity ? Object.keys(entity.fields) : undefined;
  }
  if (name in qsm.projections) {
    const proj = qsm.projections[name];
    return proj ? [...proj.exposed] : undefined;
  }
  return undefined;
}

function diff(expected: string[], actual: string[]): { missing: string[]; extra: string[] } {
  const e = new Set(expected);
  const a = new Set(actual);
  return {
    missing: expected.filter((k) => !a.has(k)),
    extra: actual.filter((k) => !e.has(k)),
  };
}

const checkMapReduceCoverageHook = (node: Node, ctx: GraphCtx): void => {
  if (node.type !== 'map' && node.type !== 'reduce') return;
  const expected = resolveShapeFieldNames(node.config.into, ctx.spec, ctx.pdm, ctx.qsm);
  if (!expected) return;
  const actual =
    node.type === 'map'
      ? Object.keys(node.config.fields)
      : [...Object.keys(node.config.group), ...Object.keys(node.config.measures)];
  const { missing, extra } = diff(expected, actual);
  if (missing.length || extra.length) {
    ctx.errors.push({
      layer: 'structural',
      code:
        node.type === 'map'
          ? ERROR_CODES.STRUCT_MAP_SHAPE_COVERAGE
          : ERROR_CODES.STRUCT_REDUCE_SHAPE_COVERAGE,
      message:
        (missing.length ? `missing: ${missing.join(', ')}; ` : '') +
        (extra.length ? `extra: ${extra.join(', ')}` : ''),
      location: { graphId: ctx.graph.id, nodeId: node.id },
    });
  }
};

export const mapReduceBundle: CheckBundle = {
  nodeByKind: {
    map: [checkMapReduceCoverageHook],
    reduce: [checkMapReduceCoverageHook],
  },
};

export function checkMapReduceCoverage(spec: AuthoringSpecOutput, pdm: ValidatedPdm, qsm: ValidatedQsm): GraphIrError[] {
  return runStructuralVisitor(spec, pdm, qsm, [mapReduceBundle]);
}
