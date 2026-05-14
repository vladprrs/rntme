import { describe, expect, it } from 'bun:test';
import type { OperationCallClient } from '@rntme/graph-ir-compiler';
import type { AdapterCallOptions, ExternalAdapterClient } from '../../src/plugins/adapter-client/types.js';
import { toOperationCallClient } from '../../src/start/operation-call-client.js';

describe('toOperationCallClient', () => {
  it('maps graph call policy to adapter timeout and retry options', async () => {
    let seenOptions: AdapterCallOptions | undefined;
    const adapter: ExternalAdapterClient = {
      async call(_module, _rpc, _input, opts) {
        seenOptions = opts;
        return { ok: true, value: { ok: true } };
      },
    };
    const client: OperationCallClient = toOperationCallClient(adapter);

    await client.call({
      target: {
        id: 'module:openrouter.Complete',
        target: { module: 'openrouter', operation: 'Complete' },
        effect: 'read',
        idempotency: 'none',
        inputShape: 'CompletionRequest',
        outputShape: 'CompletionResponse',
      },
      payload: { prompt: 'extract' },
      idempotencyKey: null,
      correlationId: 'corr-1',
      policy: {
        timeoutMs: 30000,
        retry: { attempts: 1, retryOn: 'never' },
        onError: 'fail',
      },
    });

    expect(seenOptions).toEqual({
      idempotencyKey: '',
      timeoutMs: 30000,
      retry: { attempts: 1, backoffMs: 'exp', retryOn: 'never' },
      correlationId: 'corr-1',
    });
  });
});
