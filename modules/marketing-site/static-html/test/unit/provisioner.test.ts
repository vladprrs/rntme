import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { provisioner } from '../../src/provisioner.js';
import { makeBundle } from './helpers.js';

describe('provisioner.provision', () => {
  it('returns LOCAL_PATH_IN_PROD when source is local in prod target', async () => {
    const result = await provisioner.provision({
      publicConfig: { source: { kind: 'local-path', path: '/tmp/x', sha256: 'a'.repeat(64) }, primaryDomain: 'x.example.com', ssl: 'auto' },
      targetSecrets: { isProd: true, registry: { url: 'r' }, dokploy: { upsertDockerApp: vi.fn() } },
      log: vi.fn(),
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
      targetSecrets: { isProd: false, registry: { url: 'localhost:5000', buildImage: vi.fn() }, dokploy: { upsertDockerApp: vi.fn() } },
      log: vi.fn(),
      signal: new AbortController().signal,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('MARKETING_SITE_PROVISION_HASH_MISMATCH');
  });

  it('extracts, builds, upserts, and returns public outputs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mksite-prov-'));
    const { bytes, sha256 } = await makeBundle({ 'index.html': '<h1>hi</h1>' });
    const path = join(dir, 'bundle.tar.gz');
    writeFileSync(path, bytes);
    const buildImage = vi.fn(async () => ({ ok: true as const, value: { imageRef: 'localhost:5000/x-example-com:abc1234' } }));
    const upsertDockerApp = vi.fn(async () => ({ appId: 'app-1' }));

    const result = await provisioner.provision({
      publicConfig: { source: { kind: 'local-path', path, sha256 }, primaryDomain: 'x.example.com', ssl: 'auto' },
      targetSecrets: { isProd: false, registry: { url: 'localhost:5000', buildImage }, dokploy: { upsertDockerApp } },
      log: vi.fn(),
      signal: new AbortController().signal,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.publicOutputs.url).toBe('https://x.example.com');
      expect(result.value.publicOutputs.deployedSha256).toBe(sha256);
    }
    expect(upsertDockerApp).toHaveBeenCalledWith({
      name: 'x-example-com',
      image: 'localhost:5000/x-example-com:abc1234',
      domain: 'x.example.com',
      ssl: 'auto',
    });
  });
});
