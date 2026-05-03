import { clearInterval, setInterval } from 'node:timers';
import { deleteDokployResources, type DokployDeleteResource } from '@rntme/deploy-dokploy';
import { isOk, type DeployTargetRepo, type DeploymentRepo, type ProjectOperationRepo, type ProjectRepo } from '@rntme/platform-core';
import type { Logger } from 'pino';
import type { DokployClientFactory } from './dokploy-client-factory.js';

export type ProjectDeleteExecutorDeps = {
  readonly withOrgTx: <T>(orgId: string, fn: (repos: {
    projectOperations: ProjectOperationRepo;
    projects: ProjectRepo;
    deployments: DeploymentRepo;
    deployTargets: DeployTargetRepo;
  }) => Promise<T>) => Promise<T>;
  readonly dokployClientFactory: DokployClientFactory;
  readonly logger: Pick<Logger, 'error' | 'warn' | 'info'>;
  readonly heartbeatMs?: number;
};

export async function runProjectDeleteOperation(
  operationId: string,
  orgId: string,
  deps: ProjectDeleteExecutorDeps,
): Promise<void> {
  const heartbeat = setInterval(() => {
    void deps.withOrgTx(orgId, (repos) => repos.projectOperations.touchHeartbeat(operationId)).catch(() => undefined);
  }, deps.heartbeatMs ?? 5_000);

  try {
    const operation = await deps.withOrgTx(orgId, async (repos) => {
      const op = await repos.projectOperations.getById(operationId);
      if (!isOk(op) || !op.value) throw new Error('PROJECT_OPERATION_NOT_FOUND');
      const transition = await repos.projectOperations.transition(operationId, 'running', { startedAt: new Date() });
      if (!isOk(transition)) throw new Error(transition.errors[0]?.code ?? 'PROJECT_OPERATION_INVALID_STATE');
      await repos.projectOperations.appendLog({ operationId, orgId, level: 'info', step: 'init', message: `Starting project delete operation projectId=${op.value.projectId}` });
      return op.value;
    });

    const applied = await deps.withOrgTx(orgId, (repos) => repos.deployments.listAppliedResourcesByProject(operation.projectId));
    if (!isOk(applied)) throw new Error(applied.errors[0]?.message ?? 'failed to read applied resources');

    const groups = groupByTarget(applied.value);
    const deleted: DokployDeleteResource[] = [];
    const warnings: string[] = [];
    const failures: Array<{ targetId: string; message: string }> = [];

    for (const [targetId, resources] of groups) {
      const target = await deps.withOrgTx(orgId, (repos) => repos.deployTargets.getWithSecretById(targetId));
      if (!isOk(target) || !target.value) {
        failures.push({ targetId, message: 'deploy target not found' });
        continue;
      }
      await appendLog(deps, operationId, orgId, 'info', 'teardown', `Deleting ${resources.length} resources from target ${target.value.slug}`);
      const result = await deleteDokployResources(resources, deps.dokployClientFactory(target.value));
      if (!isOk(result)) {
        failures.push({ targetId, message: result.errors[0]?.message ?? 'delete failed' });
        continue;
      }
      deleted.push(...result.value.deletedResources);
      warnings.push(...result.value.warnings);
      for (const warning of result.value.warnings) {
        await appendLog(deps, operationId, orgId, 'warn', 'teardown', warning);
      }
    }

    if (failures.length > 0) {
      await deps.withOrgTx(orgId, async (repos) => {
        await repos.projectOperations.finalize(operationId, {
          status: 'failed',
          result: { deletedResources: deleted, warnings, failures },
          errorCode: 'PROJECT_OPERATION_DELETE_TEARDOWN_FAILED',
          errorMessage: failures.map((f) => `${f.targetId}: ${f.message}`).join('; '),
        });
        await repos.projects.setStatus(orgId, operation.projectId, 'delete_failed');
      });
      return;
    }

    await deps.withOrgTx(orgId, async (repos) => {
      await repos.projectOperations.finalize(operationId, {
        status: 'succeeded',
        result: { deletedResources: deleted, warnings },
      });
      await repos.projects.setStatus(orgId, operation.projectId, 'decommissioned');
    });
  } catch (cause) {
    deps.logger.error({ operationId, cause }, 'project delete executor failed');
    await deps.withOrgTx(orgId, async (repos) => {
      const op = await repos.projectOperations.getById(operationId);
      const projectId = isOk(op) && op.value ? op.value.projectId : null;
      await repos.projectOperations.finalize(operationId, {
        status: 'failed',
        errorCode: 'PROJECT_OPERATION_DELETE_TEARDOWN_FAILED',
        errorMessage: cause instanceof Error ? cause.message : String(cause),
      });
      if (projectId !== null) await repos.projects.setStatus(orgId, projectId, 'delete_failed');
    }).catch((finalizeCause) => {
      deps.logger.error({ operationId, cause: finalizeCause }, 'project delete finalize failed');
    });
  } finally {
    clearInterval(heartbeat);
  }
}

function groupByTarget(rows: readonly {
  readonly targetId: string;
  readonly resources: readonly DokployDeleteResource[];
}[]): Map<string, DokployDeleteResource[]> {
  const out = new Map<string, DokployDeleteResource[]>();
  for (const row of rows) {
    const list = out.get(row.targetId) ?? [];
    list.push(...row.resources);
    out.set(row.targetId, list);
  }
  return out;
}

async function appendLog(
  deps: ProjectDeleteExecutorDeps,
  operationId: string,
  orgId: string,
  level: 'info' | 'warn' | 'error',
  step: string,
  message: string,
): Promise<void> {
  await deps.withOrgTx(orgId, async (repos) => {
    await repos.projectOperations.appendLog({ operationId, orgId, level, step, message });
  });
}
