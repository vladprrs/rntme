import assert from 'node:assert/strict';
import type { ConformanceDeps, MarketingSiteProvisioner } from '../index.js';
import { provisionOrThrow } from './support.js';

/**
 * Canonical happy path for vendors that implement the marketing-site contract.
 *
 * The contract's first-class path is `project-folder` — the CLI packs the
 * declared folder into a deterministic tar.gz asset, and the deploy-runner
 * materializes that asset into a local file path BEFORE the provisioner
 * runs. From the provisioner's perspective, the input it sees is
 * `materialized-project-asset`, and it produces a target-agnostic
 * `staticSite` payload that the deploy target turns into a hosted resource.
 *
 * Legacy `s3` and `local-path` source kinds are NOT exercised here: they
 * predate the deploy-target-owned static hosting model and are kept in the
 * provisioner only until callers migrate.
 */
export async function runHappyPath(provisioner: MarketingSiteProvisioner, deps: ConformanceDeps): Promise<void> {
  const bundle = await deps.buildBundle({
    'index.html': '<h1>ok</h1>',
    'styles.css': 'body{color:#111}',
  });
  const out = await provisionOrThrow(provisioner, {
    publicConfig: {
      source: {
        kind: 'materialized-project-asset',
        assetPath: `assets/project-folders/marketing/${bundle.sha256}.tar.gz`,
        localPath: bundle.localPath,
        sha256: bundle.sha256,
      },
      primaryDomain: 'marketing.example.com',
      ssl: 'auto',
    } as never,
    targetSecrets: {},
    log: () => {},
    signal: new AbortController().signal,
  });

  const url = out.publicOutputs.url as { href: string };
  const deployedSha256 = out.publicOutputs.deployedSha256 as { value: string };
  assert.equal(url.href, 'https://marketing.example.com');
  assert.equal(deployedSha256.value, bundle.sha256);
  const staticSite = out.publicOutputs.staticSite as {
    kind: string;
    primaryDomain: string;
    ssl: string;
    sha256: string;
    files: Record<string, string>;
  };
  assert.equal(staticSite.kind, 'static-site-v1');
  assert.equal(staticSite.primaryDomain, 'marketing.example.com');
  assert.equal(staticSite.ssl, 'auto');
  assert.equal(staticSite.sha256, bundle.sha256);
  assert.ok(staticSite.files['index.html']?.includes('<h1>ok</h1>'));
  assert.ok(staticSite.files['styles.css']?.includes('color:#111'));

  // Target-agnostic guarantee: the project-folder/materialized path must not
  // depend on bundleStorage/registry/dokploy target secrets.
  assert.equal(Object.keys(out.secretOutputs).length, 0);
}
