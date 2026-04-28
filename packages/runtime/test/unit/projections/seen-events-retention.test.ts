/**
 * Unit tests for `startSeenEventsRetention` — the periodic DELETE sweep that
 * keeps the derived-projection idempotency side-table bounded in size.
 *
 * Uses an in-memory better-sqlite3 DB with the `seen_events` table created by
 * hand (same DDL as `@rntme/projection-consumer`'s `bootstrapProjections`) so
 * the test does not depend on spinning up a full runtime.
 */
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startSeenEventsRetention } from '../../../src/projections/seen-events-retention.js';

const CREATE_SEEN_EVENTS_SQL = `
CREATE TABLE seen_events (
  event_id       TEXT NOT NULL,
  projection_id  TEXT NOT NULL,
  applied_at     TEXT NOT NULL,
  PRIMARY KEY (event_id, projection_id)
)
`.trim();

const ORIGINAL_ENV = process.env.RNTME_SEEN_EVENTS_RETENTION_DAYS;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function seedRows(db: Database.Database, rows: { id: string; days: number }[]): void {
  const stmt = db.prepare(
    'INSERT INTO seen_events (event_id, projection_id, applied_at) VALUES (?, ?, ?)',
  );
  for (const r of rows) stmt.run(r.id, 'p', daysAgoIso(r.days));
}

function countRows(db: Database.Database): number {
  const r = db.prepare('SELECT COUNT(*) AS n FROM seen_events').get() as { n: number };
  return r.n;
}

describe('startSeenEventsRetention', () => {
  let db: Database.Database;

  beforeEach(() => {
    delete process.env.RNTME_SEEN_EVENTS_RETENTION_DAYS;
    db = new Database(':memory:');
    db.exec(CREATE_SEEN_EVENTS_SQL);
  });

  afterEach(() => {
    db.close();
    if (ORIGINAL_ENV === undefined) {
      delete process.env.RNTME_SEEN_EVENTS_RETENTION_DAYS;
    } else {
      process.env.RNTME_SEEN_EVENTS_RETENTION_DAYS = ORIGINAL_ENV;
    }
    vi.useRealTimers();
  });

  it('runs an initial sweep on start and deletes rows older than retentionDays', () => {
    seedRows(db, [
      { id: 'a', days: 10 },
      { id: 'b', days: 10 },
      { id: 'c', days: 10 },
      { id: 'fresh', days: 0 },
    ]);
    expect(countRows(db)).toBe(4);

    const dispose = startSeenEventsRetention(db, {
      retentionDays: 1,
      intervalMs: 10_000,
    });

    // Sweep ran synchronously at start — only the fresh row should remain.
    expect(countRows(db)).toBe(1);
    const remaining = db.prepare('SELECT event_id FROM seen_events').all() as {
      event_id: string;
    }[];
    expect(remaining.map((r) => r.event_id)).toEqual(['fresh']);

    dispose();
  });

  it('returned dispose() clears the interval; no further sweeps fire', () => {
    vi.useFakeTimers();
    const dispose = startSeenEventsRetention(db, {
      retentionDays: 1,
      intervalMs: 5_000,
    });
    // After initial sweep: empty table.
    expect(countRows(db)).toBe(0);

    // Dispose immediately.
    dispose();

    // Seed a stale row AFTER dispose; if the interval is still active, the
    // next tick would delete it. Advance well past one interval and verify it
    // remains (i.e. no tick fired).
    seedRows(db, [{ id: 'stale', days: 10 }]);
    vi.advanceTimersByTime(60_000);
    expect(countRows(db)).toBe(1);
  });

  it('honours RNTME_SEEN_EVENTS_RETENTION_DAYS when no opts.retentionDays is passed', () => {
    process.env.RNTME_SEEN_EVENTS_RETENTION_DAYS = '1';
    seedRows(db, [
      { id: 'two-day-old', days: 2 },
      { id: 'fresh', days: 0 },
    ]);
    expect(countRows(db)).toBe(2);

    const dispose = startSeenEventsRetention(db, { intervalMs: 10_000 });

    // Env says retain 1 day; the 2-day-old row must be deleted.
    expect(countRows(db)).toBe(1);
    const remaining = db.prepare('SELECT event_id FROM seen_events').all() as {
      event_id: string;
    }[];
    expect(remaining.map((r) => r.event_id)).toEqual(['fresh']);

    dispose();
  });

  it.each(['abc', 'NaN', 'Infinity', '1.5', '0', '-1'])(
    'rejects invalid RNTME_SEEN_EVENTS_RETENTION_DAYS=%s',
    (value) => {
      process.env.RNTME_SEEN_EVENTS_RETENTION_DAYS = value;

      expect(() => startSeenEventsRetention(db, { intervalMs: 10_000 })).toThrow(
        /RNTME_SEEN_EVENTS_RETENTION_DAYS/,
      );
    },
  );

  it.each([Number.NaN, Infinity, 1.5, 0, -1])(
    'rejects invalid opts.retentionDays=%s',
    (retentionDays) => {
      expect(() =>
        startSeenEventsRetention(db, {
          retentionDays,
          intervalMs: 10_000,
        }),
      ).toThrow(/retentionDays/);
    },
  );
});
