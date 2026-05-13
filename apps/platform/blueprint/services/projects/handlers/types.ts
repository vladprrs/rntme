import type {
  ApiTokenProvider,
  BlobStore,
  Ids,
  PlatformError,
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
