import { Buffer } from 'node:buffer';
import {
  isOk,
  parseCanonicalBundle,
  type PlatformError,
} from '@rntme/platform-core';
import type {
  ListProjectEndpointsHandlerInput,
  ListProjectEndpointsHandlerOutput,
  ProjectEndpointRow,
} from './types.js';

type RuntimeCtx = {
  readonly qsmDb: {
    readonly prepare: <P = unknown, R = unknown>(sql: string) => {
      readonly get: (...args: unknown[]) => R | undefined;
    };
  };
};

type ProjectRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly slug: string;
  readonly status: string;
};

type ProjectVersionRow = {
  readonly id: string;
};

type ProjectVersionBundleRow = {
  readonly bundle_bytes: Uint8Array;
};

/**
 * Native handler for GET /api/projects/{projectId}/endpoints.
 *
 * Runtime-native read: resolves the project (id or slug) from `qsmDb`, finds
 * the latest published `project_versions` row, loads the raw canonical bundle
 * bytes persisted in `project_version_bundles`, parses them, and flattens the
 * HTTP endpoint bindings declared in every per-service `bindings.json` file
 * into `{ service, operation, method, path }` rows.
 *
 * `getProjectArtifact` can only return flat file listings or one file body, so
 * it cannot produce "endpoints grouped by service" rows — endpoints are nested
 * inside per-service `bindings.json` objects. This handler reads exactly the
 * same `bindings.json` entries `getProjectArtifactSummary` counts and exposes
 * their shape. Rows are derived purely from the stored bundle blob; no PDM
 * entity or publish-time projection backs this. When the project has no
 * published version yet, this returns an empty list rather than an error.
 */
export function listProjectEndpointsHandler(
  input: ListProjectEndpointsHandlerInput,
  ctx: RuntimeCtx,
): ListProjectEndpointsHandlerOutput {
  if (input.sessionStatus !== 'ACTIVE' || typeof input.sessionSubject !== 'string') {
    return error('PLATFORM_AUTH_INVALID', 'active edge session is required');
  }
  if (!isRuntimeCtx(ctx)) {
    return error('PLATFORM_INTERNAL', 'runtime project storage is not available');
  }

  const project = resolveRuntimeProject(ctx, input.projectId);
  if (project === null) {
    return error('PLATFORM_TENANCY_PROJECT_NOT_FOUND', input.projectId);
  }

  const latest = ctx.qsmDb.prepare<[string], ProjectVersionRow>(`
    SELECT id
    FROM project_versions
    WHERE project_id = ?
    ORDER BY sequence DESC
    LIMIT 1
  `).get(project.id);
  if (latest === undefined) {
    return { status: 'ok', endpoints: [] };
  }

  const bundleRow = ctx.qsmDb.prepare<[string], ProjectVersionBundleRow>(`
    SELECT bundle_bytes
    FROM project_version_bundles
    WHERE version_id = ?
    LIMIT 1
  `).get(latest.id);
  if (bundleRow === undefined) {
    return { status: 'ok', endpoints: [] };
  }

  const bytes = Buffer.from(
    bundleRow.bundle_bytes.buffer,
    bundleRow.bundle_bytes.byteOffset,
    bundleRow.bundle_bytes.byteLength,
  );
  const parsed = parseCanonicalBundle(bytes);
  if (!isOk(parsed)) {
    return { status: 'error', errors: parsed.errors };
  }

  const files = parsed.value.bundle.files;
  const endpoints: ProjectEndpointRow[] = [];

  for (const [path, content] of Object.entries(files)) {
    const fileName = path.slice(path.lastIndexOf('/') + 1);
    if (fileName !== 'bindings.json') continue;
    const service = serviceNameFromPath(path);
    for (const row of flattenBindings(service, content)) {
      endpoints.push(row);
    }
  }

  endpoints.sort((a, b) =>
    a.service !== b.service
      ? a.service.localeCompare(b.service)
      : a.operation.localeCompare(b.operation),
  );

  return { status: 'ok', endpoints };
}

/**
 * Derives the owning service slug from a per-service `bindings.json` path such
 * as `services/projects/bindings/bindings.json` → `projects`. Falls back to the
 * full path when it does not follow the `services/<service>/` convention.
 */
function serviceNameFromPath(path: string): string {
  const segments = path.split('/');
  const service = segments[1];
  if (segments[0] === 'services' && service !== undefined && service.length > 0) {
    return service;
  }
  return path;
}

/**
 * Flattens the HTTP endpoint bindings declared in a per-service `bindings.json`
 * file into `{ service, operation, method, path }` rows. Each key under
 * `bindings` is one bound operation; its `http.method` / `http.path` describe
 * the endpoint. Entries without a readable `http.method` and `http.path` are
 * skipped; a malformed or missing `bindings` object contributes no rows.
 */
function flattenBindings(service: string, content: unknown): ProjectEndpointRow[] {
  if (!isRecord(content)) return [];
  const bindings = content.bindings;
  if (!isRecord(bindings)) return [];

  const rows: ProjectEndpointRow[] = [];
  for (const [operation, entry] of Object.entries(bindings)) {
    if (!isRecord(entry)) continue;
    const http = entry.http;
    if (!isRecord(http)) continue;
    const method = http.method;
    const path = http.path;
    if (typeof method !== 'string' || method.length === 0) continue;
    if (typeof path !== 'string' || path.length === 0) continue;
    rows.push({ service, operation, method, path });
  }
  return rows;
}

function resolveRuntimeProject(ctx: RuntimeCtx, projectIdOrSlug: string): ProjectRow | null {
  const byId = ctx.qsmDb.prepare<[string], ProjectRow>(`
    SELECT id, organization_id, slug, status
    FROM projects
    WHERE id = ?
    LIMIT 1
  `).get(projectIdOrSlug);
  if (byId !== undefined) return byId;

  return ctx.qsmDb.prepare<[string], ProjectRow>(`
    SELECT id, organization_id, slug, status
    FROM projects
    WHERE slug = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(projectIdOrSlug) ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isRuntimeCtx(value: unknown): value is RuntimeCtx {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { qsmDb?: { prepare?: unknown } }).qsmDb?.prepare === 'function';
}

function error(code: PlatformError['code'], message: string): ListProjectEndpointsHandlerOutput {
  return { status: 'error', errors: [{ code, message }] };
}
