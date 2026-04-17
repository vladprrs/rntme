export const VERSION = '0.0.0';

export { parseQsm } from './parse/parse.js';
export { QsmArtifactSchema } from './parse/schema.js';
export type { QsmArtifactParsed } from './parse/schema.js';

export {
  validateQsm,
  validateStructural,
  validateCrossRef,
} from './validate/index.js';

export { defaultTableName } from './validate/structural.js';

export { generateProjectionDdl } from './derive/ddl.js';
export type {
  ProjectionDdlSpec,
  ColumnSpec,
  IndexSpec,
  SqlType,
} from './derive/ddl.js';

export { deriveProjectionHandler } from './derive/handler.js';
export type {
  ProjectionHandlerSpec,
  EventHandler,
  HandlerOp,
  IdempotencyGuard,
} from './derive/handler.js';

export { createQsmResolver } from './resolvers/qsm-resolver.js';

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
  QsmError,
  QsmErrorCode,
} from './types/result.js';

export type {
  QsmArtifact,
  Projection,
  ProjectionBacking,
  ProjectionSource,
  RelationRole,
  QsmRelation,
  Cardinality,
  StructurallyValidQsm,
  ValidatedQsm,
} from './types/artifact.js';

export { RELATION_ROLE_VALUES, CARDINALITY_VALUES } from './types/artifact.js';

export type {
  QsmResolver,
  ResolvedProjection,
  ResolvedRelation,
} from './types/resolvers.js';
