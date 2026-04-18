import type { PdmResolver, ResolvedEntity, ResolvedField, EventTypeSpec } from '@rntme/pdm';
import {
  deriveProjectionHandler,
  type ValidatedQsm,
  type ProjectionHandlerSpec,
  type EventHandler,
} from '@rntme/qsm';
import type {
  ApplyPlan,
  CompiledHandler,
  ColumnBinding,
  MirrorHandler,
  DerivedHandler,
} from '../types/apply.js';
import { ApplyCompileError } from '../types/errors.js';

export function compileApplyPlan(input: {
  pdm: PdmResolver;
  qsm: ValidatedQsm;
  events: readonly EventTypeSpec[];
  derivedHandlers?: readonly DerivedHandler[];
}): ApplyPlan {
  const specs = deriveProjectionHandler(input.qsm, input.pdm, input.events);
  const mirrorBuckets = new Map<string, MirrorHandler[]>();
  const derivedBuckets = new Map<string, DerivedHandler[]>();
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
      let compiled: MirrorHandler | null = null;
      if (handler.op.kind === 'insert') {
        compiled = compileInsert(spec, handler, entity, eventSpec);
      } else if (handler.op.kind === 'update') {
        compiled = compileUpdate(spec, handler, entity);
      }
      if (compiled) {
        const bucket = mirrorBuckets.get(handler.eventType);
        if (bucket) bucket.push(compiled);
        else mirrorBuckets.set(handler.eventType, [compiled]);
      }
    }
  }

  for (const dh of input.derivedHandlers ?? []) {
    const bucket = derivedBuckets.get(dh.eventType);
    if (bucket) bucket.push(dh);
    else derivedBuckets.set(dh.eventType, [dh]);
  }

  // Merge: mirror-first, then derived handlers sorted by projectionName for
  // deterministic ordering across runs.
  const handlersByEventType = new Map<string, readonly CompiledHandler[]>();
  const eventTypes = new Set<string>([
    ...mirrorBuckets.keys(),
    ...derivedBuckets.keys(),
  ]);
  for (const et of eventTypes) {
    const mirrors = mirrorBuckets.get(et) ?? [];
    const derived = [...(derivedBuckets.get(et) ?? [])].sort((a, b) =>
      a.projectionName < b.projectionName ? -1 : a.projectionName > b.projectionName ? 1 : 0,
    );
    const combined: CompiledHandler[] = [...mirrors, ...derived];
    handlersByEventType.set(et, combined);
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
  eventSpec: EventTypeSpec,
): MirrorHandler {
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
      bindingForInsertColumn(
        col,
        keyColumn,
        entity,
        fieldByColumn,
        fieldByName,
        payloadFields,
        spec.projectionName,
        eventSpec,
      ),
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
  eventSpec: EventTypeSpec,
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
  if (
    eventSpec.isCreation &&
    entity.stateMachine !== null &&
    field.name === entity.stateMachine.stateField
  ) {
    return { kind: 'literalString', value: eventSpec.to };
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

function compileUpdate(
  spec: ProjectionHandlerSpec,
  handler: EventHandler,
  entity: ResolvedEntity,
): MirrorHandler {
  if (handler.op.kind !== 'update') {
    throw new ApplyCompileError(
      'PC_MISSING_ENTITY_FIELD',
      'compileUpdate called with non-update handler',
      {},
    );
  }
  const keyColumn = spec.keyColumns[0]!;
  const fieldByColumn = new Map(entity.fields.map((f) => [f.column, f]));
  const fieldByName = new Map(entity.fields.map((f) => [f.name, f]));

  const setParts: string[] = [];
  const bindings: ColumnBinding[] = [];
  for (let i = 0; i < handler.op.setColumns.length; i++) {
    const col = handler.op.setColumns[i]!;
    const fieldName = handler.op.setFields[i]!;
    if (!fieldByColumn.has(col)) {
      throw new ApplyCompileError(
        'PC_MISSING_ENTITY_FIELD',
        `setColumn "${col}" not in entity "${entity.name}" while compiling update handler for projection "${spec.projectionName}".`,
        { column: col, entity: entity.name, projection: spec.projectionName },
      );
    }
    setParts.push(`${q(col)} = ?`);
    bindings.push({ kind: 'payloadField', fieldName });
  }
  for (const field of entity.fields) {
    if (field.generated === 'updatedAt') {
      setParts.push(`${q(field.column)} = ?`);
      bindings.push({ kind: 'generatedOccurred' });
    }
  }
  setParts.push(`${q('last_event_id')} = ?`);
  bindings.push({ kind: 'eventId' });
  setParts.push(`${q('last_event_version')} = ?`);
  bindings.push({ kind: 'eventVersion' });
  setParts.push(`${q('applied_at')} = ?`);
  bindings.push({ kind: 'appliedAt' });

  const keyFieldName = entity.keys[0]!;
  const keyField = fieldByName.get(keyFieldName)!;
  bindings.push({ kind: 'aggregateId', sqlType: sqlTypeOf(keyField) });
  bindings.push({ kind: 'eventVersion' });

  const sql =
    `UPDATE ${q(spec.tableName)}\n` +
    `SET ${setParts.join(', ')}\n` +
    `WHERE ${q(keyColumn)} = ? AND ${q('last_event_version')} < ?`;

  return {
    kind: 'update',
    projectionName: spec.projectionName,
    tableName: spec.tableName,
    aggregateType: spec.aggregateType,
    eventType: handler.eventType,
    keyColumn,
    sql,
    bindings,
  };
}
