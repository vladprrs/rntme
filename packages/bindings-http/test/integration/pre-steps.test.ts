import { describe, it, expect } from 'vitest';
import { runPreSteps } from '../../src/pre/run-pre-steps.js';
import type { ExternalAdapterClient } from '../../src/runtime-contract.js';

const fakeAdapter: ExternalAdapterClient = {
  async call(module, rpc, input, opts) {
    if (module === 'payments' && rpc === 'CreateCustomer')
      return { ok: true, value: { id: `cust-${opts.idempotencyKey.slice(0, 4)}` } };
    if (module === 'payments' && rpc === 'ChargeCard')
      return { ok: false, errors: [{ code: 'EXTERNAL_VENDOR_DOMAIN', message: 'PAYMENTS_CARD_DECLINED: card declined', domainCode: 'PAYMENTS_CARD_DECLINED', httpStatus: 409 }] };
    return { ok: false, errors: [{ code: 'EXTERNAL_MODULE_SCHEMA_MISMATCH', message: 'unknown rpc', httpStatus: 500 }] };
  },
};

describe('runPreSteps', () => {
  it('runs two steps, binding pre[1] input against pre[0].result', async () => {
    const out = await runPreSteps(
      [
        { kind: 'system', op: 'randomBytes', bytes: 8, bindAs: 'nonce' },
        { kind: 'module-rpc', module: 'payments', rpc: 'CreateCustomer',
          input: { nonce: '$pre.nonce', email: '$auth.email' }, bindAs: 'customer' },
      ],
      {
        scope: { body: {}, query: {}, auth: { email: 'u@x' }, config: {} },
        adapterClient: fakeAdapter,
        runId: 'run-1',
        correlationId: 'corr-1',
        logger: () => {},
      },
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect((out.systemFields.pre.customer as { id: string }).id).toContain('cust-');
  });

  it('returns mapped HTTP status on terminal module error', async () => {
    const out = await runPreSteps(
      [
        { kind: 'module-rpc', module: 'payments', rpc: 'ChargeCard',
          input: {}, bindAs: 'charge' },
      ],
      {
        scope: { body: {}, query: {}, auth: {}, config: {} },
        adapterClient: fakeAdapter,
        runId: 'run-2',
        correlationId: 'corr-2',
        logger: () => {},
      },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.httpStatus).toBe(409);
      expect(out.body.code).toBe('PAYMENTS_CARD_DECLINED');
    }
  });
});
