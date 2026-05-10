import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'bun:test';
import { buildDeterministicTarGz, hashBuffer } from '@rntme/bundle-publish';
import { validateMarketingSiteConfig } from '@rntme/contracts-marketing-site-v1';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readProject(): { services: string[]; modules: { marketing?: { publicConfig?: unknown } } } {
  return JSON.parse(readFileSync(join(__dirname, '..', 'project.json'), 'utf8')) as {
    services: string[];
    modules: { marketing?: { publicConfig?: unknown } };
  };
}

describe('cv-extract landing wiring', () => {
  it('marketing publicConfig is valid against marketing-site/v1', () => {
    const cfg = readProject().modules.marketing?.publicConfig;
    const result = validateMarketingSiteConfig(cfg);

    expect(result.ok).toBe(true);
  });

  it('marketing service appears in services', () => {
    expect(readProject().services).toContain('marketing');
  });

  it('marketing source hash matches the deterministic landing bundle', async () => {
    const cfg = readProject().modules.marketing?.publicConfig as {
      source?: { sha256?: string; key?: string };
    } | undefined;
    const bundle = await buildDeterministicTarGz(join(__dirname, '..', 'landing'), []);
    const sha256 = hashBuffer(bundle);

    expect(cfg?.source?.sha256).toBe(sha256);
    expect(cfg?.source?.key).toBe(`landings/cv-extract/${sha256}.tar.gz`);
  });
});
