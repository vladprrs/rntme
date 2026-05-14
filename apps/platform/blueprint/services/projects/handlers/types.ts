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

/** A single deployed service parsed from the latest published project bundle. */
export type ProjectServiceRow = {
  /** Service slug as authored in the bundle's project.json `services` array. */
  readonly name: string;
  /**
   * Deployment status. The published bundle has no per-service status field
   * yet, so this defaults to "Ready" for every service in a published bundle.
   */
  readonly status: string;
  /** Optional human description; omitted when the bundle carries none. */
  readonly description?: string;
};

export type ListProjectServicesHandlerInput = {
  /** Canonical project id (uuid) or org-scoped project slug. */
  readonly projectId: string;
  /** Advisory edge-auth subject header forwarded by nginx after auth_request succeeds. */
  readonly sessionSubject?: string | null;
  /** Advisory edge-auth status header forwarded by nginx after auth_request succeeds. */
  readonly sessionStatus?: string | null;
};

export type ListProjectServicesHandlerOutput =
  | { readonly status: 'ok'; readonly services: readonly ProjectServiceRow[] }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };

/**
 * Artifact counts derived from the latest published project bundle.
 *
 * Every count is parsed from the stored canonical bundle blob at query time
 * (the same source `listProjectServices` reads). When the project has no
 * published version yet, every count is 0.
 */
export type ProjectArtifactSummary = {
  /** Number of `project_versions` rows for the project. */
  readonly versions: number;
  /** Length of the bundle's `project.json.services` array. */
  readonly services: number;
  /** Count of PDM entity files (`pdm/entities/*.json`) in the bundle. */
  readonly entities: number;
  /** Count of per-service `shapes.json` artifact files in the bundle. */
  readonly schemas: number;
  /** Count of per-service graph files under any `graphs/` directory, excluding `shapes.json`. */
  readonly graphs: number;
  /** Total HTTP endpoint bindings declared across the bundle's `bindings.json` files. */
  readonly endpoints: number;
  /** Count of UI component spec files (`*.spec.json`, including layouts) in the bundle. */
  readonly uiComponents: number;
};

export type GetProjectArtifactSummaryHandlerInput = {
  /** Canonical project id (uuid) or org-scoped project slug. */
  readonly projectId: string;
  /** Advisory edge-auth subject header forwarded by nginx after auth_request succeeds. */
  readonly sessionSubject?: string | null;
  /** Advisory edge-auth status header forwarded by nginx after auth_request succeeds. */
  readonly sessionStatus?: string | null;
};

export type GetProjectArtifactSummaryHandlerOutput =
  | { readonly status: 'ok'; readonly summary: ProjectArtifactSummary }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };

/** A single artifact file entry in a prefix listing of the published bundle tree. */
export type ProjectArtifactEntry = {
  /** Full bundle-relative file path (e.g. `pdm/entities/Project.json`). */
  readonly path: string;
  /** Last path segment without its `.json` extension (e.g. `Project`). */
  readonly name: string;
};

export type GetProjectArtifactHandlerInput = {
  /** Canonical project id (uuid) or org-scoped project slug. */
  readonly projectId: string;
  /**
   * Bundle-relative artifact path. When it names an exact file in the published
   * bundle tree (e.g. `pdm/entities/Project.json`), the handler returns that
   * file's parsed JSON `body`. When it names a directory prefix (e.g.
   * `pdm/entities`), the handler returns an `items` listing of the matching
   * `*.json` files under that prefix instead.
   */
  readonly artifactPath: string;
  /** Advisory edge-auth subject header forwarded by nginx after auth_request succeeds. */
  readonly sessionSubject?: string | null;
  /** Advisory edge-auth status header forwarded by nginx after auth_request succeeds. */
  readonly sessionStatus?: string | null;
};

export type GetProjectArtifactHandlerOutput =
  | {
      readonly status: 'ok';
      /** The resolved artifact path or prefix, echoed back. */
      readonly path: string;
      /** Parsed JSON body of the named file; present only for an exact-file match. */
      readonly body?: unknown;
      /** Listing of artifact files under the prefix; present only for a prefix match. */
      readonly items?: readonly ProjectArtifactEntry[];
    }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };

/**
 * A single HTTP endpoint binding flattened from a per-service `bindings.json`
 * file in the latest published project bundle.
 */
export type ProjectEndpointRow = {
  /** Owning service slug, derived from the `services/<service>/` bundle path. */
  readonly service: string;
  /** Binding key — the bound operation name under `bindings`. */
  readonly operation: string;
  /** HTTP method from the binding's `http.method`. */
  readonly method: string;
  /** Service-relative HTTP path from the binding's `http.path`. */
  readonly path: string;
};

export type ListProjectEndpointsHandlerInput = {
  /** Canonical project id (uuid) or org-scoped project slug. */
  readonly projectId: string;
  /** Advisory edge-auth subject header forwarded by nginx after auth_request succeeds. */
  readonly sessionSubject?: string | null;
  /** Advisory edge-auth status header forwarded by nginx after auth_request succeeds. */
  readonly sessionStatus?: string | null;
};

export type ListProjectEndpointsHandlerOutput =
  | { readonly status: 'ok'; readonly endpoints: readonly ProjectEndpointRow[] }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };

/**
 * A single UI component spec file flattened from the latest published project
 * bundle for definition inspection (no live preview).
 */
export type ProjectUiComponentRow = {
  /** Spec classification: `screen`, `layout`, or `component`. */
  readonly kind: string;
  /** Last path segment without its `.spec.json` extension (e.g. `data-model`). */
  readonly name: string;
  /** Full bundle-relative spec file path (e.g. `services/app/ui/screens/data-model.spec.json`). */
  readonly path: string;
};

export type ListProjectUiComponentsHandlerInput = {
  /** Canonical project id (uuid) or org-scoped project slug. */
  readonly projectId: string;
  /** Advisory edge-auth subject header forwarded by nginx after auth_request succeeds. */
  readonly sessionSubject?: string | null;
  /** Advisory edge-auth status header forwarded by nginx after auth_request succeeds. */
  readonly sessionStatus?: string | null;
};

export type ListProjectUiComponentsHandlerOutput =
  | { readonly status: 'ok'; readonly uiComponents: readonly ProjectUiComponentRow[] }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };

/**
 * A single graph artifact file flattened from the latest published project
 * bundle for definition inspection (node/edge tables, no interactive canvas).
 */
export type ProjectGraphRow = {
  /** Owning service slug, derived from the `services/<service>/graphs/` bundle path. */
  readonly service: string;
  /** Last path segment without its `.json` extension (e.g. `createProject`). */
  readonly graph: string;
  /** Length of the graph artifact's `nodes` array. */
  readonly nodeCount: number;
};

export type ListProjectGraphsHandlerInput = {
  /** Canonical project id (uuid) or org-scoped project slug. */
  readonly projectId: string;
  /** Advisory edge-auth subject header forwarded by nginx after auth_request succeeds. */
  readonly sessionSubject?: string | null;
  /** Advisory edge-auth status header forwarded by nginx after auth_request succeeds. */
  readonly sessionStatus?: string | null;
};

export type ListProjectGraphsHandlerOutput =
  | { readonly status: 'ok'; readonly graphs: readonly ProjectGraphRow[] }
  | { readonly status: 'error'; readonly errors: readonly PlatformError[] };
