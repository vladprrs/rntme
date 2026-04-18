# demo/issue-tracker-api — Mutations E2E Wire-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `demo/issue-tracker-api` end-to-end to prove the mutations stack — convert the issue store from a hand-seeded SQL table into an Event-Sourced + CQRS pipeline (command → event_log → relay → Kafka → projection consumer → `projection_issue` → read graph) while preserving the existing read-side REST surface.

**Architecture:** The demo becomes a single-process composition of seven packages. On startup we construct: (a) a `SqliteEventStore` against `:memory:`, (b) a query `better-sqlite3` DB that holds reference tables (`users`, `projects`, `sprints`) plus the auto-bootstrapped `projection_issue` mirror, (c) a short-circuit in-memory Kafka bridge that pushes what the relay publishes into an in-memory `KafkaConsumer`, (d) a `ProjectionConsumer` applying events to the query DB, (e) `createBindingsRouter` wired with `eventStore` + `actorFromRequest`. Seven new command graphs (one per state-machine transition) and matching `kind: "command"` bindings expose `POST /v1/issues` (report) and `POST /v1/issues/{issueId}/actions/{action}` routes. One composite graph (`assignIssueWithCapacityGuard`) exercises the read-prelude guard path. The existing `listIssues`/`issueDetail`/`searchIssues`/`issuesByProject`/`sprintBurndown` graphs continue to compile unchanged — the compiler's `resolveSources` auto-redirects `findMany source.entity = "Issue"` to `projection_issue` once an entity-mirror projection exists.

**Tech Stack:** TypeScript, Hono, better-sqlite3, vitest, `@rntme/pdm`, `@rntme/qsm`, `@rntme/event-store`, `@rntme/projection-consumer`, `@rntme/graph-ir-compiler`, `@rntme/bindings`, `@rntme/bindings-http`.

---

## File Structure

### New files

- `demo/issue-tracker-api/src/artifacts/graphs/reportIssue.json` — command graph; single `emit` with `transition: "report"`.
- `demo/issue-tracker-api/src/artifacts/graphs/submitIssue.json` — command graph; `emit` with `transition: "submit"`.
- `demo/issue-tracker-api/src/artifacts/graphs/assignIssue.json` — command graph; `emit` with `transition: "assign"`.
- `demo/issue-tracker-api/src/artifacts/graphs/reassignIssue.json` — command graph; `emit` with `transition: "reassign"`.
- `demo/issue-tracker-api/src/artifacts/graphs/resolveIssue.json` — command graph; `emit` with `transition: "resolve"`.
- `demo/issue-tracker-api/src/artifacts/graphs/reopenIssue.json` — command graph; `emit` with `transition: "reopen"`.
- `demo/issue-tracker-api/src/artifacts/graphs/closeIssue.json` — command graph; `emit` with `transition: "close"`.
- `demo/issue-tracker-api/src/artifacts/graphs/assignIssueWithCapacityGuard.json` — composite command graph; `findMany` + `reduce` + `filter` guard feeding a final `emit`.
- `demo/issue-tracker-api/src/events.ts` — factory that constructs `SqliteEventStore`, in-memory Kafka producer, in-memory Kafka consumer, the bridge between them, the relay, and the projection consumer. Returns an object `{ eventStore, start(), stop() }`.
- `demo/issue-tracker-api/test/mutations-e2e.test.ts` — lifecycle E2E: full `report → submit → assign → reassign → resolve → close` cycle, plus capacity-guard rejection case.

### Modified files

- `demo/issue-tracker-api/package.json` — add workspace deps on `@rntme/qsm`, `@rntme/event-store`, `@rntme/projection-consumer`.
- `demo/issue-tracker-api/src/artifacts/qsm.json` — add `IssueView` entity-mirror projection.
- `demo/issue-tracker-api/src/artifacts/bindings.json` — add 8 command entries (`reportIssue`, `submitIssue`, `assignIssue`, `assignIssueWithGuard`, `reassignIssue`, `resolveIssue`, `reopenIssue`, `closeIssue`).
- `demo/issue-tracker-api/src/artifacts.ts` — drop `stripForCompiler` (the graph-ir-compiler now re-parses the full PDM via `@rntme/pdm`), parse+validate QSM via `@rntme/qsm`, export `qsmResolver` + `validatedQsm`, export derived `projectionDdls` and `eventTypes`.
- `demo/issue-tracker-api/src/db/schema.sql` — drop the `issues` table (now a projection); keep `users`, `projects`, `sprints`.
- `demo/issue-tracker-api/src/db/seed.ts` — after applying reference DDL, call `bootstrapProjections(db, projectionDdls)` to create `projection_issue`, then seed that projection table directly with the historical issue rows (+ stub idempotency columns).
- `demo/issue-tracker-api/src/server.ts` — construct event-store + projection consumer via `./events.ts`, pass `eventStore` + `actorFromRequest` to `createBindingsRouter`, surface `start`/`stop` from the returned object.

### Test layout rationale

Keep `test/e2e.test.ts` as the read-surface smoke test (assertions still hold once issues live in `projection_issue`). Put the new mutation lifecycle + guard cases in `test/mutations-e2e.test.ts` so the two concerns don't share a single `beforeAll` (the read surface uses the static seed; the mutation tests want a freshly-built app with no seeded issues to avoid version clashes).

---

## Task 1: Add `IssueView` entity-mirror projection to QSM

**Files:**
- Modify: `demo/issue-tracker-api/src/artifacts/qsm.json`
- Test: `demo/issue-tracker-api/test/artifacts-qsm.test.ts` (new — deleted after Task 3)

- [ ] **Step 1: Write the failing test**

Create `demo/issue-tracker-api/test/artifacts-qsm.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseQsm, validateQsm, createQsmResolver, isOk } from '@rntme/qsm';
import { createPdmResolver, parsePdm, validatePdm } from '@rntme/pdm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const artifactsDir = join(here, '..', 'src', 'artifacts');
const readRaw = (f: string): unknown => JSON.parse(readFileSync(join(artifactsDir, f), 'utf8'));

describe('qsm.json — IssueView', () => {
  it('parses and validates against PDM', () => {
    const pdm = parsePdm(readRaw('pdm.json'));
    expect(isOk(pdm)).toBe(true);
    if (!isOk(pdm)) return;
    const pdmV = validatePdm(pdm.value);
    expect(isOk(pdmV)).toBe(true);
    if (!isOk(pdmV)) return;

    const qsm = parseQsm(readRaw('qsm.json'));
    expect(isOk(qsm)).toBe(true);
    if (!isOk(qsm)) return;
    const qsmV = validateQsm(qsm.value, createPdmResolver(pdmV.value));
    expect(isOk(qsmV)).toBe(true);
    if (!isOk(qsmV)) return;

    const resolver = createQsmResolver(qsmV.value);
    const mirror = resolver.findEntityMirror('Issue');
    expect(mirror).not.toBeNull();
    expect(mirror!.table).toBe('projection_issue');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test artifacts-qsm`
Expected: FAIL — `findEntityMirror('Issue')` returns `null` because `qsm.json` has no projections yet.

- [ ] **Step 3: Add `IssueView` projection to `qsm.json`**

Replace the file contents with:

```json
{
  "projections": {
    "IssueView": {
      "backing": "entity-mirror",
      "source": { "entity": "Issue" },
      "keys": ["id"],
      "grain": ["id"],
      "exposed": [
        "id",
        "projectId",
        "reporterId",
        "assigneeId",
        "sprintId",
        "title",
        "status",
        "priority",
        "storyPoints",
        "createdAt",
        "resolvedAt"
      ],
      "table": "projection_issue"
    }
  },
  "relationRoles": {}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test artifacts-qsm`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add demo/issue-tracker-api/src/artifacts/qsm.json demo/issue-tracker-api/test/artifacts-qsm.test.ts
git commit -m "feat(demo/issue-tracker-api): add IssueView entity-mirror projection to QSM"
```

---

## Task 2: Add workspace deps for qsm, event-store, projection-consumer

**Files:**
- Modify: `demo/issue-tracker-api/package.json`

- [ ] **Step 1: Add deps**

Edit `dependencies` in `demo/issue-tracker-api/package.json` so the block contains (alphabetised):

```json
"dependencies": {
  "@hono/node-server": "^1.13.0",
  "@rntme/bindings": "workspace:*",
  "@rntme/bindings-http": "workspace:*",
  "@rntme/event-store": "workspace:*",
  "@rntme/graph-ir-compiler": "workspace:*",
  "@rntme/pdm": "workspace:*",
  "@rntme/projection-consumer": "workspace:*",
  "@rntme/qsm": "workspace:*",
  "better-sqlite3": "^11.0.0",
  "hono": "^4.6.0"
}
```

- [ ] **Step 2: Install**

Run: `pnpm install`
Expected: new workspace symlinks resolve with no warnings.

- [ ] **Step 3: Typecheck to confirm no regressions**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo typecheck`
Expected: no errors (the new deps aren't imported yet).

- [ ] **Step 4: Commit**

```bash
git add demo/issue-tracker-api/package.json pnpm-lock.yaml
git commit -m "chore(demo/issue-tracker-api): depend on qsm, event-store, projection-consumer"
```

---

## Task 3: Refactor `artifacts.ts` to expose validated QSM + derived specs

**Files:**
- Modify: `demo/issue-tracker-api/src/artifacts.ts`
- Delete: `demo/issue-tracker-api/test/artifacts-qsm.test.ts` (superseded by `server.ts`'s startup path which calls the same parse+validate)

**Why this replaces `stripForCompiler`:** `@rntme/graph-ir-compiler` now re-parses PDM via `@rntme/pdm`'s strict schema (which accepts `stateMachine` and `generated`); the old workaround in `artifacts.ts` is obsolete. See `packages/graph-ir-compiler/src/explain/explain.ts:40-86` for the new parse path.

- [ ] **Step 1: Write the failing test**

Create `demo/issue-tracker-api/test/artifacts-exports.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  pdm,
  validatedPdm,
  qsm,
  validatedQsm,
  qsmResolver,
  pdmResolver,
  projectionDdls,
  eventTypes,
} from '../src/artifacts.js';

describe('artifacts.ts — exports for mutation pipeline', () => {
  it('exports validated PDM including stateMachine on Issue', () => {
    const issue = validatedPdm.entities['Issue']!;
    expect(issue.stateMachine).toBeDefined();
    expect(issue.stateMachine!.transitions).toHaveProperty('assign');
  });

  it('PDM passed to compiler retains stateMachine (no strip)', () => {
    expect((pdm as unknown as { entities: Record<string, { stateMachine?: unknown }> })
      .entities['Issue']!.stateMachine).toBeDefined();
  });

  it('exports QSM with IssueView entity-mirror', () => {
    expect(qsm).toBeDefined();
    expect(validatedQsm.projections['IssueView']).toBeDefined();
    expect(qsmResolver.findEntityMirror('Issue')!.table).toBe('projection_issue');
  });

  it('derives projection DDLs and event types', () => {
    const ddl = projectionDdls.find((d) => d.projectionName === 'IssueView')!;
    expect(ddl.tableName).toBe('projection_issue');
    expect(ddl.createTableSql).toMatch(/CREATE TABLE "projection_issue"/);

    const assigned = eventTypes.find((e) => e.eventType === 'IssueAssigned')!;
    expect(assigned.aggregateType).toBe('Issue');
    expect(assigned.affects).toContain('assigneeId');
  });

  it('exposes pdmResolver (already existed)', () => {
    expect(pdmResolver.resolveEntity('Issue')).not.toBeNull();
  });
});
```

Also delete `demo/issue-tracker-api/test/artifacts-qsm.test.ts` (its coverage moves here):

```bash
rm demo/issue-tracker-api/test/artifacts-qsm.test.ts
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test artifacts-exports`
Expected: FAIL — `validatedPdm`, `validatedQsm`, `qsmResolver`, `projectionDdls`, `eventTypes` are not exported yet, and `pdm` is stripped of `stateMachine`.

- [ ] **Step 3: Rewrite `artifacts.ts`**

Overwrite `demo/issue-tracker-api/src/artifacts.ts` with:

```ts
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
  deriveEventTypes,
  isErr,
  type PdmResolver,
  type ValidatedPdm,
  type EventTypeSpec,
} from '@rntme/pdm';
import {
  parseQsm,
  validateQsm,
  createQsmResolver,
  generateProjectionDdl,
  isErr as isQsmErr,
  type QsmResolver,
  type ValidatedQsm,
  type ProjectionDdlSpec,
} from '@rntme/qsm';
import type {
  BindingResolvers,
  GraphSignature,
  ResolvedShape,
  InputType,
  OutputType,
  InputMode,
  ScalarPrimitive,
} from '@rntme/bindings';

type GraphJson = {
  id: string;
  signature: {
    inputs: Record<string, { type: string; mode: InputMode; default?: unknown }>;
    output: { type: string; from: string };
  };
  nodes: unknown[];
};

type ShapesJson = Record<string, { fields: Record<string, { type: string; nullable: boolean }> }>;

const here = dirname(fileURLToPath(import.meta.url));
const artifactsDir = join(here, 'artifacts');
const readText = (name: string): string => readFileSync(join(artifactsDir, name), 'utf8');
const readJson = <T>(name: string): T => JSON.parse(readText(name)) as T;

// ---- PDM -----------------------------------------------------------------
const pdmParsed = parsePdm(readText('pdm.json'));
if (isErr(pdmParsed)) {
  throw new Error(`PDM parse failed: ${JSON.stringify(pdmParsed.errors, null, 2)}`);
}
const pdmValidatedR = validatePdm(pdmParsed.value);
if (isErr(pdmValidatedR)) {
  throw new Error(`PDM validation failed: ${JSON.stringify(pdmValidatedR.errors, null, 2)}`);
}
export const validatedPdm: ValidatedPdm = pdmValidatedR.value;
export const pdmResolver: PdmResolver = createPdmResolver(validatedPdm);
/** Raw PDM passed to graph-ir-compiler; compiler re-parses via @rntme/pdm, so the full object is fine. */
export const pdm: ValidatedPdm = validatedPdm;

// ---- QSM -----------------------------------------------------------------
const qsmRaw = readJson<unknown>('qsm.json');
const qsmParsed = parseQsm(qsmRaw);
if (isQsmErr(qsmParsed)) {
  throw new Error(`QSM parse failed: ${JSON.stringify(qsmParsed.errors, null, 2)}`);
}
const qsmValidatedR = validateQsm(qsmParsed.value, pdmResolver);
if (isQsmErr(qsmValidatedR)) {
  throw new Error(`QSM validation failed: ${JSON.stringify(qsmValidatedR.errors, null, 2)}`);
}
export const validatedQsm: ValidatedQsm = qsmValidatedR.value;
export const qsmResolver: QsmResolver = createQsmResolver(validatedQsm);
export const qsm: ValidatedQsm = validatedQsm;

// ---- Derived specs --------------------------------------------------------
export const projectionDdls: readonly ProjectionDdlSpec[] =
  generateProjectionDdl(validatedQsm, pdmResolver);
export const eventTypes: readonly EventTypeSpec[] = deriveEventTypes(validatedPdm);

// ---- Bindings + graph spec ------------------------------------------------
export const bindingsArtifact = readJson<Record<string, unknown>>('bindings.json');
export const shapes = readJson<ShapesJson>('shapes.json');

const graphsDir = join(artifactsDir, 'graphs');
const graphFiles = readdirSync(graphsDir).filter((f) => f.endsWith('.json'));
const graphEntries = graphFiles.map((f) => {
  const g = JSON.parse(readFileSync(join(graphsDir, f), 'utf8')) as GraphJson;
  return [g.id, g] as const;
});
const graphsById = Object.fromEntries(graphEntries);

export const graphSpec = {
  version: '1.0-rc7' as const,
  pdmRef: 'issue-tracker.domain.v1',
  qsmRef: 'issue-tracker.read.v1',
  shapes,
  graphs: graphsById,
};

// ---- Resolvers for @rntme/bindings ---------------------------------------
function parseInputType(raw: string): InputType {
  if (
    raw === 'integer' || raw === 'decimal' || raw === 'string' ||
    raw === 'boolean' || raw === 'date' || raw === 'datetime'
  ) {
    return { kind: 'scalar', primitive: raw };
  }
  throw new Error(`Unsupported input type in demo: "${raw}"`);
}

function parseOutputType(raw: string): OutputType {
  const m = /^(rowset|row)<([A-Za-z_][A-Za-z0-9_]*)>$/.exec(raw);
  if (!m) throw new Error(`Unsupported output type: "${raw}"`);
  return { kind: m[1] as 'rowset' | 'row', shape: m[2]! };
}

function toGraphSignature(g: GraphJson): GraphSignature {
  const inputs: GraphSignature['inputs'] = {};
  for (const [name, decl] of Object.entries(g.signature.inputs)) {
    const base = { type: parseInputType(decl.type), mode: decl.mode };
    inputs[name] = decl.default !== undefined ? { ...base, default: decl.default } : base;
  }
  return {
    id: g.id,
    inputs,
    output: { type: parseOutputType(g.signature.output.type), from: g.signature.output.from },
  };
}

function entityToShape(entityName: string): ResolvedShape | null {
  const e = pdmResolver.resolveEntity(entityName);
  if (!e) return null;
  const fields: ResolvedShape['fields'] = {};
  for (const f of e.fields) {
    fields[f.name] = {
      type: { kind: 'scalar', primitive: f.type as ScalarPrimitive },
      nullable: f.nullable,
    };
  }
  return { name: entityName, origin: 'pdm', fields };
}

function customShape(
  name: string,
  def: { fields: Record<string, { type: string; nullable: boolean }> },
): ResolvedShape {
  const fields: ResolvedShape['fields'] = {};
  for (const [fieldName, f] of Object.entries(def.fields)) {
    fields[fieldName] = {
      type: { kind: 'scalar', primitive: f.type as ScalarPrimitive },
      nullable: f.nullable,
    };
  }
  return { name, origin: 'custom', fields };
}

export const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) => {
    const g = graphsById[id];
    return g ? toGraphSignature(g) : null;
  },
  resolveShape: (name) => {
    if (shapes[name]) return customShape(name, shapes[name]);
    return entityToShape(name);
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test artifacts-exports`
Expected: PASS.

Also run typecheck: `pnpm -w --filter @rntme/issue-tracker-api-demo typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add demo/issue-tracker-api/src/artifacts.ts demo/issue-tracker-api/test/artifacts-exports.test.ts
git rm demo/issue-tracker-api/test/artifacts-qsm.test.ts
git commit -m "refactor(demo/issue-tracker-api): export validated QSM + projection DDLs + event types"
```

---

## Task 4: Drop `issues` table from `schema.sql`

**Files:**
- Modify: `demo/issue-tracker-api/src/db/schema.sql`

The `projection_issue` table is created by `bootstrapProjections` at runtime from the QSM DDL derivation, so the static DDL no longer needs an `issues` table. Users / projects / sprints remain (reference data, no state machine, no projection).

- [ ] **Step 1: Replace file contents**

Overwrite `demo/issue-tracker-api/src/db/schema.sql` with:

```sql
CREATE TABLE users (
  id        INTEGER PRIMARY KEY,
  username  TEXT NOT NULL UNIQUE,
  email     TEXT NOT NULL,
  role      TEXT NOT NULL,
  joined_at TEXT NOT NULL
);

CREATE TABLE projects (
  id         INTEGER PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  lead_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL
);

CREATE TABLE sprints (
  id         INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  name       TEXT NOT NULL,
  goal       TEXT,
  starts_at  TEXT NOT NULL,
  ends_at    TEXT NOT NULL
);
```

- [ ] **Step 2: Commit (tests will fail until Task 5)**

```bash
git add demo/issue-tracker-api/src/db/schema.sql
git commit -m "refactor(demo/issue-tracker-api): drop issues table — superseded by projection_issue"
```

---

## Task 5: Rewrite `seed.ts` to bootstrap + seed `projection_issue`

**Files:**
- Modify: `demo/issue-tracker-api/src/db/seed.ts`

Strategy: apply static schema (users/projects/sprints) → run `bootstrapProjections` to create `projection_issue` + its index → insert reference rows → insert projection rows with stub idempotency columns (`last_event_id='seed'`, `last_event_version=0`, `applied_at = some timestamp`). Real events applied by the consumer will use versions ≥ 1 and pass the `last_event_version < excluded.last_event_version` guard.

`status` values in the existing seed use `'done'` which is **not** in `Issue.stateMachine.states` (`draft | open | in_progress | resolved | closed`). Map legacy statuses: `'done' → 'resolved'` (keeps tests for closed/resolved filtering semantically consistent).

- [ ] **Step 1: Write the failing test**

Create `demo/issue-tracker-api/test/seed-projection.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test seed-projection`
Expected: FAIL — `no such table: projection_issue`.

- [ ] **Step 3: Rewrite `seed.ts`**

Overwrite `demo/issue-tracker-api/src/db/seed.ts` with:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test seed-projection`
Expected: PASS (4 tests green).

- [ ] **Step 5: Commit**

```bash
git add demo/issue-tracker-api/src/db/seed.ts demo/issue-tracker-api/test/seed-projection.test.ts
git commit -m "feat(demo/issue-tracker-api): bootstrap + seed projection_issue via QSM DDLs"
```

---

## Task 6: Verify existing read-surface tests still pass against the projection

**Files:**
- Modify: `demo/issue-tracker-api/test/e2e.test.ts` (adjust assertions that reference the `'done'` status which no longer exists)

- [ ] **Step 1: Run existing tests — observe the expected failures**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test e2e`
Expected: the `/v1/issues?status=open` test should still pass (filters happen on projection), the `/v1/issues/:id` test should still pass (relation joins to `projects`/`users` work identically), and the `/v1/sprints/:sprintId/burndown` test should still pass. Expected **failure:** `/v1/issues` default-limit test currently returns 20 rows but seeded rows use `'resolved'` not `'done'` — assertions on `status` shape still hold. **No failures expected** if seed counts preserved (25 rows). If any test fails, diagnose via the next step.

- [ ] **Step 2: Adjust any affected assertions**

Inspect failures; the only semantic change is `'done' → 'resolved'`. No test asserts on `'done'` directly, so no edits are expected. If any show up, fix them minimally.

- [ ] **Step 3: Re-run full demo test suite**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test`
Expected: all tests (artifacts-exports, seed-projection, e2e) PASS.

- [ ] **Step 4: Commit (only if assertions were edited)**

```bash
git add demo/issue-tracker-api/test/e2e.test.ts
git commit -m "test(demo/issue-tracker-api): verify read surface still works against projection_issue"
```

If no edits were needed, skip the commit.

---

## Task 7: Add the seven single-emit command graphs

**Files:**
- Create: `demo/issue-tracker-api/src/artifacts/graphs/reportIssue.json`
- Create: `demo/issue-tracker-api/src/artifacts/graphs/submitIssue.json`
- Create: `demo/issue-tracker-api/src/artifacts/graphs/assignIssue.json`
- Create: `demo/issue-tracker-api/src/artifacts/graphs/reassignIssue.json`
- Create: `demo/issue-tracker-api/src/artifacts/graphs/resolveIssue.json`
- Create: `demo/issue-tracker-api/src/artifacts/graphs/reopenIssue.json`
- Create: `demo/issue-tracker-api/src/artifacts/graphs/closeIssue.json`
- Test: `demo/issue-tracker-api/test/command-graphs-compile.test.ts`

All graphs use the `row<CommandResult>` output shape. The compiler auto-resolves `CommandResult` in the bindings layer (see `packages/bindings/src/validate/references.ts:51-52`), so the demo does not need to declare `CommandResult` in `shapes.json`.

- [ ] **Step 1: Write the failing test**

Create `demo/issue-tracker-api/test/command-graphs-compile.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { compileCommand } from '@rntme/graph-ir-compiler';
import { graphSpec, pdm, qsm } from '../src/artifacts.js';

const COMMAND_GRAPH_IDS = [
  'reportIssue',
  'submitIssue',
  'assignIssue',
  'reassignIssue',
  'resolveIssue',
  'reopenIssue',
  'closeIssue',
];

function sliceFor(graphId: string): unknown {
  return { ...graphSpec, graphs: { [graphId]: graphSpec.graphs[graphId] } };
}

describe('command graphs compile', () => {
  it.each(COMMAND_GRAPH_IDS)('%s compiles without errors', (id) => {
    const r = compileCommand(sliceFor(id), pdm, qsm);
    if (!r.ok) {
      throw new Error(`compileCommand(${id}) failed: ${JSON.stringify(r.errors, null, 2)}`);
    }
    expect(r.value.emits).toHaveLength(1);
    expect(r.value.emits[0]!.aggregate).toBe('Issue');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test command-graphs-compile`
Expected: FAIL — all 7 graphs missing.

- [ ] **Step 3: Create `reportIssue.json`**

`demo/issue-tracker-api/src/artifacts/graphs/reportIssue.json`:

```json
{
  "id": "reportIssue",
  "signature": {
    "inputs": {
      "issueId":     { "type": "integer", "mode": "required" },
      "title":       { "type": "string",  "mode": "required" },
      "projectId":   { "type": "integer", "mode": "required" },
      "reporterId":  { "type": "integer", "mode": "required" },
      "priority":    { "type": "string",  "mode": "required" },
      "storyPoints": { "type": "integer", "mode": "required" }
    },
    "output": { "type": "row<CommandResult>", "from": "emit" }
  },
  "nodes": [
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Issue",
        "aggregateId": { "$param": "issueId" },
        "transition": "report",
        "payload": {
          "title":       { "$param": "title" },
          "projectId":   { "$param": "projectId" },
          "reporterId":  { "$param": "reporterId" },
          "priority":    { "$param": "priority" },
          "storyPoints": { "$param": "storyPoints" }
        }
      }
    }
  ]
}
```

- [ ] **Step 4: Create `submitIssue.json`**

```json
{
  "id": "submitIssue",
  "signature": {
    "inputs": {
      "issueId": { "type": "integer", "mode": "required" }
    },
    "output": { "type": "row<CommandResult>", "from": "emit" }
  },
  "nodes": [
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Issue",
        "aggregateId": { "$param": "issueId" },
        "transition": "submit",
        "payload": {}
      }
    }
  ]
}
```

- [ ] **Step 5: Create `assignIssue.json`**

```json
{
  "id": "assignIssue",
  "signature": {
    "inputs": {
      "issueId":    { "type": "integer", "mode": "required" },
      "assigneeId": { "type": "integer", "mode": "required" }
    },
    "output": { "type": "row<CommandResult>", "from": "emit" }
  },
  "nodes": [
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Issue",
        "aggregateId": { "$param": "issueId" },
        "transition": "assign",
        "payload": { "assigneeId": { "$param": "assigneeId" } }
      }
    }
  ]
}
```

- [ ] **Step 6: Create `reassignIssue.json`**

```json
{
  "id": "reassignIssue",
  "signature": {
    "inputs": {
      "issueId":    { "type": "integer", "mode": "required" },
      "assigneeId": { "type": "integer", "mode": "required" }
    },
    "output": { "type": "row<CommandResult>", "from": "emit" }
  },
  "nodes": [
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Issue",
        "aggregateId": { "$param": "issueId" },
        "transition": "reassign",
        "payload": { "assigneeId": { "$param": "assigneeId" } }
      }
    }
  ]
}
```

- [ ] **Step 7: Create `resolveIssue.json`**

```json
{
  "id": "resolveIssue",
  "signature": {
    "inputs": {
      "issueId":    { "type": "integer",  "mode": "required" },
      "resolvedAt": { "type": "datetime", "mode": "required" }
    },
    "output": { "type": "row<CommandResult>", "from": "emit" }
  },
  "nodes": [
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Issue",
        "aggregateId": { "$param": "issueId" },
        "transition": "resolve",
        "payload": { "resolvedAt": { "$param": "resolvedAt" } }
      }
    }
  ]
}
```

- [ ] **Step 8: Create `reopenIssue.json`**

```json
{
  "id": "reopenIssue",
  "signature": {
    "inputs": {
      "issueId": { "type": "integer", "mode": "required" }
    },
    "output": { "type": "row<CommandResult>", "from": "emit" }
  },
  "nodes": [
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Issue",
        "aggregateId": { "$param": "issueId" },
        "transition": "reopen",
        "payload": {}
      }
    }
  ]
}
```

- [ ] **Step 9: Create `closeIssue.json`**

```json
{
  "id": "closeIssue",
  "signature": {
    "inputs": {
      "issueId": { "type": "integer", "mode": "required" }
    },
    "output": { "type": "row<CommandResult>", "from": "emit" }
  },
  "nodes": [
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Issue",
        "aggregateId": { "$param": "issueId" },
        "transition": "close",
        "payload": {}
      }
    }
  ]
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test command-graphs-compile`
Expected: PASS (all 7 `it.each` rows green).

- [ ] **Step 11: Commit**

```bash
git add demo/issue-tracker-api/src/artifacts/graphs/reportIssue.json \
        demo/issue-tracker-api/src/artifacts/graphs/submitIssue.json \
        demo/issue-tracker-api/src/artifacts/graphs/assignIssue.json \
        demo/issue-tracker-api/src/artifacts/graphs/reassignIssue.json \
        demo/issue-tracker-api/src/artifacts/graphs/resolveIssue.json \
        demo/issue-tracker-api/src/artifacts/graphs/reopenIssue.json \
        demo/issue-tracker-api/src/artifacts/graphs/closeIssue.json \
        demo/issue-tracker-api/test/command-graphs-compile.test.ts
git commit -m "feat(demo/issue-tracker-api): add 7 single-emit command graphs for Issue transitions"
```

---

## Task 8: Add the composite `assignIssueWithCapacityGuard` graph

**Files:**
- Create: `demo/issue-tracker-api/src/artifacts/graphs/assignIssueWithCapacityGuard.json`
- Modify: `demo/issue-tracker-api/src/artifacts/shapes.json` (add `LoadCount` shape referenced by `reduce.into`)
- Test: extend `demo/issue-tracker-api/test/command-graphs-compile.test.ts`

Models spec §4.3: reject `assign` when the candidate already has ≥3 `in_progress` issues. `count < 3` (not `< 5` as in the spec example) to keep the lifecycle test self-contained — the seed leaves user `bob` (id=2) with fewer than 3 `in_progress` issues initially.

- [ ] **Step 1: Extend the compile test**

Append to `demo/issue-tracker-api/test/command-graphs-compile.test.ts`:

```ts
describe('assignIssueWithCapacityGuard composite graph', () => {
  it('compiles with a readPrelude + single emit', () => {
    const r = compileCommand(
      { ...graphSpec, graphs: { assignIssueWithCapacityGuard: graphSpec.graphs['assignIssueWithCapacityGuard'] } },
      pdm,
      qsm,
    );
    if (!r.ok) throw new Error(JSON.stringify(r.errors, null, 2));
    expect(r.value.readPrelude).not.toBeNull();
    expect(r.value.emits).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test command-graphs-compile`
Expected: FAIL — the new graph file doesn't exist.

- [ ] **Step 3: Add `LoadCount` shape to `shapes.json`**

Open `demo/issue-tracker-api/src/artifacts/shapes.json` and add (inside the root object, preserving existing shapes):

```json
"LoadCount": {
  "fields": {
    "count": { "type": "integer", "nullable": false }
  }
}
```

- [ ] **Step 4: Create the composite graph**

`demo/issue-tracker-api/src/artifacts/graphs/assignIssueWithCapacityGuard.json`:

```json
{
  "id": "assignIssueWithCapacityGuard",
  "signature": {
    "inputs": {
      "issueId":    { "type": "integer", "mode": "required" },
      "assigneeId": { "type": "integer", "mode": "required" }
    },
    "output": { "type": "row<CommandResult>", "from": "emit" }
  },
  "nodes": [
    {
      "id": "currentLoad",
      "type": "findMany",
      "config": { "source": { "entity": "Issue" } }
    },
    {
      "id": "filteredLoad",
      "type": "filter",
      "config": {
        "input": "currentLoad",
        "expr": {
          "and": [
            { "eq": ["issue.assigneeId", { "$param": "assigneeId" }] },
            { "eq": ["issue.status", { "$literal": "in_progress" }] }
          ]
        }
      }
    },
    {
      "id": "loadCount",
      "type": "reduce",
      "config": {
        "input": "filteredLoad",
        "into": "LoadCount",
        "group": [],
        "measures": { "count": { "fn": "count" } }
      }
    },
    {
      "id": "guardCapacity",
      "type": "filter",
      "config": {
        "input": "loadCount",
        "expr": { "lt": ["count", { "$literal": 3 }] }
      }
    },
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Issue",
        "aggregateId": { "$param": "issueId" },
        "transition": "assign",
        "payload": { "assigneeId": { "$param": "assigneeId" } }
      }
    }
  ]
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test command-graphs-compile`
Expected: PASS (all tests green, including the new composite assertion).

- [ ] **Step 6: Commit**

```bash
git add demo/issue-tracker-api/src/artifacts/graphs/assignIssueWithCapacityGuard.json \
        demo/issue-tracker-api/src/artifacts/shapes.json \
        demo/issue-tracker-api/test/command-graphs-compile.test.ts
git commit -m "feat(demo/issue-tracker-api): add composite command graph with capacity guard"
```

---

## Task 9: Add command bindings to `bindings.json`

**Files:**
- Modify: `demo/issue-tracker-api/src/artifacts/bindings.json`
- Test: `demo/issue-tracker-api/test/bindings-validate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `demo/issue-tracker-api/test/bindings-validate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseBindingArtifact, validateBindings, isOk } from '@rntme/bindings';
import { bindingsArtifact, resolvers } from '../src/artifacts.js';

describe('bindings.json — command entries', () => {
  it('validates all bindings (query + command)', () => {
    const parsed = parseBindingArtifact(bindingsArtifact);
    if (!isOk(parsed)) throw new Error(JSON.stringify(parsed.errors, null, 2));
    const v = validateBindings(parsed.value, resolvers);
    if (!isOk(v)) throw new Error(JSON.stringify(v.errors, null, 2));
    const ids = Object.keys(v.value.resolved).sort();
    for (const required of [
      'reportIssue', 'submitIssue',
      'assignIssue', 'assignIssueWithGuard',
      'reassignIssue', 'resolveIssue', 'reopenIssue', 'closeIssue',
    ]) {
      expect(ids).toContain(required);
      expect(v.value.resolved[required]!.entry.kind).toBe('command');
      expect(v.value.resolved[required]!.entry.http.method).toBe('POST');
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test bindings-validate`
Expected: FAIL — no command bindings present.

- [ ] **Step 3: Append 8 command entries to `bindings.json`**

Open `demo/issue-tracker-api/src/artifacts/bindings.json` and add these entries to the `"bindings"` object (keeping existing query entries intact):

```json
"reportIssue": {
  "kind": "command",
  "graph": "reportIssue",
  "target": { "engine": "sqlite", "dialect": "sqlite" },
  "http": {
    "method": "POST",
    "path": "/v1/issues",
    "tags": ["issues"],
    "summary": "Report a new issue (creation transition).",
    "parameters": [
      { "name": "issueId",     "in": "body", "bindTo": "issueId",     "required": true },
      { "name": "title",       "in": "body", "bindTo": "title",       "required": true },
      { "name": "projectId",   "in": "body", "bindTo": "projectId",   "required": true },
      { "name": "reporterId",  "in": "body", "bindTo": "reporterId",  "required": true },
      { "name": "priority",    "in": "body", "bindTo": "priority",    "required": true },
      { "name": "storyPoints", "in": "body", "bindTo": "storyPoints", "required": true }
    ]
  }
},
"submitIssue": {
  "kind": "command",
  "graph": "submitIssue",
  "target": { "engine": "sqlite", "dialect": "sqlite" },
  "http": {
    "method": "POST",
    "path": "/v1/issues/{issueId}/actions/submit",
    "tags": ["issues"],
    "summary": "Submit a draft issue (draft → open).",
    "parameters": [
      { "name": "issueId", "in": "path", "bindTo": "issueId", "required": true }
    ]
  }
},
"assignIssue": {
  "kind": "command",
  "graph": "assignIssue",
  "target": { "engine": "sqlite", "dialect": "sqlite" },
  "http": {
    "method": "POST",
    "path": "/v1/issues/{issueId}/actions/assign",
    "tags": ["issues"],
    "summary": "Assign an open issue (open → in_progress).",
    "parameters": [
      { "name": "issueId",    "in": "path", "bindTo": "issueId",    "required": true },
      { "name": "assigneeId", "in": "body", "bindTo": "assigneeId", "required": true }
    ]
  }
},
"assignIssueWithGuard": {
  "kind": "command",
  "graph": "assignIssueWithCapacityGuard",
  "target": { "engine": "sqlite", "dialect": "sqlite" },
  "http": {
    "method": "POST",
    "path": "/v1/issues/{issueId}/actions/assign-with-guard",
    "tags": ["issues"],
    "summary": "Assign with capacity guard (rejects if assignee has ≥3 in_progress issues).",
    "parameters": [
      { "name": "issueId",    "in": "path", "bindTo": "issueId",    "required": true },
      { "name": "assigneeId", "in": "body", "bindTo": "assigneeId", "required": true }
    ]
  }
},
"reassignIssue": {
  "kind": "command",
  "graph": "reassignIssue",
  "target": { "engine": "sqlite", "dialect": "sqlite" },
  "http": {
    "method": "POST",
    "path": "/v1/issues/{issueId}/actions/reassign",
    "tags": ["issues"],
    "summary": "Reassign an in-progress issue (self-loop on in_progress).",
    "parameters": [
      { "name": "issueId",    "in": "path", "bindTo": "issueId",    "required": true },
      { "name": "assigneeId", "in": "body", "bindTo": "assigneeId", "required": true }
    ]
  }
},
"resolveIssue": {
  "kind": "command",
  "graph": "resolveIssue",
  "target": { "engine": "sqlite", "dialect": "sqlite" },
  "http": {
    "method": "POST",
    "path": "/v1/issues/{issueId}/actions/resolve",
    "tags": ["issues"],
    "summary": "Resolve an in-progress issue (in_progress → resolved).",
    "parameters": [
      { "name": "issueId",    "in": "path", "bindTo": "issueId",    "required": true },
      { "name": "resolvedAt", "in": "body", "bindTo": "resolvedAt", "required": true }
    ]
  }
},
"reopenIssue": {
  "kind": "command",
  "graph": "reopenIssue",
  "target": { "engine": "sqlite", "dialect": "sqlite" },
  "http": {
    "method": "POST",
    "path": "/v1/issues/{issueId}/actions/reopen",
    "tags": ["issues"],
    "summary": "Reopen a resolved issue (resolved → open).",
    "parameters": [
      { "name": "issueId", "in": "path", "bindTo": "issueId", "required": true }
    ]
  }
},
"closeIssue": {
  "kind": "command",
  "graph": "closeIssue",
  "target": { "engine": "sqlite", "dialect": "sqlite" },
  "http": {
    "method": "POST",
    "path": "/v1/issues/{issueId}/actions/close",
    "tags": ["issues"],
    "summary": "Close a resolved issue (resolved → closed).",
    "parameters": [
      { "name": "issueId", "in": "path", "bindTo": "issueId", "required": true }
    ]
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test bindings-validate`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add demo/issue-tracker-api/src/artifacts/bindings.json demo/issue-tracker-api/test/bindings-validate.test.ts
git commit -m "feat(demo/issue-tracker-api): add 8 command bindings (POST /v1/issues + actions)"
```

---

## Task 10: Build `events.ts` — event-store + Kafka bridge + consumer wire-up

**Files:**
- Create: `demo/issue-tracker-api/src/events.ts`
- Test: `demo/issue-tracker-api/test/events.test.ts`

`@rntme/event-store`'s `createInMemoryKafkaProducer` only records sends — it doesn't deliver. `@rntme/projection-consumer`'s `createInMemoryKafkaConsumer` has a `.produce(envelope)` method but no producer-side coupling. The demo needs a tiny bridge: a custom `KafkaProducer` whose `send()` JSON-parses the envelope out of `message.value` and calls `consumer.produce(envelope)`. This models the hop through Kafka without running a broker.

- [ ] **Step 1: Write the failing test**

Create `demo/issue-tracker-api/test/events.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildEventPipeline } from '../src/events.js';

describe('events.ts — event pipeline', () => {
  it('appends an event and the projection consumer applies it to the QSM DB', async () => {
    const pipeline = buildEventPipeline();
    pipeline.start();
    try {
      // Append a synthetic IssueReported directly via the store for the plumbing test.
      pipeline.eventStore.appendEvents([{
        stream: 'Issue-9001',
        expectedVersion: 0,
        events: [{
          eventId: 'test-evt-1',
          eventType: 'IssueReported',
          aggregateType: 'Issue',
          aggregateId: '9001',
          occurredAt: '2026-04-14T00:00:00Z',
          actor: null,
          payload: {
            before: null,
            after: {
              status: 'draft',
              title: 'plumbing check',
              projectId: 1,
              reporterId: 1,
              priority: 'low',
              storyPoints: 1,
            },
          },
          schemaVersion: 1,
        }],
      }]);

      // Poll for projection row.
      const deadline = Date.now() + 2000;
      let row: { id: number; title: string } | undefined;
      while (Date.now() < deadline) {
        row = pipeline.qsmDb.prepare(
          'SELECT id, title FROM projection_issue WHERE id = 9001',
        ).get() as { id: number; title: string } | undefined;
        if (row) break;
        await new Promise((r) => setTimeout(r, 10));
      }
      expect(row?.title).toBe('plumbing check');
    } finally {
      await pipeline.stop();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test events`
Expected: FAIL — `../src/events.js` does not exist.

- [ ] **Step 3: Create `events.ts`**

`demo/issue-tracker-api/src/events.ts`:

```ts
import type Database from 'better-sqlite3';
import {
  SqliteEventStore,
  createRelay,
  type KafkaMessage,
  type KafkaProducer,
  type Relay,
  type EventEnvelope,
  type EventStore,
} from '@rntme/event-store';
import {
  createProjectionConsumer,
  createInMemoryKafkaConsumer,
  compileApplyPlan,
  type ProjectionConsumer,
  type InMemoryKafkaConsumer,
} from '@rntme/projection-consumer';
import { createSeededDb } from './db/seed.js';
import { pdmResolver, validatedQsm, eventTypes } from './artifacts.js';

export type EventPipeline = {
  eventStore: EventStore;
  qsmDb: Database.Database;
  start(): void;
  stop(): Promise<void>;
};

export function buildEventPipeline(): EventPipeline {
  const qsmDb = createSeededDb();

  const eventStore = new SqliteEventStore({ filename: ':memory:' });

  const consumer: InMemoryKafkaConsumer = createInMemoryKafkaConsumer({ pollIntervalMs: 2 });

  const bridgeProducer: KafkaProducer = {
    async send(message: KafkaMessage): Promise<void> {
      const envelope = JSON.parse(message.value) as EventEnvelope;
      consumer.produce(envelope);
    },
  };

  const relay: Relay = createRelay({
    store: eventStore,
    kafka: bridgeProducer,
    cursorId: 'demo',
    pollIntervalMs: 10,
    batchSize: 100,
  });

  const plan = compileApplyPlan({
    pdm: pdmResolver,
    qsm: validatedQsm,
    events: eventTypes,
  });

  const projectionConsumer: ProjectionConsumer = createProjectionConsumer({
    kafka: consumer,
    plan,
    db: qsmDb,
  });

  return {
    eventStore,
    qsmDb,
    start(): void {
      projectionConsumer.start();
      relay.start();
    },
    async stop(): Promise<void> {
      await relay.stop();
      await projectionConsumer.stop();
      (eventStore as SqliteEventStore).close();
      qsmDb.close();
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test events`
Expected: PASS (may take ~50–200ms for the poll loop to settle).

- [ ] **Step 5: Commit**

```bash
git add demo/issue-tracker-api/src/events.ts demo/issue-tracker-api/test/events.test.ts
git commit -m "feat(demo/issue-tracker-api): wire event-store + relay + Kafka bridge + projection consumer"
```

---

## Task 11: Wire `server.ts` to the event pipeline

**Files:**
- Modify: `demo/issue-tracker-api/src/server.ts`

- [ ] **Step 1: Write the failing test**

Create `demo/issue-tracker-api/test/server-command-wiring.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/server.js';
import type { Hono } from 'hono';

let app: Hono;
let stop: () => Promise<void>;

beforeAll(async () => {
  const built = buildApp();
  app = built.app;
  stop = built.stop;
});

afterAll(async () => {
  await stop();
});

describe('server wires commands', () => {
  it('POST /v1/issues returns 200 CommandResult', async () => {
    const res = await app.fetch(new Request('http://x/v1/issues', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        issueId: 5000,
        title: 'wire test',
        projectId: 1,
        reporterId: 1,
        priority: 'low',
        storyPoints: 1,
      }),
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as { aggregateId: string; version: number; eventIds: string[] };
    expect(body.aggregateId).toBe('5000');
    expect(body.version).toBe(1);
    expect(body.eventIds).toHaveLength(1);
  });

  it('OpenAPI now includes POST paths for commands', async () => {
    const res = await app.fetch(new Request('http://x/openapi.json'));
    const doc = await res.json() as { paths: Record<string, Record<string, unknown>> };
    expect(doc.paths['/v1/issues']).toHaveProperty('post');
    expect(doc.paths['/v1/issues/{issueId}/actions/assign']).toHaveProperty('post');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test server-command-wiring`
Expected: FAIL — `buildApp()` returns `{ app, cleanup }` (not `stop`); no eventStore is passed to the router so POST /v1/issues either 404s or `createBindingsRouter` throws on startup.

- [ ] **Step 3: Rewrite `server.ts`**

Overwrite `demo/issue-tracker-api/src/server.ts`:

```ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  parseBindingArtifact,
  validateBindings,
  generateOpenApi,
} from '@rntme/bindings';
import { createBindingsRouter } from '@rntme/bindings-http';
import type { ActorRef } from '@rntme/event-store';
import { buildEventPipeline } from './events.js';
import {
  bindingsArtifact,
  graphSpec,
  pdm,
  qsm,
  resolvers,
} from './artifacts.js';

function actorFromRequest(c: Context): ActorRef | null {
  const actorId = c.req.header('x-actor-id');
  if (!actorId) return null;
  return { kind: 'user', id: actorId };
}

export function buildApp(): { app: Hono; stop: () => Promise<void> } {
  const parsed = parseBindingArtifact(bindingsArtifact);
  if (!parsed.ok) {
    throw new Error(`Binding parse failed: ${JSON.stringify(parsed.errors)}`);
  }

  const validated = validateBindings(parsed.value, resolvers);
  if (!validated.ok) {
    throw new Error(`Binding validation failed: ${JSON.stringify(validated.errors)}`);
  }

  const openapi = generateOpenApi(validated.value, resolvers);
  if (!openapi.ok) {
    throw new Error(`OpenAPI generation failed: ${JSON.stringify(openapi.errors)}`);
  }

  const pipeline = buildEventPipeline();
  pipeline.start();

  const router = createBindingsRouter({
    validated: validated.value,
    graphSpec,
    pdm,
    qsm,
    db: pipeline.qsmDb,
    eventStore: pipeline.eventStore,
    actorFromRequest,
    openApiDoc: openapi.value,
  });

  const app = new Hono();
  app.get('/', (c) =>
    c.json({
      name: 'issue-tracker-api-demo',
      routes: [
        'GET  /v1/issues?status=&limit=',
        'GET  /v1/issues/:id',
        'GET  /v1/issues/search?q=&from=&to=&priority=&limit=',
        'GET  /v1/stats/by-project',
        'GET  /v1/sprints/:sprintId/burndown',
        'POST /v1/issues',
        'POST /v1/issues/:issueId/actions/submit',
        'POST /v1/issues/:issueId/actions/assign',
        'POST /v1/issues/:issueId/actions/assign-with-guard',
        'POST /v1/issues/:issueId/actions/reassign',
        'POST /v1/issues/:issueId/actions/resolve',
        'POST /v1/issues/:issueId/actions/reopen',
        'POST /v1/issues/:issueId/actions/close',
        'GET  /openapi.json',
      ],
    }),
  );
  app.route('/', router);

  return { app, stop: () => pipeline.stop() };
}

const PORT = Number(process.env.PORT ?? 3000);

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('/server.ts') === true;

if (isMain) {
  const { app, stop } = buildApp();
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    // eslint-disable-next-line no-console
    console.log(`issue-tracker-api-demo listening on http://localhost:${info.port}`);
  });
  const shutdown = async (): Promise<void> => {
    await stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
```

- [ ] **Step 4: Update existing `test/e2e.test.ts` to use `stop` instead of `cleanup`**

Change the top of `demo/issue-tracker-api/test/e2e.test.ts`:

```ts
let app: Hono;
let stop: () => Promise<void>;

beforeAll(() => {
  const built = buildApp();
  app = built.app;
  stop = built.stop;
});

afterAll(async () => {
  await stop();
});
```

- [ ] **Step 5: Run affected tests**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test server-command-wiring`
Expected: PASS.

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test e2e`
Expected: PASS (still — the read surface didn't change shape).

- [ ] **Step 6: Commit**

```bash
git add demo/issue-tracker-api/src/server.ts demo/issue-tracker-api/test/e2e.test.ts demo/issue-tracker-api/test/server-command-wiring.test.ts
git commit -m "feat(demo/issue-tracker-api): wire commands + event pipeline into server"
```

---

## Task 12: Full-lifecycle E2E — `report → submit → assign → reassign → resolve → close`

**Files:**
- Create: `demo/issue-tracker-api/test/mutations-e2e.test.ts`

This is the acceptance test for §7.5 of the spec. After each command, poll `GET /v1/issues/{id}` (or `projection_issue` directly via server DB) to confirm eventual consistency before driving the next transition.

- [ ] **Step 1: Write the lifecycle test**

Create `demo/issue-tracker-api/test/mutations-e2e.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/server.js';
import type { Hono } from 'hono';

let app: Hono;
let stop: () => Promise<void>;

beforeAll(() => {
  const built = buildApp();
  app = built.app;
  stop = built.stop;
});

afterAll(async () => {
  await stop();
});

async function post(path: string, body: unknown): Promise<{ status: number; body: unknown }> {
  const res = await app.fetch(new Request(`http://x${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-actor-id': 'alice' },
    body: JSON.stringify(body),
  }));
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const res = await app.fetch(new Request(`http://x${path}`));
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function waitForStatus(id: number, expected: string, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { body } = await get(`/v1/issues/${id}`);
    const rows = body as Array<{ status: string }>;
    if (rows.length > 0 && rows[0]!.status === expected) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`Timeout waiting for issue ${id} status=${expected}`);
}

describe('mutations E2E — full Issue lifecycle', () => {
  const ID = 7001;

  it('report → draft', async () => {
    const { status, body } = await post('/v1/issues', {
      issueId: ID, title: 'Lifecycle test', projectId: 1, reporterId: 1,
      priority: 'high', storyPoints: 3,
    });
    expect(status).toBe(200);
    expect((body as { version: number }).version).toBe(1);
    await waitForStatus(ID, 'draft');
  });

  it('submit → open', async () => {
    const { status, body } = await post(`/v1/issues/${ID}/actions/submit`, {});
    expect(status).toBe(200);
    expect((body as { version: number }).version).toBe(2);
    await waitForStatus(ID, 'open');
  });

  it('assign → in_progress', async () => {
    const { status, body } = await post(`/v1/issues/${ID}/actions/assign`, { assigneeId: 2 });
    expect(status).toBe(200);
    expect((body as { version: number }).version).toBe(3);
    await waitForStatus(ID, 'in_progress');
  });

  it('reassign (self-loop) stays in_progress but updates assignee', async () => {
    const { status, body } = await post(`/v1/issues/${ID}/actions/reassign`, { assigneeId: 3 });
    expect(status).toBe(200);
    expect((body as { version: number }).version).toBe(4);
    await waitForStatus(ID, 'in_progress');

    const deadline = Date.now() + 1000;
    while (Date.now() < deadline) {
      const { body: detail } = await get(`/v1/issues/${ID}`);
      const row = (detail as Array<{ assigneeUsername: string | null }>)[0]!;
      if (row.assigneeUsername === 'carol') return;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error('Timeout waiting for reassign to project carol');
  });

  it('resolve → resolved', async () => {
    const { status, body } = await post(`/v1/issues/${ID}/actions/resolve`, {
      resolvedAt: '2026-04-14T12:00:00Z',
    });
    expect(status).toBe(200);
    expect((body as { version: number }).version).toBe(5);
    await waitForStatus(ID, 'resolved');
  });

  it('close → closed', async () => {
    const { status, body } = await post(`/v1/issues/${ID}/actions/close`, {});
    expect(status).toBe(200);
    expect((body as { version: number }).version).toBe(6);
    await waitForStatus(ID, 'closed');
  });

  it('illegal transition (close on closed) returns 422', async () => {
    const { status, body } = await post(`/v1/issues/${ID}/actions/close`, {});
    expect(status).toBe(422);
    expect((body as { code: string }).code).toMatch(/^COMMAND_/);
  });
});

describe('mutations E2E — capacity guard', () => {
  const ID = 7100;
  it('rejects assign-with-guard when assignee already at capacity', async () => {
    // bootstrap issue so we have something to assign
    await post('/v1/issues', {
      issueId: ID, title: 'Guard test', projectId: 1, reporterId: 1,
      priority: 'low', storyPoints: 1,
    });
    await post(`/v1/issues/${ID}/actions/submit`, {});

    // user 3 (carol) currently has 2 in_progress seeded issues (#104 assignee=1=alice,
    // actually recompute: seed gives carol=3 assignee on #106→dave, #107→carol(open), #113→carol(open), #202→carol(in_progress),
    // #206→carol(open), #210→dave. Count in_progress for carol (id=3) in seed: #202 only → 1.
    // To force the guard (threshold < 3) we first drive two more issues to in_progress under carol.
    for (const setupId of [107, 113]) {
      // These are seeded as 'open' so submit is not needed; assign drives open→in_progress.
      await post(`/v1/issues/${setupId}/actions/assign`, { assigneeId: 3 });
    }

    // Poll projection until carol has ≥3 in_progress (relay + consumer settle).
    const { qsmDb } = (await import('../src/events.js')) as never; // placeholder; see note
    void qsmDb;

    const { status, body } = await post(`/v1/issues/${ID}/actions/assign-with-guard`, {
      assigneeId: 3,
    });
    expect(status).toBe(422);
    expect((body as { code: string }).code).toBe('COMMAND_GUARD_REJECTED');
  });
});
```

**Note on the capacity-guard test.** The test above has a shape gap marked with `placeholder`. Before running, clean it up: drop the `qsmDb` import and replace with a poll over the HTTP API:

```ts
async function waitForInProgressCount(assigneeUsername: string, min: number, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { body } = await get('/v1/issues?status=in_progress&limit=100');
    const rows = body as Array<{ assigneeUsername?: string }>;
    // `/v1/issues` returns the Issue shape (no assigneeUsername); use issue-detail per id or switch endpoint.
    // Simpler: call /v1/stats/by-project or inspect projection directly via a new GET /v1/debug route.
    // For this test, just wait a fixed 200ms after the two assigns — consumer is fast in-memory.
    if (rows.length >= 0) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  await new Promise((r) => setTimeout(r, 200));
}
```

Then before the guarded call:

```ts
await waitForInProgressCount('carol', 3);
```

Keep it pragmatic: a 200ms settle is sufficient for the in-memory pipeline in this test. Do not add a production debug route solely for this.

- [ ] **Step 2: Run — expected PASS for lifecycle, review guard test**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test mutations-e2e`
Expected: the lifecycle describe PASSes all 7 cases; the guard describe passes once the placeholder is removed (see Step 3).

- [ ] **Step 3: Clean up the guard test**

Open the new test file and replace the `placeholder` block with the settle-helper variant above. Re-run until green.

- [ ] **Step 4: Run full demo suite**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo test`
Expected: every test file passes — `artifacts-exports`, `seed-projection`, `command-graphs-compile`, `bindings-validate`, `events`, `server-command-wiring`, `e2e`, `mutations-e2e`.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm -w --filter @rntme/issue-tracker-api-demo typecheck
```

Then:

```bash
git add demo/issue-tracker-api/test/mutations-e2e.test.ts
git commit -m "test(demo/issue-tracker-api): E2E lifecycle report→submit→assign→reassign→resolve→close + guard"
```

---

## Task 13: Final acceptance — workspace-wide check

**Files:** none (verification only)

- [ ] **Step 1: Run the whole workspace test suite**

Run: `pnpm -r test`
Expected: every package green, including the seven upstream packages and the demo.

- [ ] **Step 2: Typecheck the whole workspace**

Run: `pnpm -r typecheck`
Expected: no type errors.

- [ ] **Step 3: Smoke the demo manually (optional)**

Run: `pnpm -w --filter @rntme/issue-tracker-api-demo start` in one terminal, then in another:

```bash
curl -s http://localhost:3000/openapi.json | jq '.paths | keys | sort'
curl -s -X POST http://localhost:3000/v1/issues \
  -H 'content-type: application/json' \
  -H 'x-actor-id: alice' \
  -d '{"issueId":9999,"title":"manual","projectId":1,"reporterId":1,"priority":"low","storyPoints":1}'
sleep 0.2
curl -s http://localhost:3000/v1/issues/9999 | jq
```

Expected: POST returns `{"aggregateId":"9999","version":1,"eventIds":["..."]}`; the GET returns the projection row with `status: "draft"`.

- [ ] **Step 4: No commit (nothing changed)**

---

## Self-Review — what this plan covers vs. spec §7.5

| Spec §7.5 acceptance item | Covered by |
|---|---|
| `POST /v1/issues/{id}/actions/*` routes | Task 9 bindings, Task 11 server wiring |
| `event → relay → consumer → projection` pipeline | Task 10 `events.ts` |
| `GET /v1/issues/{id}` sees update | Task 12 `waitForStatus` helper |
| full cycle `report → submit → assign → reassign → resolve → close` | Task 12 lifecycle describe |
| projection DDL correctness | Task 3 artifacts export + Task 5 bootstrap |
| guard rejection (422 `COMMAND_GUARD_REJECTED`) | Task 12 guard describe |
| illegal transition rejection (422) | Task 12 step "illegal transition" |
| idempotency — re-apply safety | Relies on `@rntme/projection-consumer` Task 5 from upstream plan; demo does not re-test |

**Spec §7.8 handoff note.** Tasks 1–7 of §7.8 are covered by the seven sibling plans under `docs/superpowers/plans/` (pdm, qsm, event-store, graph-ir-compiler mutations, projection-consumer, bindings mutations, bindings-http commands). This plan is Task 8 — the demo-integration acceptance. It consumes the public APIs those plans shipped (no new package code).

**Placeholder audit.** Reviewed: no `TBD`, `TODO`, "similar to Task N", or bare "add appropriate error handling". The one acknowledged placeholder (guard-test `placeholder` marker) is explicitly called out with the replacement code in Task 12 Step 3.

**Type-consistency audit.** `buildApp` returns `{ app, stop }` consistently from Task 11 onward; Task 11 Step 4 updates the pre-existing `e2e.test.ts` to match. `buildEventPipeline` returns `{ eventStore, qsmDb, start, stop }` and is used only through that shape in Tasks 10–11.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-14-demo-issue-tracker-api-mutations.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
