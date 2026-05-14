import { Buffer } from 'node:buffer';
import {
  isOk,
  parseCanonicalBundle,
  projectVersionBlobKey,
  publishProjectVersionFromBundleBytes,
  type CanonicalBundle,
  type PlatformError,
  type ProjectVersion,
  type ProjectVersionSummary,
} from '@rntme/platform-core';
import type {
  PublishProjectBundleHandlerDeps,
  PublishProjectBundleHandlerInput,
  PublishProjectBundleHandlerOutput,
} from './types.js';

type RuntimeCtx = {
  readonly qsmDb: {
    readonly exec?: (sql: string) => unknown;
    readonly prepare: <P = unknown, R = unknown>(sql: string) => {
      readonly get: (...args: unknown[]) => R | undefined;
      readonly run: (...args: unknown[]) => unknown;
    };
  };
  readonly nextId?: () => string;
  readonly now?: () => string;
  readonly correlation?: { readonly commandId: string; readonly correlationId: string; readonly traceparent: string | null };
};

type ProjectRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly slug: string;
  readonly display_name: string;
  readonly status: string;
  readonly created_at: string;
};

type ProjectVersionRow = {
  readonly id: string;
  readonly project_id: string;
  readonly sequence: number;
  readonly bundle_digest: string;
  readonly bundle_object_key: string;
  readonly status: string;
  readonly created_at: string;
};

/**
 * Native handler for POST /api/projects/{projectId}/versions.
 *
 * Authenticates with the platform API-token provider via the `authorization`
 * header, resolves the project (id or slug under the authenticated org), then
 * delegates to `publishProjectVersionFromBundleBytes` with the raw canonical
 * bundle bytes. Returns the created (or matching, by digest) ProjectVersion.
 */
export async function publishProjectBundleHandler(
  depsOrInput: PublishProjectBundleHandlerDeps | PublishProjectBundleHandlerInput,
  inputOrCtx: PublishProjectBundleHandlerInput | RuntimeCtx,
): Promise<PublishProjectBundleHandlerOutput> {
  if (!isDeps(depsOrInput)) {
    return publishProjectBundleRuntimeNative(depsOrInput, inputOrCtx as RuntimeCtx);
  }

  const deps = depsOrInput;
  const input = inputOrCtx as PublishProjectBundleHandlerInput;
  const auth = await deps.provider.authenticate({
    authorizationHeader: input.authorization,
    cookieHeader: undefined,
  });
  if (!isOk(auth)) {
    return { status: 'error', errors: auth.errors };
  }
  const subject = auth.value;

  // Resolve project id-or-slug under the authenticated org.
  const orgId = subject.org.id;
  const byId = await deps.repos.projects.findById(orgId, input.projectId);
  if (!isOk(byId)) return { status: 'error', errors: byId.errors };
  let projectRow = byId.value;
  if (!projectRow) {
    const bySlug = await deps.repos.projects.findBySlug(orgId, input.projectId);
    if (!isOk(bySlug)) return { status: 'error', errors: bySlug.errors };
    projectRow = bySlug.value;
  }
  if (!projectRow) {
    return {
      status: 'error',
      errors: [{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: input.projectId }],
    };
  }

  const bundleBytes = Buffer.from(input.bodyBytes.buffer, input.bodyBytes.byteOffset, input.bodyBytes.byteLength);

  const result = await publishProjectVersionFromBundleBytes(
    {
      repos: { projects: deps.repos.projects, projectVersions: deps.repos.projectVersions },
      blob: deps.blob,
      ids: deps.ids,
    },
    {
      orgId,
      projectId: projectRow.id,
      accountId: subject.account.id,
      tokenId: subject.tokenId ?? null,
      bundleBytes,
    },
  );
  if (!isOk(result)) {
    return { status: 'error', errors: result.errors };
  }
  return { status: 'created', version: result.value };
}

function publishProjectBundleRuntimeNative(
  input: PublishProjectBundleHandlerInput,
  ctx: RuntimeCtx,
): PublishProjectBundleHandlerOutput {
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
  if (project.status !== 'active') {
    return error('PROJECT_OPERATION_INVALID_STATE', project.status);
  }

  const bundleBytes = Buffer.from(input.bodyBytes.buffer, input.bodyBytes.byteOffset, input.bodyBytes.byteLength);
  const parsed = parseCanonicalBundle(bundleBytes);
  if (!isOk(parsed)) return { status: 'error', errors: parsed.errors };
  if (parsed.value.bundle.version !== 2) {
    return error('PROJECT_VERSION_BUNDLE_UNSUPPORTED_VERSION', `bundle.version must be 2; got ${String(parsed.value.bundle.version)}`);
  }
  const summary = summaryFromBundle(parsed.value.bundle);
  if (summary.status === 'error') return { status: 'error', errors: summary.errors };

  ensureRuntimeBundleTable(ctx);
  const existing = ctx.qsmDb.prepare<[string, string], ProjectVersionRow>(`
    SELECT
      id,
      project_id,
      sequence,
      bundle_digest,
      bundle_object_key,
      status,
      created_at
    FROM project_versions
    WHERE project_id = ? AND bundle_digest = ?
    LIMIT 1
  `).get(project.id, parsed.value.digest);
  if (existing !== undefined) {
    storeRuntimeBundleBytes(ctx, existing.id, blobKeyFromRow(existing), bundleBytes);
    return {
      status: 'created',
      version: rowToProjectVersion(existing, project.organization_id, bundleBytes.byteLength, summary.value, input.sessionSubject),
    };
  }

  const versionId = nextId(ctx);
  const eventId = nextId(ctx);
  const now = nowIso(ctx);
  const nextSeqRow = ctx.qsmDb.prepare<[string], { readonly seq: number }>(`
    SELECT COALESCE(MAX(sequence), 0) + 1 AS seq
    FROM project_versions
    WHERE project_id = ?
  `).get(project.id);
  const seq = nextSeqRow?.seq ?? 1;
  const blobKey = projectVersionBlobKey(project.id, parsed.value.digest);

  ctx.qsmDb.prepare(`
    INSERT INTO project_versions (
      id,
      project_id,
      sequence,
      bundle_digest,
      bundle_object_key,
      status,
      created_at,
      last_event_id,
      last_event_version,
      applied_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    versionId,
    project.id,
    seq,
    parsed.value.digest,
    blobKey,
    'published',
    now,
    eventId,
    1,
    now,
  );
  storeRuntimeBundleBytes(ctx, versionId, blobKey, bundleBytes);

  return {
    status: 'created',
    version: {
      id: versionId,
      orgId: project.organization_id,
      projectId: project.id,
      seq,
      bundleDigest: parsed.value.digest,
      bundleBlobKey: blobKey,
      bundleSizeBytes: bundleBytes.byteLength,
      summary: summary.value,
      uploadedByAccountId: input.sessionSubject,
      createdAt: new Date(now),
    },
  };
}

function ensureRuntimeBundleTable(ctx: RuntimeCtx): void {
  const sql = `
    CREATE TABLE IF NOT EXISTS project_version_bundles (
      version_id TEXT NOT NULL PRIMARY KEY,
      bundle_object_key TEXT NOT NULL,
      bundle_bytes BLOB NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
  if (ctx.qsmDb.exec !== undefined) {
    ctx.qsmDb.exec(sql);
    return;
  }
  ctx.qsmDb.prepare(sql).run();
}

function storeRuntimeBundleBytes(ctx: RuntimeCtx, versionId: string, blobKey: string, bundleBytes: Buffer): void {
  ctx.qsmDb.prepare(`
    INSERT OR REPLACE INTO project_version_bundles (
      version_id,
      bundle_object_key,
      bundle_bytes,
      updated_at
    ) VALUES (?, ?, ?, ?)
  `).run(versionId, blobKey, bundleBytes, nowIso(ctx));
}

function blobKeyFromRow(row: ProjectVersionRow): string {
  return row.bundle_object_key;
}

function resolveRuntimeProject(ctx: RuntimeCtx, projectIdOrSlug: string): ProjectRow | null {
  const byId = ctx.qsmDb.prepare<[string], ProjectRow>(`
    SELECT
      id,
      organization_id,
      slug,
      display_name,
      status,
      created_at
    FROM projects
    WHERE id = ?
    LIMIT 1
  `).get(projectIdOrSlug);
  if (byId !== undefined) return byId;

  return ctx.qsmDb.prepare<[string], ProjectRow>(`
    SELECT
      id,
      organization_id,
      slug,
      display_name,
      status,
      created_at
    FROM projects
    WHERE slug = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(projectIdOrSlug) ?? null;
}

function rowToProjectVersion(
  row: ProjectVersionRow,
  orgId: string,
  bundleSizeBytes: number,
  summary: ProjectVersionSummary,
  uploadedByAccountId: string,
): ProjectVersion {
  return {
    id: row.id,
    orgId,
    projectId: row.project_id,
    seq: row.sequence,
    bundleDigest: row.bundle_digest,
    bundleBlobKey: row.bundle_object_key,
    bundleSizeBytes,
    summary,
    uploadedByAccountId,
    createdAt: new Date(row.created_at),
  };
}

function summaryFromBundle(bundle: CanonicalBundle):
  | { readonly status: 'ok'; readonly value: ProjectVersionSummary }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] } {
  const projectFile = bundle.files['project.json'];
  if (!isRecord(projectFile)) {
    return {
      status: 'error',
      errors: [{ code: 'PROJECT_VERSION_BUNDLE_INVALID_SHAPE', message: 'bundle files["project.json"] is missing or not an object' }],
    };
  }
  const name = projectFile.name;
  if (typeof name !== 'string' || name.length === 0) {
    return {
      status: 'error',
      errors: [{ code: 'PROJECT_VERSION_BUNDLE_INVALID_SHAPE', message: 'project.json.name must be a non-empty string' }],
    };
  }

  const routesRaw = isRecord(projectFile.routes) ? projectFile.routes : {};
  return {
    status: 'ok',
    value: {
      projectName: name,
      services: Array.isArray(projectFile.services)
        ? projectFile.services.filter((value): value is string => typeof value === 'string')
        : [],
      routes: {
        ui: isRecord(routesRaw.ui) ? recordOfStrings(routesRaw.ui) : {},
        http: isRecord(routesRaw.http) ? recordOfStrings(routesRaw.http) : {},
      },
      middleware: isRecord(projectFile.middleware) ? projectFile.middleware : {},
      mounts: Array.isArray(projectFile.mounts) ? projectFile.mounts : [],
    },
  };
}

function recordOfStrings(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isDeps(value: unknown): value is PublishProjectBundleHandlerDeps {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { provider?: { authenticate?: unknown } }).provider?.authenticate === 'function'
    && typeof (value as { repos?: unknown }).repos === 'object';
}

function isRuntimeCtx(value: unknown): value is RuntimeCtx {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { qsmDb?: { prepare?: unknown } }).qsmDb?.prepare === 'function';
}

function nextId(ctx: RuntimeCtx): string {
  return ctx.nextId?.() ?? crypto.randomUUID();
}

function nowIso(ctx: RuntimeCtx): string {
  return ctx.now?.() ?? new Date().toISOString();
}

function error(code: PlatformError['code'], message: string): PublishProjectBundleHandlerOutput {
  return { status: 'error', errors: [{ code, message }] };
}
