import { describe, expect, it } from 'bun:test';
import {
  createDokployClientFactory,
  normalizeDokployBaseUrl,
} from '../src/dokploy-client-factory.js';
import type { RenderedDokployResource } from '@rntme/deploy-dokploy';
import type { ParseTargetSecretFn, SecretCipher } from '../src/dokploy-client-factory.js';

describe('normalizeDokployBaseUrl', () => {
  it('keeps a clean origin', () => {
    expect(normalizeDokployBaseUrl('https://dokploy.example.com')).toBe(
      'https://dokploy.example.com',
    );
  });

  it('strips trailing slash', () => {
    expect(normalizeDokployBaseUrl('https://dokploy.example.com/')).toBe(
      'https://dokploy.example.com',
    );
  });

  it('strips trailing /api', () => {
    expect(normalizeDokployBaseUrl('https://dokploy.example.com/api')).toBe(
      'https://dokploy.example.com',
    );
  });
});

describe('createDokployClientFactory', () => {
  it('returns a callable factory', () => {
    const cipher: SecretCipher = {
      encrypt: () => ({ ciphertext: Buffer.alloc(0), nonce: Buffer.alloc(0), keyVersion: 0 }),
      decrypt: () => '',
    };
    const parser: ParseTargetSecretFn = () => ({ ok: true, value: {} });
    const factory = createDokployClientFactory(cipher, parser);
    expect(typeof factory).toBe('function');
  });

  it('resolves target-secret refs before saving compose environment', async () => {
    const calls: Array<{ readonly path: string; readonly body: unknown }> = [];
    const factory = createDokployClientFactory(
      plaintextCipher('dokploy-token'),
      () => ({ ok: true, value: {} }),
      async (url, init) => {
        calls.push({
          path: new URL(String(url)).pathname,
          body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
        });
        return new globalThis.Response('{}', { status: 200 });
      },
    );
    const client = factory(target(), { 'openrouter-api-key': 'sk-live-secret' });

    await client.configureCompose('compose_1', composeResource({
      env: [
        { name: 'OPENROUTER_API_KEY', value: 'openrouter-api-key', secret: true },
        { name: 'MODEL', value: 'openai/gpt-4.1-mini', secret: false },
      ],
    }));

    const saveEnv = calls.find((call) => call.path === '/api/compose.saveEnvironment');
    expect(saveEnv?.body).toEqual({
      composeId: 'compose_1',
      env: 'OPENROUTER_API_KEY=sk-live-secret\nMODEL=openai/gpt-4.1-mini',
    });
  });

  it('keeps literal secret values that are not target-secret refs', async () => {
    const calls: Array<{ readonly path: string; readonly body: unknown }> = [];
    const factory = createDokployClientFactory(
      plaintextCipher('dokploy-token'),
      () => ({ ok: true, value: {} }),
      async (url, init) => {
        calls.push({
          path: new URL(String(url)).pathname,
          body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
        });
        return new globalThis.Response('{}', { status: 200 });
      },
    );
    const client = factory(target(), { 'openrouter-api-key': 'sk-live-secret' });

    await client.configureCompose('compose_1', composeResource({
      env: [
        { name: 'PROVISIONED_CLIENT_SECRET', value: 'literal-from-provisioner', secret: true },
      ],
    }));

    const saveEnv = calls.find((call) => call.path === '/api/compose.saveEnvironment');
    expect(saveEnv?.body).toEqual({
      composeId: 'compose_1',
      env: 'PROVISIONED_CLIENT_SECRET=literal-from-provisioner',
    });
  });
});

function plaintextCipher(value: string): SecretCipher {
  return {
    encrypt: () => ({ ciphertext: Buffer.alloc(0), nonce: Buffer.alloc(0), keyVersion: 0 }),
    decrypt: () => value,
  };
}

function target() {
  return {
    apiTokenCiphertext: Buffer.alloc(0),
    apiTokenNonce: Buffer.alloc(0),
    apiTokenKeyVersion: 0,
    dokployUrl: 'https://dokploy.example.com',
  };
}

function composeResource(
  overrides: Partial<Extract<RenderedDokployResource, { kind: 'compose' }>>,
): Extract<RenderedDokployResource, { kind: 'compose' }> {
  return {
    logicalId: 'project-stack',
    kind: 'compose',
    infrastructureKind: 'project-stack',
    name: 'rntme-direct-cv-extract',
    image: 'docker/compose',
    composeFile: 'services:\n  mod-openrouter:\n    image: openrouter\n',
    env: [],
    labels: {},
    ...overrides,
  };
}
