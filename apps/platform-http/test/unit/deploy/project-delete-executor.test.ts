import { Buffer } from 'node:buffer';
import { describe, expect, it, mock } from 'bun:test';
import { ok, type DeployTargetWithSecret, type ProjectOperationRepo, type DeploymentRepo, type ProjectRepo, type ProjectVersionRepo } from '@rntme/platform-core';
import { runProjectDeleteOperation, type ProjectDeleteExecutorDeps } from '../../../src/deploy/project-delete-executor.js';

describe('runProjectDeleteOperation', () => {
  it('deletes applied resources grouped by target and decommissions project', async () => {
    const operations = operationRepo();
    const projects = projectRepo();
  const deployments = deploymentRepo();
  const deployTargets = {
    getWithSecretById: mock(async () => ok(target('target-1'))),
  };
  const projectVersions = projectVersionRepo();
  const client = {
    deleteApplication: mock(async () => undefined),
    deleteCompose: mock(async () => undefined),
  };
  const withOrgTx = async (_orgId: string, fn: (repos: {
    projectOperations: typeof operations;
    projects: typeof projects;
    deployments: typeof deployments;
    deployTargets: typeof deployTargets;
    projectVersions: typeof projectVersions;
  }) => Promise<unknown>) => fn({ projectOperations: operations, projects, deployments, deployTargets, projectVersions });

    await runProjectDeleteOperation('operation-1', 'org-1', {
      withOrgTx: withOrgTx as unknown as ProjectDeleteExecutorDeps['withOrgTx'],
      dokployClientFactory: () => client as never,
      logger: { warn: mock(), error: mock(), info: mock() },
      heartbeatMs: 1_000,
      blob: {
        getRaw: mock(async () => ok(Buffer.alloc(0))),
        putIfAbsent: mock(async () => ok(undefined as never)),
        presignedGet: mock(async () => ok('')),
        getJson: mock(async () => ok({})),
      } as unknown as ProjectDeleteExecutorDeps['blob'],
      secretCipher: {
        encrypt: mock(() => ({ ciphertext: Buffer.alloc(0), nonce: Buffer.alloc(0), keyVersion: 1 })),
        decrypt: mock(() => '{"modules":{}}'),
      } as ProjectDeleteExecutorDeps['secretCipher'],
      resolveProvisioner: mock(async () => ({
        provision: mock(),
        tearDown: mock(),
      })) as unknown as ProjectDeleteExecutorDeps['resolveProvisioner'],
    });

    expect(client.deleteApplication).toHaveBeenCalledWith('app_1');
    expect(client.deleteCompose).toHaveBeenCalledWith('compose_1');
    expect(projects.setStatus).toHaveBeenCalledWith('org-1', 'project-1', 'decommissioned');
    expect(operations.finalize).toHaveBeenCalledWith('operation-1', expect.objectContaining({ status: 'succeeded' }));
  });
});

function operationRepo(): ProjectOperationRepo {
  return {
    create: mock(),
    attachDeployment: mock(),
    getById: mock(async () => ok({
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
    getByDeploymentId: mock(),
    listByProject: mock(),
    transition: mock(async () => ok(undefined)),
    finalize: mock(async (_id, args) => ok({
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
    touchHeartbeat: mock(async () => ok(undefined)),
    appendLog: mock(async () => ok(undefined)),
    readLogs: mock(),
    findStaleRunning: mock(),
  } as ProjectOperationRepo;
}

function projectRepo(): Pick<ProjectRepo, 'setStatus'> {
  return { setStatus: mock(async () => ok({} as never)) };
}

function deploymentRepo(): Pick<DeploymentRepo, 'listAppliedResourcesByProject' | 'findLastSuccessfulForProjectTarget'> {
  return {
    listAppliedResourcesByProject: mock(async () => ok([
      {
        deploymentId: 'deployment-1',
        targetId: 'target-1',
        resources: [
          { resourceKind: 'application' as const, targetResourceId: 'app_1', targetResourceName: 'api' },
          { resourceKind: 'compose' as const, targetResourceId: 'compose_1', targetResourceName: 'event-bus' },
        ],
      },
    ])),
    // Returns null provisionResult → tearDown phase is skipped.
    findLastSuccessfulForProjectTarget: mock(async () => ok(null)),
  };
}

function projectVersionRepo(): Pick<ProjectVersionRepo, 'getById'> {
  return {
    getById: mock(async () => ok(null)),
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
    storage: { mode: 'external' },
    modules: {},
    workflows: null,
    auth: {},
    policyValues: {},
    manualAccess: {},
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
