import { describe, it, expect } from 'vitest';
import { createSeededDb } from '../src/db/seed.js';

describe('createSeededDb — projection_issue seeding', () => {
  it('creates projection_issue table with 25 seeded rows', () => {
    const db = createSeededDb();
    const n = (db.prepare('SELECT COUNT(*) AS n FROM projection_issue').get() as { n: number }).n;
    expect(n).toBe(25);
    db.close();
  });

  it('seeded rows carry idempotency stub columns', () => {
    const db = createSeededDb();
    const row = db.prepare(
      `SELECT last_event_id, last_event_version, applied_at FROM projection_issue WHERE id = 101`,
    ).get() as { last_event_id: string; last_event_version: number; applied_at: string };
    expect(row.last_event_id).toBe('seed');
    expect(row.last_event_version).toBe(0);
    expect(row.applied_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    db.close();
  });

  it('legacy "done" status is normalised to "resolved"', () => {
    const db = createSeededDb();
    const n = (db.prepare(`SELECT COUNT(*) AS n FROM projection_issue WHERE status = 'done'`)
      .get() as { n: number }).n;
    expect(n).toBe(0);
    const resolved = (db.prepare(`SELECT COUNT(*) AS n FROM projection_issue WHERE status = 'resolved'`)
      .get() as { n: number }).n;
    expect(resolved).toBeGreaterThan(0);
    db.close();
  });

  it('reference tables still populated', () => {
    const db = createSeededDb();
    const users = (db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
    const projects = (db.prepare('SELECT COUNT(*) AS n FROM projects').get() as { n: number }).n;
    expect(users).toBe(4);
    expect(projects).toBe(2);
    db.close();
  });
});
