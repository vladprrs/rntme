import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { writeFileSync, cpSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI = join(__dirname, '../../dist/bin/cli.js');

function scaffoldArtifacts(seed: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'rntme-seed-cli-'));
  cpSync(join(__dirname, '../fixtures/minimal-pdm.json'), join(dir, 'pdm.json'));
  writeFileSync(join(dir, 'seed.json'), JSON.stringify(seed));
  return dir;
}

beforeAll(() => {
  const r = spawnSync('pnpm', ['-F', '@rntme/seed', 'build'], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('build failed');
});

describe('rntme-seed validate', () => {
  it('exits 0 on valid artifacts', () => {
    const dir = scaffoldArtifacts({
      seedVersion: 1,
      events: [
        {
          stream: 'Thing-1',
          aggregateType: 'Thing',
          aggregateId: '1',
          version: 1,
          eventType: 'ThingCreated',
          payload: { name: 'x', status: 'active' },
          occurredAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const r = spawnSync('node', [CLI, 'validate', dir], { encoding: 'utf8' });
    expect(r.status).toBe(0);
  });

  it('exits 1 and prints errors on invalid seed', () => {
    const dir = scaffoldArtifacts({
      seedVersion: 1,
      events: [
        {
          stream: 'Widget-1',
          aggregateType: 'Widget',
          aggregateId: '1',
          version: 1,
          eventType: 'WidgetCreated',
          payload: {},
          occurredAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    const r = spawnSync('node', [CLI, 'validate', dir], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain('SEED_UNKNOWN_AGGREGATE_TYPE');
  });

  it('supports --json output', () => {
    const dir = scaffoldArtifacts({ seedVersion: 1, events: [{ bogus: true }] });
    const r = spawnSync('node', [CLI, 'validate', dir, '--json'], { encoding: 'utf8' });
    expect(r.status).toBe(1);
    const parsed = JSON.parse(r.stdout);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('exits 0 when seed.json is absent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-seed-empty-'));
    cpSync(join(__dirname, '../fixtures/minimal-pdm.json'), join(dir, 'pdm.json'));
    const r = spawnSync('node', [CLI, 'validate', dir], { encoding: 'utf8' });
    expect(r.status).toBe(0);
  });
});
