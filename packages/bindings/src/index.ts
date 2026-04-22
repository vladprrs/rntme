export const VERSION = '0.0.0';

export { parseBindingArtifact } from './parse/parse.js';
export { BindingArtifactSchema } from './parse/schema.js';
export type { BindingArtifactParsed } from './parse/schema.js';

export { validateBindings, validateStructural, validateReferences, validateConsistency } from './validate/index.js';

export { generateOpenApi } from './openapi/emit.js';
export type { OpenApiGenOptions } from './openapi/emit.js';

export {
  COMMAND_RESULT_SHAPE_NAME,
  commandResultShape,
  commandResultJsonSchema,
} from './openapi/command-result.js';

export {
  ok,
  err,
  isOk,
  isErr,
  ERROR_CODES,
} from './types/result.js';

export type {
  Result,
  BindingsError,
  BindingsErrorCode,
  Layer,
} from './types/result.js';

export type {
  BindingArtifact,
  BindingEntry,
  BindingKind,
  HttpBinding,
  HttpParameter,
  HttpMethod,
  HttpParameterLocation,
  OpenApiDefaults,
  StructurallyValid,
  ResolvedBinding,
  ResolvedBindings,
  ValidatedBindings,
  OperationPassthrough,
  ParameterPassthrough,
  PreStep,
} from './types/artifact.js';

export type {
  BindingResolvers,
  GraphSignature,
  GraphRole,
  GraphInput,
  InputMode,
  InputType,
  OutputType,
  ResolvedShape,
  ShapeField,
  FieldType,
  ScalarPrimitive,
  ShapeOrigin,
} from './types/resolvers.js';

export type {
  OpenApiDoc,
  InfoObject,
  ServerObject,
  PathItem,
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  MediaType,
  JsonSchema,
} from './types/openapi.js';
