import { describe, expect, it } from 'vitest';
import * as contract from '../../src/index.js';

describe('@rntme/contracts-provisioner-v1', () => {
  it('exposes a stable VERSION constant', () => {
    expect(contract.VERSION).toBe('1.0.0');
  });

  it('compiles a ProvisionerContract value against the runtime contract types', () => {
    // Runtime smoke test: the package is types-only, so the meaningful guarantee
    // is that a value satisfying ProvisionerContract typechecks. If the contract
    // shape regresses, this file fails to compile (caught in `vitest run`).
    const c: contract.ProvisionerContract<{ a: string }> = {
      async provision(input) {
        input.log({ step: 'noop', level: 'info', message: 'ok' });
        return { ok: true, value: { publicOutputs: {}, secretOutputs: {} } };
      },
    };
    expect(typeof c.provision).toBe('function');
  });

  it('accepts an env-mapping object shaped against ProvisionerEnvMapping', () => {
    const m: contract.ProvisionerEnvMapping = {
      'identity-acme': [
        { from: 'spaClient.id', envName: 'ACME_SPA_CLIENT_ID', secret: false, target: 'app' },
      ],
    };
    expect(Object.keys(m)).toContain('identity-acme');
  });
});
