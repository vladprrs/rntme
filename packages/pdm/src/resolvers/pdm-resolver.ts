import type {
  Entity,
  StateMachine,
  Transition,
  ValidatedPdm,
} from '../types/artifact.js';
import type {
  PdmResolver,
  ResolvedEntity,
  ResolvedField,
  ResolvedRelation,
  ResolvedStateMachine,
  ResolvedTransition,
} from '../types/resolvers.js';

export function createPdmResolver(artifact: ValidatedPdm): PdmResolver {
  const entities = artifact.entities;

  const resolveEntity = (name: string): ResolvedEntity | null => {
    const e = entities[name];
    return e ? toResolvedEntity(name, e) : null;
  };

  const resolveField = (entity: string, field: string): ResolvedField | null => {
    const e = entities[entity];
    const f = e?.fields[field];
    if (!e || !f) return null;
    return toResolvedField(field, f);
  };

  const resolveStateMachine = (entity: string): ResolvedStateMachine | null => {
    const e = entities[entity];
    if (!e?.stateMachine) return null;
    return toResolvedStateMachine(entity, e.stateMachine);
  };

  const resolveTransition = (
    entity: string,
    transition: string,
  ): ResolvedTransition | null => {
    const e = entities[entity];
    const t = e?.stateMachine?.transitions[transition];
    if (!e || !e.stateMachine || !t) return null;
    return toResolvedTransition(entity, transition, t, e.stateMachine.stateField);
  };

  return {
    listEntities: () => Object.keys(entities),
    resolveEntity,
    resolveField,
    resolveStateMachine,
    resolveTransition,
  };
}

function toResolvedEntity(name: string, e: Entity): ResolvedEntity {
  const fields = Object.entries(e.fields).map(([n, f]) => toResolvedField(n, f));
  const relations = Object.entries(e.relations ?? {}).map(
    ([n, r]): ResolvedRelation => ({ ...r, name: n, from: name }),
  );
  const stateMachine = e.stateMachine
    ? toResolvedStateMachine(name, e.stateMachine)
    : null;
  return {
    name,
    ownerService: e.ownerService,
    table: e.table,
    fields,
    relations,
    keys: e.keys,
    stateMachine,
  };
}

function toResolvedField(name: string, f: Entity['fields'][string]): ResolvedField {
  const base: ResolvedField = {
    name,
    type: f.type,
    nullable: f.nullable,
    column: f.column,
  };
  return f.generated !== undefined ? { ...base, generated: f.generated } : base;
}

function toResolvedStateMachine(
  entity: string,
  sm: StateMachine,
): ResolvedStateMachine {
  const transitions = Object.entries(sm.transitions).map(([n, t]) =>
    toResolvedTransition(entity, n, t, sm.stateField),
  );
  return {
    entity,
    stateField: sm.stateField,
    states: sm.states,
    initial: sm.initial,
    transitions,
  };
}

function toResolvedTransition(
  aggregate: string,
  name: string,
  t: Transition,
  stateField: string,
): ResolvedTransition {
  const from = normalizeFrom(t.from);
  const isCreation = from.includes(null);
  const isSelfLoop = !isCreation && from.length === 1 && from[0] === t.to;
  const declared = t.affects ?? [stateField];
  const affects = declared.includes(stateField)
    ? declared
    : [stateField, ...declared];
  return {
    name,
    aggregate,
    from,
    to: t.to,
    isCreation,
    isSelfLoop,
    affects,
  };
}

function normalizeFrom(from: Transition['from']): readonly (string | null)[] {
  if (from === null) return [null];
  if (typeof from === 'string') return [from];
  return [...from];
}
