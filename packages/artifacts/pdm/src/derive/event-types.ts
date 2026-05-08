import type {
  ScalarPrimitive,
  StateMachine,
  Transition,
  ValidatedPdm,
} from '../types/artifact.js';

export type EventFieldSpec = Readonly<{
  type: ScalarPrimitive;
  nullable: boolean;
}>;

export type EventTypeSpec = Readonly<{
  eventType: string;
  aggregateType: string;
  transition: string;
  from: readonly (string | null)[];
  to: string;
  isCreation: boolean;
  isSelfLoop: boolean;
  affects: readonly string[];
  payloadFields: Readonly<Record<string, EventFieldSpec>>;
}>;

// Cache keyed by ValidatedPdm identity. Branded `Readonly<...>` brands are
// still real objects, so WeakMap is GC-safe: when the PDM goes out of scope,
// its cache entry is collected. Callers (graph-ir-compiler emit/validate/
// compile, blueprint compose, runtime load-service, seed CLI/tests) all pass
// the same ValidatedPdm reference repeatedly per service boot, so cache hits
// dominate after the first call.
const eventTypesCache = new WeakMap<ValidatedPdm, readonly EventTypeSpec[]>();

export function deriveEventTypes(artifact: ValidatedPdm): readonly EventTypeSpec[] {
  const cached = eventTypesCache.get(artifact);
  if (cached !== undefined) return cached;

  const computed = computeEventTypes(artifact);
  eventTypesCache.set(artifact, computed);
  return computed;
}

function computeEventTypes(artifact: ValidatedPdm): readonly EventTypeSpec[] {
  const events: EventTypeSpec[] = [];

  for (const [entityName, entity] of Object.entries(artifact.entities)) {
    if (!entity.stateMachine) continue;
    const sm = entity.stateMachine;

    for (const [transitionName, t] of Object.entries(sm.transitions)) {
      events.push(buildSpec(entityName, transitionName, t, sm, entity));
    }
  }

  return events;
}

function buildSpec(
  entityName: string,
  transitionName: string,
  t: Transition,
  sm: StateMachine,
  entity: ValidatedPdm['entities'][string],
): EventTypeSpec {
  const from = normalizeFrom(t.from);
  const isCreation = from.includes(null);
  const isSelfLoop =
    !isCreation && from.length === 1 && from[0] === t.to;

  const declared = t.affects;
  const resolved = resolveAffects(declared, sm.stateField);
  const affectsWithState = includeStateField(resolved, sm.stateField);

  // Creation payloads use only declared affects: the new state comes from the transition `to`,
  // not the event payload (see projection-consumer INSERT binding for the state column).
  const fieldsForPayload = isCreation ? resolved : affectsWithState;

  const payloadFields: Record<string, EventFieldSpec> = {};
  for (const fieldName of fieldsForPayload) {
    const f = entity.fields[fieldName];
    if (!f) continue;
    payloadFields[fieldName] = { type: f.type, nullable: f.nullable };
  }

  return {
    eventType: t.eventType ?? defaultEventType(entityName, transitionName),
    aggregateType: entityName,
    transition: transitionName,
    from,
    to: t.to,
    isCreation,
    isSelfLoop,
    affects: affectsWithState,
    payloadFields,
  };
}

export function defaultEventType(entityName: string, transitionName: string): string {
  return pascalCase(entityName) + pascalCase(transitionName);
}

function resolveAffects(
  declared: readonly string[] | undefined,
  stateField: string,
): readonly string[] {
  if (declared !== undefined) return declared;
  return [stateField];
}

function includeStateField(
  affects: readonly string[],
  stateField: string,
): readonly string[] {
  return affects.includes(stateField) ? affects : [stateField, ...affects];
}

function normalizeFrom(from: Transition['from']): readonly (string | null)[] {
  if (from === null) return [null];
  if (typeof from === 'string') return [from];
  return [...from];
}

function pascalCase(s: string): string {
  if (s.length === 0) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
