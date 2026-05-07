import assert from 'node:assert/strict';
import type { ConformanceDeps, MarketingSiteProvisioner } from '../index.js';
import { provisionOrThrow, targetSecretsFor } from './support.js';

export async function runIdempotency(provisioner: MarketingSiteProvisioner, deps: ConformanceDeps): Promise<void> {
  const bundle = await deps.buildBundle({ 'index.html': '<h1>same</h1>' });
  const input = {
    publicConfig: {
      source: { kind: 's3' as const, bucket: bundle.bucket, key: bundle.key, sha256: bundle.sha256 },
      primaryDomain: 'same.example.com',
      ssl: 'auto' as const,
    },
    targetSecrets: targetSecretsFor(bundle, deps),
    log: () => {},
    signal: new AbortController().signal,
  };

  const first = await provisionOrThrow(provisioner, input);
  const second = await provisionOrThrow(provisioner, input);

  assert.equal(second.publicOutputs.url, first.publicOutputs.url);
  assert.equal(second.publicOutputs.deployedSha256, first.publicOutputs.deployedSha256);
}
