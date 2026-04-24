import type { Field, Relation, ScalarPrimitive } from './artifact.js';

export type ResolvedField = Readonly<{
  name: string;
  type: ScalarPrimitive;
  nullable: boolean;
  column: string;
  generated?: Field['generated'];
}>;

export type ResolvedRelation = Readonly<
  Relation & { name: string; from: string }
>;

export type ResolvedTransition = Readonly<{
  name: string;
  aggregate: string;
  from: readonly (string | null)[];  // normalized: string|null|string[] → always array
  to: string;
  isCreation: boolean;
  isSelfLoop: boolean;
  affects: readonly string[];         // includes auto-added stateField
}>;

export type ResolvedStateMachine = Readonly<{
  entity: string;
  stateField: string;
  states: readonly string[];
  initial: null;
  transitions: readonly ResolvedTransition[];
}>;

export type ResolvedEntity = Readonly<{
  name: string;
  ownerService: string;
  table: string;
  fields: readonly ResolvedField[];
  relations: readonly ResolvedRelation[];
  keys: readonly string[];
  stateMachine: ResolvedStateMachine | null;
}>;

export type PdmResolver = {
  listEntities(): readonly string[];
  resolveEntity(name: string): ResolvedEntity | null;
  resolveField(entity: string, field: string): ResolvedField | null;
  resolveStateMachine(entity: string): ResolvedStateMachine | null;
  resolveTransition(entity: string, transition: string): ResolvedTransition | null;
};
