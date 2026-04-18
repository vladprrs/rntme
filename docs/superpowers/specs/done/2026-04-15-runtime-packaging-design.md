# rntme runtime packaging — design

**Status:** Draft
**Date:** 2026-04-15
**Scope:** One new package `@rntme/runtime` + one published Docker image that turns a folder of JSON artifacts into a running service with zero user-written code.

## 1. Goal and non-goals

### Goal

Given a folder of validated artifacts (PDM, QSM, Graph IR graphs, bindings, UI, and a new service-level `manifest.json`), a user or LLM agent can start the corresponding service with a single `docker run` and no code to write, compile, or bundle.

The runtime is **one rntme per service** per the platform vision: cross-service orchestration (Zeebe), sync RPC between services (gRPC), and downstream event transforms (ksqlDB) are explicitly out of scope for rntme itself.

### Non-goals

- Multi-service orchestration or workflow engines.
- Schema evolution / data migrations across service versions. A new PDM/QSM version ships to a fresh database.
- Multi-tenancy inside one runtime process. The platform handles tenancy above rntme.
- A TypeScript authoring DSL or umbrella SDK. Artifact format is JSON; LLM agents author it directly.
- gRPC surface, real Kafka, and Turso in v1. All three have plugin seams and will ship as additive packages.

## 2. Background

The current `demo/issue-tracker-api` ships the whole stack, but every service would have to hand-write ~250 lines of glue:

- `artifacts.ts` — parse and validate PDM/QSM/graphs/bindings/shapes and construct resolvers.
- `events.ts` — construct the SQLite event-store, an in-memory Kafka bridge, the relay, and the projection consumer.
- `server.ts` — compose a Hono app with `bindings-http` + `ui-runtime` + `/openapi.json` + a `GET /` route inventory.

That glue is identical for every service. Rntme's shipping surface today is a library; the missing piece is a runtime package and container image that consume the artifacts directly.

## 3. Overall shape

### 3.1 Distribution

Two delivery paths, both officially supported:

1. **Default (mount artifacts):**
   ```bash
   docker run --rm -p 3000:3000 \
     -v $(pwd)/artifacts:/srv/artifacts:ro \
     ghcr.io/vladprrs/rntme-runtime:1.0
   ```
   One image for the whole platform, artifacts come in via a read-only volume mount. This is the agent-loop happy path and the only path needed for local/ephemeral runs.

2. **Baked image (for immutable prod deploys):**
   A `Dockerfile.template` ships inside the npm package. Users copy it next to their artifacts and produce a versioned service image:
   ```dockerfile
   FROM ghcr.io/vladprrs/rntme-runtime:1.0
   COPY . /srv/artifacts
   ```
   ```bash
   cd artifacts && docker build -t myorg/issue-tracker:2026.04.15 .
   ```
   This path is for teams that want immutable, service-specific images tracked in their own registry and pinned in a K8s Deployment.

### 3.2 Single package, two binaries

The npm package is `@rntme/runtime`. It exposes:

- A programmatic API (`loadService`, `startService`, plugin interfaces, default impls) for embedding, tests, and future plugin authors.
- A CLI with two commands: `rntme-runtime start <dir>` (used as the Docker entrypoint) and `rntme-runtime validate <dir>` (used in CI and by agents before deploy).

There is no separate `@rntme/cli`, no umbrella SDK, and no extension-contracts package. Plugin interfaces are exported from `@rntme/runtime`.

### 3.3 Changes to existing packages

No changes are required to existing packages. `@rntme/ui` already exposes `parseUiArtifact` and `validateUi`; the demo's current TS-const UI is replaced with a `ui.json` that goes through those same functions.

## 4. Artifact layout on disk

The runtime expects a fixed relative layout rooted at the directory passed to `start`/`validate` (defaults to `/srv/artifacts` in the container). No path overrides from `manifest.json`, no glob patterns.

```
<artifacts-dir>/
  manifest.json       # service-level artifact (new)
  pdm.json
  qsm.json
  bindings.json
  shapes.json
  ui.json             # JSON now, not a TS const as in the current demo
  graphs/
    *.json            # any number of files; graph id is defined inside each
```

Why fixed layout: every service has the same shape, agents generate predictable paths, CI and reviewers find artifacts without reading config.

### 4.1 `manifest.json` schema (MVP)

```json
{
  "rntmeVersion": "1.0",
  "service": {
    "name": "issue-tracker-api",
    "version": "2026.04.15-1"
  },
  "surface": {
    "http": {
      "enabled": true,
      "port": 3000
    }
  },
  "persistence": {
    "mode": "ephemeral"
  },
  "bus": {
    "mode": "in-memory"
  },
  "auth": {
    "mode": "header",
    "headerName": "x-actor-id",
    "actorKind": "user"
  },
  "observability": {
    "health":  { "path": "/health" },
    "metrics": { "path": "/metrics" }
  }
}
```

Fields and override behaviour:

| Field | Role | Env override |
|---|---|---|
| `rntmeVersion` | Manifest/runtime contract version. Major mismatch → runtime fails fast on startup. | — |
| `service.name` / `service.version` | Identity strings used in logs, `/`, and future Kafka topic namespaces. **Cannot be overridden by env.** | — |
| `surface.http.enabled` | Whether to mount HTTP surface. Default `true`. | — |
| `surface.http.port` | HTTP listen port. | `RNTME_HTTP_PORT` |
| `persistence.mode` | `"ephemeral"` (default) \| `"persistent"`. | `RNTME_PERSISTENCE_MODE` |
| `persistence.eventStorePath` | File path, required when `persistent`. | `RNTME_EVENT_STORE_PATH` |
| `persistence.qsmPath` | File path, required when `persistent`. | `RNTME_QSM_PATH` |
| `bus.mode` | `"in-memory"` — the only value in MVP. | `RNTME_BUS_MODE` |
| `auth.mode` | `"header"` — the only value in MVP. | — |
| `auth.headerName` | Name of the HTTP header carrying actor id. Anonymous if header absent. | `RNTME_AUTH_HEADER_NAME` |
| `auth.actorKind` | Actor kind string injected into `ActorRef`. Default `"user"`. | — |
| `observability.health.path` | Default `/health`. | — |
| `observability.metrics.path` | Default `/metrics`. | — |

Validation rules:

- Unknown top-level keys → error (strict mode).
- Missing `service.name` or `service.version` → error.
- `persistence.mode === "persistent"` with missing `eventStorePath`/`qsmPath` (after env overrides) → error.
- `rntmeVersion` major != runtime major → error (fail fast).
- Every error has a machine-readable code (`MANIFEST_INVALID_PORT`, `MANIFEST_MISSING_EVENT_STORE_PATH`, `MANIFEST_VERSION_MAJOR_MISMATCH`, …) so that an agent can self-correct.
- Validation returns `Result<ValidatedManifest, ManifestError[]>` in the existing `@rntme/pdm` `Result` style.

## 5. Runtime startup sequence

```
1. Read <artifacts-dir>/manifest.json
   → parse + validate
   → fail fast on rntmeVersion major mismatch

2. Load and validate the five domain artifacts
   → parsePdm + validatePdm                    → ValidatedPdm
   → parseQsm + validateQsm(pdmResolver)        → ValidatedQsm
   → read graphs/*.json                         → GraphSpec
   → parseBindingArtifact + validateBindings    → ValidatedBindings
   → parseUiArtifact + validateUi               → ValidatedUi
   → any error → JSON report to stderr, exit(1)

3. Apply env var overrides over manifest values

4. Instantiate plugins
   → db = BetterSqliteDriver({ path: manifest.persistence.* })
   → bus = InMemoryBus()
   → surfaces = [HttpSurface({ port, basePath, observability })]

5. Initialise DBs (idempotent)
   → event-store DDL (via SqliteEventStore)
   → QSM DDL from generateProjectionDdl (CREATE TABLE IF NOT EXISTS)
   → cursor tables for relay + projection consumer

6. Compile runtime plans
   → projection-consumer: compileApplyPlan({ pdm, qsm, events })
   → generateOpenApi(validatedBindings)              → OpenApiDocument
   → Graph IR SQL compilation is still lazy (first request),
     unchanged from current bindings-http behaviour.

7. Build Hono app
   → mount bindings-http router
   → mount ui-runtime SPA
   → mount GET /openapi.json
   → mount GET /health
   → mount GET /metrics
   → mount GET / (service identity + route inventory)

8. Start background loops
   → relay.start()
   → projectionConsumer.start()

9. listen(port) → log "rntme runtime ready" as one JSON line
```

Any error before step 9 → structured JSON report to stderr + `exit(1)`. No recovery inside startup.

### 5.1 `/health` semantics

`GET /health` returns `200 {ok: true}` when the event store is open, the relay loop is running, and the projection consumer loop is running; `503` otherwise. One endpoint serves both K8s liveness and readiness in MVP. If operational experience later demands a split, `/ready` is added as a minor version.

### 5.2 `/metrics` semantics

Prometheus exposition format, served by `prom-client`. Counters:

- `rntme_commands_total{graph,status}` — command executions.
- `rntme_events_appended_total{stream_type}` — event-store appends.
- `rntme_http_requests_total{route,method,status}` — HTTP request counts.

Gauges:

- `rntme_projection_lag_events` — events appended minus events projected; the primary health signal for the CQRS pipeline.
- `rntme_relay_cursor` — current relay position.

The metric list is additive — new counters/gauges are minor-version changes, removing or renaming is a major.

### 5.3 Graceful shutdown

On `SIGINT`/`SIGTERM`:

1. Stop HTTP listener (new requests rejected).
2. Drain in-flight requests with a timeout. Default 30 s, overridable via `RNTME_SHUTDOWN_TIMEOUT_MS`.
3. `relay.stop()` + `projectionConsumer.stop()`.
4. Close DB handles.
5. `exit(0)`.

## 6. Package API

```ts
// Entry points
export function loadService(dir: string): Result<ValidatedService, ServiceError[]>;
export function startService(
  service: ValidatedService,
  config?: Partial<RuntimeConfig>,
): Promise<RunningService>;

export type ValidatedService = {
  manifest: ValidatedManifest;
  pdm: ValidatedPdm;
  qsm: ValidatedQsm;
  bindings: ValidatedBindings;
  ui: ValidatedUi;
  graphSpec: GraphSpec;
  openApiDoc: OpenApiDocument;
  projectionApplyPlan: ApplyPlan;
  projectionDdls: readonly ProjectionDdlSpec[];
  eventTypes: readonly EventTypeSpec[];
};

export type RunningService = {
  httpPort: number;
  stop(): Promise<void>;
};

// Plugin interfaces
export interface DbDriver {
  open(opts: { purpose: 'event-store' | 'qsm'; path: string | ':memory:' }): DbHandle;
}
export interface DbHandle {
  prepare(sql: string): Statement;
  exec(sql: string): void;
  transaction<T>(fn: () => T): () => T;
  close(): void;
  readonly readonly: boolean;
}
export interface EventBus {
  producer(): KafkaProducerLike;
  consumer(opts: { groupId: string; topic: string }): KafkaConsumerLike;
  start?(): Promise<void>;
  stop?(): Promise<void>;
}
export interface Surface {
  mount(app: Hono, ctx: SurfaceContext): void;
  listen?(): Promise<{ port: number; stop(): Promise<void> }>;
}
export type SurfaceContext = {
  service: ValidatedService;
  eventStore: EventStore;
  qsmDb: DbHandle;
  actorFromRequest: (c: Context) => ActorRef | null;
};

// Defaults
export class BetterSqliteDriver implements DbDriver { … }
export class InMemoryBus implements EventBus { … }
export class HttpSurface implements Surface { … }

// Embedding config (env overrides already applied)
export type RuntimeConfig = {
  db?: DbDriver;
  bus?: EventBus;
  surfaces?: Surface[];
  actorFromRequest?: (c: Context) => ActorRef | null;  // escape hatch, overrides manifest.auth
  onReady?: (info: { port: number }) => void;
};

// Errors (discriminated union with code strings)
export type ServiceError =
  | { code: 'MANIFEST_INVALID'; details: ManifestError[] }
  | { code: 'PDM_INVALID'; details: unknown[] }
  | { code: 'QSM_INVALID'; details: unknown[] }
  | { code: 'BINDINGS_INVALID'; details: unknown[] }
  | { code: 'UI_INVALID'; details: unknown[] }
  | { code: 'GRAPH_INVALID'; details: unknown[] };

// Plugin contract test-kit (publicly exported)
export function runDbDriverContract(driver: DbDriver): void;
export function runEventBusContract(bus: EventBus): void;
export function runSurfaceContract(surface: Surface): void;

export { type Result } from '@rntme/pdm';
```

Deliberately **not** exported: `SqliteEventStore`, `createRelay`, `createProjectionConsumer`, `createBindingsRouter`, `createUiApp`, internal wiring helpers. They become implementation details of `startService`. The existing demo currently imports them directly; the migration in §9 replaces those imports with `loadService` + `startService`.

## 7. Plugin seams

The three interfaces in §6 define the physical boundary between MVP defaults and future additive packages. Real Kafka, Turso, and gRPC slot in without touching the runtime package.

**Planned follow-ups (not in MVP):**

| Package | Implements | Comment |
|---|---|---|
| `@rntme/bus-kafka` | `EventBus` | `KafkaJS` or `node-rdkafka` under the hood. Published separately, paired image `ghcr.io/vladprrs/rntme-runtime-kafka`. |
| `@rntme/db-turso` | `DbDriver` | Drop-in SQL-compatible. Paired image `ghcr.io/vladprrs/rntme-runtime-turso`. |
| `@rntme/bindings-grpc` + `GrpcSurface` | `Surface` | Requires a proto emitter in `@rntme/bindings`, which is separate, larger upstream work. |

In MVP the manifest only exposes `bus.mode: "in-memory"` and `persistence.mode: "ephemeral" | "persistent"`. Plugin selection from manifest (`bus.mode: "kafka"`, etc.) becomes meaningful only in paired images that have the plugin package pre-installed. Embedding users can always pass a plugin via `RuntimeConfig.bus` / `RuntimeConfig.db` / `RuntimeConfig.surfaces`.

The contract test-kit (`runDbDriverContract`, …) is the gate: any new plugin passes the same contract tests that `BetterSqliteDriver` / `InMemoryBus` / `HttpSurface` pass.

## 8. Docker image

### 8.1 Base image (`ghcr.io/vladprrs/rntme-runtime`)

Multi-stage Dockerfile:

```dockerfile
# Stage 1: builder with native toolchain for better-sqlite3
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++
WORKDIR /build
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

# Stage 2: lean runtime image
FROM node:20-alpine
WORKDIR /srv
COPY --from=builder /build/node_modules ./node_modules
COPY package.json ./
COPY dist/ ./dist/
ENV NODE_ENV=production \
    RNTME_ARTIFACTS_DIR=/srv/artifacts \
    RNTME_HTTP_PORT=3000
USER node
EXPOSE 3000
ENTRYPOINT ["node", "dist/bin/runtime.js", "start"]
CMD ["/srv/artifacts"]
```

Target image size: under 150 MB. Native bindings for `better-sqlite3` are built in the builder stage; the final stage ships the compiled `.node` alongside `node_modules` and does not carry the toolchain.

### 8.2 Tag strategy

- `ghcr.io/vladprrs/rntme-runtime:1.0.0` — exact version.
- `ghcr.io/vladprrs/rntme-runtime:1.0` — latest patch in the minor.
- `ghcr.io/vladprrs/rntme-runtime:1` — latest minor in the major.
- `ghcr.io/vladprrs/rntme-runtime:latest` — convenience for local demos; **not** referenced from K8s manifests.

Image tag and npm package version are always equal and released together from a single git tag.

### 8.3 SemVer contract

- **Major**: breaking change in `manifest.json` schema or in the public `@rntme/runtime` exports. `rntmeVersion` must match major-to-major.
- **Minor**: additive manifest fields (optional with defaults), additive plugin interfaces, new metrics, new CLI flags.
- **Patch**: bug and security fixes.

### 8.4 `Dockerfile.template`

A three-line template file shipped inside the npm package at `./Dockerfile.template`:

```dockerfile
FROM ghcr.io/vladprrs/rntme-runtime:1.0
COPY . /srv/artifacts
```

Agents can find it predictably at `node_modules/@rntme/runtime/Dockerfile.template`.

### 8.5 Release pipeline

On `v<semver>` git tag push:

1. Build `@rntme/runtime` and publish to npm.
2. Build the Docker image with matching tags on GHCR.
3. Versions of npm package and image are the same string.

## 9. Testing strategy and demo migration

### 9.1 Runtime package tests

```
packages/runtime/
  src/
    manifest/         # parse + validate manifest.json
    load/             # loadService: orchestrates all artifact parsers/validators
    start/            # startService: wiring event-store, bus, surfaces, Hono
    plugins/
      better-sqlite.ts
      in-memory-bus.ts
      http-surface.ts
    bin/
      runtime.ts      # CLI entrypoint (start, validate)
  test/
    unit/
      manifest.parse.test.ts
      manifest.validate.test.ts
      env-override.test.ts
    integration/
      load-service.test.ts          # valid fixtures → ValidatedService
      load-service.errors.test.ts   # broken fixtures → coded errors
      startup.test.ts               # startService → GET /health → 200
      shutdown.test.ts              # SIGTERM → graceful stop within timeout
      plugin-contracts.test.ts      # run*Contract against MVP defaults
    e2e/
      issue-tracker.test.ts         # same smoke as the current demo test, via runtime
      validate-cli.test.ts          # rntme-runtime validate on fixtures
  fixtures/
    issue-tracker/                  # canonical fixture (shared with demo)
    broken-pdm/
    missing-manifest/
    version-mismatch/
```

E2E uses the same fixtures as the demo. `issue-tracker` fixture is authoritative — the demo directory consumes it rather than duplicating.

### 9.2 Demo migration

Before:

```
demo/issue-tracker-api/src/
  artifacts/*.json + graphs/*.json
  artifacts.ts    (~180 lines)
  events.ts       (~60 lines)
  ui.ts           (hardcoded UI const)
  server.ts       (~150 lines)
```

After:

```
demo/issue-tracker-api/
  artifacts/
    manifest.json          # new
    pdm.json, qsm.json, bindings.json, shapes.json, ui.json
    graphs/*.json
  src/
    server.ts              (~15 lines: loadService + startService)
  test/                    # unchanged; tests HTTP behaviour
  Dockerfile               # ~3 lines, uses FROM rntme-runtime:1.0
  package.json             # "start": "rntme-runtime start ./artifacts"
```

`artifacts.ts` and `events.ts` are deleted outright. `ui.ts` becomes `ui.json` (straight JSON dump of the current const, no logic loss because the UI artifact is already declarative).

Migration order (a hint for the implementation plan):

1. Build `@rntme/runtime` with default impls, `loadService`, `startService`, CLI.
2. Run existing demo fixtures through the runtime in e2e tests — require them green before touching the demo.
3. Migrate the demo: add `manifest.json`, convert `ui.ts` → `ui.json`, delete `artifacts.ts` / `events.ts`, shrink `server.ts`.
4. Add `Dockerfile` in the demo and wire up the GHCR publish pipeline for the base image.

## 10. Risks and mitigations

- **`better-sqlite3` native build on Alpine.** Pre-built binaries may not exist for all architectures; fallback is build-from-source.
  - *Mitigation:* multi-stage Dockerfile with gcc/python in the builder stage. For local embedding, rely on npm prebuilt binaries.
- **In-memory bus + `persistent` mode on restart.** Events that the relay had already published to the in-process bus but the consumer had not yet applied are dropped on restart. The relay cursor ensures catch-up on the next boot (existing `@rntme/event-store` guarantee), so no data is lost — but the consumer's state may lag briefly after restart.
  - *Mitigation:* document explicitly in the manifest schema reference. Persistent deployments that cannot tolerate the lag are expected to use the Kafka plugin when it ships.
- **Docker image size.** Target `< 150 MB`. `node:20-alpine` is small; danger is transitively pulling dev deps.
  - *Mitigation:* strict multi-stage build, `pnpm install --prod`, no source TS in the final image.
- **Agent drift on manifest schema.** An agent emitting an outdated manifest shape with a future runtime.
  - *Mitigation:* `rntmeVersion` in manifest, major-mismatch fail-fast with an unambiguous error code.

## 11. Decision log

| # | Decision | Rationale |
|---|---|---|
| 1 | Ship both: one base image with mounted artifacts (default) and a bake-in `Dockerfile.template`. | Zero-dep agent loop needs the mount path; immutable service images need bake-in. |
| 2 | `manifest.json` co-located with artifacts + env var overrides. | Artifacts stay portable across envs; secrets and env-specific values stay out of git. |
| 3 | Plugin seams + MVP defaults (SQLite file, in-memory bus, HTTP). | Unblocks MVP without designing Kafka/gRPC/Turso today. |
| 4 | No SDK package. Plugin interfaces are exports of `@rntme/runtime`. | Agent is the primary author; an umbrella or DSL would be a drift risk. |
| 5 | One package `@rntme/runtime`, two-command CLI. | Minimum moving parts for MVP; split later if CLI grows rich. |
| 6 | Ephemeral default, persistent by env vars, no seed or reset in the runtime. | Seeding is not a runtime concern; CQRS means using real commands for seed data. |
| 7 | `/health` + `/metrics` in Prometheus; logs are JSON lines on stdout. | K8s probes required; projection lag is the key pipeline signal; no `pino` dep. |
| 8 | `auth.headerName` in manifest; `actorFromRequest` in `RuntimeConfig` as escape hatch. | Ops config belongs in manifest; tests need a programmatic override. |
| 9 | GHCR for images. | Free for public images, first-class GitHub Actions integration. |

## 12. Out of scope for MVP

- Real Kafka bus.
- Turso driver.
- gRPC surface (and the prerequisite proto emitter in `@rntme/bindings`).
- Snapshots, multi-aggregate commands, list/`in` parameters, named predicate graphs, `distinct`, `lookupOne`, window functions.
- Schema evolution / data migrations across service versions.
- Auth/authz beyond the `x-actor-id` header.
- Multi-tenancy inside a single runtime process.
- Structured logger beyond `console`.
- Separate `/ready` endpoint.
- `rntme build` / `rntme dev --watch` commands.
