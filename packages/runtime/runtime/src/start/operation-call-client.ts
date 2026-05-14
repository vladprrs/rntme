import type { OperationCallClient } from '@rntme/graph-ir-compiler';
import type { ExternalAdapterClient, RetryPolicy } from '../plugins/interfaces.js';
import { DEFAULT_RETRY, DEFAULT_TIMEOUT_MS } from '../plugins/interfaces.js';

export function toOperationCallClient(client: ExternalAdapterClient): OperationCallClient {
  return {
    async call(input) {
      const target = input.target.target;
      if (!('module' in target)) {
        return {
          ok: false,
          error: {
            code: 'EXTERNAL_SERVICE_CALL_UNSUPPORTED',
            message: 'service-to-service call targets are not supported by the runtime adapter client',
          },
        };
      }
      const result = await client.call(target.module, target.operation, input.payload, {
        idempotencyKey: input.idempotencyKey ?? '',
        timeoutMs: input.policy.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        retry: retryPolicyFromCallPolicy(input.policy.retry),
        correlationId: input.correlationId,
      });
      if (result.ok) return { ok: true, value: result.value };
      const first = result.errors[0];
      return {
        ok: false,
        error: {
          code: first?.code ?? 'EXTERNAL_MODULE_INTERNAL',
          message: first?.message ?? 'external module call failed',
          detail: first?.detail,
        },
      };
    },
  };
}

function retryPolicyFromCallPolicy(
  retry: Parameters<OperationCallClient['call']>[0]['policy']['retry'],
): RetryPolicy {
  return {
    ...DEFAULT_RETRY,
    ...(retry?.attempts === undefined ? {} : { attempts: retry.attempts }),
    ...(retry?.retryOn === undefined ? {} : { retryOn: retry.retryOn }),
  };
}
