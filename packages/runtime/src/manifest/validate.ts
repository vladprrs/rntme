import type {
  ManifestError,
  ManifestResult,
  ParsedManifest,
  ValidatedManifest,
} from './types.js';

export type SemverTriple = { major: number; minor: number; patch: number };

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

  if (errors.length > 0) return { ok: false, errors };

  const v: ValidatedManifest = {
    rntmeVersion: semver!,
    service: { name: parsed.service.name, version: parsed.service.version },
    surface: {
      http: {
        enabled: parsed.surface?.http?.enabled ?? true,
        port: parsed.surface?.http?.port ?? 3000,
      },
    },
    persistence,
    bus: { mode: parsed.bus?.mode ?? 'in-memory' },
    auth: {
      mode: parsed.auth?.mode ?? 'header',
      headerName: parsed.auth?.headerName ?? 'x-actor-id',
      actorKind: parsed.auth?.actorKind ?? 'user',
    },
    observability: {
      health: { path: parsed.observability?.health?.path ?? '/health' },
      metrics: { path: parsed.observability?.metrics?.path ?? '/metrics' },
    },
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

  const bus: ValidatedManifest['bus'] = { mode: 'in-memory' };

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
      surface: { http: { enabled: v.surface.http.enabled, port } },
      persistence,
      bus,
      auth,
    },
  };
}
