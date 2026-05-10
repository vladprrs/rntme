import { describe, expect, it, mock } from 'bun:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { ok } from '@rntme/platform-core';
import { startOrphanDetectLoop } from '../../../src/deploy/orphan-detect.js';

describe('startOrphanDetectLoop', () => {
  it('finalizes stale deployments as failed_orphaned on startup', async () => {
    const finalize = mock(async () => ok(undefined));
    const deps = {
      findStaleRunning: mock(async () =>
        ok([{ id: 'dep-1', orgId: 'org-1' }, { id: 'dep-2', orgId: 'org-2' }]),
      ),
      withOrgTx: mock(async (_orgId: string, fn: (repos: never) => Promise<unknown>) =>
        fn({ deployments: { finalize } } as never),
      ),
      logger: { warn: mock() },
    };

    const loop = startOrphanDetectLoop(deps as never, 60_000);
    await waitForCalls(finalize, 2);
    loop.stop();

    expect(finalize).toHaveBeenCalledWith('dep-1', {
      status: 'failed_orphaned',
      errorCode: 'DEPLOY_EXECUTOR_ORPHANED',
      errorMessage: 'no heartbeat for >=60s',
    });
  });

  it('stops future interval ticks', async () => {
    const deps = {
      findStaleRunning: mock(async () => ok([])),
      withOrgTx: mock(),
      logger: { warn: mock() },
    };

    const loop = startOrphanDetectLoop(deps as never, 50);
    await waitForCalls(deps.findStaleRunning, 1);
    loop.stop();
    const callsAfterStop = deps.findStaleRunning.mock.calls.length;
    await sleep(125);

    expect(deps.findStaleRunning).toHaveBeenCalled();
    expect(deps.findStaleRunning).toHaveBeenCalledTimes(callsAfterStop);
  });
});

async function waitForCalls(fn: { mock: { calls: unknown[] } }, count: number): Promise<void> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (fn.mock.calls.length >= count) return;
    await sleep(10);
  }
  expect(fn).toHaveBeenCalledTimes(count);
}
