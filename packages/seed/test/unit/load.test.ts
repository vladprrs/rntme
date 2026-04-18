import { describe, it, expect } from 'vitest';
import { Buffer } from 'node:buffer';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePdm, validatePdm, createPdmResolver, deriveEventTypes } from '@rntme/pdm';
import { loadSeed } from '../../src/load.js';
import type { SeedArtifact } from '../../src/types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SERVICE_NAME = 'test-service';

const pdmRaw = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/minimal-pdm.json'), 'utf8'),
);

function ctx() {
  const parsed = parsePdm(pdmRaw);
  if (!parsed.ok) throw new Error('pdm fixture invalid');
  const validated = validatePdm(parsed.value);
  if (!validated.ok) throw new Error('pdm fixture invalid');
  return {
    pdm: createPdmResolver(validated.value),
    events: deriveEventTypes(validated.value),
    serviceName: SERVICE_NAME,
  };
}

const minimalSeed: SeedArtifact = {
  seedVersion: 1,
  events: [
    {
      id: 'seed:Thing:1:v1',
      subject: 'Thing-1',
      rntAggregateType: 'Thing',
      rntAggregateId: '1',
      rntVersion: 1,
      eventType: 'ThingCreated',
      data: { name: 'x' },
      time: '2026-01-01T00:00:00.000Z',
      rntSchemaVersion: 1,
    },
  ],
};

describe('loadSeed', () => {
  it('accepts a seed object', () => {
    const result = loadSeed(minimalSeed as unknown as Record<string, unknown>, ctx());
    expect(result.ok).toBe(true);
  });

  it('accepts a Buffer of JSON', () => {
    const result = loadSeed(Buffer.from(JSON.stringify(minimalSeed), 'utf8'), ctx());
    expect(result.ok).toBe(true);
  });

  it('accepts a file path', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seed-load-'));
    const filePath = join(dir, 'seed.json');
    writeFileSync(filePath, JSON.stringify(minimalSeed), 'utf8');
    const result = loadSeed(filePath, ctx());
    expect(result.ok).toBe(true);
  });

  it('returns SEED_SYNTAX_INVALID on read or JSON parse errors', () => {
    const badJson = loadSeed(Buffer.from('{', 'utf8'), ctx());
    expect(badJson.ok).toBe(false);
    if (!badJson.ok) expect(badJson.errors[0]!.code).toBe('SEED_SYNTAX_INVALID');

    const missingFile = loadSeed(join(tmpdir(), 'nonexistent-seed-xyz.json'), ctx());
    expect(missingFile.ok).toBe(false);
    if (!missingFile.ok) expect(missingFile.errors[0]!.code).toBe('SEED_SYNTAX_INVALID');
  });

  it('returns SEED_UNKNOWN_AGGREGATE_TYPE when validation fails after parse', () => {
    const badAggregate: SeedArtifact = {
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
    };
    const result = loadSeed(badAggregate as unknown as Record<string, unknown>, ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]!.code).toBe('SEED_UNKNOWN_AGGREGATE_TYPE');
  });
});
