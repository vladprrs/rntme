import assert from 'node:assert/strict';
import type { ConformanceDeps, MarketingSiteProvisioner } from '../index.js';
import { provisionOrThrow } from './support.js';

export async function runIdempotency(provisioner: MarketingSiteProvisioner, deps: ConformanceDeps): Promise<void> {
  const bundle = await deps.buildBundle({ 'index.html': '<h1>same</h1>' });
  const input = {
    publicConfig: {
      source: {
        kind: 'materialized-project-asset' as const,
        assetPath: `assets/project-folders/marketing/${bundle.sha256}.tar.gz`,
        localPath: bundle.localPath,
        sha256: bundle.sha256,
      },
      primaryDomain: 'same.example.com',
      ssl: 'auto' as const,
    } as never,
    targetSecrets: {},
    log: () => {},
    signal: new AbortController().signal,
  };

  const first = await provisionOrThrow(provisioner, input);
  const second = await provisionOrThrow(provisioner, input);

  const firstUrl = first.publicOutputs.url as { href: string };
  const secondUrl = second.publicOutputs.url as { href: string };
  const firstSha = first.publicOutputs.deployedSha256 as { value: string };
  const secondSha = second.publicOutputs.deployedSha256 as { value: string };
  assert.equal(secondUrl.href, firstUrl.href);
  assert.equal(secondSha.value, firstSha.value);
}
