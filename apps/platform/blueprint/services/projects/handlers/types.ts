import type {
  ApiTokenProvider,
  BlobStore,
  Ids,
  OrganizationRepo,
  PlatformError,
  Project,
  ProjectRepo,
  ProjectVersion,
  ProjectVersionRepo,
} from '@rntme/platform-core';

export type PublishProjectBundleHandlerInput = {
  /** Raw Authorization header value, with or without the "Bearer " prefix. */
  readonly authorization: string;
  /** Canonical project id (uuid) or org-scoped project slug. */
  readonly projectId: string;
  /** Raw canonical bundle bytes (gzip-decoded JSON bytes, exactly as the client uploaded them). */
  readonly bodyBytes: Uint8Array;
  /** Advisory edge-auth subject header forwarded by nginx after auth_request succeeds. */
  readonly sessionSubject?: string | null;
  /** Advisory edge-auth status header forwarded by nginx after auth_request succeeds. */
  readonly sessionStatus?: string | null;
};

export type PublishProjectBundleHandlerDeps = {
  readonly provider: ApiTokenProvider;
  readonly repos: {
    readonly projects: ProjectRepo;
    readonly projectVersions: ProjectVersionRepo;
  };
  readonly blob: BlobStore;
  readonly ids: Ids;
};

export type PublishProjectBundleHandlerOutput =
  | { readonly status: 'created'; readonly version: ProjectVersion }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };

export type ListOrgProjectsHandlerInput = {
  /** Raw Authorization header value, with or without the "Bearer " prefix. */
  readonly authorization: string;
  /** Caller-supplied id, slug, or WorkOS org id (must match the authenticated org). */
  readonly organizationId: string;
  /** Maximum number of projects to return; defaults to 100 if undefined. */
  readonly limit?: number;
  /** Advisory edge-auth subject header forwarded by nginx after auth_request succeeds. */
  readonly sessionSubject?: string | null;
  /** Advisory edge-auth status header forwarded by nginx after auth_request succeeds. */
  readonly sessionStatus?: string | null;
};

export type ListOrgProjectsHandlerDeps = {
  readonly provider: ApiTokenProvider;
  readonly repos: {
    readonly organizations: OrganizationRepo;
    readonly projects: ProjectRepo;
  };
};

export type ListOrgProjectsHandlerOutput =
  | { readonly status: 'ok'; readonly projects: readonly Project[] }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };
