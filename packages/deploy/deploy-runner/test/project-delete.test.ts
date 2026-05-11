import { Buffer } from 'node:buffer';
import { describe, expect, it, mock } from 'bun:test';
import {
  ok,
  type DeployTargetWithSecret,
  type ProjectOperationRepo,
  type DeploymentRepo,
  type ProjectRepo,
  type ProjectVersionRepo,
} from '@rntme/platform-core';
import { runProjectDelete, type ProjectDeleteExecutorDeps } from '../src/project-delete.js';

describe('runProjectDelete', () => {
  it('deletes applied resources grouped by target and decommissions the project', async () => {
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
    const withOrgTx = async (
      _orgId: string,
      fn: (repos: {
        projectOperations: typeof operations;
        projects: typeof projects;
        deployments: typeof deployments;
        deployTargets: typeof deployTargets;
        projectVersions: typeof projectVersions;
      }) => Promise<unknown>,
    ) => fn({ projectOperations: operations, projects, deployments, deployTargets, projectVersions });

    await runProjectDelete('operation-1', 'org-1', {
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
    expect(operations.finalize).toHaveBeenCalledWith(
      'operation-1',
      expect.objectContaining({ status: 'succeeded' }),
    );
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
    finalize: mock(async () => ok(undefined)),
    touchHeartbeat: mock(async () => ok(undefined)),
    appendLog: mock(async () => ok(undefined)),
    listLogs: mock(),
    findStaleRunning: mock(),
  } as unknown as ProjectOperationRepo;
}

function projectRepo(): ProjectRepo {
  return {
    create: mock(),
    listForOrg: mock(),
    findBySlug: mock(),
    findById: mock(),
    setStatus: mock(async () => ok(undefined)),
  } as unknown as ProjectRepo;
}

function deploymentRepo(): DeploymentRepo {
  return {
    listAppliedResourcesByProject: mock(async () => ok([
      { deploymentId: 'deployment-1', targetId: 'target-1', resources: [
        { resourceKind: 'application' as const, targetResourceId: 'app_1', targetResourceName: 'a' },
        { resourceKind: 'compose' as const, targetResourceId: 'compose_1', targetResourceName: 'c' },
      ] },
    ])),
    findLastSuccessfulForProjectTarget: mock(async () => ok(null)),
    findStaleRunning: mock(),
  } as unknown as DeploymentRepo;
}

function projectVersionRepo(): ProjectVersionRepo {
  return {
    getById: mock(),
  } as unknown as ProjectVersionRepo;
}

function target(id: string): DeployTargetWithSecret {
  return {
    id,
    orgId: 'org-1',
    slug: 'preview',
    displayName: 'Preview',
    kind: 'dokploy',
    config: { dokployUrl: 'https://dokploy.test', dokployProjectId: 'proj-1' },
    encryptedSecret: { ciphertext: Buffer.alloc(0), nonce: Buffer.alloc(0), keyVersion: 1 },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as DeployTargetWithSecret;
}
