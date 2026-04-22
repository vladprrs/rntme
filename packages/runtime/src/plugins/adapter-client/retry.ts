import type { AdapterResult, RetryPolicy, AdapterErrorCode } from './types.js';

const TRANSIENT_CODES: ReadonlySet<AdapterErrorCode> = new Set<AdapterErrorCode>([
  'EXTERNAL_MODULE_TIMEOUT',
  'EXTERNAL_MODULE_UNAVAILABLE',
  'EXTERNAL_MODULE_OVERLOAD',
  'EXTERNAL_MODULE_INTERNAL',
]);

export type OnAttempt = (attempt: number, result: AdapterResult, delayMs: number) => void;

export async function withRetry(
  call: () => Promise<AdapterResult>,
  policy: RetryPolicy,
  onAttempt: OnAttempt,
): Promise<AdapterResult> {
  let lastResult: AdapterResult = { ok: false, error: { code: 'EXTERNAL_MODULE_INTERNAL', message: 'no attempts', httpStatus: 502 } };
  for (let attempt = 1; attempt <= policy.attempts; attempt++) {
    lastResult = await call();
    if (lastResult.ok) return lastResult;

    const shouldRetry = policy.retryOn === 'all'
      || (policy.retryOn === 'transient' && TRANSIENT_CODES.has(lastResult.error.code));
    const atLimit = attempt === policy.attempts;
    if (!shouldRetry || atLimit) {
      onAttempt(attempt, lastResult, 0);
      return lastResult;
    }
    const delayMs = nextDelay(attempt, policy.backoffMs);
    onAttempt(attempt, lastResult, delayMs);
    if (delayMs > 0) await sleep(delayMs);
  }
  return lastResult;
}

function nextDelay(attempt: number, backoffMs: 'exp' | number): number {
  if (backoffMs === 'exp') return Math.min(50 * 2 ** (attempt - 1), 2000);
  return backoffMs;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
