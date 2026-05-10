export const VERSION = '0.0.0';

export { loadService } from './load/load-service.js';
export { startService, type RuntimeConfig } from './start/start-service.js';
export { buildActorFromRequest } from './start/build-actor-from-request.js';
export {
  buildKafkaJsClientConfigFromEnv,
  parseRuntimeAuthEnv,
  RuntimeBootError,
  type KafkaJsClientConfig,
  type KafkaJsSaslMechanism,
  type RuntimeAuthEnv,
} from './start/runtime-env.js';
export {
  validateRuntimeConfig,
  RuntimeConfigError,
  type RuntimeConfigValidationError,
  type RuntimeConfigValidationResult,
} from './start/runtime-config.js';

export type {
  ValidatedService,
  RunningService,
  ServiceError,
  GraphSpec,
  RuntimeResult,
  RuntimeOk,
  RuntimeErr,
} from './types.js';

export type {
  ParsedManifest,
  ValidatedManifest,
  ManifestError,
  ManifestErrorCode,
} from './manifest/types.js';
export { parseManifest } from './manifest/parse.js';
export { validateManifest, applyEnvOverrides } from './manifest/validate.js';

export type {
  DbDriver,
  DbHandle,
  DbOpenOpts,
  EventBus,
  Surface,
  SurfaceContext,
} from './plugins/interfaces.js';
export { BunSqliteDriver } from './plugins/bun-sqlite-driver.js';
export { InMemoryBus } from './plugins/in-memory-bus.js';
export { KafkaJsEventBus } from './plugins/kafka-js-bus.js';
export { HttpSurface } from './plugins/http-surface.js';
export { GrpcSurface, type GrpcSurfaceOptions } from './plugins/grpc-surface.js';
export {
  createMetrics,
  mountObservability,
  recordPreStep,
  type Metrics,
  type HealthProbe,
} from './plugins/observability.js';

export * from './plugins/executors/index.js';

export * from './plugins/adapter-client/index.js';

// contract-tests intentionally NOT re-exported from the main entry point
// (they import bun:test which must not load in non-test processes).
// Import directly from '@rntme/runtime/src/plugins/contract-tests.js' in test files.
