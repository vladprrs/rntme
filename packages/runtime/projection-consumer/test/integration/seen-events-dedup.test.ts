import { describe, it, expect, afterEach } from 'bun:test';
import { openSqliteDatabase, type SqliteDatabase } from '@rntme/sqlite';
import { bootstrapProjections } from '../../src/store/bootstrap.js';
import { applyEvent } from '../../src/apply/apply-event.js';
import type { ApplyPlan, DerivedHandler } from '../../src/types/apply.js';
import { makeEnvelope } from '../fixtures/envelopes.js';

let db: SqliteDatabase | null = null;
afterEach(() => { db?.close(); db = null; });

/**
 * Integration: wire a minimal `DerivedHandler` by hand (no graph-IR compile
 * step) and verify that re-delivering the same envelope twice still produces
 * exactly one projection update + one seen_events row. This is the end-to-end
 * contract for D5 §6.5's "seen_events table is the sole idempotency gate for
 * derived projections" invariant.
 */
describe('seen_events dedup — integration (D5 Task 20)', () => {
  it('applying the same envelope twice yields count=1 and one seen_events row', () => {
    db = openSqliteDatabase({ filename: ':memory:' });
    // DDL: projection table + seen_events.
    db.exec(`
      CREATE TABLE projection_issue_count (
        issue_id INTEGER PRIMARY KEY,
        event_count INTEGER NOT NULL
      );
    `);
    bootstrapProjections(db, []);

    const handler: DerivedHandler = {
      kind: 'derived',
      projectionName: 'IssueCount',
      tableName: 'projection_issue_count',
      aggregateType: 'Issue',
      eventType: 'IssueResolve',
      deltaSql:
        `INSERT INTO "projection_issue_count" ("issue_id", "event_count")
         VALUES (?, 1)
         ON CONFLICT ("issue_id") DO UPDATE SET "event_count" = "projection_issue_count"."event_count" + 1`,
      bootstrapSql: 'SELECT 1',
      deltaBindings: [{ kind: 'aggregateId', sqlType: 'INTEGER' }],
      filter: null,
    };

    const plan: ApplyPlan = {
      handlersByEventType: new Map([['IssueResolve', [handler]]]),
      mirrorsByAggregate: new Map(),
    };

    const envelope = makeEnvelope({
      id: 'ev-dedup-1',
      eventType: 'IssueResolve',
      rntAggregateId: '42',
    });

    // First delivery applies.
    expect(applyEvent(db, plan, envelope)).toEqual(['applied']);
    // Second (replayed) delivery hits the seen_events gate.
    expect(applyEvent(db, plan, envelope)).toEqual(['skipped-seen-event']);

    const row = db
      .prepare('SELECT event_count FROM projection_issue_count WHERE issue_id = 42')
      .get() as { event_count: number };
    expect(row.event_count).toBe(1);

    const seen = db
      .prepare(
        'SELECT COUNT(*) AS c FROM seen_events WHERE event_id = ? AND projection_id = ?',
      )
      .get('ev-dedup-1', 'IssueCount') as { c: number };
    expect(seen.c).toBe(1);
  });

  it('applied_at in seen_events is an ISO timestamp', () => {
    db = openSqliteDatabase({ filename: ':memory:' });
    db.exec(`
      CREATE TABLE projection_issue_count (
        issue_id INTEGER PRIMARY KEY,
        event_count INTEGER NOT NULL
      );
    `);
    bootstrapProjections(db, []);

    const handler: DerivedHandler = {
      kind: 'derived',
      projectionName: 'IssueCount',
      tableName: 'projection_issue_count',
      aggregateType: 'Issue',
      eventType: 'IssueResolve',
      deltaSql:
        `INSERT INTO "projection_issue_count" ("issue_id", "event_count")
         VALUES (?, 1)
         ON CONFLICT ("issue_id") DO UPDATE SET "event_count" = "projection_issue_count"."event_count" + 1`,
      bootstrapSql: 'SELECT 1',
      deltaBindings: [{ kind: 'aggregateId', sqlType: 'INTEGER' }],
      filter: null,
    };

    const plan: ApplyPlan = {
      handlersByEventType: new Map([['IssueResolve', [handler]]]),
      mirrorsByAggregate: new Map(),
    };

    applyEvent(db, plan, makeEnvelope({
      id: 'ev-ts-1',
      eventType: 'IssueResolve',
      rntAggregateId: '1',
    }));

    const row = db
      .prepare('SELECT applied_at FROM seen_events WHERE event_id = ?')
      .get('ev-ts-1') as { applied_at: string };
    expect(typeof row.applied_at).toBe('string');
    expect(() => new Date(row.applied_at).toISOString()).not.toThrow();
  });
});
