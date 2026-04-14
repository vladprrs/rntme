import type { CanonicalGraph, CanonicalNode } from '../types/canonical.js';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import type { PlanStep, SemanticPlan } from '../types/semantic-plan.js';
import { err, ok, ERROR_CODES, type Result, type GraphIrError } from '../types/result.js';
import { resolveSources, type SourceMap } from '../validate/semantic/sources.js';

export function buildSemanticPlan(
  graph: CanonicalGraph,
  pdm: ValidatedPdm,
  qsm: ValidatedQsm,
): Result<SemanticPlan> {
  const sourcesR = resolveSources(graph, pdm, qsm);
  if (!sourcesR.ok) return sourcesR;
  const sources = sourcesR.value;
  const errors: GraphIrError[] = [];
  const steps: PlanStep[] = [];

  for (const node of graph.nodes) {
    const step = lower(node, sources, pdm);
    if (step) steps.push(step);
    else
      errors.push({
        layer: 'semantic-plan',
        code: ERROR_CODES.SEM_TYPE_MISMATCH,
        message: `unable to plan node "${node.id}"`,
        location: { graphId: graph.id, nodeId: node.id },
      });
  }
  if (errors.length) return err(errors);

  return ok({
    graphId: graph.id,
    outputNodeId: graph.outputFrom,
    outputShape: graph.signature.output.type,
    cardinality: graph.signature.output.type.startsWith('rowset') ? 'rowset' : 'row',
    steps,
  });
}

function lower(node: CanonicalNode, sources: SourceMap, pdm: ValidatedPdm): PlanStep | undefined {
  switch (node.kind) {
    case 'findMany': {
      const src = sources.get(node.id);
      if (!src) return undefined;
      const entity = pdm.entities[src.entity];
      if (!entity) return undefined;
      const fields = Object.entries(entity.fields).map(([name, f]) => ({
        name,
        column: f.column,
        type: f.type,
        nullable: f.nullable,
      }));
      return {
        kind: 'scan',
        nodeId: node.id,
        table: src.table,
        alias: node.alias,
        entity: src.entity,
        fields,
      };
    }
    case 'limit':
      return { kind: 'limit', nodeId: node.id, count: node.count };
    case 'filter':
      return { kind: 'filter', nodeId: node.id, predicate: node.expr };
    case 'map':
      return {
        kind: 'project',
        nodeId: node.id,
        into: node.into,
        fields: Object.fromEntries(
          Object.entries(node.fields).map(([k, v]) => [k, { expr: v as never }]),
        ),
      };
    case 'reduce':
      return {
        kind: 'aggregate',
        nodeId: node.id,
        into: node.into,
        group: node.group,
        measures: Object.fromEntries(
          Object.entries(node.measures).map(([k, m]) => [
            k,
            m.expr !== undefined ? { fn: m.fn, expr: m.expr } : { fn: m.fn },
          ]),
        ),
      };
    case 'sort':
      return { kind: 'sort', nodeId: node.id, by: node.by };
    default:
      return undefined;
  }
}
