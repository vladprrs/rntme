import { Buffer } from 'node:buffer';
import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { ok, type BlobStore, type DeploymentWithProvision, type SecretCipher } from '@rntme/platform-core';

import { runTearDownsForDeployment } from '../../../src/deploy/run-teardowns.js';

describe('runTearDownsForDeployment', () => {
  it('rejects invalid stored bundles before materializing colliding JSON assets', async () => {
    const resolveProvisioner = vi.fn();
    const result = await runTearDownsForDeployment({
      deployment: deploymentWithProvision(),
      projectVersion: { bundleBlobKey: 'bundle-key' },
      deps: {
        blob: blobWithBundle({
          version: 2,
          files: {
            'project.json': {
              name: 'shop',
              services: [],
              modules: { identity: { package: '@rntme/fake-identity' } },
            },
            'node_modules/@rntme/fake-identity/module.json': {
              name: '@rntme/fake-identity',
              version: '0.0.0',
              capabilities: { rpcs: [], events: [] },
              provisioner: { entry: './provisioner.js', produces: [], requires: [] },
            },
          },
          assets: {
            'project.json': Buffer.from('not json').toString('base64'),
          },
        }),
        secretCipher: {
          encrypt: vi.fn(() => ({ ciphertext: Buffer.alloc(0), nonce: Buffer.alloc(0), keyVersion: 1 })),
          decrypt: vi.fn(() => '{"modules":{}}'),
        } as SecretCipher,
        resolveProvisioner,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toContain('tearDown: invalid bundle');
      expect(result.errors[0]?.message).toContain('PROJECT_VERSION_BUNDLE_INVALID_SHAPE');
    }
    expect(resolveProvisioner).not.toHaveBeenCalled();
  });
});

function blobWithBundle(bundle: unknown): BlobStore {
  return {
    getRaw: vi.fn(async () => ok(gzipSync(Buffer.from(JSON.stringify(bundle))))),
    putIfAbsent: vi.fn(),
    presignedGet: vi.fn(),
    getJson: vi.fn(),
  } as unknown as BlobStore;
}

function deploymentWithProvision(): DeploymentWithProvision {
  return {
    id: 'deployment-1',
    projectId: 'project-1',
    orgId: 'org-1',
    projectVersionId: 'version-1',
    targetId: 'target-1',
    status: 'succeeded',
    configOverrides: {},
    renderedPlanDigest: 'sha256:' + 'a'.repeat(64),
    applyResult: null,
    verificationReport: null,
    warnings: [],
    errorCode: null,
    errorMessage: null,
    startedByAccountId: 'account-1',
    queuedAt: new Date(),
    startedAt: new Date(),
    finishedAt: new Date(),
    lastHeartbeatAt: new Date(),
    provisionResult: {
      modules: {
        identity: {
          publicOutputs: {},
          provisionedAt: '2026-05-05T00:00:00.000Z',
        },
      },
      startedAt: '2026-05-05T00:00:00.000Z',
      finishedAt: '2026-05-05T00:00:00.000Z',
    },
    provisionResultCiphertext: null,
    provisionResultNonce: null,
    provisionResultKeyVersion: null,
  };
}
