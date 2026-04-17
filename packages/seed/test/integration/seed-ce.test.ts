import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqliteEventStore } from '@rntme/event-store';
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
  deriveEventTypes,
} from '@rntme/pdm';
import { applySeed, parseSeed, validateSeed } from '../../src/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SERVICE_NAME = 'svc';

function buildCtx() {
  const pdmRaw = JSON.parse(
    readFileSync(resolve(__dirname, '../fixtures/minimal-pdm.json'), 'utf8'),
  );
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

describe('seed integration — CE envelope invariants on event_log', () => {
  it('parse → validate → apply stamps seed:<uuid> correlationId and NULL command_id / causation_id on every row', async () => {
    const raw = JSON.parse(
      readFileSync(resolve(__dirname, '../fixtures/seed-ce.json'), 'utf8'),
    );
    const parsed = parseSeed(raw);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const validated = validateSeed(parsed.value, buildCtx());
    if (!validated.ok) throw new Error(JSON.stringify(validated.errors));

    const store = new SqliteEventStore({
      filename: ':memory:',
      serviceName: SERVICE_NAME,
    });
    const result = await applySeed(validated.value, store, {
      mode: 'strict',
      serviceName: SERVICE_NAME,
    });
    expect(result.appliedCount).toBe(validated.value.events.length);
    expect(result.skippedCount).toBe(0);

    const rows = store
      .rawDb()
      .prepare(
        'SELECT correlation_id, command_id, causation_id FROM event_log',
      )
      .all() as Array<{
      correlation_id: string;
      command_id: string | null;
      causation_id: string | null;
    }>;
    expect(rows.length).toBe(validated.value.events.length);

    for (const row of rows) {
      expect(row.command_id).toBeNull();
      expect(row.causation_id).toBeNull();
      expect(row.correlation_id.startsWith('seed:')).toBe(true);
    }
  });

  it('applies one stable seed correlationId across the whole artifact (no explicit override)', async () => {
    const raw = JSON.parse(
      readFileSync(resolve(__dirname, '../fixtures/seed-ce.json'), 'utf8'),
    );
    const parsed = parseSeed(raw);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    const validated = validateSeed(parsed.value, buildCtx());
    if (!validated.ok) throw new Error(JSON.stringify(validated.errors));

    const store = new SqliteEventStore({
      filename: ':memory:',
      serviceName: SERVICE_NAME,
    });
    await applySeed(validated.value, store, {
      mode: 'strict',
      serviceName: SERVICE_NAME,
    });

    const rows = store
      .rawDb()
      .prepare('SELECT correlation_id FROM event_log')
      .all() as Array<{ correlation_id: string }>;
    const distinct = new Set(rows.map((r) => r.correlation_id));
    expect(distinct.size).toBe(1);
    const [only] = [...distinct];
    // seed:<uuid> — validate shape
    expect(only).toMatch(
      /^seed:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
