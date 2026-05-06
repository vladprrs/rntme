import type { Context } from 'hono';
import type { ActorRef } from '@rntme/event-store';
import type { ApplyMode } from '@rntme/seed';
import type { DbDriver, EventBus, Surface } from '../plugins/interfaces.js';
import type { CommandExecutor, QueryExecutor } from '../plugins/executors/types.js';
import type { ExternalAdapterClient } from '../plugins/adapter-client/index.js';

export type RuntimeConfig = {
  db?: DbDriver;
  bus?: EventBus;
  surfaces?: Surface[];
  actorFromRequest?: (c: Context) => ActorRef | null;
  onReady?: (info: { port: number }) => void;
  seedMode?: ApplyMode;
  skipSeed?: boolean;
  commandExecutor?: CommandExecutor;
  queryExecutor?: QueryExecutor;
  externalAdapterClient?: ExternalAdapterClient;
  artifactDir?: string;
  runtimeEnv?: Record<string, string | undefined>;
  shutdownTimeoutMs?: number;
};

export type RuntimeConfigValidationErrorCode =
  | 'RUNTIME_CONFIG_INVALID_OBJECT'
  | 'RUNTIME_CONFIG_DB_DRIVER_INVALID'
  | 'RUNTIME_CONFIG_EVENT_BUS_INVALID'
  | 'RUNTIME_CONFIG_SURFACES_INVALID'
  | 'RUNTIME_CONFIG_ACTOR_RESOLVER_INVALID'
  | 'RUNTIME_CONFIG_ON_READY_INVALID'
  | 'RUNTIME_CONFIG_SEED_MODE_INVALID'
  | 'RUNTIME_CONFIG_SKIP_SEED_INVALID'
  | 'RUNTIME_CONFIG_SEED_MODE_WITH_SKIP_SEED'
  | 'RUNTIME_CONFIG_COMMAND_EXECUTOR_INVALID'
  | 'RUNTIME_CONFIG_QUERY_EXECUTOR_INVALID'
  | 'RUNTIME_CONFIG_EXTERNAL_ADAPTER_CLIENT_INVALID'
  | 'RUNTIME_CONFIG_ARTIFACT_DIR_INVALID'
  | 'RUNTIME_CONFIG_RUNTIME_ENV_INVALID'
  | 'RUNTIME_CONFIG_SHUTDOWN_TIMEOUT_INVALID';

export type RuntimeConfigValidationError = {
  readonly code: RuntimeConfigValidationErrorCode;
  readonly path: string;
  readonly message: string;
};

export type RuntimeConfigValidationResult =
  | { readonly ok: true; readonly value: Partial<RuntimeConfig> }
  | { readonly ok: false; readonly errors: readonly RuntimeConfigValidationError[] };

export class RuntimeConfigError extends Error {
  readonly code = 'RUNTIME_CONFIG_INVALID' as const;

  constructor(readonly errors: readonly RuntimeConfigValidationError[]) {
    super(`invalid RuntimeConfig: ${errors.map((error) => `${error.path}: ${error.message}`).join('; ')}`);
    this.name = 'RuntimeConfigError';
  }
}

export function validateRuntimeConfig(config: unknown): RuntimeConfigValidationResult {
  const errors: RuntimeConfigValidationError[] = [];
  if (!isRecord(config)) {
    return {
      ok: false,
      errors: [
        {
          code: 'RUNTIME_CONFIG_INVALID_OBJECT',
          path: 'config',
          message: 'RuntimeConfig must be an object',
        },
      ],
    };
  }

  validateDb(config, errors);
  validateBus(config, errors);
  validateSurfaces(config, errors);
  validateFunction(config, 'actorFromRequest', 'RUNTIME_CONFIG_ACTOR_RESOLVER_INVALID', errors);
  validateFunction(config, 'onReady', 'RUNTIME_CONFIG_ON_READY_INVALID', errors);
  validateSeedOptions(config, errors);
  validateExecutor(config, 'commandExecutor', 'RUNTIME_CONFIG_COMMAND_EXECUTOR_INVALID', errors);
  validateExecutor(config, 'queryExecutor', 'RUNTIME_CONFIG_QUERY_EXECUTOR_INVALID', errors);
  validateExternalAdapterClient(config, errors);
  validateArtifactDir(config, errors);
  validateRuntimeEnv(config, errors);
  validateShutdownTimeout(config, errors);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: config as Partial<RuntimeConfig> };
}

export function assertValidRuntimeConfig(config: unknown): Partial<RuntimeConfig> {
  const result = validateRuntimeConfig(config);
  if (!result.ok) throw new RuntimeConfigError(result.errors);
  return result.value;
}

function validateDb(config: Record<string, unknown>, errors: RuntimeConfigValidationError[]): void {
  const db = config.db;
  if (db === undefined) return;
  if (!hasFunction(db, 'open')) {
    errors.push({
      code: 'RUNTIME_CONFIG_DB_DRIVER_INVALID',
      path: 'db',
      message: 'db must expose open(opts)',
    });
  }
}

function validateBus(config: Record<string, unknown>, errors: RuntimeConfigValidationError[]): void {
  const bus = config.bus;
  if (bus === undefined) return;
  if (!hasFunction(bus, 'producer') || !hasFunction(bus, 'consumer')) {
    errors.push({
      code: 'RUNTIME_CONFIG_EVENT_BUS_INVALID',
      path: 'bus',
      message: 'bus must expose producer() and consumer(opts)',
    });
    return;
  }
  validateOptionalFunction(bus, 'ensureTopics', 'bus.ensureTopics', 'RUNTIME_CONFIG_EVENT_BUS_INVALID', errors);
  validateOptionalFunction(bus, 'start', 'bus.start', 'RUNTIME_CONFIG_EVENT_BUS_INVALID', errors);
  validateOptionalFunction(bus, 'stop', 'bus.stop', 'RUNTIME_CONFIG_EVENT_BUS_INVALID', errors);
}

function validateSurfaces(config: Record<string, unknown>, errors: RuntimeConfigValidationError[]): void {
  const surfaces = config.surfaces;
  if (surfaces === undefined) return;
  if (!Array.isArray(surfaces) || surfaces.length === 0) {
    errors.push({
      code: 'RUNTIME_CONFIG_SURFACES_INVALID',
      path: 'surfaces',
      message: 'surfaces must be a non-empty array',
    });
    return;
  }
  surfaces.forEach((surface, index) => {
    const path = `surfaces[${index}]`;
    if (!hasFunction(surface, 'mount')) {
      errors.push({
        code: 'RUNTIME_CONFIG_SURFACES_INVALID',
        path,
        message: 'surface must expose mount(app, ctx)',
      });
      return;
    }
    validateOptionalFunction(surface, 'listen', `${path}.listen`, 'RUNTIME_CONFIG_SURFACES_INVALID', errors);
  });
}

function validateSeedOptions(config: Record<string, unknown>, errors: RuntimeConfigValidationError[]): void {
  const seedMode = config.seedMode;
  if (seedMode !== undefined && seedMode !== 'strict' && seedMode !== 'upsertByEventId') {
    errors.push({
      code: 'RUNTIME_CONFIG_SEED_MODE_INVALID',
      path: 'seedMode',
      message: 'seedMode must be strict or upsertByEventId',
    });
  }

  const skipSeed = config.skipSeed;
  if (skipSeed !== undefined && typeof skipSeed !== 'boolean') {
    errors.push({
      code: 'RUNTIME_CONFIG_SKIP_SEED_INVALID',
      path: 'skipSeed',
      message: 'skipSeed must be a boolean',
    });
  }

  if (skipSeed === true && seedMode !== undefined) {
    errors.push({
      code: 'RUNTIME_CONFIG_SEED_MODE_WITH_SKIP_SEED',
      path: 'seedMode',
      message: 'seedMode is ignored when skipSeed is true',
    });
  }
}

function validateExecutor(
  config: Record<string, unknown>,
  field: 'commandExecutor' | 'queryExecutor',
  code: RuntimeConfigValidationErrorCode,
  errors: RuntimeConfigValidationError[],
): void {
  const executor = config[field];
  if (executor === undefined) return;
  if (!hasFunction(executor, 'execute')) {
    errors.push({
      code,
      path: field,
      message: `${field} must expose execute(input)`,
    });
  }
}

function validateExternalAdapterClient(
  config: Record<string, unknown>,
  errors: RuntimeConfigValidationError[],
): void {
  const client = config.externalAdapterClient;
  if (client === undefined) return;
  if (!hasFunction(client, 'call')) {
    errors.push({
      code: 'RUNTIME_CONFIG_EXTERNAL_ADAPTER_CLIENT_INVALID',
      path: 'externalAdapterClient',
      message: 'externalAdapterClient must expose call(module, rpc, input, opts)',
    });
  }
}

function validateArtifactDir(config: Record<string, unknown>, errors: RuntimeConfigValidationError[]): void {
  const artifactDir = config.artifactDir;
  if (artifactDir === undefined) return;
  if (typeof artifactDir !== 'string' || artifactDir.trim() === '') {
    errors.push({
      code: 'RUNTIME_CONFIG_ARTIFACT_DIR_INVALID',
      path: 'artifactDir',
      message: 'artifactDir must be a non-empty string',
    });
  }
}

function validateRuntimeEnv(config: Record<string, unknown>, errors: RuntimeConfigValidationError[]): void {
  const runtimeEnv = config.runtimeEnv;
  if (runtimeEnv === undefined) return;
  if (!isRecord(runtimeEnv)) {
    errors.push({
      code: 'RUNTIME_CONFIG_RUNTIME_ENV_INVALID',
      path: 'runtimeEnv',
      message: 'runtimeEnv must be an object with string or undefined values',
    });
    return;
  }
  for (const [key, value] of Object.entries(runtimeEnv)) {
    if (value !== undefined && typeof value !== 'string') {
      errors.push({
        code: 'RUNTIME_CONFIG_RUNTIME_ENV_INVALID',
        path: `runtimeEnv.${key}`,
        message: 'runtimeEnv values must be strings or undefined',
      });
    }
  }
}

function validateShutdownTimeout(
  config: Record<string, unknown>,
  errors: RuntimeConfigValidationError[],
): void {
  const shutdownTimeoutMs = config.shutdownTimeoutMs;
  if (shutdownTimeoutMs === undefined) return;
  if (
    typeof shutdownTimeoutMs !== 'number' ||
    !Number.isSafeInteger(shutdownTimeoutMs) ||
    shutdownTimeoutMs <= 0
  ) {
    errors.push({
      code: 'RUNTIME_CONFIG_SHUTDOWN_TIMEOUT_INVALID',
      path: 'shutdownTimeoutMs',
      message: 'shutdownTimeoutMs must be a positive integer number of milliseconds',
    });
  }
}

function validateFunction(
  config: Record<string, unknown>,
  field: string,
  code: RuntimeConfigValidationErrorCode,
  errors: RuntimeConfigValidationError[],
): void {
  const value = config[field];
  if (value === undefined) return;
  if (typeof value !== 'function') {
    errors.push({
      code,
      path: field,
      message: `${field} must be a function`,
    });
  }
}

function validateOptionalFunction(
  value: unknown,
  field: string,
  path: string,
  code: RuntimeConfigValidationErrorCode,
  errors: RuntimeConfigValidationError[],
): void {
  if (!isRecord(value)) return;
  const maybeFunction = value[field];
  if (maybeFunction !== undefined && typeof maybeFunction !== 'function') {
    errors.push({
      code,
      path,
      message: `${path} must be a function when provided`,
    });
  }
}

function hasFunction(value: unknown, field: string): boolean {
  return isRecord(value) && typeof value[field] === 'function';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
