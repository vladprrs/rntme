import type {
  ManifestError,
  ManifestResult,
  ParsedManifest,
  ValidatedManifest,
} from './types.js';
import type { ActorRef } from '@rntme/event-store';
import { isAbsolute } from 'node:path';

export type SemverTriple = { major: number; minor: number; patch: number };

const ACTOR_KINDS = ['user', 'system', 'service'] as const satisfies readonly ActorRef['kind'][];

function parseSemver(s: string): SemverTriple | null {
  const m = /^(\d+)\.(\d+)(?:\.(\d+))?$/.exec(s.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3] ?? '0') };
}

export function validateManifest(
  parsed: ParsedManifest,
  runtimeVersion: SemverTriple,
): ManifestResult<ValidatedManifest> {
  const errors: ManifestError[] = [];
  const semver = parseSemver(parsed.rntmeVersion);
  if (!semver) {
    errors.push({
      code: 'MANIFEST_INVALID_VERSION',
      path: 'rntmeVersion',
      message: `expected "<major>.<minor>" or "<major>.<minor>.<patch>", got "${parsed.rntmeVersion}"`,
    });
  } else if (semver.major !== runtimeVersion.major) {
    errors.push({
      code: 'MANIFEST_VERSION_MAJOR_MISMATCH',
      path: 'rntmeVersion',
      message: `manifest major ${semver.major} != runtime major ${runtimeVersion.major}`,
    });
  }

  const mode = parsed.persistence?.mode ?? 'ephemeral';
  let persistence: ValidatedManifest['persistence'];
  if (mode === 'persistent') {
    const eventStorePath = parsed.persistence?.eventStorePath;
    const qsmPath = parsed.persistence?.qsmPath;
    if (!eventStorePath) {
      errors.push({
        code: 'MANIFEST_MISSING_EVENT_STORE_PATH',
        path: 'persistence.eventStorePath',
        message: 'required when persistence.mode is "persistent"',
      });
    }
    if (!qsmPath) {
      errors.push({
        code: 'MANIFEST_MISSING_QSM_PATH',
        path: 'persistence.qsmPath',
        message: 'required when persistence.mode is "persistent"',
      });
    }
    persistence = {
      mode: 'persistent',
      eventStorePath: eventStorePath ?? '',
      qsmPath: qsmPath ?? '',
    };
  } else {
    persistence = { mode: 'ephemeral' };
  }

  const modules = parsed.modules ?? [];
  const seenNames = new Set<string>();
  for (const [index, mod] of modules.entries()) {
    if (seenNames.has(mod.name)) {
      errors.push({
        code: 'RUNTIME_MANIFEST_DUPLICATE_MODULE_NAME',
        path: `modules`,
        message: `duplicate module name "${mod.name}"`,
      });
    } else {
      seenNames.add(mod.name);
    }
    const tls = mod.grpc.tls;
    if (tls !== undefined) {
      const hasPrivateKey = tls.privateKeyPath !== undefined;
      const hasCertChain = tls.certChainPath !== undefined;
      if (hasPrivateKey !== hasCertChain) {
        errors.push({
          code: 'MANIFEST_INVALID_TYPE',
          path: `modules.${index}.grpc.tls`,
          message: 'privateKeyPath and certChainPath must be provided together',
        });
      }
    }
  }

  const actorKind = parsed.auth?.actorKind ?? 'user';
  if (!isActorKind(actorKind)) {
    errors.push({
      code: 'MANIFEST_INVALID_ACTOR_KIND',
      path: 'auth.actorKind',
      message: `auth.actorKind must be one of ${ACTOR_KINDS.join(', ')}`,
    });
  }

  const commands = validateCommandsConfig(parsed.commands, errors);

  if (errors.length > 0) return { ok: false, errors };

  const v: ValidatedManifest = {
    rntmeVersion: semver!,
    service: { name: parsed.service.name, version: parsed.service.version },
    surface: {
      http: {
        enabled: parsed.surface?.http?.enabled ?? true,
        port: parsed.surface?.http?.port ?? 3000,
        bodyLimit: {
          enabled: parsed.surface?.http?.bodyLimit?.enabled ?? true,
          maxBytes: parsed.surface?.http?.bodyLimit?.maxBytes ?? 1_048_576,
        },
        rateLimit: {
          enabled: parsed.surface?.http?.rateLimit?.enabled ?? true,
          windowMs: parsed.surface?.http?.rateLimit?.windowMs ?? 60_000,
          max: parsed.surface?.http?.rateLimit?.max ?? 600,
        },
      },
      grpc:
        parsed.surface?.grpc !== undefined
          ? {
              enabled: parsed.surface.grpc.enabled ?? true,
              port: parsed.surface.grpc.port ?? 50051,
            }
          : undefined,
    },
    persistence,
    bus: { mode: parsed.bus?.mode ?? 'in-memory' },
    auth: {
      mode: parsed.auth?.mode ?? 'header',
      headerName: parsed.auth?.headerName ?? 'x-actor-id',
      actorKind: actorKind as ActorRef['kind'],
    },
    observability: {
      health: { path: parsed.observability?.health?.path ?? '/health' },
      metrics: { path: parsed.observability?.metrics?.path ?? '/metrics' },
    },
    seed: {
      enabled: parsed.seed?.enabled !== false,
      path: parsed.seed?.path ?? 'seed.json',
    },
    ...(commands !== undefined ? { commands } : {}),
    modules,
  };
  return { ok: true, value: v };
}

export function applyEnvOverrides(
  v: ValidatedManifest,
  env: Record<string, string | undefined>,
): ManifestResult<ValidatedManifest> {
  const errors: ManifestError[] = [];
  let port = v.surface.http.port;
  if (env.RNTME_HTTP_PORT !== undefined) {
    const n = Number(env.RNTME_HTTP_PORT);
    if (!Number.isInteger(n) || n <= 0 || n > 65535) {
      errors.push({
        code: 'MANIFEST_INVALID_PORT',
        path: 'surface.http.port (from RNTME_HTTP_PORT)',
        message: `invalid port "${env.RNTME_HTTP_PORT}"`,
      });
    } else {
      port = n;
    }
  }

  const mode =
    env.RNTME_PERSISTENCE_MODE === 'persistent' || env.RNTME_PERSISTENCE_MODE === 'ephemeral'
      ? env.RNTME_PERSISTENCE_MODE
      : v.persistence.mode;
  let persistence: ValidatedManifest['persistence'];
  if (mode === 'persistent') {
    const eventStorePath =
      env.RNTME_EVENT_STORE_PATH ??
      (v.persistence.mode === 'persistent' ? v.persistence.eventStorePath : undefined);
    const qsmPath =
      env.RNTME_QSM_PATH ??
      (v.persistence.mode === 'persistent' ? v.persistence.qsmPath : undefined);
    if (!eventStorePath) {
      errors.push({
        code: 'MANIFEST_MISSING_EVENT_STORE_PATH',
        path: 'persistence.eventStorePath',
        message: 'required when persistence.mode is "persistent"',
      });
    }
    if (!qsmPath) {
      errors.push({
        code: 'MANIFEST_MISSING_QSM_PATH',
        path: 'persistence.qsmPath',
        message: 'required when persistence.mode is "persistent"',
      });
    }
    persistence = {
      mode: 'persistent',
      eventStorePath: eventStorePath ?? '',
      qsmPath: qsmPath ?? '',
    };
  } else {
    persistence = { mode: 'ephemeral' };
  }

  const bus: ValidatedManifest['bus'] = v.bus;

  const auth: ValidatedManifest['auth'] = {
    mode: 'header',
    headerName: env.RNTME_AUTH_HEADER_NAME ?? v.auth.headerName,
    actorKind: v.auth.actorKind,
  };

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      ...v,
      surface: {
        http: { ...v.surface.http, port },
        grpc: v.surface.grpc,
      },
      persistence,
      bus,
      auth,
    },
  };
}

function isActorKind(value: string): value is ActorRef['kind'] {
  return (ACTOR_KINDS as readonly string[]).includes(value);
}

function validateCommandsConfig(
  commands: ParsedManifest['commands'],
  errors: ManifestError[],
): ValidatedManifest['commands'] | undefined {
  const handlersModule = commands?.handlersModule;
  if (handlersModule === undefined) return undefined;

  if (!isSafeRelativeArtifactPath(handlersModule)) {
    errors.push({
      code: 'MANIFEST_INVALID_TYPE',
      path: 'commands.handlersModule',
      message: 'commands.handlersModule must be a relative artifact path without URL schemes, backslashes, dot segments, or parent segments',
    });
    return undefined;
  }

  return { handlersModule };
}

function isSafeRelativeArtifactPath(value: string): boolean {
  if (value.length === 0) return false;
  if (value.includes('\\')) return false;
  if (isAbsolute(value)) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;
  return value.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}
