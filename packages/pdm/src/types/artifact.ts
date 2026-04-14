/**
 * Scalar primitive types allowed in PDM fields.
 */
export type ScalarPrimitive =
  | 'integer'
  | 'decimal'
  | 'string'
  | 'boolean'
  | 'date'
  | 'datetime';

/**
 * Auto-generated field markers (spec §2.6).
 * Fields with `generated` are filled by the command executor / event store
 * and cannot appear in transition.affects.
 */
export type GeneratedKind = 'id' | 'createdAt' | 'updatedAt' | 'actor';

export type Field = {
  type: ScalarPrimitive;
  nullable: boolean;
  column: string;
  generated?: GeneratedKind;
};

export type RelationCardinality = 'one' | 'many';

export type Relation = {
  to: string;
  cardinality: RelationCardinality;
  localKey: string;
  foreignKey: string;
};

/**
 * A named state-machine transition (spec §2.1, §2.2).
 * `from = null` — creation. `from: state[]` — allowed from multiple states.
 */
export type Transition = {
  from: string | readonly string[] | null;
  to: string;
  affects?: readonly string[];
};

export type StateMachine = {
  stateField: string;
  initial: null;
  states: readonly string[];
  transitions: Readonly<Record<string, Transition>>;
};

export type Entity = {
  table: string;
  fields: Readonly<Record<string, Field>>;
  relations?: Readonly<Record<string, Relation>>;
  keys: readonly string[];
  stateMachine?: StateMachine;
};

export type PdmArtifact = {
  entities: Readonly<Record<string, Entity>>;
};

/**
 * Runtime actor reference carried in event envelope (spec §3.3).
 * Declared here because command executor and projection consumer both
 * consume it from downstream of PDM resolution.
 */
export type ActorRef =
  | { kind: 'user'; id: string }
  | { kind: 'system'; id: string }
  | { kind: 'service'; id: string };

/**
 * Branded validation states — enforce pipeline ordering at the type level.
 */
declare const StructurallyValidBrand: unique symbol;
declare const ValidatedBrand: unique symbol;

export type StructurallyValidPdm = PdmArtifact & {
  readonly [StructurallyValidBrand]: true;
};

export type ValidatedPdm = StructurallyValidPdm & {
  readonly [ValidatedBrand]: true;
};
