import { describe, expect, it, mock } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { provision } from '../../../src/stages/provision.js';
import type { ComposedProjectInput } from '@rntme/deploy-core';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..', '..', '..', '..', '..');

describe('stages.provision', () => {
  it('returns empty result when blueprint has no provisioner-bearing modules', async () => {
    const composed = { name: 'demo', services: [], modules: {}, varsManifest: {} } as unknown as ComposedProjectInput;
    const out = await provision({
      ctx: {
        orgSlug: 'org',
        target: { kind: 'dokploy', slug: 'preview', config: {}, modules: [], storage: [], workflows: undefined, auth: {} } as never,
        resolvedTargetSecrets: { apiToken: '', extras: {} },
        configOverrides: {},
      },
      composed,
      bundleDir: '/tmp/empty',
      priorProvisionOutputs: {},
    });

    expect(out.provisioned.size).toBe(0);
    expect(out.publicByModule).toEqual({});
    expect(out.secretByModule).toEqual({});
  });

  it('skips the storage-s3 provisioner when the target provisions RustFS infrastructure', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'deploy-runner-provision-rustfs-'));
    try {
      mkdirSync(join(dir, 'node_modules', '@rntme', 'storage-s3'), { recursive: true });
      writeFileSync(
        join(dir, 'node_modules', '@rntme', 'storage-s3', 'module.json'),
        readFileSync(join(repoRoot, 'modules', 'storage', 's3', 'module.json'), 'utf8'),
      );
      writeFileSync(
        join(dir, 'project.json'),
        JSON.stringify({
          name: 'demo',
          services: ['storage-s3'],
          modules: {
            storage: {
              package: '@rntme/storage-s3',
              publicConfig: {
                backend: 'rustfs',
                bucketName: 'demo-files',
                region: 'us-east-1',
              },
            },
          },
        }),
      );

      const runProvisioners = mock(async () => ({ ok: true, value: { modules: [] } }) as const);
      const composed = { name: 'demo', services: [], modules: {}, varsManifest: {} } as unknown as ComposedProjectInput;
      const out = await provision(
        {
          ctx: {
            orgSlug: 'org',
            target: {
              kind: 'dokploy',
              slug: 'preview',
              config: {},
              modules: {},
              storage: {
                mode: 'provisioned',
                provider: 'rustfs',
                publicBaseUrl: 'https://files.example.test',
                accessKeyRef: 'rustfs-access-key',
                secretKeyRef: 'rustfs-secret-key',
              },
              workflows: null,
              auth: {},
              eventBus: { kind: 'in-memory' },
              policyValues: {},
              manualAccess: {},
            } as never,
            resolvedTargetSecrets: { apiToken: '', extras: {} },
            configOverrides: {},
          },
          composed,
          bundleDir: dir,
          priorProvisionOutputs: {},
        },
        {
          runProvisioners,
          resolveProvisioner: mock(async () => ({ provision: mock() }) as never),
        },
      );

      expect(runProvisioners).not.toHaveBeenCalled();
      expect(out.provisioned.size).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
