import type { ValidatedPdm, EventFieldSpec } from '@rntme/pdm';
import type { Expr } from '../../../types/authoring.js';
import type { AggregateStep, ScanStep, SemanticPlan } from '../../../types/semantic-plan.js';
import type { RelOp } from '../../../types/relational.js';
import type {
  DerivedColumnBinding,
  DerivedCompileResult,
  DerivedSqlType,
} from '../../../types/projection.js';
import type { EventSource } from '../../../validate/semantic/sources.js';
import { buildDerivedTableSchema, type EventSourceColumnMeta } from './table-schema.js';
import { buildDeltaArtifact } from './delta.js';
import { buildBootstrapSql } from './bootstrap.js';
import { buildFilterArtifact, type EventSourceFilterColumn } from './filter.js';
import { buildRelational } from '../../../relational/build.js';

/**
 * Glue function: maps the semantic plan of a projection-role graph into a
 * fully-formed `DerivedCompileResult` (bootstrap SQL + delta SQL + bindings +
 * table schema + optional filter).
 */
export function lowerToEventDelta(
  semanticPlan: SemanticPlan,
  pdm: ValidatedPdm,
  eventSource: EventSource,
  projectionTable: string,
  filterExpr: Expr | null,
): DerivedCompileResult {
  const scan = findScanStep(semanticPlan);
  const aggregate = findAggregateStep(semanticPlan);
  if (!scan) {
    throw new Error('lowerToEventDelta: plan has no scan step');
  }
  if (!aggregate) {
    throw new Error('lowerToEventDelta: plan has no aggregate (reduce) step');
  }

  // Build the virtual-column → metadata dictionary used by both schema builder
  // and filter lowering. The scan's `fields` enumerate every virtual column
  // exposed on the event-source alias (aggregateId/occurredAt/actorId + payload).
  const columnMeta: Record<string, EventSourceColumnMeta> = {};
  const filterCols: Record<string, EventSourceFilterColumn> = {};
  for (const f of scan.fields) {
    const sqlType = mapPdmTypeToSqlType(f.type);
    const binding = deriveBinding(f.name, sqlType, eventSource.payloadFields);
    columnMeta[f.name] = { sqlType, nullable: f.nullable, binding };
    filterCols[f.name] = { sqlType, binding };
  }

  // Relational plan is needed by buildDerivedTableSchema (it walks the op tree).
  const rootRel: RelOp = buildRelational(semanticPlan);

  const tableSchema = buildDerivedTableSchema(rootRel, projectionTable, columnMeta);
  const { deltaSql, deltaBindings } = buildDeltaArtifact(tableSchema);
  const filter = buildFilterArtifact(filterExpr, filterCols);

  // For bootstrap, we render every group / measure expression in terms of
  // event_log columns (constant-literal event_type predicate already lives in
  // buildBootstrapSql; payload field refs → json_extract(...)).
  const groupKeySql: Record<string, string> = {};
  for (const [name, path] of Object.entries(aggregate.group)) {
    const virt = resolveVirtualName(path);
    const meta = columnMeta[virt];
    if (!meta) {
      throw new Error(`lowerToEventDelta: group key "${name}" → unknown virtual column "${virt}"`);
    }
    groupKeySql[name] = renderVirtualForBootstrap(virt, meta.binding);
  }

  const measureSql: Record<string, string> = {};
  for (const [name, m] of Object.entries(aggregate.measures)) {
    if (m.fn === 'count') {
      measureSql[name] = 'COUNT(*)';
    } else if (m.fn === 'sum') {
      if (m.expr === undefined) {
        throw new Error(`lowerToEventDelta: sum measure "${name}" missing expr`);
      }
      measureSql[name] = `SUM(${renderExprForBootstrap(m.expr, columnMeta)})`;
    } else {
      throw new Error(
        `lowerToEventDelta: unsupported measure fn "${m.fn}" for "${name}" (projection-role allows count | sum)`,
      );
    }
  }

  const bootstrapSql = buildBootstrapSql(
    tableSchema,
    eventSource.eventType,
    filter?.sql ?? null,
    groupKeySql,
    measureSql,
  );

  return {
    bootstrapSql,
    deltaSql,
    deltaBindings,
    filter,
    tableSchema,
    eventType: eventSource.eventType,
    aggregateType: eventSource.aggregateType,
  };
}

function findScanStep(plan: SemanticPlan): ScanStep | undefined {
  return plan.steps.find((s): s is ScanStep => s.kind === 'scan');
}

function findAggregateStep(plan: SemanticPlan): AggregateStep | undefined {
  return plan.steps.find((s): s is AggregateStep => s.kind === 'aggregate');
}

function mapPdmTypeToSqlType(t: string): DerivedSqlType {
  switch (t) {
    case 'integer':
    case 'long':
      return 'INTEGER';
    case 'decimal':
    case 'real':
      return 'REAL';
    case 'string':
    case 'date':
    case 'datetime':
    case 'boolean':
      return 'TEXT';
    default:
      return 'TEXT';
  }
}

function deriveBinding(
  virtualName: string,
  sqlType: DerivedSqlType,
  payloadFields: Readonly<Record<string, EventFieldSpec>>,
): DerivedColumnBinding {
  if (virtualName === 'aggregateId') return { kind: 'aggregateId', sqlType };
  if (virtualName === 'occurredAt') return { kind: 'eventOccurredAt' };
  if (virtualName === 'actorId') return { kind: 'eventActorId' };
  if (virtualName in payloadFields) {
    return { kind: 'payloadField', fieldName: virtualName, sqlType };
  }
  throw new Error(
    `lowerToEventDelta: virtual column "${virtualName}" is neither a reserved event field nor a payload field`,
  );
}

function resolveVirtualName(path: string): string {
  const parts = path.split('.');
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return parts[1]!;
  throw new Error(`lowerToEventDelta: dot-nav path "${path}" is not allowed on event-source virtual columns`);
}

function renderVirtualForBootstrap(virt: string, binding: DerivedColumnBinding): string {
  switch (binding.kind) {
    case 'aggregateId':
      return 'aggregate_id';
    case 'eventOccurredAt':
      return 'occurred_at';
    case 'eventActorId':
      return 'actor_id';
    case 'payloadField':
      return `json_extract(payload_json, '$.${binding.fieldName}')`;
    case 'eventId':
      return 'event_id';
    case 'appliedAt':
      return 'applied_at';
    case 'literal':
      return binding.sql;
    case 'exprScalar':
      return binding.sql;
  }
  throw new Error(`lowerToEventDelta: cannot render virtual "${virt}"`);
}

/**
 * Render a measure expression for the bootstrap-SQL context. Payload-field
 * references are inlined as `json_extract(payload_json, '$.<name>')`, and
 * literals are rendered directly.
 */
function renderExprForBootstrap(
  e: Expr,
  cols: Record<string, EventSourceColumnMeta>,
): string {
  if (e === null) return 'NULL';
  if (typeof e === 'boolean') return e ? '1' : '0';
  if (typeof e === 'number') return String(e);
  if (typeof e === 'string') {
    const virt = resolveVirtualName(e);
    const meta = cols[virt];
    if (!meta) {
      throw new Error(`lowerToEventDelta: expression refs unknown virtual column "${virt}"`);
    }
    return renderVirtualForBootstrap(virt, meta.binding);
  }
  if (typeof e === 'object') {
    if ('$literal' in e) {
      return `'${String((e as { $literal: string }).$literal).replace(/'/g, "''")}'`;
    }
    if ('$param' in e) {
      throw new Error('lowerToEventDelta: $param not supported in projection-role expressions');
    }
    const entries = Object.entries(e as Record<string, unknown>);
    if (entries.length !== 1) {
      throw new Error(`lowerToEventDelta: malformed expression ${JSON.stringify(e)}`);
    }
    const [op, args] = entries[0] as [string, Expr[]];
    const sep = op === 'mul' ? '*' : op === 'add' ? '+' : op === 'sub' ? '-' : op === 'div' ? '/' : null;
    if (sep === null) {
      throw new Error(`lowerToEventDelta: unsupported operator "${op}" in projection-role expression`);
    }
    return `(${args.map((a) => renderExprForBootstrap(a, cols)).join(` ${sep} `)})`;
  }
  throw new Error(`lowerToEventDelta: unsupported expression ${JSON.stringify(e)}`);
}
