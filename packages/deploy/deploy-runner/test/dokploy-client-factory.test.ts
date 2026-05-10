import { describe, expect, it } from 'bun:test';
import {
  createDokployClientFactory,
  normalizeDokployBaseUrl,
} from '../src/dokploy-client-factory.js';
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
});
