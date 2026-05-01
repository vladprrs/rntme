import type { CanonicalGraph, CanonicalMap } from '../../types/canonical.js';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import type { AuthoringSpecOutput } from '../../parse/schema.js';
import { inferExprType, type ParamMap } from './types.js';
import type { Scope } from './scope.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';
import type { SourceMap } from './sources.js';

function shapeFields(
  name: string,
  shapes: AuthoringSpecOutput['shapes'],
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
): Record<string, { type: string; nullable: boolean }> | undefined {
  if (name in shapes) {
    const s = shapes[name as keyof typeof shapes];
    return s?.fields as Record<string, { type: string; nullable: boolean }>;
  }
  const entity = pdm.entities[name];
  if (entity) {
    return Object.fromEntries(
      Object.entries(entity.fields).map(([k, f]) => [k, { type: f.type, nullable: f.nullable }]),
    );
  }
  const proj = qsm.projections[name];
  if (proj) {
    return Object.fromEntries(proj.exposed.map((k) => [k, { type: 'string', nullable: true }]));
  }
  return undefined;
}

const NUMERIC = new Set(['integer', 'long', 'decimal']);

function compatible(actual: string, expected: string): boolean {
  if (actual === expected) return true;
  if (NUMERIC.has(actual) && NUMERIC.has(expected)) {
    const order: Record<string, number> = { integer: 1, long: 2, decimal: 3 };
    return (order[actual] ?? 0) <= (order[expected] ?? 0);
  }
  if (actual === 'date' && expected === 'datetime') return true;
  return false;
}

export function checkMapShapeConformance(
  graph: CanonicalGraph,
  shapes: AuthoringSpecOutput['shapes'] | undefined,
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
  params: ParamMap,
  sources: SourceMap,
): GraphIrError[] {
  if (!shapes) return [];

  const errs: GraphIrError[] = [];
  let scope: Scope = { aliases: new Map() };

  for (const node of graph.nodes) {
    if (node.kind === 'findMany') {
      const src = sources.get(node.id);
      if (src) {
        if (src.kind === 'eventType') {
          scope = {
            aliases: new Map([
              [
                src.alias,
                { kind: 'eventRow', aggregateType: src.aggregateType, payloadFields: src.payloadFields },
              ],
            ]),
          };
        } else {
          scope = { aliases: new Map([[src.alias, { kind: 'entity', entity: src.entity }]]) };
        }
      }
    } else if (node.kind === 'map') {
      const m = node as CanonicalMap;
      const expected = shapeFields(m.into, shapes, pdm, qsm);
      if (!expected) continue;
      for (const [fieldName, value] of Object.entries(m.fields)) {
        const target = expected[fieldName];
        if (!target) continue;
        const rr = inferExprType(value as unknown, scope, pdm, params);
        if (!rr.ok) {
          errs.push(...rr.errors);
          continue;
        }
        if (!compatible(rr.value.type, target.type)) {
          errs.push({
            layer: 'semantic',
            code: ERROR_CODES.SEM_SHAPE_MISMATCH,
            message: `field "${fieldName}" in map "${m.id}": expected ${target.type}, got ${rr.value.type}`,
            location: { graphId: graph.id, nodeId: m.id, path: `fields.${fieldName}` },
          });
        }
        if (rr.value.nullable && !target.nullable) {
          errs.push({
            layer: 'semantic',
            code: ERROR_CODES.SEM_NULLABILITY_VIOLATION,
            message: `field "${fieldName}" in map "${m.id}" produces nullable value but target is not nullable`,
            location: { graphId: graph.id, nodeId: m.id, path: `fields.${fieldName}` },
          });
        }
      }
    }
  }
  return errs;
}
