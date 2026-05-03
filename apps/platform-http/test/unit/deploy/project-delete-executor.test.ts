import { describe, expect, it, vi } from 'vitest';
import { ok, type DeployTargetWithSecret, type ProjectOperationRepo, type DeploymentRepo, type ProjectRepo } from '@rntme/platform-core';
import { runProjectDeleteOperation, type ProjectDeleteExecutorDeps } from '../../../src/deploy/project-delete-executor.js';

describe('runProjectDeleteOperation', () => {
  it('deletes applied resources grouped by target and decommissions project', async () => {
    const operations = operationRepo();
    const projects = projectRepo();
  const deployments = deploymentRepo();
  const deployTargets = {
    getWithSecretById: vi.fn(async () => ok(target('target-1'))),
  };
  const client = {
    deleteApplication: vi.fn(async () => undefined),
    deleteCompose: vi.fn(async () => undefined),
  };
  const withOrgTx = async (_orgId: string, fn: (repos: {
    projectOperations: typeof operations;
    projects: typeof projects;
    deployments: typeof deployments;
    deployTargets: typeof deployTargets;
  }) => Promise<unknown>) => fn({ projectOperations: operations, projects, deployments, deployTargets });

    await runProjectDeleteOperation('operation-1', 'org-1', {
      withOrgTx: withOrgTx as unknown as ProjectDeleteExecutorDeps['withOrgTx'],
      dokployClientFactory: () => client as never,
      logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
      heartbeatMs: 1_000,
    });

    expect(client.deleteApplication).toHaveBeenCalledWith('app_1');
    expect(client.deleteCompose).toHaveBeenCalledWith('compose_1');
    expect(projects.setStatus).toHaveBeenCalledWith('org-1', 'project-1', 'decommissioned');
    expect(operations.finalize).toHaveBeenCalledWith('operation-1', expect.objectContaining({ status: 'succeeded' }));
  });
});

function operationRepo(): ProjectOperationRepo {
  return {
    create: vi.fn(),
    attachDeployment: vi.fn(),
    getById: vi.fn(async () => ok({
      id: 'operation-1',
      orgId: 'org-1',
      projectId: 'project-1',
      kind: 'delete',
      status: 'queued',
      requestedByAccountId: 'account-1',
      requestedByTokenId: null,
      targetId: null,
      projectVersionId: null,
      deploymentId: null,
      input: {},
      result: null,
      errorCode: null,
      errorMessage: null,
      queuedAt: new Date(),
      startedAt: null,
      finishedAt: null,
      lastHeartbeatAt: null,
    })),
    getByDeploymentId: vi.fn(),
    listByProject: vi.fn(),
    transition: vi.fn(async () => ok(undefined)),
    finalize: vi.fn(async (_id, args) => ok({
      id: 'operation-1',
      orgId: 'org-1',
      projectId: 'project-1',
      kind: 'delete',
      status: args.status,
      requestedByAccountId: 'account-1',
      requestedByTokenId: null,
      targetId: null,
      projectVersionId: null,
      deploymentId: null,
      input: {},
      result: args.result ?? null,
      errorCode: args.errorCode ?? null,
      errorMessage: args.errorMessage ?? null,
      queuedAt: new Date(),
      startedAt: new Date(),
      finishedAt: new Date(),
      lastHeartbeatAt: new Date(),
    })),
    touchHeartbeat: vi.fn(async () => ok(undefined)),
    appendLog: vi.fn(async () => ok(undefined)),
    readLogs: vi.fn(),
    findStaleRunning: vi.fn(),
  } as ProjectOperationRepo;
}

function projectRepo(): Pick<ProjectRepo, 'setStatus'> {
  return { setStatus: vi.fn(async () => ok({} as never)) };
}

function deploymentRepo(): Pick<DeploymentRepo, 'listAppliedResourcesByProject'> {
  return {
    listAppliedResourcesByProject: vi.fn(async () => ok([
      {
        deploymentId: 'deployment-1',
        targetId: 'target-1',
        resources: [
          { resourceKind: 'application' as const, targetResourceId: 'app_1', targetResourceName: 'api' },
          { resourceKind: 'compose' as const, targetResourceId: 'compose_1', targetResourceName: 'event-bus' },
        ],
      },
    ])),
  };
}

function target(id: string): DeployTargetWithSecret {
  return {
    id,
    orgId: 'org-1',
    slug: 'dokploy',
    displayName: 'Dokploy',
    kind: 'dokploy',
    dokployUrl: 'https://dokploy.example.com',
    publicBaseUrl: null,
    dokployProjectId: 'project-1',
    dokployProjectName: null,
    allowCreateProject: false,
    apiTokenCiphertext: Buffer.from('secret'),
    apiTokenNonce: Buffer.from('nonce'),
    apiTokenKeyVersion: 1,
    eventBus: { kind: 'kafka', mode: 'external', brokers: ['redpanda:9092'] },
    modules: {},
    auth: {},
    policyValues: {},
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
