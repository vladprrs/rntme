export const VERSION = '0.0.0';

export { createBindingsRouter } from './router.js';
export type { BindingsRouterOptions } from './router.js';

export { BindingsRuntimeError } from './errors.js';
export type {
  RuntimeErrorEntry,
  ErrorResponseBody,
  ValidationDetail,
  CommandErrorStatus,
} from './errors.js';
export { commandErrorBody, commandErrorStatus } from './errors.js';

export { correlationMiddleware } from './runtime/correlation-middleware.js';
export type { CorrelationCtx, CorrelationVariables } from './runtime/correlation-middleware.js';
