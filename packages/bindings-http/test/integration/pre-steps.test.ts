import { describe, it, expect } from 'vitest';
import { runPreSteps } from '../../src/pre/run-pre-steps.js';
import type { ExternalAdapterClient } from '../../src/runtime-contract.js';

const fakeAdapter: ExternalAdapterClient = {
  async call(module, rpc, input, opts) {
    if (module === 'identity' && rpc === 'EchoInput') {
      return { ok: true, value: input };
    }
    if (module === 'payments' && rpc === 'CreateCustomer')
      return { ok: true, value: { id: `cust-${opts.idempotencyKey.slice(0, 4)}` } };
    if (module === 'payments' && rpc === 'ChargeCard')
      return { ok: false, errors: [{ code: 'EXTERNAL_VENDOR_DOMAIN', message: 'PAYMENTS_CARD_DECLINED: card declined', domainCode: 'PAYMENTS_CARD_DECLINED', httpStatus: 409 }] };
    if (module === 'identity' && rpc === 'IntrospectSession') {
      return {
        ok: true,
        value: {
          session_id: 's1',
          status: 3,
          user_id: 'u1',
          vendor_raw: { deactivation_reason: 'TOKEN_EXPIRED' },
        },
      };
    }
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

  it('returns 401 auth-token-invalid with deactivation reason when IntrospectSession Session is non-ACTIVE', async () => {
    const out = await runPreSteps(
      [{ kind: 'module-rpc', module: 'identity', rpc: 'IntrospectSession', input: {}, bindAs: 'session' }],
      {
        scope: { body: {}, query: {}, auth: {}, config: {} },
        adapterClient: fakeAdapter,
        runId: 'run-3',
        correlationId: 'corr-3',
        logger: () => {},
      },
    );
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.httpStatus).toBe(401);
      expect(out.body).toEqual({
        code: 'RUNTIME_AUTH_TOKEN_INVALID',
        message: 'authentication required',
        reason: 'TOKEN_EXPIRED',
      });
    }
  });

  it('resolves bearer authorization header into IntrospectSession token input', async () => {
    let capturedInput: unknown;
    const adapter: ExternalAdapterClient = {
      async call(module, rpc, input) {
        capturedInput = input;
        if (module === 'identity' && rpc === 'IntrospectSession') {
          return { ok: true, value: { session_id: 's1', status: 1, user_id: 'auth0|alice' } };
        }
        return { ok: false, errors: [{ code: 'EXTERNAL_MODULE_SCHEMA_MISMATCH', message: 'unknown rpc', httpStatus: 500 }] };
      },
    };

    const out = await runPreSteps(
      [
        {
          kind: 'module-rpc',
          module: 'identity',
          rpc: 'IntrospectSession',
          input: { token: '$header.authorization', audience: 'https://notes-demo.rntme.com/api' },
          bindAs: 'session',
        },
      ],
      {
        scope: {
          body: {},
          query: {},
          auth: {},
          config: {},
          header: { authorization: 'Bearer header.jwt.token' },
        },
        adapterClient: adapter,
        runId: 'run-4',
        correlationId: 'corr-4',
        logger: () => {},
      },
    );

    expect(out.ok).toBe(true);
    expect(capturedInput).toEqual({
      token: 'Bearer header.jwt.token',
      audience: 'https://notes-demo.rntme.com/api',
    });
  });
});
