import { randomBytes } from 'node:crypto';
import { bindAsName, type PreStep } from '@rntme/bindings';
import type { ExternalAdapterClient, RetryPolicy } from '../runtime-contract.js';
import { DEFAULT_RETRY, DEFAULT_TIMEOUT_MS } from '../runtime-contract.js';
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
    const bindName = bindAsName(step.bindAs);

    if (step.kind === 'system') {
      const value = performSystemOp(step.op, step.bytes);
      system_acc[bindName] = value;
      pre_acc[bindName] = value;
      opts.logger({ pre_step: 'system', index: i, op: step.op, bindAs: bindName });
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
    const retry: RetryPolicy = {
      attempts: step.retry?.attempts ?? DEFAULT_RETRY.attempts,
      backoffMs: step.retry?.backoffMs ?? DEFAULT_RETRY.backoffMs,
      retryOn: step.retry?.retryOn ?? DEFAULT_RETRY.retryOn,
    };

    const result = await opts.adapterClient.call(step.module, step.rpc, resolvedInput, {
      idempotencyKey, timeoutMs, retry, correlationId: opts.correlationId,
    });

    if (!result.ok) {
      const firstError = result.errors[0]!;
      const body = firstError.code === 'EXTERNAL_VENDOR_DOMAIN'
        ? { code: firstError.domainCode ?? 'EXTERNAL_VENDOR_DOMAIN', message: firstError.message }
        : { code: firstError.code, message: firstError.message };
      opts.logger({
        pre_step: 'module-rpc',
        index: i,
        module: step.module, rpc: step.rpc,
        bindAs: bindName,
        result: 'error',
        code: firstError.code,
        http_status: firstError.httpStatus,
      });
      return { ok: false, httpStatus: firstError.httpStatus, body };
    }

    pre_acc[bindName] = result.value;
    opts.logger({
      pre_step: 'module-rpc',
      index: i, module: step.module, rpc: step.rpc, bindAs: bindName, result: 'ok',
    });
  }

  return { ok: true, systemFields: { ...system_acc, pre: pre_acc } };
}

function performSystemOp(op: 'randomBytes', bytes: number): string {
  if (op === 'randomBytes') return randomBytes(bytes).toString('base64url');
  throw new Error(`unsupported system op: ${op as string}`);
}
