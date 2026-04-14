import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapProjections } from '@rntme/projection-consumer';
import { projectionDdls } from '../artifacts.js';

const here = dirname(fileURLToPath(import.meta.url));

export type SeedOptions = { path?: string };

export function createSeededDb(options: SeedOptions = {}): Database.Database {
  const db = new Database(options.path ?? ':memory:');
  db.pragma('foreign_keys = ON');

  const ddl = readFileSync(join(here, 'schema.sql'), 'utf8');
  db.exec(ddl);

  bootstrapProjections(db, projectionDdls);

  const tx = db.transaction(() => {
    insertUsers(db);
    insertProjects(db);
    insertSprints(db);
    insertProjectionIssues(db);
  });
  tx();

  return db;
}

function insertUsers(db: Database.Database): void {
  const stmt = db.prepare(
    `INSERT INTO users (id, username, email, role, joined_at) VALUES (?, ?, ?, ?, ?)`,
  );
  const rows: Array<[number, string, string, string, string]> = [
    [1, 'alice', 'alice@example.com', 'admin', '2025-11-01T09:00:00Z'],
    [2, 'bob', 'bob@example.com', 'member', '2025-12-03T10:00:00Z'],
    [3, 'carol', 'carol@example.com', 'member', '2026-01-15T11:00:00Z'],
    [4, 'dave', 'dave@example.com', 'member', '2026-02-20T12:00:00Z'],
  ];
  for (const r of rows) stmt.run(...r);
}

function insertProjects(db: Database.Database): void {
  const stmt = db.prepare(
    `INSERT INTO projects (id, key, name, lead_id, created_at) VALUES (?, ?, ?, ?, ?)`,
  );
  stmt.run(1, 'CORE', 'Core Platform', 1, '2025-11-05T09:00:00Z');
  stmt.run(2, 'MOB', 'Mobile App', 2, '2026-01-10T10:00:00Z');
}

function insertSprints(db: Database.Database): void {
  const stmt = db.prepare(
    `INSERT INTO sprints (id, project_id, name, goal, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  stmt.run(10, 1, 'CORE-S1', 'Stabilize auth', '2026-02-01T00:00:00Z', '2026-02-14T23:59:59Z');
  stmt.run(11, 1, 'CORE-S2', 'API polish', '2026-02-15T00:00:00Z', '2026-02-28T23:59:59Z');
  stmt.run(20, 2, 'MOB-S1', 'Push notifications MVP', '2026-03-01T00:00:00Z', '2026-03-14T23:59:59Z');
}

type IssueRow = [
  number, number, number, number | null, number | null,
  string, string, string, number, string, string | null,
];

function mapLegacyStatus(s: string): string {
  return s === 'done' ? 'resolved' : s;
}

function insertProjectionIssues(db: Database.Database): void {
  const stmt = db.prepare(
    `INSERT INTO projection_issue
       (id, project_id, reporter_id, assignee_id, sprint_id, title, status, priority,
        story_points, created_at, resolved_at,
        last_event_id, last_event_version, applied_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed', 0, ?)`,
  );
  const appliedAt = '2026-04-14T00:00:00Z';

  const rows: IssueRow[] = [
    [101, 1, 1, 2, 10, 'Login page returns 500 on invalid email', 'done', 'high', 5, '2026-01-20T09:00:00Z', '2026-02-10T17:30:00Z'],
    [102, 1, 1, 3, 10, 'Add rate limiting to /auth/token', 'done', 'medium', 3, '2026-01-22T10:00:00Z', '2026-02-12T14:00:00Z'],
    [103, 1, 2, null, 10, 'Refactor session cookie parsing', 'open', 'low', 2, '2026-01-25T11:00:00Z', null],
    [104, 1, 2, 1, 10, 'Write docs for SSO integration', 'in_progress', 'medium', 5, '2026-01-27T12:00:00Z', null],
    [105, 1, 3, 2, 11, 'Pagination cursor leaks internal id', 'open', 'critical', 8, '2026-02-02T09:30:00Z', null],
    [106, 1, 3, 4, 11, 'Latency spike on /search endpoint', 'in_progress', 'high', 13, '2026-02-03T10:30:00Z', null],
    [107, 1, 1, 3, 11, 'Clean up legacy /v0 routes', 'open', 'low', 2, '2026-02-05T14:00:00Z', null],
    [108, 1, 4, null, null, 'Audit log missing for user-delete', 'open', 'high', 5, '2026-02-08T15:00:00Z', null],
    [109, 1, 2, 2, 11, 'Migrate logging to structured JSON', 'closed', 'medium', 3, '2026-02-10T09:00:00Z', '2026-02-26T11:00:00Z'],
    [110, 1, 1, 1, null, 'Investigate flaky build on main', 'done', 'low', 1, '2026-02-12T10:00:00Z', '2026-02-13T08:00:00Z'],
    [111, 1, 4, 4, 11, 'OpenAPI doc missing tags', 'done', 'low', 2, '2026-02-15T11:00:00Z', '2026-02-25T15:00:00Z'],
    [112, 1, 3, null, null, 'Track down memory leak in worker pool', 'open', 'critical', 13, '2026-02-20T13:00:00Z', null],
    [113, 1, 2, 3, null, 'Upgrade Node to LTS 22', 'open', 'medium', 8, '2026-02-22T14:00:00Z', null],
    [201, 2, 2, 4, 20, 'Crash on Android 12 when opening settings', 'open', 'critical', 8, '2026-02-28T09:00:00Z', null],
    [202, 2, 2, 3, 20, 'Push token refresh not persisted', 'in_progress', 'high', 5, '2026-03-01T10:00:00Z', null],
    [203, 2, 1, 2, 20, 'iOS dark mode colors off', 'open', 'low', 2, '2026-03-02T11:00:00Z', null],
    [204, 2, 4, null, 20, 'Biometrics prompt shows twice', 'open', 'medium', 3, '2026-03-04T12:00:00Z', null],
    [205, 2, 2, 4, 20, 'Onboarding flow skip button hidden on small screens', 'in_progress', 'medium', 3, '2026-03-05T13:00:00Z', null],
    [206, 2, 3, 3, 20, 'Translate error copy for FR locale', 'open', 'low', 2, '2026-03-06T14:00:00Z', null],
    [207, 2, 1, null, null, 'Set up Crashlytics release channels', 'open', 'high', 5, '2026-03-07T15:00:00Z', null],
    [208, 2, 4, 1, null, 'Offline sync conflict when editing same note twice', 'open', 'critical', 13, '2026-03-10T09:00:00Z', null],
    [209, 2, 2, 2, null, 'Improve cold-start time below 2s', 'open', 'high', 8, '2026-03-12T10:00:00Z', null],
    [210, 2, 3, 4, null, 'Deep links broken on Android 13+', 'in_progress', 'high', 5, '2026-03-15T11:00:00Z', null],
    [211, 2, 1, 2, null, 'Fix inconsistent button padding on iPad', 'done', 'low', 1, '2026-03-18T12:00:00Z', '2026-03-22T14:00:00Z'],
    [212, 2, 4, 3, null, 'Add accessibility labels to main nav', 'closed', 'medium', 3, '2026-03-20T13:00:00Z', '2026-03-30T16:00:00Z'],
  ];

  for (const r of rows) {
    const normalised: IssueRow = [...r];
    normalised[6] = mapLegacyStatus(r[6]);
    stmt.run(...normalised, appliedAt);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outPath = process.argv[2] ?? join(here, '..', '..', 'app.db');
  const db = createSeededDb({ path: outPath });
  const counts = {
    users: (db.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number }).n,
    projects: (db.prepare(`SELECT COUNT(*) AS n FROM projects`).get() as { n: number }).n,
    sprints: (db.prepare(`SELECT COUNT(*) AS n FROM sprints`).get() as { n: number }).n,
    issues: (db.prepare(`SELECT COUNT(*) AS n FROM projection_issue`).get() as { n: number }).n,
  };
  db.close();
  // eslint-disable-next-line no-console
  console.log(`Seeded ${outPath}:`, counts);
}
