import { describe, expectTypeOf, it } from 'vitest';
import type { ProvisionerInput } from '../src/provisioner-contract.js';

describe('ProvisionerInput.serviceArtifacts', () => {
  it('is optional and opaque', () => {
    expectTypeOf<ProvisionerInput<unknown>>().toHaveProperty('serviceArtifacts');
    expectTypeOf<ProvisionerInput<unknown>['serviceArtifacts']>().toEqualTypeOf<
      Readonly<Record<string, unknown>> | undefined
    >();
  });

  it('absent serviceArtifacts is a valid input (backwards compatibility)', () => {
    const input: ProvisionerInput<{ x: number }> = {
      publicConfig: { x: 1 },
      targetSecrets: {},
      log: () => undefined,
      signal: new AbortController().signal,
    };
    expectTypeOf(input).not.toBeNullable();
  });
});
