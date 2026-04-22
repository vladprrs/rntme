import { randomBytes } from 'node:crypto';
import type { PreStep } from '@rntme/bindings';
import type { ExternalAdapterClient } from '@rntme/runtime';
import type { RetryPolicy as RuntimeRetryPolicy } from '@rntme/runtime';
import { DEFAULT_RETRY, DEFAULT_TIMEOUT_MS } from '@rntme/runtime';
import { evaluateExpression, type ExpressionScope } from './expression.js';
import { deriveStepKey } from '../idempotency/derive-keys.js';
import type { PreStepsResult } from './types.js';

export type RunPreStepsOpts = {
  scope: Omit<ExpressionScope, 'pre' | 'system'>;
  adapterClient: ExternalAdapterClient;
  runId: string;
  correlationId: string;
  logger: (evt: Record<string, unknown>) => void;
};

export async function runPreSteps(pre: PreStep[], opts: RunPreStepsOpts): Promise<PreStepsResult> {
  const pre_acc: Record<string, unknown> = {};
  const system_acc: Record<string, unknown> = {};

  for (let i = 0; i < pre.length; i++) {
    const step = pre[i]!;
    const fullScope: ExpressionScope = { ...opts.scope, pre: pre_acc, system: system_acc };

    if (step.kind === 'system') {
      const value = performSystemOp(step.op, step.bytes);
      system_acc[step.bindAs] = value;
      pre_acc[step.bindAs] = value;
      opts.logger({ pre_step: 'system', index: i, op: step.op, bindAs: step.bindAs });
      continue;
    }

    // module-rpc
    let resolvedInput: unknown;
    try {
      resolvedInput = evaluateExpression(step.input, fullScope);
    } catch (e) {
      return {
        ok: false,
        httpStatus: 500,
        body: { code: 'BINDINGS_RUNTIME_EXPRESSION_ERROR', message: e instanceof Error ? e.message : String(e) },
      };
    }

    const idempotencyKey = deriveStepKey(opts.runId, i);
    const timeoutMs = step.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const retry: RuntimeRetryPolicy = {
      attempts: step.retry?.attempts ?? DEFAULT_RETRY.attempts,
      backoffMs: step.retry?.backoffMs ?? DEFAULT_RETRY.backoffMs,
      retryOn: step.retry?.retryOn ?? DEFAULT_RETRY.retryOn,
    };

    const result = await opts.adapterClient.call(step.module, step.rpc, resolvedInput, {
      idempotencyKey, timeoutMs, retry, correlationId: opts.correlationId,
    });

    if (!result.ok) {
      const body = result.error.code === 'EXTERNAL_VENDOR_DOMAIN'
        ? { code: result.error.domainCode ?? 'EXTERNAL_VENDOR_DOMAIN', message: result.error.message }
        : { code: result.error.code, message: result.error.message };
      opts.logger({
        pre_step: 'module-rpc',
        index: i,
        module: step.module, rpc: step.rpc,
        bindAs: step.bindAs,
        result: 'error',
        code: result.error.code,
        http_status: result.error.httpStatus,
      });
      return { ok: false, httpStatus: result.error.httpStatus, body };
    }

    pre_acc[step.bindAs] = result.value;
    opts.logger({
      pre_step: 'module-rpc',
      index: i, module: step.module, rpc: step.rpc, bindAs: step.bindAs, result: 'ok',
    });
  }

  return { ok: true, systemFields: { ...system_acc, pre: pre_acc } };
}

function performSystemOp(op: 'randomBytes', bytes: number): string {
  if (op === 'randomBytes') return randomBytes(bytes).toString('base64url');
  throw new Error(`unsupported system op: ${op as string}`);
}
