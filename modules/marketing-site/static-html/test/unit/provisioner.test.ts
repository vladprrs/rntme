import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, mock } from 'bun:test';
import { buildDeterministicTarGz, hashBuffer } from '@rntme/bundle-publish';
import { provisioner } from '../../src/provisioner.js';
import { makeBundle } from './helpers.js';

describe('provisioner.provision', () => {
  it('returns LOCAL_PATH_IN_PROD when source is local in prod target', async () => {
    const result = await provisioner.provision({
      publicConfig: { source: { kind: 'local-path', path: '/tmp/x', sha256: 'a'.repeat(64) }, primaryDomain: 'x.example.com', ssl: 'auto' },
      targetSecrets: { isProd: true, registry: { url: 'r' }, dokploy: { upsertDockerApp: mock() } },
      log: mock(),
      signal: new AbortController().signal,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('MARKETING_SITE_PROVISION_LOCAL_PATH_IN_PROD');
  });

  it('returns HASH_MISMATCH when local bundle bytes do not match declared sha256', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mksite-prov-'));
    const { bytes } = await makeBundle({ 'index.html': '<h1>hi</h1>' });
    const path = join(dir, 'bundle.tar.gz');
    writeFileSync(path, bytes);

    const result = await provisioner.provision({
      publicConfig: { source: { kind: 'local-path', path, sha256: 'd'.repeat(64) }, primaryDomain: 'x.example.com', ssl: 'auto' },
      targetSecrets: { isProd: false, registry: { url: 'localhost:5000', buildImage: mock() }, dokploy: { upsertDockerApp: mock() } },
      log: mock(),
      signal: new AbortController().signal,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('MARKETING_SITE_PROVISION_HASH_MISMATCH');
  });

  it('extracts, builds, upserts, and returns public outputs (legacy local-path)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mksite-prov-'));
    const { bytes, sha256 } = await makeBundle({ 'index.html': '<h1>hi</h1>' });
    const path = join(dir, 'bundle.tar.gz');
    writeFileSync(path, bytes);
    const buildImage = mock(async () => ({ ok: true as const, value: { imageRef: 'localhost:5000/x-example-com:abc1234' } }));
    const upsertDockerApp = mock(async () => ({ appId: 'app-1' }));

    const result = await provisioner.provision({
      publicConfig: { source: { kind: 'local-path', path, sha256 }, primaryDomain: 'x.example.com', ssl: 'auto' },
      targetSecrets: { isProd: false, registry: { url: 'localhost:5000', buildImage }, dokploy: { upsertDockerApp } },
      log: mock(),
      signal: new AbortController().signal,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.publicOutputs.url).toEqual({ href: 'https://x.example.com' });
      expect(result.value.publicOutputs.deployedSha256).toEqual({ value: sha256 });
    }
    expect(upsertDockerApp).toHaveBeenCalledWith({
      name: 'x-example-com',
      image: 'localhost:5000/x-example-com:abc1234',
      domain: 'x.example.com',
      ssl: 'auto',
    });
  });

  it('refuses to run when project-folder source has not been materialized by deploy-runner', async () => {
    const result = await provisioner.provision({
      publicConfig: { source: { kind: 'project-folder', path: 'landing' }, primaryDomain: 'mkt.example.com', ssl: 'auto' },
      targetSecrets: {},
      log: mock(),
      signal: new AbortController().signal,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe(
        'MARKETING_SITE_PROVISION_PROJECT_FOLDER_NOT_MATERIALIZED',
      );
    }
  });

  it('runs target-agnostic for materialized-project-asset source (no registry/dokploy secrets)', async () => {
    const folderDir = mkdtempSync(join(tmpdir(), 'mksite-folder-'));
    mkdirSync(folderDir, { recursive: true });
    writeFileSync(join(folderDir, 'index.html'), '<h1>cv extract</h1>');
    writeFileSync(join(folderDir, 'styles.css'), 'body{color:#111}');
    const tarGz = await buildDeterministicTarGz(folderDir, [], 8 * 1024 * 1024);
    const tarDir = mkdtempSync(join(tmpdir(), 'mksite-tar-'));
    const tarPath = join(tarDir, 'landing.tar.gz');
    writeFileSync(tarPath, tarGz);
    const sha = hashBuffer(tarGz);

    const result = await provisioner.provision({
      publicConfig: {
        source: {
          kind: 'materialized-project-asset',
          assetPath: `assets/project-folders/marketing/${sha}.tar.gz`,
          localPath: tarPath,
          sha256: sha,
        },
        primaryDomain: 'mkt.example.com',
        ssl: 'auto',
      } as never, // internal-only source variant injected by deploy-runner
      targetSecrets: {},
      log: mock(),
      signal: new AbortController().signal,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.publicOutputs.url).toEqual({ href: 'https://mkt.example.com' });
    expect(result.value.publicOutputs.deployedSha256).toEqual({ value: sha });
    const staticSite = result.value.publicOutputs.staticSite as {
      kind: string;
      primaryDomain: string;
      sha256: string;
      ssl: string;
      files: Record<string, string>;
    };
    expect(staticSite.kind).toBe('static-site-v1');
    expect(staticSite.primaryDomain).toBe('mkt.example.com');
    expect(staticSite.ssl).toBe('auto');
    expect(staticSite.sha256).toBe(sha);
    expect(staticSite.files['index.html']).toContain('cv extract');
    expect(staticSite.files['styles.css']).toContain('color:#111');
  });

  it('returns TARGET_SECRETS_MISSING for legacy s3 source when registry/dokploy missing', async () => {
    const result = await provisioner.provision({
      publicConfig: {
        source: { kind: 's3', bucket: 'b', key: 'k', sha256: 'a'.repeat(64) },
        primaryDomain: 'mkt.example.com',
        ssl: 'auto',
      },
      targetSecrets: {},
      log: mock(),
      signal: new AbortController().signal,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('MARKETING_SITE_PROVISION_TARGET_SECRETS_MISSING');
    }
  });
});
