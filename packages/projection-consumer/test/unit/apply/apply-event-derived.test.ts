import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapProjections } from '../../../src/store/bootstrap.js';
import { applyEvent } from '../../../src/apply/apply-event.js';
import type { ApplyPlan, DerivedHandler } from '../../../src/types/apply.js';
import { makeEnvelope } from '../../fixtures/envelopes.js';

let db: Database.Database | null = null;
afterEach(() => { db?.close(); db = null; });

function setupDb(): Database.Database {
  const d = new Database(':memory:');
  // Tiny self-contained projection table: count events per issue id.
  d.exec(`
    CREATE TABLE IF NOT EXISTS projection_issue_count (
      issue_id INTEGER PRIMARY KEY,
      event_count INTEGER NOT NULL
    );
  `);
  bootstrapProjections(d, []);
  return d;
}

function makeCountHandler(overrides: Partial<DerivedHandler> = {}): DerivedHandler {
  return {
    kind: 'derived',
    projectionName: overrides.projectionName ?? 'IssueCount',
    tableName: overrides.tableName ?? 'projection_issue_count',
    aggregateType: overrides.aggregateType ?? 'Issue',
    eventType: overrides.eventType ?? 'IssueResolve',
    deltaSql:
      overrides.deltaSql ??
      `INSERT INTO "projection_issue_count" ("issue_id", "event_count")
       VALUES (?, 1)
       ON CONFLICT ("issue_id") DO UPDATE SET "event_count" = "projection_issue_count"."event_count" + 1`,
    bootstrapSql: overrides.bootstrapSql ?? 'SELECT 1',
    deltaBindings:
      overrides.deltaBindings ?? [{ kind: 'aggregateId', sqlType: 'INTEGER' }],
    filter: overrides.filter ?? null,
  };
}

function planWith(derived: DerivedHandler[]): ApplyPlan {
  const handlersByEventType = new Map<string, DerivedHandler[]>();
  for (const d of derived) {
    const bucket = handlersByEventType.get(d.eventType);
    if (bucket) bucket.push(d);
    else handlersByEventType.set(d.eventType, [d]);
  }
  return {
    handlersByEventType,
    mirrorsByAggregate: new Map(),
  };
}

describe('applyEvent — derived handler branch (D5 Task 20)', () => {
  it('returns [skipped-no-handler] when no handler matches the eventType', () => {
    db = setupDb();
    const plan = planWith([makeCountHandler({ eventType: 'IssueResolve' })]);
    const env = makeEnvelope({ eventType: 'SomethingElse', aggregateId: '1' });
    expect(applyEvent(db, plan, env)).toEqual(['skipped-no-handler']);
  });

  it('returns [applied] on first delivery and writes the projection row', () => {
    db = setupDb();
    const plan = planWith([makeCountHandler()]);
    const env = makeEnvelope({
      eventId: 'ev-1', eventType: 'IssueResolve', aggregateId: '5',
    });
    expect(applyEvent(db, plan, env)).toEqual(['applied']);
    const row = db.prepare('SELECT event_count FROM projection_issue_count WHERE issue_id = 5').get() as { event_count: number };
    expect(row.event_count).toBe(1);
  });

  it('returns [skipped-seen-event] on re-delivery of the same eventId + projectionName', () => {
    db = setupDb();
    const plan = planWith([makeCountHandler()]);
    const env = makeEnvelope({
      eventId: 'ev-dup', eventType: 'IssueResolve', aggregateId: '7',
    });
    expect(applyEvent(db, plan, env)).toEqual(['applied']);
    expect(applyEvent(db, plan, env)).toEqual(['skipped-seen-event']);
    // Event count did not advance the second time.
    const row = db.prepare('SELECT event_count FROM projection_issue_count WHERE issue_id = 7').get() as { event_count: number };
    expect(row.event_count).toBe(1);
    // seen_events has exactly one row for this (event_id, projection_id)
    const seen = db.prepare('SELECT COUNT(*) AS c FROM seen_events WHERE event_id = ? AND projection_id = ?').get('ev-dup', 'IssueCount') as { c: number };
    expect(seen.c).toBe(1);
  });

  it('returns [skipped-filter] when filter predicate evaluates false', () => {
    db = setupDb();
    // Filter that always evaluates false; no bindings.
    const handler = makeCountHandler({
      filter: { sql: '1 = 0', bindings: [] },
    });
    const plan = planWith([handler]);
    const env = makeEnvelope({ eventId: 'ev-f', eventType: 'IssueResolve', aggregateId: '9' });
    expect(applyEvent(db, plan, env)).toEqual(['skipped-filter']);
    // Nothing was inserted into the projection table or seen_events.
    const count = db.prepare('SELECT COUNT(*) AS c FROM projection_issue_count').get() as { c: number };
    expect(count.c).toBe(0);
    const seen = db.prepare('SELECT COUNT(*) AS c FROM seen_events').get() as { c: number };
    expect(seen.c).toBe(0);
  });

  it('applies when filter predicate evaluates true', () => {
    db = setupDb();
    const handler = makeCountHandler({
      filter: { sql: '1 = 1', bindings: [] },
    });
    const plan = planWith([handler]);
    const env = makeEnvelope({ eventId: 'ev-t', eventType: 'IssueResolve', aggregateId: '11' });
    expect(applyEvent(db, plan, env)).toEqual(['applied']);
  });

  it('multiple handlers registered for one eventType each return their own result', () => {
    db = setupDb();
    db.exec('CREATE TABLE projection_other (id INTEGER PRIMARY KEY, c INTEGER NOT NULL)');
    const a = makeCountHandler({ projectionName: 'IssueCount' });
    const b = makeCountHandler({
      projectionName: 'OtherCount',
      tableName: 'projection_other',
      deltaSql:
        `INSERT INTO "projection_other" ("id", "c")
         VALUES (?, 1)
         ON CONFLICT ("id") DO UPDATE SET "c" = "projection_other"."c" + 1`,
    });
    const plan = planWith([a, b]);
    const env = makeEnvelope({ eventId: 'ev-multi', eventType: 'IssueResolve', aggregateId: '3' });
    const results = applyEvent(db, plan, env);
    expect(results).toEqual(['applied', 'applied']);
    // Second delivery — both handlers see the same eventId and skip.
    expect(applyEvent(db, plan, env)).toEqual(['skipped-seen-event', 'skipped-seen-event']);
  });
});
