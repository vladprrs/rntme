import { describe, expect, it } from 'bun:test';

/**
 * Cutover smoke test for the BPMN-orchestrated deploy flow.
 *
 * Intended end-to-end shape (per plan
 * `docs/superpowers/plans/2026-05-10-bpmn-orchestrated-deploy-services-deployments.md`,
 * Task 17):
 *
 *   1. Boot the deployed platform in **blueprint mode** (the new path that
 *      bypasses the legacy deployment scheduler) against a Dokploy
 *      testcontainer, alongside Operaton + Kafka + a `deploy-worker`
 *      poll-mode container.
 *   2. POST a queueDeployment request for the demo `notes-blueprint` against a
 *      fixture target.
 *   3. Poll until the BPMN process completes (success or failure).
 *   4. Assert that one `DeployStageState` row exists per stage
 *      (compose / plan / provision / render / apply / verify) with status
 *      `succeeded`.
 *   5. Assert the deployment record itself transitions to `succeeded`.
 *
 * This test is **skipped** because shipping it green still requires:
 *
 *   - **Harness helpers** (`apps/platform-http/test/e2e/harness.ts`):
 *     `startTestPlatformBlueprintMode`, `queueTestDeployment`, and
 *     `waitForDeployment` do not yet exist. They need to wrap the existing
 *     `live-dokploy-env` primitives plus a new Operaton + Kafka + worker
 *     bring-up. The current `harness.ts` only knows how to boot
 *     platform-http in legacy/scheduler mode.
 *   - **Stage-handler completion**: the in-process handlers (Task 10 of the
 *     plan) carry known TODOs:
 *       * `orgSlug` is plumbed as a placeholder until the deployment record
 *         carries it explicitly.
 *       * `resolveProvisioner` in the provision stage is still a stub —
 *         module bundles aren't dependencies of platform-http, so no
 *         provisioner can run end-to-end yet (see memory entry
 *         `rntme_provisioner_resolver_gap.md`).
 *       * Target normalization (`target.auth.auth0.clientId` etc.) still
 *         relies on casts in a few places.
 *   - **Loud-failure contract for the worker**: covered by Task 13/14 unit
 *     tests but not yet exercised through a real Operaton + Kafka stack.
 *
 * Once those land, flip `it.skip` to `it`, wire in the helpers, and run with:
 *
 *   SKIP_TESTCONTAINERS=false bun test --cwd apps/platform-http \
 *     test/e2e/bpmn-deploy-flow.test.ts
 *
 * Expected runtime: under 5 minutes.
 */
describe('BPMN deploy flow', () => {
  it.skip('runs all six stages via Operaton and finalizes the deployment', async () => {
    // TODO(plan-2026-05-10): unskip once the harness helpers and stage
    // handlers above are in place. Reference shape:
    //
    // const platform = await startTestPlatformBlueprintMode();
    // try {
    //   const deployment = await queueTestDeployment(platform, {
    //     blueprint: 'notes-blueprint',
    //   });
    //   const result = await waitForDeployment(platform, deployment.id, {
    //     timeoutMs: 5 * 60_000,
    //   });
    //   expect(result.status).toBe('succeeded');
    //   expect(result.stages).toEqual([
    //     { stage: 'compose', status: 'succeeded' },
    //     { stage: 'plan', status: 'succeeded' },
    //     { stage: 'provision', status: 'succeeded' },
    //     { stage: 'render', status: 'succeeded' },
    //     { stage: 'apply', status: 'succeeded' },
    //     { stage: 'verify', status: 'succeeded' },
    //   ]);
    // } finally {
    //   await platform.stop();
    // }
    expect(true).toBe(true);
  });
});
