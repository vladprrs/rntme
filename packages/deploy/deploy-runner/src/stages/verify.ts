import { isComposeTaskHealthy, type DeploymentApplyResult } from '@rntme/deploy-dokploy';
import { SmokeVerifier } from '../smoke-verifier.js';
import { StageError } from './compose.js';
import type { VerifyStageInput, VerifyStageOutput } from './types.js';
import type { VerificationReport } from '../types.js';

export async function verify(
  input: VerifyStageInput,
  override?: { readonly smoker?: SmokeVerifier },
): Promise<VerifyStageOutput> {
  const stackReport = verifyComposeStack(input.applied);
  if (stackReport !== null && !stackReport.ok) {
    throw new StageError('DEPLOY_VERIFY_WORKLOAD_CRASH_LOOP', 'workload crash loop detected', stackReport);
  }
  const smoker = override?.smoker ?? new SmokeVerifier();
  const report = await smoker.verify(input.applied);
  if (!report.ok && !report.partialOk) {
    throw new StageError('DEPLOY_EXECUTOR_SMOKE_FAILED', 'smoke verification failed', report);
  }
  return { report, stackReport };
}

function verifyComposeStack(applyResult: DeploymentApplyResult): VerificationReport | null {
  const stack = applyResult.verificationHints.stack;
  if (stack === undefined) return null;
  const checks = (stack.inspections ?? []).map((inspection) => ({
    name: `workload ${inspection.serviceName}`,
    url: `dokploy:compose/${stack.composeId}/${inspection.serviceName}`,
    status: inspection.status,
    latencyMs: 0,
    ok: isComposeTaskHealthy(inspection),
    note: inspection.message ?? `status=${inspection.status} failedCount=${inspection.failedCount}`,
  }));
  if (checks.length === 0) return { checks: [], ok: true, partialOk: false };
  return { checks, ok: checks.every((c) => c.ok), partialOk: false };
}
