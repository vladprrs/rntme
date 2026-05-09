import type {
  RenderedComposeDomain,
  RenderedComposeServiceClass,
} from './compose-model.js';
import type {
  RenderedDokployProject,
  RenderedDokployResource,
  RenderedEnvVar,
  RenderedSecretFileRef,
} from './render.js';

export type DokployProjectRef = RenderedDokployProject;

export type DokployComposeServiceSummary = {
  readonly name: string;
  readonly serviceClass: RenderedComposeServiceClass;
};

export type DokployComposeTaskInspection = {
  readonly serviceName: string;
  readonly status: 'running' | 'healthy' | 'starting' | 'failed' | 'rejected' | 'exited' | 'unknown';
  readonly failedCount: number;
  readonly message?: string;
};

/**
 * Shared OK predicate for compose tasks: a task with `failedCount === 0` in any
 * of the listed statuses is considered healthy. Both apply-side inspection
 * surfacing and post-apply crash-loop verification must agree on this set,
 * otherwise healthy tasks would still be surfaced as inspections and trigger
 * crash-loop guards.
 *
 * Parameter type is structural so callers don't have to construct a full
 * `DokployComposeTaskInspection` if they have looser data.
 */
export function isComposeTaskHealthy(task: {
  readonly status: DokployComposeTaskInspection['status'];
  readonly failedCount: number;
}): boolean {
  if (task.failedCount > 0) return false;
  return (
    task.status === 'running' ||
    task.status === 'healthy' ||
    task.status === 'starting' ||
    task.status === 'unknown'
  );
}

export type DokployApplication = {
  readonly id: string;
  readonly name: string;
  readonly appName?: string;
  readonly image?: string;
  readonly command?: string | null;
  readonly args?: readonly string[] | null;
  readonly build?: Extract<RenderedDokployResource, { kind: 'application' }>['build'];
  readonly ports?: Extract<RenderedDokployResource, { kind: 'application' }>['ports'];
  readonly ingress?: Extract<RenderedDokployResource, { kind: 'application' }>['ingress'];
  readonly env?: readonly RenderedEnvVar[];
  readonly labels?: Readonly<Record<string, string>>;
  readonly files?: Readonly<Record<string, string>>;
  readonly secretFiles?: Readonly<Record<string, RenderedSecretFileRef>>;
};

export type DokployCompose = {
  readonly id: string;
  readonly name: string;
  readonly appName?: string;
  readonly image?: string;
  readonly composeFile?: string;
  readonly env?: readonly RenderedEnvVar[];
  readonly labels?: Readonly<Record<string, string>>;
};

export type DokployApplicationInspection = {
  readonly status: 'running' | 'done' | 'failed' | 'rejected' | 'unknown';
  readonly message?: string;
};

export type DokployClient = {
  ensureEnvironment(ref: DokployProjectRef, environmentName: string): Promise<{ environmentId: string }>;
  findApplicationByName(environmentId: string, name: string): Promise<DokployApplication | null>;
  createApplication(
    environmentId: string,
    resource: Extract<RenderedDokployResource, { kind: 'application' }>,
  ): Promise<DokployApplication>;
  updateApplication(
    applicationId: string,
    resource: Extract<RenderedDokployResource, { kind: 'application' }>,
  ): Promise<DokployApplication>;
  configureApplication(
    applicationId: string,
    resource: Extract<RenderedDokployResource, { kind: 'application' }>,
  ): Promise<void>;
  deployApplication(applicationId: string): Promise<void>;
  startApplication(applicationId: string): Promise<void>;
  inspectApplication?(applicationId: string): Promise<DokployApplicationInspection>;
  findComposeByName(environmentId: string, name: string): Promise<DokployCompose | null>;
  createCompose(
    environmentId: string,
    resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  ): Promise<DokployCompose>;
  updateCompose(
    composeId: string,
    resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  ): Promise<DokployCompose>;
  configureCompose(
    composeId: string,
    resource: Extract<RenderedDokployResource, { kind: 'compose' }>,
  ): Promise<void>;
  deployCompose(composeId: string): Promise<void>;
  configureComposeDomains?(
    composeId: string,
    domains: readonly RenderedComposeDomain[],
  ): Promise<void>;
  startCompose?(composeId: string): Promise<void>;
  loadComposeServices?(composeId: string): Promise<readonly DokployComposeServiceSummary[]>;
  inspectComposeTasks?(
    composeId: string,
    services: readonly DokployComposeServiceSummary[],
  ): Promise<readonly DokployComposeTaskInspection[]>;
  deleteApplication(applicationId: string): Promise<void>;
  deleteCompose(composeId: string): Promise<void>;
  /**
   * Optional list methods used by post-apply legacy-topology cleanup. When
   * implemented, the apply pipeline lists Dokploy applications and composes
   * scoped to `environmentId` after a successful project-stack apply and
   * deletes legacy non-stack resources whose names start with the
   * `rntme-<org>-<project>-` prefix. The name prefix is the primary
   * ownership marker because Dokploy's list APIs do not surface
   * resource-level labels; an explicit foreign `rntme.managed-by` label on
   * a candidate vetoes deletion. Per-resource and list-step failures are
   * isolated and surfaced as warnings on the apply result rather than
   * failing the deploy or being silently swallowed.
   */
  listApplications?(environmentId: string): Promise<readonly DokployApplication[]>;
  listComposes?(environmentId: string): Promise<readonly DokployCompose[]>;
};
