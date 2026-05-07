import { describe, expect, it } from 'vitest';
import { validateMarketingSiteConfig } from '../src/index.js';

describe('validateMarketingSiteConfig', () => {
  it('accepts a minimal s3 config', () => {
    const out = validateMarketingSiteConfig({
      source: { kind: 's3', bucket: 'b', key: 'k', sha256: 'a'.repeat(64) },
      primaryDomain: 'example.com',
      ssl: 'auto',
    });

    expect(out.ok).toBe(true);
  });

  it('accepts a local-path config', () => {
    const out = validateMarketingSiteConfig({
      source: { kind: 'local-path', path: './bundle', sha256: 'a'.repeat(64) },
      primaryDomain: 'example.com',
      ssl: 'manual',
    });

    expect(out.ok).toBe(true);
  });

  it('accepts a primaryDomain placeholder declared by blueprint vars', () => {
    const out = validateMarketingSiteConfig({
      source: { kind: 's3', bucket: 'b', key: 'k', sha256: 'a'.repeat(64) },
      primaryDomain: '${MARKETING_DOMAIN}',
      ssl: 'auto',
    });

    expect(out.ok).toBe(true);
  });

  it('rejects unknown source kind', () => {
    const out = validateMarketingSiteConfig({
      source: { kind: 'webdav', bucket: 'b', key: 'k', sha256: 'a'.repeat(64) },
      primaryDomain: 'example.com',
      ssl: 'auto',
    });

    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors[0]?.code).toBe('MARKETING_SITE_VALIDATE_INVALID_SOURCE');
  });

  it('rejects empty primaryDomain', () => {
    const out = validateMarketingSiteConfig({
      source: { kind: 's3', bucket: 'b', key: 'k', sha256: 'a'.repeat(64) },
      primaryDomain: '',
      ssl: 'auto',
    });

    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors[0]?.code).toBe('MARKETING_SITE_VALIDATE_INVALID_DOMAIN');
  });

  it('rejects invalid sha256 length', () => {
    const out = validateMarketingSiteConfig({
      source: { kind: 's3', bucket: 'b', key: 'k', sha256: 'short' },
      primaryDomain: 'example.com',
      ssl: 'auto',
    });

    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors[0]?.code).toBe('MARKETING_SITE_VALIDATE_INVALID_SOURCE');
  });
});
