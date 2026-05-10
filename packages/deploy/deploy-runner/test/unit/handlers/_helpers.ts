import { mock } from 'bun:test';
import type { HandlerContext } from '../../../src/handlers/platform-context.js';

/**
 * Build a minimal HandlerContext suitable for unit-testing handler
 * orchestration. Each repo factory returns a fresh in-memory stub. Tests can
 * override individual fields by passing `overrides`.
 */
export function makeMockHandlerContext(overrides: Partial<HandlerContext> = {}): {
  ctx: HandlerContext;
  stageRepo: ReturnType<typeof makeStageRepo>;
  deploymentRepo: ReturnType<typeof makeDeploymentRepo>;
  deployTargetRepo: ReturnType<typeof makeDeployTargetRepo>;
  targetSecretsRepo: ReturnType<typeof makeTargetSecretsRepo>;
  projectVersionRepo: ReturnType<typeof makeProjectVersionRepo>;
  blob: ReturnType<typeof makeBlobStore>;
} {
  const stageRepo = makeStageRepo();
  const deploymentRepo = makeDeploymentRepo();
  const deployTargetRepo = makeDeployTargetRepo();
  const targetSecretsRepo = makeTargetSecretsRepo();
  const projectVersionRepo = makeProjectVersionRepo();
  const blob = makeBlobStore();

  const ctx = {
    pool: {} as never,
    db: {} as never,
    cipher: {} as never,
    blob,
    stageStateRepoFor: () => stageRepo,
    deploymentRepoFor: () => deploymentRepo,
    deployTargetRepoFor: () => deployTargetRepo,
    targetSecretsRepoFor: () => targetSecretsRepo,
    projectVersionRepoFor: () => projectVersionRepo,
    dokployClientFactoryFor: () => ({}) as never,
    ...overrides,
  } as unknown as HandlerContext;

  return { ctx, stageRepo, deploymentRepo, deployTargetRepo, targetSecretsRepo, projectVersionRepo, blob };
}

export function makeStageRepo() {
  return {
    begin: mock(async () => undefined),
    succeed: mock(async () => undefined),
    fail: mock(async () => undefined),
    read: mock(async () => null),
    readAll: mock(async () => []),
  };
}

export function makeDeploymentRepo() {
  return {
    getById: mock(async () => ({ ok: true as const, value: null })),
  };
}

export function makeDeployTargetRepo() {
  return {
    getWithSecretById: mock(async () => ({ ok: true as const, value: null })),
  };
}

export function makeTargetSecretsRepo() {
  return {
    getAllDecrypted: mock(async () => ({}) as Record<string, unknown>),
  };
}

export function makeProjectVersionRepo() {
  return {
    getById: mock(async () => ({ ok: true as const, value: null })),
  };
}

export function makeBlobStore() {
  return {
    getRaw: mock(async () => ({ ok: true as const, value: Buffer.from('{}') })),
    putIfAbsent: mock(async () => ({ ok: true as const, value: undefined })),
    getJson: mock(async () => ({ ok: true as const, value: {} as unknown })),
    presignedGet: mock(async () => ({ ok: true as const, value: '' })),
  };
}
