export const VERSION = '0.0.0';

export { createBindingsRouter } from './router.js';
export type { BindingsRouterOptions } from './router.js';
export { buildDefaultGraphIrCommandMap, buildDefaultGraphIrQueryMap } from './startup/compile-plan.js';
export type { BuildPlanResult, GraphIrCommandMap, GraphIrQueryMapPublic } from './startup/compile-plan.js';
export type {
  BindingsGraphRuntimeInputs,
  RuntimeGraphSpec,
  ValidatedPdm,
  ValidatedQsm,
} from './startup/runtime-inputs.js';

export { BindingsRuntimeError } from './errors.js';
export { BINDINGS_HTTP_STARTUP_ERROR_CODES, missingRuntimeDependencyError } from './errors.js';
export type {
  RuntimeErrorEntry,
  StartupDependencyName,
  MissingRuntimeDependencyCause,
  ErrorResponseBody,
  ValidationDetail,
  CommandErrorStatus,
  CommandErrorLike,
} from './errors.js';
export { commandErrorBody, commandErrorStatus } from './errors.js';

export { correlationMiddleware } from './runtime/correlation-middleware.js';
export type { CorrelationCtx, CorrelationVariables } from './runtime/correlation-middleware.js';
