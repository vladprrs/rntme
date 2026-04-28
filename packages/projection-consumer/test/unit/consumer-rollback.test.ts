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
import { issueLifecycle, makeEnvelope } from '../fixtures/envelopes.js';

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

describe('createProjectionConsumer — rollback on failure', () => {
  it('throws in apply (NOT NULL violation) → ROLLBACK → no offset commit + no persisted rows', async () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);

    const kafka = createInMemoryKafkaConsumer();
    const errors: unknown[] = [];
    const consumer = createProjectionConsumer({
      kafka, plan, db,
      onError: (err) => errors.push(err),
    });
    consumer.start();

    kafka.produce(issueLifecycle('1')[0]!);
    kafka.produce(makeEnvelope({
      id: 'bad', eventType: 'IssueReport', rntAggregateId: '2', rntVersion: 1,
      data: { before: null, after: { status: 'draft' } },
    }));

    const deadline = Date.now() + 2000;
    while (errors.length === 0 && Date.now() < deadline) await wait(5);
    await consumer.stop();

    expect(errors.length).toBeGreaterThan(0);
    const count = db.prepare('SELECT COUNT(*) AS c FROM projection_issue').get() as { c: number };
    expect(count.c).toBe(0);
    expect(kafka.committed).toEqual([]);
  });

  it('preserves the apply error when ROLLBACK also fails', async () => {
    db = new Database(':memory:');
    const { plan, ddls } = setup();
    bootstrapProjections(db, ddls);

    const rollbackError = new Error('rollback failed');
    const dbWithFailingRollback = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop !== 'prepare') return Reflect.get(target, prop, receiver);
        return (sql: string) => {
          const statement = target.prepare(sql);
          if (sql !== 'ROLLBACK') return statement;
          return new Proxy(statement, {
            get(statementTarget, statementProp, statementReceiver) {
              if (statementProp !== 'run') {
                return Reflect.get(statementTarget, statementProp, statementReceiver);
              }
              return (...args: unknown[]) => {
                statementTarget.run(...args);
                throw rollbackError;
              };
            },
          });
        };
      },
    }) as Database.Database;

    const kafka = createInMemoryKafkaConsumer();
    const errors: unknown[] = [];
    const consumer = createProjectionConsumer({
      kafka, plan, db: dbWithFailingRollback,
      onError: (err) => errors.push(err),
    });
    consumer.start();

    kafka.produce(makeEnvelope({
      id: 'bad', eventType: 'IssueReport', rntAggregateId: '2', rntVersion: 1,
      data: { before: null, after: { status: 'draft' } },
    }));

    const deadline = Date.now() + 2000;
    while (errors.length === 0 && Date.now() < deadline) await wait(5);
    await consumer.stop();

    expect(errors).toHaveLength(1);
    expect(errors[0]).not.toBe(rollbackError);
    expect(String(errors[0])).toContain('NOT NULL');
    expect((errors[0] as { rollbackError?: unknown }).rollbackError).toBe(rollbackError);
    expect(kafka.committed).toEqual([]);
  });
});
