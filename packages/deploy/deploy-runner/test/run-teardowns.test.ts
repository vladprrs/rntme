import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, mock, afterEach } from 'bun:test';
import type { ProvisionerContract } from '@rntme/deploy-core';

import { runTearDownsForDeployment } from '../src/run-teardowns.js';

/**
 * Create a temporary project directory with the given file tree.
 * Keys are relative paths; values are JSON-serialisable objects.
 */
function mkTempProject(files: Record<string, unknown>): string {
  const projectDir = mkdtempSync(join(tmpdir(), 'rntme-deploy-runner-'));
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(projectDir, relPath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, JSON.stringify(content), 'utf-8');
  }
  return projectDir;
}

// Track tmp dirs so we can clean them up after each test.
const tmpDirs: string[] = [];

function mkTrackedProject(files: Record<string, unknown>): string {
  const d = mkTempProject(files);
  tmpDirs.push(d);
  return d;
}

afterEach(async () => {
  for (const d of tmpDirs.splice(0)) {
    await rm(d, { recursive: true, force: true }).catch(() => undefined);
  }
});

// ─── helpers ────────────────────────────────────────────────────────────────

function identityModule() {
  return {
    'project.json': {
      name: 'demo',
      modules: { identity: { package: '@rntme/identity-auth0' } },
    },
    'node_modules/@rntme/identity-auth0/module.json': {
      name: '@rntme/identity-auth0',
      version: '1.0.0',
      category: 'identity',
      vendor: 'auth0',
      contract: 'identity/v1',
      capabilities: { rpcs: ['GetUser'], events: [] },
      provisioner: {
        entry: './dist/provisioner.js',
        produces: [{ name: 'spaClient', kind: 'single', secret: false }],
        requires: [{ name: 'auth0Mgmt', schema: 'auth0-mgmt-api-v1' }],
      },
    },
  };
}

function makeContract(overrides?: Partial<ProvisionerContract>): ProvisionerContract {
  return {
    provision: mock(async () => ({
      ok: true as const,
      publicOutputs: {},
      secretOutputs: {},
    })),
    tearDown: mock(async () => ({ ok: true as const })),
    ...overrides,
  } as unknown as ProvisionerContract;
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('runTearDownsForDeployment (runner)', () => {
  it('empty priorProvisionPublic → ok: true without calling resolveProvisioner', async () => {
    const resolveProvisioner = mock(async (_pkg: string, _entry: string, _dir: string) =>
      makeContract(),
    );

    const result = await runTearDownsForDeployment({
      bundleDir: '/does-not-matter',
      priorProvisionPublic: {},
      priorProvisionSecrets: {},
      deps: { resolveProvisioner },
    });

    expect(result.ok).toBe(true);
    expect(resolveProvisioner).not.toHaveBeenCalled();
  });

  it('happy path: single module with publicOutputs; tearDown called and succeeds', async () => {
    const bundleDir = mkTrackedProject(identityModule());
    const tearDownFn = mock(async () => ({ ok: true as const }));
    const contract = makeContract({ tearDown: tearDownFn });
    const resolveProvisioner = mock(async () => contract);

    const result = await runTearDownsForDeployment({
      bundleDir,
      priorProvisionPublic: {
        identity: { publicOutputs: { spaClientId: 'abc123' } },
      },
      priorProvisionSecrets: {},
      deps: { resolveProvisioner },
    });

    expect(result.ok).toBe(true);
    expect(resolveProvisioner).toHaveBeenCalledTimes(1);
    expect(tearDownFn).toHaveBeenCalledTimes(1);

    const callArg = (tearDownFn.mock.calls[0] as [{ priorOutputs: unknown }])[0];
    expect(callArg.priorOutputs).toEqual({
      publicOutputs: { spaClientId: 'abc123' },
      secretOutputs: {},
    });
  });

  it('tearDown returns { ok: false } → runner returns ok: false with error', async () => {
    const bundleDir = mkTrackedProject(identityModule());
    const contract = makeContract({
      tearDown: mock(async () => ({
        ok: false as const,
        errors: [{ code: 'AUTH0_CLIENT_NOT_FOUND', message: 'client gone' }],
      })),
    });
    const resolveProvisioner = mock(async () => contract);

    const result = await runTearDownsForDeployment({
      bundleDir,
      priorProvisionPublic: {
        identity: { publicOutputs: {} },
      },
      priorProvisionSecrets: {},
      deps: { resolveProvisioner },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toContain('tearDown[identity]');
      expect(result.errors[0]?.message).toContain('AUTH0_CLIENT_NOT_FOUND');
      expect(result.errors[0]?.message).toContain('client gone');
    }
  });

  it('throwing tearDown → runner catches and surfaces as error', async () => {
    const bundleDir = mkTrackedProject(identityModule());
    const contract = makeContract({
      tearDown: mock(async () => {
        throw new Error('network timeout');
      }),
    });
    const resolveProvisioner = mock(async () => contract);

    const result = await runTearDownsForDeployment({
      bundleDir,
      priorProvisionPublic: {
        identity: { publicOutputs: {} },
      },
      priorProvisionSecrets: {},
      deps: { resolveProvisioner },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toContain('tearDown[identity]');
      expect(result.errors[0]?.message).toContain('threw');
      expect(result.errors[0]?.message).toContain('network timeout');
    }
  });

  it('module in priorProvisionPublic without matching discovered module → silently skipped', async () => {
    // Bundle has no modules at all.
    const bundleDir = mkTrackedProject({
      'project.json': { name: 'demo', modules: {} },
    });
    const resolveProvisioner = mock(async () => makeContract());

    const result = await runTearDownsForDeployment({
      bundleDir,
      priorProvisionPublic: {
        identity: { publicOutputs: {} }, // key not in discovered modules
      },
      priorProvisionSecrets: {},
      deps: { resolveProvisioner },
    });

    expect(result.ok).toBe(true);
    expect(resolveProvisioner).not.toHaveBeenCalled();
  });

  it('module whose manifest has no provisioner block → silently skipped', async () => {
    const bundleDir = mkTrackedProject({
      'project.json': {
        name: 'demo',
        modules: { identity: { package: '@rntme/identity-auth0' } },
      },
      'node_modules/@rntme/identity-auth0/module.json': {
        name: '@rntme/identity-auth0',
        version: '1.0.0',
        category: 'identity',
        vendor: 'auth0',
        contract: 'identity/v1',
        capabilities: { rpcs: ['GetUser'], events: [] },
        // NOTE: no provisioner field
      },
    });
    const resolveProvisioner = mock(async () => makeContract());

    const result = await runTearDownsForDeployment({
      bundleDir,
      priorProvisionPublic: {
        identity: { publicOutputs: {} },
      },
      priorProvisionSecrets: {},
      deps: { resolveProvisioner },
    });

    expect(result.ok).toBe(true);
    expect(resolveProvisioner).not.toHaveBeenCalled();
  });

  it('contract without tearDown function → silently skipped', async () => {
    const bundleDir = mkTrackedProject(identityModule());
    const contract = { provision: mock(async () => ({ ok: true, publicOutputs: {}, secretOutputs: {} })) } as unknown as ProvisionerContract;
    const resolveProvisioner = mock(async () => contract);

    const result = await runTearDownsForDeployment({
      bundleDir,
      priorProvisionPublic: {
        identity: { publicOutputs: {} },
      },
      priorProvisionSecrets: {},
      deps: { resolveProvisioner },
    });

    expect(result.ok).toBe(true);
  });

  it('resolveProvisioner throws → error surfaces and processing continues for other modules', async () => {
    const bundleDir = mkTrackedProject({
      'project.json': {
        name: 'demo',
        modules: {
          identity: { package: '@rntme/identity-auth0' },
          storage: { package: '@rntme/storage-s3' },
        },
      },
      'node_modules/@rntme/identity-auth0/module.json': {
        name: '@rntme/identity-auth0',
        version: '1.0.0',
        category: 'identity',
        vendor: 'auth0',
        contract: 'identity/v1',
        capabilities: { rpcs: ['GetUser'], events: [] },
        provisioner: {
          entry: './provisioner.js',
          produces: [{ name: 'spaClient', kind: 'single', secret: false }],
          requires: [],
        },
      },
      'node_modules/@rntme/storage-s3/module.json': {
        name: '@rntme/storage-s3',
        version: '1.0.0',
        category: 'storage',
        vendor: 's3',
        contract: 'storage/v1',
        capabilities: { rpcs: ['GetBucket'], events: [] },
        provisioner: {
          entry: './provisioner.js',
          produces: [{ name: 'bucketName', kind: 'single', secret: false }],
          requires: [],
        },
      },
    });

    let callCount = 0;
    const resolveProvisioner = mock(async (pkg: string) => {
      callCount++;
      if (pkg === '@rntme/identity-auth0') throw new Error('module load failed');
      return makeContract();
    });

    const result = await runTearDownsForDeployment({
      bundleDir,
      priorProvisionPublic: {
        identity: { publicOutputs: {} },
        storage: { publicOutputs: {} },
      },
      priorProvisionSecrets: {},
      deps: { resolveProvisioner },
    });

    // identity failed, storage succeeded → overall failure
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.message).toContain('tearDown[identity]');
      expect(result.errors[0]?.message).toContain('resolveProvisioner failed');
    }
    // resolveProvisioner was called for both modules
    expect(callCount).toBe(2);
  });

  it('passes decrypted secret outputs into tearDown priorOutputs', async () => {
    const bundleDir = mkTrackedProject(identityModule());
    const tearDownFn = mock(async () => ({ ok: true as const }));
    const contract = makeContract({ tearDown: tearDownFn });
    const resolveProvisioner = mock(async () => contract);

    const result = await runTearDownsForDeployment({
      bundleDir,
      priorProvisionPublic: {
        identity: { publicOutputs: { spaClientId: 'abc' } },
      },
      priorProvisionSecrets: {
        identity: { secretOutputs: { clientSecret: 's3cr3t' } },
      },
      deps: { resolveProvisioner },
    });

    expect(result.ok).toBe(true);
    const callArg = (tearDownFn.mock.calls[0] as [{ priorOutputs: unknown }])[0];
    expect(callArg.priorOutputs).toEqual({
      publicOutputs: { spaClientId: 'abc' },
      secretOutputs: { clientSecret: 's3cr3t' },
    });
  });
});
