import assert from 'node:assert/strict';
import type { ConformanceDeps, MarketingSiteProvisioner } from '../index.js';
import { provisionOrThrow, targetSecretsFor } from './support.js';

export async function runHappyPath(provisioner: MarketingSiteProvisioner, deps: ConformanceDeps): Promise<void> {
  const bundle = await deps.buildBundle({ 'index.html': '<h1>ok</h1>' });
  const out = await provisionOrThrow(provisioner, {
    publicConfig: {
      source: { kind: 's3', bucket: bundle.bucket, key: bundle.key, sha256: bundle.sha256 },
      primaryDomain: 'marketing.example.com',
      ssl: 'auto',
    },
    targetSecrets: targetSecretsFor(bundle, deps),
    log: () => {},
    signal: new AbortController().signal,
  });

  assert.equal(out.publicOutputs.url, 'https://marketing.example.com');
  assert.equal(out.publicOutputs.deployedSha256, bundle.sha256);
}
