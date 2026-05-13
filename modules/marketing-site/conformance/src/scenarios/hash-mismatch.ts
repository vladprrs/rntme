import assert from 'node:assert/strict';
import type { ConformanceDeps, MarketingSiteProvisioner } from '../index.js';

export async function runHashMismatch(provisioner: MarketingSiteProvisioner, deps: ConformanceDeps): Promise<void> {
  const bundle = await deps.buildBundle({ 'index.html': '<h1>bad</h1>' });
  const result = await provisioner.provision({
    publicConfig: {
      source: {
        kind: 'materialized-project-asset',
        assetPath: `assets/project-folders/marketing/${'d'.repeat(64)}.tar.gz`,
        localPath: bundle.localPath,
        sha256: 'd'.repeat(64),
      },
      primaryDomain: 'bad.example.com',
      ssl: 'auto',
    } as never,
    targetSecrets: {},
    log: () => {},
    signal: new AbortController().signal,
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.errors[0]?.code, 'MARKETING_SITE_PROVISION_HASH_MISMATCH');
}
