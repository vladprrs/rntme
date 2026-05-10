// Generic Hono middleware shared between @rntme/runtime and consumers like
// apps/platform-http. Each module is added in its own task; this barrel
// gathers them so callers do a single named import.

export { requestId } from './request-id.js';
export { requestLogger, type RequestLoggerOptions } from './request-logger.js';
export { errorHandler, type ErrorHandlerOptions } from './error-handler.js';
export { cors, isAllowedOrigin, type CorsOptions } from './cors.js';
export { bodyLimit, type BodyLimitOptions } from './body-limit.js';
export {
  InMemoryRateLimiter,
  rateLimit,
  type RateLimiter,
  type RateLimitDecision,
  type RateLimitOptions,
} from './rate-limit.js';
export { securityHeaders, type SecurityHeadersOptions } from './security-headers.js';
export { sameOriginOnly, type SameOriginOptions } from './same-origin.js';
