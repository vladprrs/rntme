import { clearInterval, setInterval } from 'node:timers';
import { isOk, type DeploymentRepo, type PlatformError, type ProjectOperationRepo, type ProjectRepo, type Result } from '@rntme/platform-core';
import type { Logger } from 'pino';

export type OrphanDetectDeps = {
  readonly withOrgTx: <T>(
    orgId: string,
    fn: (repos: { deployments: DeploymentRepo; projectOperations: ProjectOperationRepo; projects: ProjectRepo }) => Promise<T>,
  ) => Promise<T>;
  readonly findStaleRunning: (
    staleAfterSeconds: number,
  ) => Promise<Result<readonly { id: string; orgId: string }[], PlatformError>>;
  readonly findStaleRunningProjectOperations?: (
    staleAfterSeconds: number,
  ) => Promise<Result<readonly { id: string; orgId: string; kind: string; projectId: string }[], PlatformError>>;
  readonly logger: Pick<Logger, 'warn'>;
};

export function startOrphanDetectLoop(
  deps: OrphanDetectDeps,
  intervalMs = 60_000,
): { stop: () => void } {
  let stopped = false;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    const stale = await deps.findStaleRunning(60);
    if (!isOk(stale)) {
      deps.logger.warn({ errors: stale.errors }, 'orphan-detect findStaleRunning failed');
      return;
    }
    for (const { id, orgId } of stale.value) {
      await deps.withOrgTx(orgId, async (repos) => {
        const finalized = await repos.deployments.finalize(id, {
          status: 'failed_orphaned',
          errorCode: 'DEPLOY_EXECUTOR_ORPHANED',
          errorMessage: 'no heartbeat for >=60s',
        });
        if (!isOk(finalized)) {
          deps.logger.warn({ deploymentId: id, errors: finalized.errors }, 'orphan finalize failed');
        }
      });
    }

    if (deps.findStaleRunningProjectOperations) {
      const staleOps = await deps.findStaleRunningProjectOperations(60);
      if (!isOk(staleOps)) {
        deps.logger.warn({ errors: staleOps.errors }, 'orphan-detect findStaleRunningProjectOperations failed');
        return;
      }
      for (const { id, orgId, kind, projectId } of staleOps.value) {
        await deps.withOrgTx(orgId, async (repos) => {
          const finalized = await repos.projectOperations.finalize(id, {
            status: 'failed',
            errorCode: 'PROJECT_OPERATION_DELETE_TEARDOWN_FAILED',
            errorMessage: 'no heartbeat for >=60s',
          });
          if (!isOk(finalized)) {
            deps.logger.warn({ operationId: id, errors: finalized.errors }, 'orphan project operation finalize failed');
          }
          if (kind === 'delete') {
            await repos.projects.setStatus(orgId, projectId, 'delete_failed');
          }
        });
      }
    }
  };

  void tick();
  const handle = setInterval(() => {
    void tick();
  }, intervalMs);

  return {
    stop: () => {
      stopped = true;
      clearInterval(handle);
    },
  };
}
