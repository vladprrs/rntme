import type { AuthoringSpecOutput } from '../../parse/schema.js';
import type { Pdm } from '../../types/pdm.js';
import type { Qsm } from '../../types/qsm.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

function resolveShapeFieldNames(
  name: string,
  spec: AuthoringSpecOutput,
  pdm: Pdm,
  qsm: Qsm,
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
    return proj ? proj.exposed : undefined;
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

export function checkMapReduceCoverage(spec: AuthoringSpecOutput, pdm: Pdm, qsm: Qsm): GraphIrError[] {
  const errs: GraphIrError[] = [];
  for (const graph of Object.values(spec.graphs)) {
    for (const node of graph.nodes) {
      if (node.type !== 'map' && node.type !== 'reduce') continue;
      const expected = resolveShapeFieldNames(node.config.into, spec, pdm, qsm);
      if (!expected) continue;
      const actual =
        node.type === 'map'
          ? Object.keys(node.config.fields)
          : [...Object.keys(node.config.group), ...Object.keys(node.config.measures)];
      const { missing, extra } = diff(expected, actual);
      if (missing.length || extra.length) {
        errs.push({
          layer: 'structural',
          code:
            node.type === 'map'
              ? ERROR_CODES.STRUCT_MAP_SHAPE_COVERAGE
              : ERROR_CODES.STRUCT_REDUCE_SHAPE_COVERAGE,
          message:
            (missing.length ? `missing: ${missing.join(', ')}; ` : '') +
            (extra.length ? `extra: ${extra.join(', ')}` : ''),
          location: { graphId: graph.id, nodeId: node.id },
        });
      }
    }
  }
  return errs;
}
