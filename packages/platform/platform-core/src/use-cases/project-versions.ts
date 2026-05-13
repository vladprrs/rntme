import { gzipSync } from 'node:zlib';
import type { BlobStore } from '../blob/store.js';
import type { Ids } from '../ids.js';
import type { ProjectRepo } from '../repos/project-repo.js';
import type { ProjectVersionRepo } from '../repos/project-version-repo.js';
import type {
  CanonicalBundle,
  ProjectVersion,
  ProjectVersionSummary,
} from '../schemas/project-version.js';
import { err, isOk, ok, type PlatformError, type Result } from '../types/result.js';
import { parseCanonicalBundle } from '../validation/canonical-bundle.js';

type Deps = {
  repos: {
    projects: ProjectRepo;
    projectVersions: ProjectVersionRepo;
  };
  blob: BlobStore;
  ids: Ids;
};

export type PublishProjectVersionInput = {
  readonly orgId: string;
  readonly projectId: string;
  readonly accountId: string;
  readonly tokenId: string | null;
  readonly bundleBytes: Buffer;
  readonly bundleDigest: string;
  readonly summary: ProjectVersionSummary;
};

export async function publishProjectVersion(
  deps: Deps,
  input: PublishProjectVersionInput,
): Promise<Result<ProjectVersion, PlatformError>> {
  const project = await deps.repos.projects.findById(input.orgId, input.projectId);
  if (!isOk(project)) return project;
  if (!project.value) {
    return { ok: false, errors: [{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: input.projectId }] };
  }
  if (project.value.status !== 'active') {
    return { ok: false, errors: [{ code: 'PROJECT_OPERATION_INVALID_STATE', message: project.value.status }] };
  }

  const existing = await deps.repos.projectVersions.findByDigest(
    input.projectId,
    input.bundleDigest,
  );
  if (!isOk(existing)) return existing;
  if (existing.value) return ok(existing.value);

  const blobKey = projectVersionBlobKey(input.projectId, input.bundleDigest);
  const upload = await deps.blob.putIfAbsent(blobKey, gzipSync(input.bundleBytes));
  if (!isOk(upload)) return upload;

  return deps.repos.projectVersions.create({
    projectId: input.projectId,
    row: {
      id: deps.ids.uuid(),
      orgId: input.orgId,
      bundleDigest: input.bundleDigest,
      bundleBlobKey: blobKey,
      bundleSizeBytes: input.bundleBytes.byteLength,
      summary: input.summary,
      uploadedByAccountId: input.accountId,
    },
    auditActorAccountId: input.accountId,
    auditActorTokenId: input.tokenId,
  });
}

export function projectVersionBlobKey(projectId: string, digest: string): string {
  const hex = digest.startsWith('sha256:') ? digest.slice(7) : digest;
  return `projects/${projectId}/versions/sha256-${hex}.json.gz`;
}

export async function listProjectVersions(
  deps: { repos: { projectVersions: ProjectVersionRepo } },
  input: { projectId: string; limit: number; cursor: number | undefined },
): Promise<Result<readonly ProjectVersion[], PlatformError>> {
  return deps.repos.projectVersions.listByProject(input.projectId, {
    limit: input.limit,
    cursor: input.cursor,
  });
}

export async function getProjectVersion(
  deps: { repos: { projectVersions: ProjectVersionRepo } },
  input: { projectId: string; seq: number },
): Promise<Result<ProjectVersion | null, PlatformError>> {
  return deps.repos.projectVersions.getBySeq(input.projectId, input.seq);
}

export type PublishProjectVersionFromBundleBytesInput = {
  readonly orgId: string;
  readonly projectId: string;
  readonly accountId: string;
  readonly tokenId: string | null;
  readonly bundleBytes: Buffer;
  /**
   * Optional client-claimed digest. When provided, must match the server-computed
   * digest of the canonical bytes; otherwise PROJECT_VERSION_DIGEST_MISMATCH.
   */
  readonly claimedDigest?: string;
};

export async function publishProjectVersionFromBundleBytes(
  deps: Deps,
  input: PublishProjectVersionFromBundleBytesInput,
): Promise<Result<ProjectVersion, PlatformError>> {
  const parsed = parseCanonicalBundle(input.bundleBytes);
  if (!isOk(parsed)) return parsed;

  if (parsed.value.bundle.version !== 2) {
    return err([
      {
        code: 'PROJECT_VERSION_BUNDLE_UNSUPPORTED_VERSION',
        message: `bundle.version must be 2; got ${String(parsed.value.bundle.version)}`,
        stage: 'parse',
      },
    ]);
  }

  if (input.claimedDigest !== undefined && input.claimedDigest !== parsed.value.digest) {
    return err([
      {
        code: 'PROJECT_VERSION_DIGEST_MISMATCH',
        message: `claimed digest "${input.claimedDigest}" does not match server-computed "${parsed.value.digest}"`,
        stage: 'parse',
      },
    ]);
  }

  const summary = summaryFromBundle(parsed.value.bundle);
  if (!isOk(summary)) return summary;

  return publishProjectVersion(deps, {
    orgId: input.orgId,
    projectId: input.projectId,
    accountId: input.accountId,
    tokenId: input.tokenId,
    bundleBytes: input.bundleBytes,
    bundleDigest: parsed.value.digest,
    summary: summary.value,
  });
}

function summaryFromBundle(
  bundle: CanonicalBundle,
): Result<ProjectVersionSummary, PlatformError> {
  const projectFile = bundle.files['project.json'];
  if (!isRecord(projectFile)) {
    return err([
      {
        code: 'PROJECT_VERSION_BUNDLE_INVALID_SHAPE',
        message: 'bundle files["project.json"] is missing or not an object',
        stage: 'parse',
      },
    ]);
  }

  const name = projectFile.name;
  if (typeof name !== 'string' || name.length === 0) {
    return err([
      {
        code: 'PROJECT_VERSION_BUNDLE_INVALID_SHAPE',
        message: 'project.json.name must be a non-empty string',
        stage: 'parse',
      },
    ]);
  }

  const services = Array.isArray(projectFile.services)
    ? projectFile.services.filter((s): s is string => typeof s === 'string')
    : [];

  const routesRaw = isRecord(projectFile.routes) ? projectFile.routes : {};
  const uiRoutes = isRecord(routesRaw.ui) ? recordOfStrings(routesRaw.ui) : {};
  const httpRoutes = isRecord(routesRaw.http) ? recordOfStrings(routesRaw.http) : {};
  const middleware = isRecord(projectFile.middleware) ? { ...projectFile.middleware } : {};
  const mounts = Array.isArray(projectFile.mounts) ? [...projectFile.mounts] : [];

  return ok({
    projectName: name,
    services,
    routes: { ui: uiRoutes, http: httpRoutes },
    middleware,
    mounts,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordOfStrings(value: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}
