import assert from 'node:assert/strict';
import type { ConformanceDeps, MarketingSiteProvisioner } from '../index.js';
import { targetSecretsFor } from './support.js';

export async function runHashMismatch(provisioner: MarketingSiteProvisioner, deps: ConformanceDeps): Promise<void> {
  const bundle = await deps.buildBundle({ 'index.html': '<h1>bad</h1>' });
  const result = await provisioner.provision({
    publicConfig: {
      source: { kind: 's3', bucket: bundle.bucket, key: bundle.key, sha256: 'd'.repeat(64) },
      primaryDomain: 'bad.example.com',
      ssl: 'auto',
    },
    targetSecrets: targetSecretsFor(bundle, deps),
    log: () => {},
    signal: new AbortController().signal,
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errors[0]?.code, 'MARKETING_SITE_PROVISION_HASH_MISMATCH');
}
