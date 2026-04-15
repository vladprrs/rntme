import { describe, it, expect } from 'vitest';
import { mkdtempSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadService } from '../../src/load/load-service.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURE = join(__dirname, '../fixtures/issue-tracker');

function cloneFixtureWithSeed(seed: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'runtime-seed-load-'));
  cpSync(FIXTURE, dir, { recursive: true });
  writeFileSync(join(dir, 'seed.json'), JSON.stringify(seed));
  const manifestPath = join(dir, 'manifest.json');
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
  m.seed = { ...(m.seed ?? {}), enabled: true };
  writeFileSync(manifestPath, JSON.stringify(m));
  return dir;
}

describe('loadService — seed', () => {
  it('returns seed: null when no seed.json present', () => {
    const r = loadService(FIXTURE);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.seed).toBeNull();
  });

  it('parses and validates seed.json when present', () => {
    const dir = cloneFixtureWithSeed({ seedVersion: 1, events: [] });
    const r = loadService(dir);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.seed).not.toBeNull();
      expect(r.value.seed!.events).toEqual([]);
    }
  });

  it('fails loadService when seed.json is invalid', () => {
    const dir = cloneFixtureWithSeed({ bogus: true });
    const r = loadService(dir);
    expect(r.ok).toBe(false);
  });

  it('respects manifest.seed.enabled: false', () => {
    const dir = cloneFixtureWithSeed({ seedVersion: 1, events: [] });
    const manifestPath = join(dir, 'manifest.json');
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
    m.seed = { enabled: false };
    writeFileSync(manifestPath, JSON.stringify(m));
    const r = loadService(dir);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.seed).toBeNull();
  });

  it('respects manifest.seed.path override', () => {
    const dir = cloneFixtureWithSeed({ seedVersion: 1, events: [] });
    cpSync(join(dir, 'seed.json'), join(dir, 'seed-alt.json'));
    writeFileSync(join(dir, 'seed.json'), JSON.stringify({ bogus: true }));
    const manifestPath = join(dir, 'manifest.json');
    const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
    m.seed = { path: 'seed-alt.json' };
    writeFileSync(manifestPath, JSON.stringify(m));
    const r = loadService(dir);
    expect(r.ok).toBe(true);
  });
});
