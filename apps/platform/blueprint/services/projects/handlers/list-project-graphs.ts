import { Buffer } from 'node:buffer';
import {
  isOk,
  parseCanonicalBundle,
  type PlatformError,
} from '@rntme/platform-core';
import type {
  ListProjectGraphsHandlerInput,
  ListProjectGraphsHandlerOutput,
  ProjectGraphRow,
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
 * Native handler for GET /api/projects/{projectId}/graphs.
 *
 * Runtime-native read: resolves the project (id or slug) from `qsmDb`, finds
 * the latest published `project_versions` row, loads the raw canonical bundle
 * bytes persisted in `project_version_bundles`, parses them, and flattens every
 * graph artifact file (`services/<svc>/graphs/<graph>.json`) declared anywhere
 * in the bundle's file tree into `{ service, graph, nodeCount }` rows for
 * definition inspection.
 *
 * `getProjectArtifact` can only list a single flat directory prefix of
 * `*.json` files, but graph files live across multiple per-service
 * `services/<svc>/graphs/` directories that also hold a non-graph `shapes.json`
 * file. A single prefix listing therefore cannot surface exactly the graph set,
 * so this handler walks the whole tree and selects every `.json` file under a
 * `graphs/` directory (excluding `shapes.json`) — the same set
 * `getProjectArtifactSummary` counts as `graphs`. Each row's `nodeCount` is
 * read from the artifact's `nodes` array.
 * Rows are derived purely from the stored bundle blob; no PDM entity or
 * publish-time projection backs this. When the project has no published version
 * yet, this returns an empty list rather than an error.
 */
export function listProjectGraphsHandler(
  input: ListProjectGraphsHandlerInput,
  ctx: RuntimeCtx,
): ListProjectGraphsHandlerOutput {
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
    return { status: 'ok', graphs: [] };
  }

  const bundleRow = ctx.qsmDb.prepare<[string], ProjectVersionBundleRow>(`
    SELECT bundle_bytes
    FROM project_version_bundles
    WHERE version_id = ?
    LIMIT 1
  `).get(latest.id);
  if (bundleRow === undefined) {
    return { status: 'ok', graphs: [] };
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
  const graphs: ProjectGraphRow[] = [];

  for (const [path, content] of Object.entries(files)) {
    if (!path.includes('/graphs/') || !path.endsWith('.json')) continue;
    const fileName = path.slice(path.lastIndexOf('/') + 1);
    if (fileName === 'shapes.json') continue;
    graphs.push({
      service: serviceNameFromPath(path),
      graph: fileName.slice(0, -'.json'.length),
      nodeCount: countNodes(content),
    });
  }

  graphs.sort((a, b) =>
    a.service !== b.service
      ? a.service.localeCompare(b.service)
      : a.graph.localeCompare(b.graph),
  );

  return { status: 'ok', graphs };
}

/**
 * Derives the owning service slug from a graph artifact path such as
 * `services/projects/graphs/createProject.json` → `projects`. Falls back to the
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
 * Counts the nodes declared in a graph artifact. Each graph artifact is
 * `{ id, signature, nodes: [...] }`; a malformed or missing `nodes` array
 * contributes a count of 0.
 */
function countNodes(content: unknown): number {
  if (!isRecord(content)) return 0;
  const nodes = content.nodes;
  return Array.isArray(nodes) ? nodes.length : 0;
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

function error(code: PlatformError['code'], message: string): ListProjectGraphsHandlerOutput {
  return { status: 'error', errors: [{ code, message }] };
}
