export const VERSION = '0.0.0';

export { parsePdm } from './parse/parse.js';
export { PdmArtifactSchema } from './parse/schema.js';
export type { PdmArtifactParsed } from './parse/schema.js';

export {
  validatePdm,
  validateStructural,
  validateStateMachine,
} from './validate/index.js';

export { deriveEventTypes } from './derive/event-types.js';
export type { EventTypeSpec, EventFieldSpec } from './derive/event-types.js';

export { createPdmResolver } from './resolvers/pdm-resolver.js';

export {
  ok,
  err,
  isOk,
  isErr,
  ERROR_CODES,
} from './types/result.js';

export type {
  Result,
  Ok,
  Err,
  Layer,
  PdmError,
  PdmErrorCode,
} from './types/result.js';

export type {
  PdmArtifact,
  Entity,
  EntityKind,
  Field,
  Relation,
  RelationCardinality,
  StateMachine,
  Transition,
  ScalarPrimitive,
  GeneratedKind,
  ActorRef,
  StructurallyValidPdm,
  ValidatedPdm,
} from './types/artifact.js';

export type {
  PdmResolver,
  ResolvedEntity,
  ResolvedField,
  ResolvedRelation,
  ResolvedStateMachine,
  ResolvedTransition,
} from './types/resolvers.js';
