import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { bootstrapProjections } from '../../../src/store/bootstrap.js';

let db: Database.Database | null = null;
afterEach(() => { db?.close(); db = null; });

describe('bootstrapProjections — seen_events DDL (D5 Task 18)', () => {
  it('creates the seen_events table even with no projection DDLs', () => {
    db = new Database(':memory:');
    bootstrapProjections(db, []);
    const rows = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'seen_events'`)
      .all() as { name: string }[];
    expect(rows).toHaveLength(1);
  });

  it('seen_events has (event_id, projection_id) composite primary key with applied_at column', () => {
    db = new Database(':memory:');
    bootstrapProjections(db, []);
    const cols = db.prepare('PRAGMA table_info(seen_events)').all() as Array<{
      name: string;
      pk: number;
      notnull: number;
    }>;
    const names = cols.map((c) => c.name).sort();
    expect(names).toEqual(['applied_at', 'event_id', 'projection_id']);
    // Composite PK: both event_id and projection_id have pk > 0
    const pkCols = cols.filter((c) => c.pk > 0).map((c) => c.name).sort();
    expect(pkCols).toEqual(['event_id', 'projection_id']);
    // All columns NOT NULL
    for (const c of cols) expect(c.notnull).toBe(1);
  });

  it('creates idx_seen_events_applied index on applied_at', () => {
    db = new Database(':memory:');
    bootstrapProjections(db, []);
    const idx = db
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'seen_events'`)
      .all() as { name: string }[];
    expect(idx.map((r) => r.name)).toContain('idx_seen_events_applied');
  });

  it('is idempotent — bootstrapping twice does not throw', () => {
    db = new Database(':memory:');
    bootstrapProjections(db, []);
    expect(() => bootstrapProjections(db!, [])).not.toThrow();
  });
});
