import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { applyEventStoreSchema } from '../../src/store/schema.js';

describe('applyEventStoreSchema', () => {
  it('creates event_log and publish_cursor tables', () => {
    const db = new Database(':memory:');
    applyEventStoreSchema(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain('event_log');
    expect(names).toContain('publish_cursor');
  });

  it('creates UNIQUE(stream, version) index on event_log', () => {
    const db = new Database(':memory:');
    applyEventStoreSchema(db);

    const idx = db
      .prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='event_log'")
      .all() as { name: string; sql: string | null }[];
    // UNIQUE is either its own index or auto-index; check the constraint exists
    db.prepare(
      `INSERT INTO event_log (stream, aggregate_type, aggregate_id, version, event_type,
                              event_id, actor_kind, actor_id, occurred_at, payload_json, schema_version)
       VALUES ('Issue-1','Issue','1',1,'X','e1',NULL,NULL,'2026-01-01T00:00:00Z','{}',1)`,
    ).run();
    expect(() =>
      db.prepare(
        `INSERT INTO event_log (stream, aggregate_type, aggregate_id, version, event_type,
                                event_id, actor_kind, actor_id, occurred_at, payload_json, schema_version)
         VALUES ('Issue-1','Issue','1',1,'Y','e2',NULL,NULL,'2026-01-01T00:00:00Z','{}',1)`,
      ).run(),
    ).toThrow(/UNIQUE/);
    // eventId unique too
    expect(() =>
      db.prepare(
        `INSERT INTO event_log (stream, aggregate_type, aggregate_id, version, event_type,
                                event_id, actor_kind, actor_id, occurred_at, payload_json, schema_version)
         VALUES ('Issue-2','Issue','2',1,'X','e1',NULL,NULL,'2026-01-01T00:00:00Z','{}',1)`,
      ).run(),
    ).toThrow(/UNIQUE/);
    // idx name list is not asserted (sqlite auto-names UNIQUE indexes); presence of the constraint is what matters
    expect(idx.length).toBeGreaterThanOrEqual(0);
  });

  it('is idempotent — applying twice does not throw', () => {
    const db = new Database(':memory:');
    applyEventStoreSchema(db);
    expect(() => applyEventStoreSchema(db)).not.toThrow();
  });

  it('creates delivery_tracking table with expected columns', () => {
    const db = new Database(':memory:');
    applyEventStoreSchema(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toContain('delivery_tracking');

    const cols = db
      .prepare("PRAGMA table_info('delivery_tracking')")
      .all() as { name: string; notnull: number; pk: number }[];
    const byName = Object.fromEntries(cols.map((c) => [c.name, c]));
    expect(byName['event_id']?.pk).toBe(1);
    expect(byName['first_attempt_at']?.notnull).toBe(1);
    expect(byName['last_attempt_at']?.notnull).toBe(1);
    expect(byName['attempt_count']?.notnull).toBe(1);
    expect(byName['last_error']?.notnull).toBe(0);
    expect(byName['delivered_at']?.notnull).toBe(0);
    expect(byName['dlq_at']?.notnull).toBe(0);
  });
});
