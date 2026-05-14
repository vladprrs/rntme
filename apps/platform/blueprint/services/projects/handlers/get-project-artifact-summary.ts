import { Buffer } from 'node:buffer';
import {
  isOk,
  parseCanonicalBundle,
  type PlatformError,
} from '@rntme/platform-core';
import type {
  GetProjectArtifactSummaryHandlerInput,
  GetProjectArtifactSummaryHandlerOutput,
  ProjectArtifactSummary,
} from './types.js';

type RuntimeCtx = {
  readonly qsmDb: {
    readonly prepare: <P = unknown, R = unknown>(sql: string) => {
      readonly get: (...args: unknown[]) => R | undefined;
      readonly all: (...args: unknown[]) => readonly R[];
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

const EMPTY_SUMMARY: ProjectArtifactSummary = {
  versions: 0,
  services: 0,
  entities: 0,
  schemas: 0,
  graphs: 0,
  endpoints: 0,
  uiComponents: 0,
};

/**
 * Native handler for GET /api/projects/{projectId}/artifact-summary.
 *
 * Runtime-native read: resolves the project (id or slug) from `qsmDb`, counts
 * its `project_versions` rows, loads the latest published canonical bundle
 * bytes persisted in `project_version_bundles`, parses them, and counts the
 * artifacts declared in the bundle's file tree — services, PDM entities,
 * per-service shapes (schemas) and graphs, HTTP endpoint bindings, and UI
 * component specs.
 *
 * Counts are derived purely from the stored bundle blob; no PDM entity or
 * publish-time projection backs this. When the project has no published
 * version yet, every artifact count is 0 (but the versions count still
 * reflects any rows present).
 */
export function getProjectArtifactSummaryHandler(
  input: GetProjectArtifactSummaryHandlerInput,
  ctx: RuntimeCtx,
): GetProjectArtifactSummaryHandlerOutput {
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

  const versionRows = ctx.qsmDb.prepare<[string], ProjectVersionRow>(`
    SELECT id
    FROM project_versions
    WHERE project_id = ?
    ORDER BY sequence DESC
  `).all(project.id);
  const versions = versionRows.length;

  const latest = versionRows[0];
  if (latest === undefined) {
    return { status: 'ok', summary: { ...EMPTY_SUMMARY, versions } };
  }

  const bundleRow = ctx.qsmDb.prepare<[string], ProjectVersionBundleRow>(`
    SELECT bundle_bytes
    FROM project_version_bundles
    WHERE version_id = ?
    LIMIT 1
  `).get(latest.id);
  if (bundleRow === undefined) {
    return { status: 'ok', summary: { ...EMPTY_SUMMARY, versions } };
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

  const services = Array.isArray(rawServices)
    ? rawServices.filter((value) => typeof value === 'string' && value.length > 0).length
    : 0;

  let entities = 0;
  let schemas = 0;
  let graphs = 0;
  let endpoints = 0;
  let uiComponents = 0;

  for (const [path, content] of Object.entries(files)) {
    if (path.startsWith('pdm/entities/') && path.endsWith('.json')) {
      entities += 1;
      continue;
    }
    const fileName = path.slice(path.lastIndexOf('/') + 1);
    if (fileName === 'shapes.json') {
      schemas += 1;
      continue;
    }
    if (fileName === 'bindings.json') {
      endpoints += countBindings(content);
      continue;
    }
    if (path.includes('/graphs/') && path.endsWith('.json')) {
      graphs += 1;
      continue;
    }
    if (path.endsWith('.spec.json')) {
      uiComponents += 1;
      continue;
    }
  }

  return {
    status: 'ok',
    summary: { versions, services, entities, schemas, graphs, endpoints, uiComponents },
  };
}

/**
 * Counts the HTTP endpoint bindings declared in a per-service `bindings.json`
 * file. Each key under `bindings` is one bound operation/endpoint; a
 * malformed or missing `bindings` object contributes 0.
 */
function countBindings(content: unknown): number {
  if (!isRecord(content)) return 0;
  const bindings = content.bindings;
  if (!isRecord(bindings)) return 0;
  return Object.keys(bindings).length;
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

function error(
  code: PlatformError['code'],
  message: string,
): GetProjectArtifactSummaryHandlerOutput {
  return { status: 'error', errors: [{ code, message }] };
}
