import type { PdmResolver, ResolvedEntity, EventTypeSpec } from '@rntme/pdm';
import type { ValidatedQsm, Projection } from '../types/artifact.js';
import { defaultTableName } from '../validate/structural.js';
import { invariantViolated } from '../common/invariant.js';

export type HandlerOp =
  | Readonly<{
      kind: 'insert';
      columns: readonly string[];
      payloadFields: readonly string[];
    }>
  | Readonly<{
      kind: 'update';
      setColumns: readonly string[];
      setFields: readonly string[];
    }>;

export type EventHandler = Readonly<{
  eventType: string;
  transition: string;
  op: HandlerOp;
}>;

export type IdempotencyGuard = Readonly<{
  versionColumn: 'last_event_version';
  eventIdColumn: 'last_event_id';
  appliedAtColumn: 'applied_at';
}>;

export type ProjectionHandlerSpec = Readonly<{
  projectionName: string;
  tableName: string;
  aggregateType: string;
  idempotencyGuard: IdempotencyGuard;
  keyColumns: readonly string[];
  eventHandlers: readonly EventHandler[];
}>;

const IDEMPOTENCY_GUARD: IdempotencyGuard = {
  versionColumn: 'last_event_version',
  eventIdColumn: 'last_event_id',
  appliedAtColumn: 'applied_at',
};

export function deriveProjectionHandler(
  artifact: ValidatedQsm,
  pdm: PdmResolver,
  eventTypes: readonly EventTypeSpec[],
): ProjectionHandlerSpec[] {
  const specs: ProjectionHandlerSpec[] = [];

  for (const [projName, proj] of Object.entries(artifact.projections)) {
    const backing = proj.backing ?? 'entity-mirror';
    if (backing !== 'entity-mirror') continue;

    const entity = pdm.resolveEntity(proj.source.entity);
    if (!entity) {
      throw invariantViolated(`entity "${proj.source.entity}" not in PDM for projection "${projName}"`);
    }

    specs.push(buildSpec(projName, proj, entity, eventTypes));
  }

  return specs;
}

function buildSpec(
  projName: string,
  proj: Projection,
  entity: ResolvedEntity,
  eventTypes: readonly EventTypeSpec[],
): ProjectionHandlerSpec {
  const tableName = proj.table ?? defaultTableName(projName);
  const columnOfField = new Map(entity.fields.map((f) => [f.name, f.column]));
  const allMirrorColumns = entity.fields.map((f) => f.column);

  const keyColumns = entity.keys.map((k) => {
    const col = columnOfField.get(k);
    if (!col) {
      throw invariantViolated(`key "${k}" missing column mapping on entity "${entity.name}"`);
    }
    return col;
  });

  const eventHandlers: EventHandler[] = eventTypes
    .filter((e) => e.aggregateType === entity.name)
    .map((e) => buildEventHandler(e, columnOfField, allMirrorColumns));

  return {
    projectionName: projName,
    tableName,
    aggregateType: entity.name,
    idempotencyGuard: IDEMPOTENCY_GUARD,
    keyColumns,
    eventHandlers,
  };
}

function buildEventHandler(
  e: EventTypeSpec,
  columnOfField: Map<string, string>,
  allMirrorColumns: readonly string[],
): EventHandler {
  if (e.isCreation) {
    return {
      eventType: e.eventType,
      transition: e.transition,
      op: {
        kind: 'insert',
        columns: allMirrorColumns,
        payloadFields: Object.keys(e.payloadFields),
      },
    };
  }

  const setColumns = e.affects.map((fieldName) => {
    const col = columnOfField.get(fieldName);
    if (!col) {
      throw invariantViolated(`affected field "${fieldName}" has no column mapping`);
    }
    return col;
  });

  return {
    eventType: e.eventType,
    transition: e.transition,
    op: {
      kind: 'update',
      setColumns,
      setFields: [...e.affects],
    },
  };
}
