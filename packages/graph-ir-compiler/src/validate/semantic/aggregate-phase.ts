import type { CanonicalGraph } from '../../types/canonical.js';
import type { Pdm } from '../../types/pdm.js';
import type { Qsm } from '../../types/qsm.js';
import type { AuthoringSpecOutput } from '../../parse/schema.js';
import type { Scope } from './scope.js';
import { inferExprType, type ParamMap } from './types.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

const NUMERIC = new Set(['integer', 'long', 'decimal']);

function aggReturnType(fn: string, inType: string): string | undefined {
  switch (fn) {
    case 'count':
    case 'count_distinct':
      return 'integer';
    case 'sum':
      if (!NUMERIC.has(inType)) return undefined;
      if (inType === 'decimal') return 'decimal';
      if (inType === 'integer') return 'integer';
      return 'long';
    case 'avg':
      return NUMERIC.has(inType) ? 'decimal' : undefined;
    case 'min':
    case 'max':
      return inType;
    case 'group_array':
      return 'string';
    default:
      return undefined;
  }
}

function targetFieldsForInto(
  into: string,
  shapes: AuthoringSpecOutput['shapes'],
  pdm: Pdm,
  qsm: Qsm,
): Record<string, { type: string; nullable: boolean }> {
  const fromShapes = shapes[into];
  if (fromShapes?.fields) {
    return Object.fromEntries(
      Object.entries(fromShapes.fields).map(([k, f]) => [k, { type: f.type, nullable: f.nullable }]),
    );
  }
  const ent = pdm.entities[into];
  if (ent) {
    return Object.fromEntries(
      Object.entries(ent.fields).map(([k, f]) => [k, { type: f.type, nullable: f.nullable }]),
    );
  }
  const proj = qsm.projections[into];
  if (proj) {
    return Object.fromEntries(proj.exposed.map((k) => [k, { type: 'string', nullable: true }]));
  }
  return {};
}

export function checkReduce(
  graph: CanonicalGraph,
  shapes: AuthoringSpecOutput['shapes'],
  pdm: Pdm,
  qsm: Qsm,
  scopeFor: (nodeId: string) => Scope,
  params: ParamMap,
): GraphIrError[] {
  const errs: GraphIrError[] = [];
  for (const node of graph.nodes) {
    if (node.kind !== 'reduce') continue;
    const fields = targetFieldsForInto(node.into, shapes, pdm, qsm);
    if (Object.keys(fields).length === 0) continue;

    const scope = scopeFor(node.id);

    for (const [gKey, gPath] of Object.entries(node.group)) {
      const r = inferExprType(gPath, scope, pdm, params);
      if (!r.ok) {
        errs.push(...r.errors);
        continue;
      }
      const target = fields[gKey];
      if (target && target.type !== r.value.type) {
        errs.push({
          layer: 'semantic',
          code: ERROR_CODES.SEM_SHAPE_MISMATCH,
          message: `reduce.group "${gKey}": expected ${target.type}, got ${r.value.type}`,
          location: { graphId: graph.id, nodeId: node.id },
        });
      }
    }
    for (const [mKey, m] of Object.entries(node.measures)) {
      const target = fields[mKey];
      if (!target) continue;
      let in_t = 'integer';
      if (m.expr !== undefined) {
        const r = inferExprType(m.expr, scope, pdm, params);
        if (!r.ok) {
          errs.push(...r.errors);
          continue;
        }
        in_t = r.value.type;
      }
      const ret = aggReturnType(m.fn, in_t);
      if (!ret) {
        errs.push({
          layer: 'semantic',
          code: ERROR_CODES.SEM_TYPE_MISMATCH,
          message: `aggregate ${m.fn} not applicable to ${in_t}`,
          location: { graphId: graph.id, nodeId: node.id, path: `measures.${mKey}` },
        });
        continue;
      }
      const order: Record<string, number> = { integer: 1, long: 2, decimal: 3 };
      if (
        ret !== target.type &&
        !(
          NUMERIC.has(ret) &&
          NUMERIC.has(target.type) &&
          (order[ret] ?? 0) <= (order[target.type] ?? 0)
        )
      ) {
        errs.push({
          layer: 'semantic',
          code: ERROR_CODES.SEM_SHAPE_MISMATCH,
          message: `reduce.measures "${mKey}": expected ${target.type}, got ${ret}`,
          location: { graphId: graph.id, nodeId: node.id, path: `measures.${mKey}` },
        });
      }
    }
  }
  return errs;
}
