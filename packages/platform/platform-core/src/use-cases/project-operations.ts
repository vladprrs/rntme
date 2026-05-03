import type { Ids } from '../ids.js';
import type { ProjectRepo } from '../repos/project-repo.js';
import type { ProjectVersionRepo } from '../repos/project-version-repo.js';
import type { DeployTargetRepo } from '../repos/deploy-target-repo.js';
import type { DeploymentRepo } from '../repos/deployment-repo.js';
import type { ProjectOperationRepo } from '../repos/project-operation-repo.js';
import type { Deployment } from '../schemas/deployment.js';
import type {
  ProjectOperation,
  StartProjectDeleteOperationRequest,
  StartProjectUpdateOperationRequest,
} from '../schemas/project-operation.js';
import { err, isOk, ok, type PlatformError, type Result } from '../types/result.js';

type OperationDeps = {
  repos: {
    projects: ProjectRepo;
    projectOperations: ProjectOperationRepo;
  };
};

type UpdateDeps = {
  repos: {
    projects: ProjectRepo;
    projectVersions: ProjectVersionRepo;
    deployTargets: DeployTargetRepo;
    deployments: DeploymentRepo;
    projectOperations: ProjectOperationRepo;
  };
  ids: Ids;
};

type DeleteDeps = {
  repos: {
    projects: ProjectRepo;
    deployments: DeploymentRepo;
    projectOperations: ProjectOperationRepo;
  };
  ids: Ids;
};

type Actor = {
  orgId: string;
  projectId: string;
  accountId: string;
  tokenId: string | null;
};

export async function startProjectUpdateOperation(
  deps: UpdateDeps,
  input: Actor & { req: StartProjectUpdateOperationRequest },
): Promise<Result<{ operation: ProjectOperation; deployment: Deployment }, PlatformError>> {
  const project = await deps.repos.projects.findById(input.orgId, input.projectId);
  if (!isOk(project)) return project;
  if (!project.value) return err([{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: input.projectId }]);
  if (project.value.status !== 'active') {
    return err([{ code: 'PROJECT_OPERATION_INVALID_STATE', message: project.value.status }]);
  }

  const target = await deps.repos.deployTargets.getBySlug(input.orgId, input.req.targetSlug);
  if (!isOk(target)) return target;
  if (!target.value) {
    return err([
      {
        code: 'DEPLOY_REQUEST_TARGET_NOT_FOUND',
        message: input.req.targetSlug,
      },
    ]);
  }

  const active = await deps.repos.deployments.hasActiveForProjectTarget(input.projectId, target.value.id);
  if (!isOk(active)) return active;
  if (active.value) return err([{ code: 'PROJECT_OPERATION_ACTIVE_DEPLOYMENT', message: target.value.slug }]);

  if (input.req.projectVersionSeq === undefined) {
    return err([{ code: 'PROJECT_OPERATION_BUNDLE_SOURCE_CONFLICT', message: 'bundle source must be published by route before use-case call' }]);
  }

  const version = await deps.repos.projectVersions.getBySeq(input.projectId, input.req.projectVersionSeq);
  if (!isOk(version)) return version;
  if (!version.value) {
    return err([{ code: 'DEPLOY_REQUEST_VERSION_NOT_FOUND', message: `project version seq ${input.req.projectVersionSeq} not found` }]);
  }

  const operation = await deps.repos.projectOperations.create({
    row: {
      id: deps.ids.uuid(),
      orgId: input.orgId,
      projectId: input.projectId,
      kind: 'update',
      requestedByAccountId: input.accountId,
      requestedByTokenId: input.tokenId,
      targetId: target.value.id,
      projectVersionId: version.value.id,
      deploymentId: null,
      input: { projectVersionSeq: version.value.seq, targetSlug: target.value.slug },
    },
    auditActorAccountId: input.accountId,
    auditActorTokenId: input.tokenId,
  });
  if (!isOk(operation)) return operation;

  const deployment = await deps.repos.deployments.create({
    row: {
      id: deps.ids.uuid(),
      projectId: input.projectId,
      orgId: input.orgId,
      projectVersionId: version.value.id,
      targetId: target.value.id,
      configOverrides: {},
      startedByAccountId: input.accountId,
    },
    auditActorAccountId: input.accountId,
    auditActorTokenId: input.tokenId,
  });
  if (!isOk(deployment)) return deployment;

  const attached = await deps.repos.projectOperations.attachDeployment(operation.value.id, deployment.value.id);
  if (!isOk(attached)) return attached;

  return ok({ operation: attached.value, deployment: deployment.value });
}

export async function startProjectDeleteOperation(
  deps: DeleteDeps,
  input: Actor & { projectSlug: string; req: StartProjectDeleteOperationRequest },
): Promise<Result<{ operation: ProjectOperation }, PlatformError>> {
  const project = await deps.repos.projects.findById(input.orgId, input.projectId);
  if (!isOk(project)) return project;
  if (!project.value) return err([{ code: 'PLATFORM_TENANCY_PROJECT_NOT_FOUND', message: input.projectId }]);
  if (input.req.confirm !== input.projectSlug) {
    return err([{ code: 'PROJECT_OPERATION_CONFIRMATION_MISMATCH', message: input.projectSlug }]);
  }
  if (project.value.status !== 'active' && project.value.status !== 'delete_failed') {
    return err([{ code: 'PROJECT_OPERATION_INVALID_STATE', message: project.value.status }]);
  }
  const active = await deps.repos.deployments.hasActiveForProject(input.projectId);
  if (!isOk(active)) return active;
  if (active.value) return err([{ code: 'PROJECT_OPERATION_ACTIVE_DEPLOYMENT', message: input.projectSlug }]);

  const deleting = await deps.repos.projects.setStatus(input.orgId, input.projectId, 'deleting');
  if (!isOk(deleting)) return deleting;

  const operation = await deps.repos.projectOperations.create({
    row: {
      id: deps.ids.uuid(),
      orgId: input.orgId,
      projectId: input.projectId,
      kind: 'delete',
      requestedByAccountId: input.accountId,
      requestedByTokenId: input.tokenId,
      targetId: null,
      projectVersionId: null,
      deploymentId: null,
      input: { confirm: input.req.confirm },
    },
    auditActorAccountId: input.accountId,
    auditActorTokenId: input.tokenId,
  });
  if (!isOk(operation)) return operation;
  return ok({ operation: operation.value });
}

export async function finalizeProjectOperation(
  deps: OperationDeps,
  input: {
    operationId: string;
    status: 'succeeded' | 'failed';
    result?: Record<string, unknown>;
    errorCode?: string;
    errorMessage?: string;
  },
): Promise<Result<ProjectOperation, PlatformError>> {
  const operation = await deps.repos.projectOperations.finalize(input.operationId, {
    status: input.status,
    result: input.result,
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
  });
  if (!isOk(operation)) return operation;

  if (operation.value.kind === 'delete') {
    const projectStatus = input.status === 'succeeded' ? 'decommissioned' : 'delete_failed';
    const project = await deps.repos.projects.setStatus(operation.value.orgId, operation.value.projectId, projectStatus);
    if (!isOk(project)) return project;
  }

  return operation;
}

export async function listProjectOperations(
  deps: { repos: { projectOperations: ProjectOperationRepo } },
  input: { projectId: string; limit: number; cursor?: Date },
): Promise<Result<readonly ProjectOperation[], PlatformError>> {
  return deps.repos.projectOperations.listByProject(input.projectId, input);
}

export async function getProjectOperation(
  deps: { repos: { projectOperations: ProjectOperationRepo } },
  input: { operationId: string },
): Promise<Result<ProjectOperation | null, PlatformError>> {
  return deps.repos.projectOperations.getById(input.operationId);
}

export async function readProjectOperationLogs(
  deps: { repos: { projectOperations: ProjectOperationRepo } },
  input: { operationId: string; sinceLineId: number; limit: number },
) {
  return deps.repos.projectOperations.readLogs(input);
}
