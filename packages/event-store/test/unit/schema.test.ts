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
});
