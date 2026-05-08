import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import { ok, type DeployTargetWithSecret, type ProjectOperationRepo, type DeploymentRepo, type ProjectRepo, type ProjectVersionRepo } from '@rntme/platform-core';
import { runProjectDeleteOperation, type ProjectDeleteExecutorDeps } from '../../../src/deploy/project-delete-executor.js';

describe('runProjectDeleteOperation', () => {
  it('deletes applied resources grouped by target and decommissions project', async () => {
    const operations = operationRepo();
    const projects = projectRepo();
  const deployments = deploymentRepo();
  const deployTargets = {
    getWithSecretById: vi.fn(async () => ok(target('target-1'))),
  };
  const projectVersions = projectVersionRepo();
  const client = {
    deleteApplication: vi.fn(async () => undefined),
    deleteCompose: vi.fn(async () => undefined),
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
      logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
      heartbeatMs: 1_000,
      blob: {
        getRaw: vi.fn(async () => ok(Buffer.alloc(0))),
        putIfAbsent: vi.fn(async () => ok(undefined as never)),
        presignedGet: vi.fn(async () => ok('')),
        getJson: vi.fn(async () => ok({})),
      } as unknown as ProjectDeleteExecutorDeps['blob'],
      secretCipher: {
        encrypt: vi.fn(() => ({ ciphertext: Buffer.alloc(0), nonce: Buffer.alloc(0), keyVersion: 1 })),
        decrypt: vi.fn(() => '{"modules":{}}'),
      } as ProjectDeleteExecutorDeps['secretCipher'],
      resolveProvisioner: vi.fn(async () => ({
        provision: vi.fn(),
        tearDown: vi.fn(),
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

function deploymentRepo(): Pick<DeploymentRepo, 'listAppliedResourcesByProject' | 'findLastSuccessfulForProjectTarget'> {
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
    // Returns null provisionResult → tearDown phase is skipped.
    findLastSuccessfulForProjectTarget: vi.fn(async () => ok(null)),
  };
}

function projectVersionRepo(): Pick<ProjectVersionRepo, 'getById'> {
  return {
    getById: vi.fn(async () => ok(null)),
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
    workflows: null,
    auth: {},
    policyValues: {},
    manualAccess: {},
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
