import { Buffer } from 'node:buffer';
import {
  isOk,
  parseCanonicalBundle,
  type PlatformError,
} from '@rntme/platform-core';
import type {
  GetProjectArtifactHandlerInput,
  GetProjectArtifactHandlerOutput,
  ProjectArtifactEntry,
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
 * Native handler for GET /api/projects/{projectId}/artifacts?artifactPath=...
 *
 * Runtime-native read: resolves the project (id or slug) from `qsmDb`, finds
 * the latest published `project_versions` row, loads the raw canonical bundle
 * bytes persisted in `project_version_bundles`, parses them, and serves a
 * single named artifact from the bundle's file tree.
 *
 * `artifactPath` may name an exact file (e.g. `pdm/entities/Project.json`), in
 * which case the parsed JSON `body` of that file is returned; or it may name a
 * directory prefix (e.g. `pdm/entities`), in which case an `items` listing of
 * the matching `*.json` files under that prefix is returned. The artifact path
 * is supplied as a query parameter rather than a path segment because artifact
 * paths contain `/` separators that a single path segment cannot carry.
 *
 * The body is read purely from the stored bundle blob; no PDM entity or
 * publish-time projection backs this. When the project has no published
 * version yet, the handler returns a typed `PROJECT_VERSION_NOT_FOUND` error;
 * when the bundle has no matching artifact it returns
 * `PROJECT_VERSION_BUNDLE_INVALID_SHAPE`.
 */
export function getProjectArtifactHandler(
  input: GetProjectArtifactHandlerInput,
  ctx: RuntimeCtx,
): GetProjectArtifactHandlerOutput {
  if (input.sessionStatus !== 'ACTIVE' || typeof input.sessionSubject !== 'string') {
    return error('PLATFORM_AUTH_INVALID', 'active edge session is required');
  }
  if (!isRuntimeCtx(ctx)) {
    return error('PLATFORM_INTERNAL', 'runtime project storage is not available');
  }
  if (typeof input.artifactPath !== 'string' || input.artifactPath.length === 0) {
    return error('PLATFORM_PARSE_PATH_INVALID', 'artifactPath is required');
  }
  const artifactPath = normalizePath(input.artifactPath);

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
    return error(
      'PROJECT_VERSION_NOT_FOUND',
      `project has no published version; artifact "${artifactPath}" is unavailable`,
    );
  }

  const bundleRow = ctx.qsmDb.prepare<[string], ProjectVersionBundleRow>(`
    SELECT bundle_bytes
    FROM project_version_bundles
    WHERE version_id = ?
    LIMIT 1
  `).get(latest.id);
  if (bundleRow === undefined) {
    return error(
      'PROJECT_VERSION_NOT_FOUND',
      `published version has no stored bundle; artifact "${artifactPath}" is unavailable`,
    );
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

  const exact = files[artifactPath];
  if (exact !== undefined) {
    return { status: 'ok', path: artifactPath, body: exact };
  }

  const prefix = artifactPath.endsWith('/') ? artifactPath : `${artifactPath}/`;
  const items: ProjectArtifactEntry[] = Object.keys(files)
    .filter((path) => path.startsWith(prefix) && path.endsWith('.json'))
    .sort()
    .map((path) => ({ path, name: artifactName(path) }));

  if (items.length > 0) {
    return { status: 'ok', path: artifactPath, items };
  }

  return error(
    'PROJECT_VERSION_BUNDLE_INVALID_SHAPE',
    `artifact "${artifactPath}" is not present in the published bundle`,
  );
}

/** Strips leading/trailing slashes so query input matches bundle file keys. */
function normalizePath(value: string): string {
  return value.replace(/^\/+/, '').replace(/\/+$/, '');
}

/** Last path segment of a bundle file path, without its `.json` extension. */
function artifactName(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  return base.endsWith('.json') ? base.slice(0, -'.json'.length) : base;
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

function isRuntimeCtx(value: unknown): value is RuntimeCtx {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { qsmDb?: { prepare?: unknown } }).qsmDb?.prepare === 'function';
}

function error(code: PlatformError['code'], message: string): GetProjectArtifactHandlerOutput {
  return { status: 'error', errors: [{ code, message }] };
}
