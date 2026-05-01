import type { CanonicalGraph, CanonicalNode } from '../types/canonical.js';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import type { PlanStep, ScanStep, SemanticPlan } from '../types/semantic-plan.js';
import { err, ok, ERROR_CODES, type Result, type GraphIrError } from '../types/result.js';
import { resolveSources, type SourceMap } from '../validate/semantic/sources.js';

export function buildSemanticPlan(graph: CanonicalGraph, pdm: ValidatedPdm, qsm: ValidatedQsm): Result<SemanticPlan> {
  const sourcesR = resolveSources(graph, pdm, qsm);
  if (!sourcesR.ok) return sourcesR;
  const sources = sourcesR.value;
  const errors: GraphIrError[] = [];
  const steps: PlanStep[] = [];

  for (const node of graph.nodes) {
    if (node.kind === 'emit') continue;
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
    case 'emit':
      return undefined;
    case 'findMany': {
      const src = sources.get(node.id);
      if (!src) return undefined;
      if (src.kind === 'eventType') {
        // Event-log source: scan `event_log` with constant event_type predicate; expose
        // aggregateId/occurredAt/actorId + payload fields (via json_extract) as virtual columns.
        const aggEntity = pdm.entities[src.aggregateType];
        if (!aggEntity) return undefined;
        const keyName = aggEntity.keys[0];
        const keyField = keyName ? aggEntity.fields[keyName] : undefined;
        const keyType = keyField?.type ?? 'integer';
        const keyNullable = keyField?.nullable ?? false;

        const fields: ScanStep['fields'] = [
          { name: 'aggregateId', column: 'aggregate_id', type: keyType, nullable: keyNullable },
          { name: 'occurredAt', column: 'occurred_at', type: 'datetime', nullable: false },
          { name: 'actorId', column: 'actor_id', type: 'string', nullable: true },
        ];
        for (const [pname, pspec] of Object.entries(src.payloadFields)) {
          fields.push({
            name: pname,
            column: 'payload_json',
            type: pspec.type,
            nullable: pspec.nullable,
            sql: { fn: 'json_extract', column: 'payload_json', jsonPath: `$.${pname}` },
          });
        }
        return {
          kind: 'scan',
          nodeId: node.id,
          table: 'event_log',
          alias: node.alias,
          entity: src.aggregateType,
          fields,
          where: { kind: 'eq_literal', column: 'event_type', value: src.eventType },
        };
      }
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
