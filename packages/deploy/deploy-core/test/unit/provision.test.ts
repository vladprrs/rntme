import { describe, expect, it, vi } from 'vitest';
import { runProvisioners, type DiscoveredProvisionerModule } from '../../src/provision.js';
import type { ProvisionerContract } from '../../src/provisioner-contract.js';
import { ok, err } from '../../src/result.js';

const baseModule = (overrides: Partial<DiscoveredProvisionerModule> = {}): DiscoveredProvisionerModule => ({
  projectKey: 'identity-auth0',
  packageName: '@rntme/identity-auth0',
  manifest: {
    name: '@rntme/identity-auth0',
    version: '1.0.0',
    provisioner: {
      entry: './dist/provisioner.js',
      produces: [
        { name: 'spaClient', kind: 'single', secret: false },
        { name: 'm2mClients', kind: 'many', secret: true },
      ],
      requires: [{ name: 'auth0Mgmt', schema: 'auth0-mgmt-api-v1' }],
    },
  },
  publicConfig: { redirectUri: 'https://x.example/' },
  ...overrides,
});

const happyContract: ProvisionerContract = {
  async provision() {
    return ok({
      publicOutputs: { spaClient: { id: 'cid', name: 'app' } },
      secretOutputs: { m2mClients: [{ name: 'svc', clientId: 'mid', clientSecret: 'sss' }] },
    });
  },
};

describe('runProvisioners', () => {
  it('skips modules without provisioner block', async () => {
    const result = await runProvisioners({
      modules: [{ ...baseModule(), manifest: { name: 'x', version: '1.0.0' } }],
      resolvedTargetSecrets: {},
      projectDir: '/tmp/test',
      resolveProvisioner: async (_pkg, _entry, _projectDir) => happyContract,
      log: () => undefined,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.modules).toHaveLength(0);
  });

  it('returns aggregated outputs on happy path', async () => {
    const result = await runProvisioners({
      modules: [baseModule()],
      resolvedTargetSecrets: { auth0Mgmt: { tenantDomain: 'x', mgmtClientId: 'a', mgmtClientSecret: 'b' } },
      projectDir: '/tmp/test',
      resolveProvisioner: async (_pkg, _entry, _projectDir) => happyContract,
      log: () => undefined,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.modules).toHaveLength(1);
      expect(result.value.modules[0]?.publicOutputs).toEqual({ spaClient: { id: 'cid', name: 'app' } });
      expect(result.value.modules[0]?.secretOutputs).toEqual({
        m2mClients: [{ name: 'svc', clientId: 'mid', clientSecret: 'sss' }],
      });
    }
  });

  it('fails fast when required target secret is missing', async () => {
    const result = await runProvisioners({
      modules: [baseModule()],
      resolvedTargetSecrets: {},
      projectDir: '/tmp/test',
      resolveProvisioner: async (_pkg, _entry, _projectDir) => happyContract,
      log: () => undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('DEPLOY_PROVISION_TARGET_SECRET_MISSING');
    }
  });

  it('rejects output missing a declared produces name', async () => {
    const result = await runProvisioners({
      modules: [baseModule()],
      resolvedTargetSecrets: { auth0Mgmt: {} },
      projectDir: '/tmp/test',
      resolveProvisioner: async (_pkg, _entry, _projectDir): Promise<ProvisionerContract> => ({
        async provision() {
          return ok({ publicOutputs: { spaClient: { id: 'a' } }, secretOutputs: {} });
        },
      }),
      log: () => undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('DEPLOY_PROVISION_OUTPUT_INVALID');
      expect(result.errors[0]?.message).toContain('m2mClients');
    }
  });

  it('rejects when produces.kind=many but value is not an array', async () => {
    const result = await runProvisioners({
      modules: [baseModule()],
      resolvedTargetSecrets: { auth0Mgmt: {} },
      projectDir: '/tmp/test',
      resolveProvisioner: async (_pkg, _entry, _projectDir): Promise<ProvisionerContract> => ({
        async provision() {
          return ok({
            publicOutputs: { spaClient: { id: 'a' } },
            secretOutputs: { m2mClients: { not: 'an array' } },
          });
        },
      }),
      log: () => undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('DEPLOY_PROVISION_OUTPUT_INVALID');
    }
  });

  it('rejects when secret-flagged value lives in publicOutputs', async () => {
    const result = await runProvisioners({
      modules: [baseModule()],
      resolvedTargetSecrets: { auth0Mgmt: {} },
      projectDir: '/tmp/test',
      resolveProvisioner: async (_pkg, _entry, _projectDir): Promise<ProvisionerContract> => ({
        async provision() {
          return ok({
            publicOutputs: { spaClient: { id: 'a' }, m2mClients: [{ clientSecret: 'leaked' }] },
            secretOutputs: {},
          });
        },
      }),
      log: () => undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('DEPLOY_PROVISION_OUTPUT_INVALID');
    }
  });

  it('returns DEPLOY_PROVISION_VENDOR_FAILED when provision returns Err', async () => {
    const result = await runProvisioners({
      modules: [baseModule()],
      resolvedTargetSecrets: { auth0Mgmt: {} },
      projectDir: '/tmp/test',
      resolveProvisioner: async (_pkg, _entry, _projectDir): Promise<ProvisionerContract> => ({
        async provision() {
          return err([{ code: 'AUTH0_THING_FAILED', message: 'upstream said no' }]);
        },
      }),
      log: () => undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = result.errors.map((e) => e.code);
      expect(codes).toContain('DEPLOY_PROVISION_VENDOR_FAILED');
    }
  });

  it('recovers DEPLOY_PROVISION_BUNDLE_ASSET_MISSING from resolver throw message prefix', async () => {
    const result = await runProvisioners({
      modules: [baseModule()],
      resolvedTargetSecrets: { auth0Mgmt: {} },
      projectDir: '/tmp/test',
      resolveProvisioner: async () => {
        throw new Error('DEPLOY_PROVISION_BUNDLE_ASSET_MISSING: provisioner.js not found in bundle');
      },
      log: () => undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('DEPLOY_PROVISION_BUNDLE_ASSET_MISSING');
    }
  });

  it('falls back to DEPLOY_PROVISION_ENTRY_LOAD_FAILED for unrecognised resolver throw', async () => {
    const result = await runProvisioners({
      modules: [baseModule()],
      resolvedTargetSecrets: { auth0Mgmt: {} },
      projectDir: '/tmp/test',
      resolveProvisioner: async () => {
        throw new Error('something went completely wrong');
      },
      log: () => undefined,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('DEPLOY_PROVISION_ENTRY_LOAD_FAILED');
    }
  });

  it('times out when provision exceeds timeoutMs', async () => {
    vi.useFakeTimers();
    const slow: ProvisionerContract = {
      async provision({ signal }) {
        await new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        });
        return ok({ publicOutputs: {}, secretOutputs: {} });
      },
    };
    const promise = runProvisioners({
      modules: [{ ...baseModule(), manifest: { ...baseModule().manifest, provisioner: { ...baseModule().manifest.provisioner!, timeoutMs: 50 } } }],
      resolvedTargetSecrets: { auth0Mgmt: {} },
      projectDir: '/tmp/test',
      resolveProvisioner: async (_pkg, _entry, _projectDir) => slow,
      log: () => undefined,
    });
    await vi.advanceTimersByTimeAsync(60);
    const result = await promise;
    vi.useRealTimers();
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('DEPLOY_PROVISION_TIMEOUT');
    }
  });
});
