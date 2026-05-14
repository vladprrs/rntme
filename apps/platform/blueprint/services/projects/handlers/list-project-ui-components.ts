import { Buffer } from 'node:buffer';
import {
  isOk,
  parseCanonicalBundle,
  type PlatformError,
} from '@rntme/platform-core';
import type {
  ListProjectUiComponentsHandlerInput,
  ListProjectUiComponentsHandlerOutput,
  ProjectUiComponentRow,
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
 * Native handler for GET /api/projects/{projectId}/ui-components.
 *
 * Runtime-native read: resolves the project (id or slug) from `qsmDb`, finds
 * the latest published `project_versions` row, loads the raw canonical bundle
 * bytes persisted in `project_version_bundles`, parses them, and flattens every
 * UI component spec file (`*.spec.json`, including layout specs) declared
 * anywhere in the bundle's file tree into `{ kind, name, path }` rows for
 * definition inspection.
 *
 * `getProjectArtifact` can only list a single flat directory prefix of
 * `*.json` files, but UI spec files live across two sibling directories
 * (`services/<svc>/ui/screens/` and `services/<svc>/ui/layouts/`) and each of
 * those directories also holds non-spec `.json` files. A single prefix listing
 * therefore cannot surface exactly the UI spec set, so this handler walks the
 * whole tree and selects the `*.spec.json` files — the same set
 * `getProjectArtifactSummary` counts as `uiComponents`. Rows are derived purely
 * from the stored bundle blob; no PDM entity or publish-time projection backs
 * this. When the project has no published version yet, this returns an empty
 * list rather than an error.
 */
export function listProjectUiComponentsHandler(
  input: ListProjectUiComponentsHandlerInput,
  ctx: RuntimeCtx,
): ListProjectUiComponentsHandlerOutput {
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
    return { status: 'ok', uiComponents: [] };
  }

  const bundleRow = ctx.qsmDb.prepare<[string], ProjectVersionBundleRow>(`
    SELECT bundle_bytes
    FROM project_version_bundles
    WHERE version_id = ?
    LIMIT 1
  `).get(latest.id);
  if (bundleRow === undefined) {
    return { status: 'ok', uiComponents: [] };
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
  const uiComponents: ProjectUiComponentRow[] = [];

  for (const path of Object.keys(files)) {
    if (!path.endsWith('.spec.json')) continue;
    uiComponents.push({ kind: uiComponentKind(path), name: uiComponentName(path), path });
  }

  uiComponents.sort((a, b) =>
    a.kind !== b.kind ? a.kind.localeCompare(b.kind) : a.name.localeCompare(b.name),
  );

  return { status: 'ok', uiComponents };
}

/**
 * Classifies a UI spec file by its parent directory: a `*.spec.json` under a
 * `layouts/` directory is a `layout`, under a `screens/` directory is a
 * `screen`, otherwise `component`.
 */
function uiComponentKind(path: string): string {
  if (path.includes('/layouts/')) return 'layout';
  if (path.includes('/screens/')) return 'screen';
  return 'component';
}

/** Last path segment of a UI spec file, without its `.spec.json` extension. */
function uiComponentName(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  return base.endsWith('.spec.json') ? base.slice(0, -'.spec.json'.length) : base;
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

function error(code: PlatformError['code'], message: string): ListProjectUiComponentsHandlerOutput {
  return { status: 'error', errors: [{ code, message }] };
}
