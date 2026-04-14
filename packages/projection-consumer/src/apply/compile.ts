import type { PdmResolver, ResolvedEntity, ResolvedField, EventTypeSpec } from '@rntme/pdm';
import {
  deriveProjectionHandler,
  type ValidatedQsm,
  type ProjectionHandlerSpec,
  type EventHandler,
} from '@rntme/qsm';
import type { ApplyPlan, CompiledHandler, ColumnBinding } from '../types/apply.js';
import { ApplyCompileError } from '../types/errors.js';

export function compileApplyPlan(input: {
  pdm: PdmResolver;
  qsm: ValidatedQsm;
  events: readonly EventTypeSpec[];
}): ApplyPlan {
  const specs = deriveProjectionHandler(input.qsm, input.pdm, input.events);
  const handlersByEventType = new Map<string, CompiledHandler>();
  const mirrorsByAggregate = new Map<string, string>();
  const eventByType = new Map(input.events.map((e) => [e.eventType, e]));

  for (const spec of specs) {
    if (spec.keyColumns.length !== 1) {
      throw new ApplyCompileError(
        'PC_COMPOSITE_KEY_NOT_SUPPORTED',
        `Composite-key aggregate "${spec.aggregateType}" (projection "${spec.projectionName}") is not supported in MVP.`,
        {
          projection: spec.projectionName,
          aggregate: spec.aggregateType,
          keyCount: String(spec.keyColumns.length),
        },
      );
    }
    const entity = input.pdm.resolveEntity(spec.aggregateType);
    if (!entity) {
      throw new ApplyCompileError(
        'PC_MISSING_ENTITY_FIELD',
        `Entity "${spec.aggregateType}" missing from PDM while compiling projection "${spec.projectionName}".`,
        { aggregate: spec.aggregateType },
      );
    }
    mirrorsByAggregate.set(spec.aggregateType, spec.tableName);

    for (const handler of spec.eventHandlers) {
      const eventSpec = eventByType.get(handler.eventType);
      if (!eventSpec) {
        throw new ApplyCompileError(
          'PC_MISSING_ENTITY_FIELD',
          `EventTypeSpec for "${handler.eventType}" missing while compiling projection "${spec.projectionName}".`,
          { eventType: handler.eventType },
        );
      }
      if (handler.op.kind === 'insert') {
        handlersByEventType.set(handler.eventType, compileInsert(spec, handler, entity, eventSpec));
      }
      // update compiled in Task 6
    }
  }

  return {
    handlersByEventType,
    mirrorsByAggregate,
  };
}

function compileInsert(
  spec: ProjectionHandlerSpec,
  handler: EventHandler,
  entity: ResolvedEntity,
  _eventSpec: EventTypeSpec,
): CompiledHandler {
  if (handler.op.kind !== 'insert') {
    throw new ApplyCompileError(
      'PC_MISSING_ENTITY_FIELD',
      'compileInsert called with non-insert handler',
      {},
    );
  }
  const keyColumn = spec.keyColumns[0]!;
  const mirrorColumns = handler.op.columns;
  const payloadFields = new Set(handler.op.payloadFields);
  const fieldByColumn = new Map(entity.fields.map((f) => [f.column, f]));
  const fieldByName = new Map(entity.fields.map((f) => [f.name, f]));

  const bindings: ColumnBinding[] = [];
  for (const col of mirrorColumns) {
    bindings.push(
      bindingForInsertColumn(col, keyColumn, entity, fieldByColumn, fieldByName, payloadFields, spec.projectionName),
    );
  }
  // Idempotency columns always appended in this fixed order:
  bindings.push({ kind: 'eventId' });
  bindings.push({ kind: 'eventVersion' });
  bindings.push({ kind: 'appliedAt' });

  const allCols = [...mirrorColumns, 'last_event_id', 'last_event_version', 'applied_at'];
  const placeholders = allCols.map(() => '?').join(', ');
  const conflictSet = allCols
    .filter((c) => c !== keyColumn)
    .map((c) => `${q(c)} = excluded.${q(c)}`)
    .join(', ');
  const sql =
    `INSERT INTO ${q(spec.tableName)} (${allCols.map(q).join(', ')})\n` +
    `VALUES (${placeholders})\n` +
    `ON CONFLICT (${q(keyColumn)}) DO UPDATE SET\n` +
    `  ${conflictSet}\n` +
    `WHERE ${q(spec.tableName)}.${q('last_event_version')} < excluded.${q('last_event_version')}`;

  return {
    kind: 'insert',
    projectionName: spec.projectionName,
    tableName: spec.tableName,
    aggregateType: spec.aggregateType,
    eventType: handler.eventType,
    keyColumn,
    sql,
    bindings,
  };
}

function bindingForInsertColumn(
  column: string,
  keyColumn: string,
  entity: ResolvedEntity,
  fieldByColumn: Map<string, ResolvedField>,
  fieldByName: Map<string, ResolvedField>,
  payloadFields: Set<string>,
  projectionName: string,
): ColumnBinding {
  if (column === keyColumn) {
    const keyFieldName = entity.keys[0]!;
    const keyField = fieldByName.get(keyFieldName)!;
    return { kind: 'aggregateId', sqlType: sqlTypeOf(keyField) };
  }
  const field = fieldByColumn.get(column);
  if (!field) {
    throw new ApplyCompileError(
      'PC_MISSING_ENTITY_FIELD',
      `Column "${column}" in projection "${projectionName}" has no matching PDM field on entity "${entity.name}".`,
      { column, entity: entity.name, projection: projectionName },
    );
  }
  if (payloadFields.has(field.name)) {
    return { kind: 'payloadField', fieldName: field.name };
  }
  if (field.generated === 'createdAt' || field.generated === 'updatedAt') {
    return { kind: 'generatedOccurred' };
  }
  if (field.generated === 'actor') {
    return { kind: 'generatedActor' };
  }
  if (field.nullable) {
    return { kind: 'nullable' };
  }
  throw new ApplyCompileError(
    'PC_COLUMN_SOURCE_UNRESOLVABLE',
    `Column "${column}" (field "${field.name}") on entity "${entity.name}" is NOT NULL, not in event affects, and not generated — cannot bind a value for creation of projection "${projectionName}".`,
    { column, field: field.name, entity: entity.name, projection: projectionName },
  );
}

function sqlTypeOf(field: ResolvedField): 'INTEGER' | 'TEXT' | 'REAL' {
  switch (field.type) {
    case 'integer':
    case 'boolean':
      return 'INTEGER';
    case 'decimal':
      return 'REAL';
    case 'string':
    case 'date':
    case 'datetime':
      return 'TEXT';
  }
}

function q(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}
