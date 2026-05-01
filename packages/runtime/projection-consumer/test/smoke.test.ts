import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import {
  parseQsm, validateQsm, generateProjectionDdl,
} from '@rntme/qsm';
import {
  VERSION,
  bootstrapProjections,
  compileApplyPlan,
  createInMemoryKafkaConsumer,
  createProjectionConsumer,
} from '../src/index.js';
import { issueLifecycle } from './fixtures/envelopes.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, 'fixtures');

async function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let db: Database.Database | null = null;
afterEach(() => { db?.close(); db = null; });

describe('smoke: @rntme/projection-consumer end-to-end', () => {
  it('exports VERSION', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('pipeline parse → validate → bootstrap DDL → compile plan → consume → projection reflects final state', async () => {
    // PDM
    const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
    expect(pdmRaw.ok).toBe(true);
    if (!pdmRaw.ok) return;
    const pdm = validatePdm(pdmRaw.value);
    expect(pdm.ok).toBe(true);
    if (!pdm.ok) return;
    const pdmResolver = createPdmResolver(pdm.value);
    const events = deriveEventTypes(pdm.value);

    // QSM
    const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
    expect(qsmRaw.ok).toBe(true);
    if (!qsmRaw.ok) return;
    const qsm = validateQsm(qsmRaw.value, pdmResolver);
    expect(qsm.ok).toBe(true);
    if (!qsm.ok) return;

    // Runtime: SQLite + DDL + plan
    db = new Database(':memory:');
    const ddls = generateProjectionDdl(qsm.value, pdmResolver);
    bootstrapProjections(db, ddls);
    const plan = compileApplyPlan({ pdm: pdmResolver, qsm: qsm.value, events });

    // Kafka in-memory harness + consumer
    const kafka = createInMemoryKafkaConsumer();
    const consumer = createProjectionConsumer({ kafka, plan, db });
    consumer.start();

    // Drive the canonical lifecycle (spec §7.5 acceptance)
    const lifecycle = issueLifecycle('1');
    for (const env of lifecycle) kafka.produce(env);
    const deadline = Date.now() + 3000;
    while (kafka.committed.length < lifecycle.length && Date.now() < deadline) await wait(5);
    await consumer.stop();

    // Final state assertions
    expect(kafka.committed).toHaveLength(lifecycle.length);
    const row = db.prepare('SELECT * FROM projection_issue WHERE id = 1').get() as Record<string, unknown>;
    expect(row).toMatchObject({
      id: 1,
      status: 'closed',
      title: 'Hello',
      project_id: 7,
      reporter_id: 42,
      assignee_id: 100,
      priority: 'high',
      story_points: 5,
      resolved_at: '2026-04-14T10:04:00.000Z',
      created_at: '2026-04-14T10:00:00.000Z',
      last_event_id: 'e6',
      last_event_version: 6,
    });
  });

  it('idempotent under Kafka duplicate delivery (at-least-once)', async () => {
    const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
    if (!pdmRaw.ok) return;
    const pdm = validatePdm(pdmRaw.value);
    if (!pdm.ok) return;
    const pdmResolver = createPdmResolver(pdm.value);
    const events = deriveEventTypes(pdm.value);
    const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
    if (!qsmRaw.ok) return;
    const qsm = validateQsm(qsmRaw.value, pdmResolver);
    if (!qsm.ok) return;

    db = new Database(':memory:');
    bootstrapProjections(db, generateProjectionDdl(qsm.value, pdmResolver));
    const plan = compileApplyPlan({ pdm: pdmResolver, qsm: qsm.value, events });

    const kafka = createInMemoryKafkaConsumer();
    const consumer = createProjectionConsumer({ kafka, plan, db });
    consumer.start();

    const lifecycle = issueLifecycle('1');
    // Deliver each event TWICE (simulating at-least-once)
    for (const env of lifecycle) { kafka.produce(env); kafka.produce(env); }

    const expected = lifecycle.length * 2;
    const deadline = Date.now() + 3000;
    while (kafka.committed.length < expected && Date.now() < deadline) await wait(5);
    await consumer.stop();

    expect(kafka.committed).toHaveLength(expected);
    // Still exactly one row, at final state
    const rows = db.prepare('SELECT * FROM projection_issue').all() as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('closed');
    expect(rows[0]!.last_event_version).toBe(6);
  });
});
