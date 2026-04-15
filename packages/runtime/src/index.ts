export const VERSION = '0.0.0';

export { loadService } from './load/load-service.js';
export { startService, type RuntimeConfig } from './start/start-service.js';
export { buildActorFromRequest } from './start/build-actor-from-request.js';

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
export { BetterSqliteDriver } from './plugins/better-sqlite-driver.js';
export { InMemoryBus } from './plugins/in-memory-bus.js';
export { HttpSurface } from './plugins/http-surface.js';
export {
  createMetrics,
  mountObservability,
  type Metrics,
  type HealthProbe,
} from './plugins/observability.js';

// contract-tests intentionally NOT re-exported from the main entry point
// (they import vitest which must not load in non-test processes).
// Import directly from '@rntme/runtime/src/plugins/contract-tests.js' in test files.
