import { Buffer } from 'node:buffer';
import {
  isOk,
  parseCanonicalBundle,
  type PlatformError,
} from '@rntme/platform-core';
import { artifactCountsForFile } from './get-project-artifact-summary.js';
import type {
  ListProjectServicesHandlerInput,
  ListProjectServicesHandlerOutput,
  ProjectServiceRow,
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
 * Native handler for GET /api/projects/{projectId}/services.
 *
 * Runtime-native read: resolves the project (id or slug) from `qsmDb`, finds
 * the latest published `project_versions` row, loads the raw canonical bundle
 * bytes persisted in `project_version_bundles`, parses them, and returns the
 * deployed services declared in the bundle's `project.json`.
 *
 * The published bundle's `project.json.services` is a string array. Each
 * service row carries `{ name, status: "Ready" }` plus per-service artifact
 * counts (`schemas`, `graphs`, `endpoints`, `uiComponents`) derived by folding
 * the bundle's file tree scoped to that service's `services/<service>/` path
 * prefix — the same per-file classification `getProjectArtifactSummary` uses.
 *
 * `entities` is always 0 per service: PDM entities live project-level under
 * `pdm/entities/` and the bundle layout has no `services/<service>/pdm/`
 * split, so they cannot be attributed to an individual service. `description`
 * and `lastDeployedAt` are omitted — the bundle's `service.json` carries no
 * description, and no per-service deployment timestamp is reachable through
 * the projects handler's `qsmDb` read pattern. See the owner doc.
 *
 * When the project has no published version yet, this returns an empty list
 * rather than an error.
 */
export function listProjectServicesHandler(
  input: ListProjectServicesHandlerInput,
  ctx: RuntimeCtx,
): ListProjectServicesHandlerOutput {
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
    return { status: 'ok', services: [] };
  }

  const bundleRow = ctx.qsmDb.prepare<[string], ProjectVersionBundleRow>(`
    SELECT bundle_bytes
    FROM project_version_bundles
    WHERE version_id = ?
    LIMIT 1
  `).get(latest.id);
  if (bundleRow === undefined) {
    return { status: 'ok', services: [] };
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
  const projectFile = files['project.json'];
  if (!isRecord(projectFile)) {
    return error(
      'PROJECT_VERSION_BUNDLE_INVALID_SHAPE',
      'bundle files["project.json"] is missing or not an object',
    );
  }
  const rawServices = projectFile.services;
  if (rawServices !== undefined && !Array.isArray(rawServices)) {
    return error(
      'PROJECT_VERSION_BUNDLE_INVALID_SHAPE',
      'project.json.services must be an array of strings',
    );
  }

  const serviceNames: string[] = Array.isArray(rawServices)
    ? rawServices.filter(
        (value): value is string => typeof value === 'string' && value.length > 0,
      )
    : [];

  const services: ProjectServiceRow[] = serviceNames.map((name) => {
    const prefix = `services/${name}/`;
    let schemas = 0;
    let graphs = 0;
    let endpoints = 0;
    let uiComponents = 0;
    for (const [path, content] of Object.entries(files)) {
      if (!path.startsWith(prefix)) continue;
      const counts = artifactCountsForFile(path, content);
      schemas += counts.schemas;
      graphs += counts.graphs;
      endpoints += counts.endpoints;
      uiComponents += counts.uiComponents;
    }
    return {
      name,
      status: 'Ready',
      schemas,
      graphs,
      endpoints,
      uiComponents,
      // PDM entities are project-level (`pdm/entities/`); no per-service split
      // exists in the bundle layout, so per-service entity counts are 0.
      entities: 0,
    };
  });

  return { status: 'ok', services };
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

function error(code: PlatformError['code'], message: string): ListProjectServicesHandlerOutput {
  return { status: 'error', errors: [{ code, message }] };
}
