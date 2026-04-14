export type {
  QsmArtifact,
  Projection,
  ProjectionBacking,
  ProjectionSource,
  RelationRole,
  StructurallyValidQsm,
  ValidatedQsm,
} from './artifact.js';

export { RELATION_ROLE_VALUES } from './artifact.js';

export {
  ok,
  err,
  isOk,
  isErr,
  ERROR_CODES,
} from './result.js';

export type {
  Result,
  Ok,
  Err,
  Layer,
  QsmError,
  QsmErrorCode,
} from './result.js';

export type {
  QsmResolver,
  ResolvedProjection,
  ResolvedRelationRole,
} from './resolvers.js';
