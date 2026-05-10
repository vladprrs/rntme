import { describe, it, expect, beforeAll } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { writeFileSync, cpSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI = join(__dirname, '../../dist/bin/cli.js');
const SERVICE_NAME = 'test-service';

function scaffoldArtifacts(seed: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'rntme-seed-cli-'));
  cpSync(join(__dirname, '../fixtures/minimal-pdm.json'), join(dir, 'pdm.json'));
  writeFileSync(join(dir, 'seed.json'), JSON.stringify(seed));
  return dir;
}

function thingCreated(overrides: Record<string, unknown> = {}) {
  return {
    id: 'seed:Thing:1:v1',
    subject: 'Thing-1',
    rntAggregateType: 'Thing',
    rntAggregateId: '1',
    rntVersion: 1,
    eventType: 'ThingCreated',
    data: { name: 'x' },
    time: '2026-01-01T00:00:00.000Z',
    rntSchemaVersion: 1,
    ...overrides,
  };
}

beforeAll(() => {
  const r = spawnSync('bun', ['run', 'build'], {
    cwd: join(__dirname, '../..'),
    stdio: 'inherit',
  });
  if (r.status !== 0) throw new Error('build failed');
}, 30000);

describe('rntme-seed validate', () => {
  it('exits 0 on valid artifacts', () => {
    const dir = scaffoldArtifacts({
      seedVersion: 1,
      events: [thingCreated()],
    });
    const r = spawnSync('bun', [CLI, 'validate', dir, '--service-name', SERVICE_NAME], {
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
  });

  it('exits 1 and prints errors on invalid seed', () => {
    const dir = scaffoldArtifacts({
      seedVersion: 1,
      events: [
        {
          id: 'x',
          subject: 'Widget-1',
          rntAggregateType: 'Widget',
          rntAggregateId: '1',
          rntVersion: 1,
          eventType: 'WidgetCreated',
          data: {},
          time: '2026-01-01T00:00:00.000Z',
          rntSchemaVersion: 1,
        },
      ],
    });
    const r = spawnSync('bun', [CLI, 'validate', dir, '--service-name', SERVICE_NAME], {
      encoding: 'utf8',
    });
    expect(r.status).toBe(1);
    expect(r.stdout + r.stderr).toContain('SEED_UNKNOWN_AGGREGATE_TYPE');
  });

  it('supports --json output', () => {
    const dir = scaffoldArtifacts({ seedVersion: 1, events: [{ bogus: true }] });
    const r = spawnSync(
      'bun',
      [CLI, 'validate', dir, '--service-name', SERVICE_NAME, '--json'],
      { encoding: 'utf8' },
    );
    expect(r.status).toBe(1);
    const parsed = JSON.parse(r.stdout);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('exits 0 when seed.json is absent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rntme-seed-empty-'));
    cpSync(join(__dirname, '../fixtures/minimal-pdm.json'), join(dir, 'pdm.json'));
    const r = spawnSync('bun', [CLI, 'validate', dir, '--service-name', SERVICE_NAME], {
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
  });

  it('reads serviceName from manifest.json when --service-name is absent', () => {
    const dir = scaffoldArtifacts({ seedVersion: 1, events: [thingCreated()] });
    writeFileSync(
      join(dir, 'manifest.json'),
      JSON.stringify({ serviceName: 'from-manifest' }),
    );
    const r = spawnSync('bun', [CLI, 'validate', dir], { encoding: 'utf8' });
    expect(r.status).toBe(0);
  });

  it('prints PDM parse errors when pdm.json is invalid', () => {
    const dir = scaffoldArtifacts({ seedVersion: 1, events: [thingCreated()] });
    writeFileSync(join(dir, 'pdm.json'), JSON.stringify({}));
    const r = spawnSync('bun', [CLI, 'validate', dir, '--service-name', SERVICE_NAME], {
      encoding: 'utf8',
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('PDM_PARSE_SCHEMA_VIOLATION');
  });
});

describe('rntme-seed apply', () => {
  it('applies to a fresh file-backed event store and prints applied count', () => {
    const dir = scaffoldArtifacts({
      seedVersion: 1,
      events: [thingCreated()],
    });
    const storePath = join(dir, 'event-store.db');
    const r = spawnSync(
      'bun',
      [CLI, 'apply', dir, '--event-store', storePath, '--service-name', SERVICE_NAME],
      { encoding: 'utf8' },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/applied=1 skipped=0/);
  });

  it('--dry-run does not write', () => {
    const dir = scaffoldArtifacts({
      seedVersion: 1,
      events: [thingCreated()],
    });
    const storePath = join(dir, 'event-store.db');
    const r = spawnSync(
      'bun',
      [CLI, 'apply', dir, '--event-store', storePath, '--service-name', SERVICE_NAME, '--dry-run'],
      { encoding: 'utf8' },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/would apply 1 events/);
  });

  it('second apply with upsert mode skips all', () => {
    const dir = scaffoldArtifacts({
      seedVersion: 1,
      events: [thingCreated()],
    });
    const storePath = join(dir, 'event-store.db');
    spawnSync(
      'bun',
      [CLI, 'apply', dir, '--event-store', storePath, '--service-name', SERVICE_NAME],
      { encoding: 'utf8' },
    );
    const r = spawnSync(
      'bun',
      [CLI, 'apply', dir, '--event-store', storePath, '--service-name', SERVICE_NAME],
      { encoding: 'utf8' },
    );
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/applied=0 skipped=1/);
  });

  it('prints PDM parse errors when pdm.json is invalid', () => {
    const dir = scaffoldArtifacts({ seedVersion: 1, events: [thingCreated()] });
    writeFileSync(join(dir, 'pdm.json'), JSON.stringify({}));
    const storePath = join(dir, 'event-store.db');
    const r = spawnSync(
      'bun',
      [CLI, 'apply', dir, '--event-store', storePath, '--service-name', SERVICE_NAME],
      { encoding: 'utf8' },
    );
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('PDM_PARSE_SCHEMA_VIOLATION');
  });
});
