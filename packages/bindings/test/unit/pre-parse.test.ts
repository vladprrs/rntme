import { describe, it, expect } from 'vitest';
import { BindingArtifactSchema } from '../../src/parse/schema.js';

const baseCommand = {
  kind: 'command',
  graph: 'createOrder',
  target: { engine: 'graph-ir', dialect: 'sqlite' },
  http: { method: 'POST', path: '/orders', parameters: [] },
};

describe('pre[] parsing', () => {
  it('accepts command binding with empty pre[]', () => {
    const r = BindingArtifactSchema.safeParse({
      version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q',
      bindings: { createOrder: { ...baseCommand, pre: [] } },
    });
    expect(r.success).toBe(true);
  });

  it('accepts system.randomBytes step', () => {
    const r = BindingArtifactSchema.safeParse({
      version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q',
      bindings: {
        createOrder: {
          ...baseCommand,
          pre: [{ kind: 'system', op: 'randomBytes', bytes: 32, bindAs: 'nonce' }],
        },
      },
    });
    expect(r.success).toBe(true);
  });

  it('accepts module-rpc step with expression template', () => {
    const r = BindingArtifactSchema.safeParse({
      version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q',
      bindings: {
        createOrder: {
          ...baseCommand,
          pre: [{
            kind: 'module-rpc',
            module: 'payments',
            rpc: 'CreateCheckoutSession',
            input: { customerId: '$auth.userId', amount: '$body.amount' },
            bindAs: 'session',
            timeoutMs: 1500,
            retry: { attempts: 2, backoffMs: 'exp', retryOn: 'transient' },
          }],
        },
      },
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown step kind', () => {
    const r = BindingArtifactSchema.safeParse({
      version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q',
      bindings: {
        createOrder: {
          ...baseCommand,
          pre: [{ kind: 'bogus', bindAs: 'x' }],
        },
      },
    });
    expect(r.success).toBe(false);
  });

  it('rejects bytes out of range', () => {
    for (const bytes of [0, 1025]) {
      const r = BindingArtifactSchema.safeParse({
        version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q',
        bindings: {
          createOrder: {
            ...baseCommand,
            pre: [{ kind: 'system', op: 'randomBytes', bytes, bindAs: 'nonce' }],
          },
        },
      });
      expect(r.success).toBe(false);
    }
  });

  it('rejects timeoutMs > 30_000', () => {
    const r = BindingArtifactSchema.safeParse({
      version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q',
      bindings: {
        createOrder: {
          ...baseCommand,
          pre: [{
            kind: 'module-rpc',
            module: 'payments',
            rpc: 'CreateCheckoutSession',
            input: {},
            bindAs: 'session',
            timeoutMs: 30_001,
          }],
        },
      },
    });
    expect(r.success).toBe(false);
  });

  it('rejects invalid retryOn value', () => {
    const r = BindingArtifactSchema.safeParse({
      version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q',
      bindings: {
        createOrder: {
          ...baseCommand,
          pre: [{
            kind: 'module-rpc',
            module: 'payments',
            rpc: 'CreateCheckoutSession',
            input: {},
            bindAs: 'session',
            retry: { retryOn: 'sometimes' },
          }],
        },
      },
    });
    expect(r.success).toBe(false);
  });

  it('rejects missing required field (bindAs)', () => {
    const r = BindingArtifactSchema.safeParse({
      version: '1.0', graphSpecRef: 'g', pdmRef: 'p', qsmRef: 'q',
      bindings: {
        createOrder: {
          ...baseCommand,
          pre: [{ kind: 'system', op: 'randomBytes', bytes: 32 }],
        },
      },
    });
    expect(r.success).toBe(false);
  });
});
