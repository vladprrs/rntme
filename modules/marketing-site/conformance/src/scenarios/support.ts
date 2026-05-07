import assert from 'node:assert/strict';
import type { ConformanceDeps, MarketingSiteProvisioner } from '../index.js';

export function targetSecretsFor(bundle: { bytes: Buffer }, deps: ConformanceDeps) {
  return {
    isProd: false,
    bundleStorage: {
      s3: {
        accessKeyId: 'test',
        secretAccessKey: 'test',
        client: { send: async () => ({ Body: { transformToByteArray: async () => bundle.bytes } }) },
      },
    },
    registry: {
      url: deps.fakeRegistry.url,
      buildImage: async (input: { imageRef: string }) => ({ ok: true as const, value: { imageRef: input.imageRef } }),
    },
    dokploy: deps.fakeDokploy,
  };
}

export async function provisionOrThrow(provisioner: MarketingSiteProvisioner, input: Parameters<MarketingSiteProvisioner['provision']>[0]) {
  const result = await provisioner.provision(input);
  assert.equal(result.ok, true, result.ok ? '' : JSON.stringify(result.errors));
  return result.value;
}
