import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm, generateProjectionDdl } from '@rntme/qsm';
import { compileApplyPlan } from '../../src/apply/compile.js';
import { bootstrapProjections } from '../../src/store/bootstrap.js';
import { createInMemoryKafkaConsumer } from '../../src/kafka/in-memory.js';
import { createProjectionConsumer } from '../../src/consumer.js';
import { issueLifecycle } from '../fixtures/envelopes.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', 'fixtures');

function setup() {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error();
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error();
  const resolver = createPdmResolver(pdm.value);
  const events = deriveEventTypes(pdm.value);
  const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
  if (!qsmRaw.ok) throw new Error();
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error();
  return {
    plan: compileApplyPlan({ pdm: resolver, qsm: qsm.value, events }),
    ddls: generateProjectionDdl(qsm.value, resolver),
  };
}

async function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

let db: Database.Database | null = null;
afterEach(() => { db?.close(); db = null; });

describe('createProjectionConsumer — batch loop', () => {
  it('applies every message in the batch in one SQLite transaction and commits offsets after DB COMMIT', async () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);

    const kafka = createInMemoryKafkaConsumer();
    const consumer = createProjectionConsumer({ kafka, plan, db });

    consumer.start();
    const lifecycle = issueLifecycle('1');
    for (const env of lifecycle) kafka.produce(env);

    const deadline = Date.now() + 2000;
    while (kafka.committed.length < lifecycle.length && Date.now() < deadline) await wait(5);
    await consumer.stop();

    expect(kafka.committed).toHaveLength(lifecycle.length);
    const row = db.prepare('SELECT status, last_event_version FROM projection_issue WHERE id = 1').get() as Record<string, unknown>;
    expect(row.status).toBe('closed');
    expect(row.last_event_version).toBe(6);
  });

  it('stop() resolves the loop cleanly and is idempotent', async () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    const kafka = createInMemoryKafkaConsumer();
    const consumer = createProjectionConsumer({ kafka, plan, db });
    consumer.start();
    await consumer.stop();
    await consumer.stop();
    expect(kafka.committed).toEqual([]);
  });

  it('events for aggregates without mirror are committed but do not insert rows', async () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);
    const kafka = createInMemoryKafkaConsumer();
    const consumer = createProjectionConsumer({ kafka, plan, db });
    consumer.start();
    kafka.produce({
      eventId: 'u1', eventType: 'UserJoined', aggregateType: 'User', aggregateId: '7',
      stream: 'User-7', version: 1, occurredAt: '2026-04-14T10:00:00.000Z',
      actor: null, payload: { before: null, after: {} }, schemaVersion: 1,
    });
    const deadline = Date.now() + 1000;
    while (kafka.committed.length < 1 && Date.now() < deadline) await wait(5);
    await consumer.stop();

    expect(kafka.committed).toHaveLength(1);
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='projection_user'").all();
    expect(rows).toEqual([]);
  });
});
