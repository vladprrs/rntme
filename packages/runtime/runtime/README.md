# @rntme/runtime

Top-level orchestrator for an rntme service: loads a validated artifact directory, boots the event-store / bus / projection / HTTP and gRPC-capable pipeline, applies seed, wires executor seams and module support, and returns a handle with `httpPort` and `stop()`.

## Role in the system

- Depends on:
  - `@rntme/pdm` — parses/validates `pdm.json`, derives `EventTypeSpec[]`, exposes `PdmResolver` to downstream validators.
  - `@rntme/qsm` — parses/validates `qsm.json`, generates projection DDL via `generateProjectionDdl`.
  - `@rntme/event-store` — instantiates `SqliteEventStore` and `createRelay`; produces `EventEnvelope` values consumed by seed and relay.
  - `@rntme/graph-ir-compiler` — reached transitively through bindings; compiles Graph IR nodes when HTTP routes execute.
  - `@rntme/bindings` — parses/validates `bindings.json`, generates the OpenAPI document mounted at `/api/openapi.json`.
  - `@rntme/bindings-http` — `createBindingsRouter` produces the `/api` Hono sub-app mounted by `HttpSurface`.
  - `@rntme/projection-consumer` — `compileApplyPlan`, `bootstrapProjections`, `createProjectionConsumer`, and the `InMemoryKafkaConsumer` factory used by `InMemoryBus`.
  - `@rntme/seed` — `loadSeed` inside `loadService`, `applySeed` inside `startService`.
  - `@rntme/ui` — `compile()` turns the `ui/` source directory into a `CompiledArtifact`.
  - `@rntme/ui-runtime` — `createApp` serves the compiled artifact; `HttpSurface` mounts it at `/`.
- Consumed by:
  - `demo/issue-tracker-api` — embeds `startService` programmatically.
  - Any image that copies `Dockerfile.template` and a validated artifacts directory.
- Position in pipeline: service-level authoring artifacts → `loadService` (validates every input) → `startService` (boots event-store, bus, projections, executor seams, modules, HTTP/gRPC surfaces) → running service answers HTTP. Project-level intake from a project blueprint folder remains deferred to a separate runtime spec.

## File map

```
src/
  index.ts                              (entry) Public API surface — re-exports.
  types.ts                              (entry) RuntimeResult, ValidatedService, RunningService, ServiceError, GraphSpec.
  bin/
    runtime.ts                          (entry) `rntme-runtime` CLI — `start` and `validate` subcommands.
  manifest/
    schema.ts                           Zod schema for `manifest.json` (strict).
    parse.ts                            (entry) `parseManifest` — Zod → ParsedManifest, emits MANIFEST_* error codes.
    validate.ts                         (entry) `validateManifest`, `applyEnvOverrides` — semver + persistence + env merge.
    types.ts                            (entry) ParsedManifest, ValidatedManifest, ManifestError, ManifestErrorCode.
  load/
    load-service.ts                     (entry) `loadService(dir)` — one-shot validation of the whole artifact directory.
    read-dir.ts                         (internal) Filesystem helpers: readTextFile, readJsonFile, readGraphsDir.
  start/
    start-service.ts                    (entry) `startService(service, config?)`, RuntimeConfig, boot/shutdown orchestration.
    runtime-env.ts                      (entry) RNTME_AUTH_* and RNTME_EVENT_BUS_* deploy env parsing.
    wire-event-pipeline.ts              (internal) Assembles event-store + relay + projection-consumer; exposes start()/stop().
    build-actor-from-request.ts         (entry) `buildActorFromRequest(manifest)` — header → ActorRef resolver.
  plugins/
    interfaces.ts                       (entry) DbDriver, DbHandle, DbOpenOpts, EventBus, Surface, SurfaceContext.
    better-sqlite-driver.ts             (entry) `BetterSqliteDriver` — default DbDriver (SQLite via better-sqlite3).
    in-memory-bus.ts                    (entry) `InMemoryBus` — default EventBus backed by InMemoryKafkaConsumer.
    kafka-js-bus.ts                     (entry) KafkaJS-backed EventBus used when RNTME_EVENT_BUS_BROKERS is set.
    http-surface.ts                     (entry) `HttpSurface` — default Surface mounting bindings at /api and UI at /.
    observability.ts                    (entry) createMetrics, mountObservability, Metrics, HealthProbe.
    contract-tests.ts                   (test-only) Vitest contract suites for DbDriver, EventBus, Surface. Not re-exported from index.ts.
```

## Quick start

### Programmatic

```ts
import {
  loadService,
  startService,
  BetterSqliteDriver,
  InMemoryBus,
  HttpSurface,
  createMetrics,
} from '@rntme/runtime';

const loaded = loadService('./artifacts');
if (!loaded.ok) {
  console.error(loaded.errors);
  process.exit(1);
}

const running = await startService(loaded.value, {
  db: new BetterSqliteDriver(),
  bus: new InMemoryBus(),
  onReady: ({ port }) => console.log(`listening on ${port}`),
});

await fetch(`http://127.0.0.1:${running.httpPort}/health`);
await running.stop();
```

### CLI

```bash
# Validate every artifact and exit — used in CI
rntme-runtime validate ./artifacts

# Boot the service (Docker ENTRYPOINT). Defaults the directory to
# RNTME_ARTIFACTS_DIR or /srv/artifacts.
rntme-runtime start ./artifacts
```

## API

| Export | Signature | Purpose |
|---|---|---|
| `loadService` | `(dir: string) => RuntimeResult<ValidatedService, ServiceError[]>` | Reads and validates `manifest.json`, `pdm.json`, `qsm.json`, `shapes.json`, `graphs/*.json`, `bindings.json`, `ui/`, optional `seed.json`. |
| `startService` | `(service: ValidatedService, config?: Partial<RuntimeConfig>) => Promise<RunningService>` | Boots bus, event pipeline, optional seed, then HTTP. Returns `{ httpPort, stop }`. |
| `buildActorFromRequest` | `(manifest: ValidatedManifest) => (c: Context) => ActorRef \| null` | Default header-based actor resolver. |
| `parseManifest` | `(raw: string) => ManifestResult<ParsedManifest>` | Zod-strict JSON parse of the manifest. |
| `validateManifest` | `(parsed, runtimeVersion) => ManifestResult<ValidatedManifest>` | Semver + persistence-mode validation, fills defaults. |
| `applyEnvOverrides` | `(v, env) => ManifestResult<ValidatedManifest>` | Merges `RNTME_HTTP_PORT`, `RNTME_PERSISTENCE_MODE`, `RNTME_EVENT_STORE_PATH`, `RNTME_QSM_PATH`, `RNTME_AUTH_HEADER_NAME`. |
| `parseRuntimeAuthEnv` | `(env) => RuntimeAuthEnv \| null` | Parses `RNTME_AUTH_*` runtime module wiring and fails fast on incomplete Auth0 config. |
| `buildKafkaJsClientConfigFromEnv` | `(env, clientId) => KafkaJsClientConfig \| null` | Builds KafkaJS client config from `RNTME_EVENT_BUS_*`, including `ssl: true`, SCRAM SASL for `sasl_ssl`, and KafkaJS connection timeout defaults. |
| `parseRuntimeEventBusTopicPrefixFromEnv` | `(env) => string \| null` | Reads optional `RNTME_EVENT_BUS_TOPIC_PREFIX`; when present, relay publish topics and projection subscriptions are scoped under that prefix. |
| `createMetrics` | `(serviceName: string) => Metrics` | Prom-client registry with the `rntme_*` counters and gauges. |
| `mountObservability` | `(app, { healthPath, metricsPath, probe, metrics }) => void` | Attaches `/health` and `/metrics` routes to a Hono app. |
| `VERSION` | `string` | Package version marker (`'0.0.0'` in-repo). |

Re-exported types: `ValidatedService`, `RunningService`, `ServiceError`, `GraphSpec`, `RuntimeResult`, `RuntimeOk`, `RuntimeErr`, `ParsedManifest`, `ValidatedManifest`, `ManifestError`, `ManifestErrorCode`, `Metrics`, `HealthProbe`.

### Plugin seams

`DbDriver`, `EventBus`, and `Surface` are the replaceable backings. `CommandExecutor` and `QueryExecutor` are the executor seams shared by HTTP/gRPC surfaces and modules. Default implementations ship in this package; future packages (`@rntme/db-turso`, `@rntme/bus-kafka`) implement the same interfaces and are injected via `RuntimeConfig`.

| Interface | Default impl | Key methods |
|---|---|---|
| `DbDriver` | `BetterSqliteDriver` | `open(opts: { purpose: 'event-store' \| 'qsm'; path: string \| ':memory:' }): DbHandle` |
| `EventBus` | `InMemoryBus` | `producer(): KafkaProducer`, `consumer({ groupId, topic }): KafkaConsumer`, optional `start()`, `stop()` |
| `Surface` | `HttpSurface` | `mount(app: Hono, ctx: SurfaceContext): void`, optional `listen()` |

`EventBus.consumer({ topic })` treats `topic` as the subscription contract. The default
`InMemoryBus` accepts exact topic names and `*` wildcard patterns such as
`rntme.issue-tracker.*`; messages outside the requested pattern are not delivered to
that consumer.

`SurfaceContext` hands a mounted surface the running `ValidatedService`, the live `EventStore`, the QSM `DbHandle`, and the `actorFromRequest` resolver. `HttpSurface` composes three sub-apps: the bindings router under `/api`, the UI runtime app at `/`, and `mountObservability` at `/health` + `/metrics`.

Contract suites for all three interfaces live in `src/plugins/contract-tests.ts` (importable only from test code — the file imports vitest and must not be loaded in production processes).

### `RuntimeConfig`

| Field | Default | Purpose |
|---|---|---|
| `db` | `new BetterSqliteDriver()` | DbDriver for QSM (`event-store` is opened directly by `SqliteEventStore`). |
| `bus` | `new InMemoryBus()` | EventBus used by relay/consumer. |
| `surfaces` | `[new HttpSurface(...)]` | Surfaces mounted onto the internal Hono app. |
| `actorFromRequest` | `buildActorFromRequest(manifest)` | Request → `ActorRef \| null`. |
| `onReady` | `undefined` | Callback invoked once the HTTP listener is bound. |
| `seedMode` | `'strict'` | Passed to `applySeed`. `'strict'` rejects on a non-empty event-store with `SEED_STORE_NOT_EMPTY`. |
| `skipSeed` | `false` | Test-only escape hatch that bypasses `applySeed` entirely. |
| `externalAdapterClient` | `manifest.modules[]` + `artifactDir` | Overrides module client wiring for tests/embedding. |
| `artifactDir` | `undefined` | Base directory for `manifest.modules[].protoPath` and TLS paths. Required for module wiring. |
| `runtimeEnv` | `process.env` | Test/embed override for deploy env vars such as `RNTME_AUTH_*` and `RNTME_EVENT_BUS_*`. |

### Deploy runtime env

Auth0 pre-step wiring is controlled by `RNTME_AUTH_PROVIDER=auth0`,
`RNTME_AUTH_AUDIENCE`, `RNTME_AUTH_MODULE_SLUG`, and
`RNTME_AUTH_MODULE_ENDPOINT`. If provider is set but endpoint is missing,
startup fails with `RUNTIME_BOOT_AUTH_ENDPOINT_MISSING`. When auth env is
present, `startService` overrides that module's manifest gRPC address with the
endpoint, builds a `GrpcAdapterClient`, and passes it to `bindings-http`. The
CLI passes `artifactDir` to `startService` so module proto paths resolve in
deployed containers.

External Kafka-compatible event bus env is read from `RNTME_EVENT_BUS_BROKERS`,
`RNTME_EVENT_BUS_PROTOCOL`, `RNTME_EVENT_BUS_MECHANISM`,
`RNTME_EVENT_BUS_USERNAME`, and `RNTME_EVENT_BUS_PASSWORD`. If brokers are
absent, runtime uses `InMemoryBus`. For `sasl_ssl`, runtime builds KafkaJS
config with `ssl: true` and `sasl: { mechanism, username, password }`; missing
SASL credentials fail boot with `RUNTIME_BOOT_EVENT_BUS_SASL_INCOMPLETE`. Do
not log SASL username or password values. External Kafka startup uses
`connectionTimeout: 10000` by default because managed Kafka endpoints can be
remote from the Dokploy host; override with positive integer
`RNTME_EVENT_BUS_CONNECTION_TIMEOUT_MS` when a target needs a different
handshake budget. Optional `RNTME_EVENT_BUS_TOPIC_PREFIX` scopes both relay
publish topics and projection subscriptions. With service `app` and prefix
`rntme.rnt364.smoke`, runtime publishes `Note` events to
`rntme.rnt364.smoke.app.note` and subscribes projections to
`rntme.rnt364.smoke.app.*`.

### HTTP ingress limits

`manifest.surface.http` supports two defensive defaults for every `/api/*`
request:

```json
{
  "surface": {
    "http": {
      "bodyLimit": { "enabled": true, "maxBytes": 1048576 },
      "rateLimit": { "enabled": true, "windowMs": 60000, "max": 600 }
    }
  }
}
```

If omitted, both controls are enabled. Oversized requests are rejected before
the bindings router with `413` and `{ "error": "REQUEST_BODY_TOO_LARGE" }`.
Rate-limited requests return `429`, `Retry-After`, and `X-RateLimit-*`
headers. The default limiter is in-memory and per-process; use it as a local
safety gate, not as a distributed quota system.

### Module gRPC TLS

`manifest.modules[]` declares external platform modules used by `pre[]`:

```json
{
  "modules": [
    {
      "name": "identity",
      "grpc": {
        "address": "identity:50051",
        "tls": {
          "rootCertPath": "certs/ca.pem",
          "privateKeyPath": "certs/client-key.pem",
          "certChainPath": "certs/client.pem"
        }
      },
      "protoPath": "protos/identity.proto"
    }
  ]
}
```

TLS paths are resolved relative to the artifact directory passed to
`startService(..., { artifactDir })`. `privateKeyPath` and `certChainPath`
must be provided together; `validateManifest` rejects partial client-certificate
config before startup. When `grpc.tls` is omitted, `GrpcAdapterClient` falls
back to insecure credentials and logs a production warning under
`NODE_ENV=production`.

### `ServiceError` codes

| Code | Emitted from | Details shape |
|---|---|---|
| `MANIFEST_INVALID` | `parseManifest`, `validateManifest`, `applyEnvOverrides` | `ManifestError[]` |
| `PDM_INVALID` | `@rntme/pdm` `parsePdm` / `validatePdm` | pdm error array |
| `QSM_INVALID` | `@rntme/qsm` `parseQsm` / `validateQsm` | qsm error array |
| `BINDINGS_INVALID` | `@rntme/bindings` `parseBindingArtifact` / `validateBindings` | bindings error array |
| `UI_INVALID` | `@rntme/ui` `compile` (and missing `ui/` directory) | ui compiler error array |
| `OPENAPI_INVALID` | `@rntme/bindings` `generateOpenApi` | openapi error array |
| `SEED_INVALID` | `@rntme/seed` `loadSeed` | `SeedError[]` |
| `IO_ERROR` | filesystem reads inside `loadService` | `{ message: string }` |

### Manifest error codes

`MANIFEST_NOT_JSON`, `MANIFEST_NOT_OBJECT`, `MANIFEST_UNKNOWN_KEY`, `MANIFEST_MISSING_FIELD`, `MANIFEST_INVALID_TYPE`, `MANIFEST_INVALID_PORT`, `MANIFEST_INVALID_VERSION`, `MANIFEST_VERSION_MAJOR_MISMATCH`, `MANIFEST_MISSING_EVENT_STORE_PATH`, `MANIFEST_MISSING_QSM_PATH`.

### Boot order (authoritative)

`startService` executes in this exact sequence; the order is test-verified and MUST NOT be reordered:

1. `bus.start?.()` — optional hook for buses that need async startup.
2. `wireEventPipeline(service, db, bus)` — instantiates `SqliteEventStore`, opens `qsmDb` via `db.open({ purpose: 'qsm' })`, calls `bootstrapProjections(qsmDb, service.projectionDdls)`, wires `createRelay` and `createProjectionConsumer`. **Does not start them.**
3. `applySeed(service.seed, pipeline.eventStore, { mode: seedMode })` — only if `service.seed !== null` and `!skipSeed`. Runs before relay so the consumer never polls an empty bus.
4. `pipeline.start()` — `projectionConsumer.start(); relay.start();`.
5. `HttpSurface.mount` (or each `config.surfaces[i].mount`) attaches routes to a fresh Hono app. `HttpSurface` mounts `mountObservability` first, then `app.route('/api', bindingsRouter)`, then `app.route('/', uiApp)`.
6. `serve({ fetch: app.fetch, port })` via `@hono/node-server`. `config.onReady` fires with the resolved port.

### Persistence modes

| `persistence.mode` | Event-store path | QSM path | Required fields |
|---|---|---|---|
| `'ephemeral'` (default) | `:memory:` | `:memory:` | none |
| `'persistent'` | `persistence.eventStorePath` | `persistence.qsmPath` | both, else `MANIFEST_MISSING_EVENT_STORE_PATH` / `MANIFEST_MISSING_QSM_PATH` |

Env overrides (`RNTME_PERSISTENCE_MODE`, `RNTME_EVENT_STORE_PATH`, `RNTME_QSM_PATH`) pass through `applyEnvOverrides`; invalid `RNTME_HTTP_PORT` re-emits `MANIFEST_INVALID_PORT`.

## Invariants & gotchas

- **UI v2 routes mount at `/api` with a prefixed `httpMap`.** `loadService` builds `httpMap[id] = { method, path: '/api' + rb.entry.http.path }` before calling `ui.compile`. The compiled artifact embeds those absolute paths; `HttpSurface` then mounts `createBindingsRouter` at `/api` and the UI app at `/`. Fix: `d83e926 fix(runtime): prepend /api prefix to httpMap paths for v2 compiled screens`.
- **Seed lifecycle — applied after DDL bootstrap, before relay.** Exact order in `startService`: `bus.start` → `wireEventPipeline` (which calls `bootstrapProjections(qsmDb, projectionDdls)`) → `applySeed` (if `service.seed !== null` and `!skipSeed`) → `pipeline.start()` (relay + consumer) → `HttpSurface.mount` → `serve`. `wireEventPipeline` does **not** auto-start; the split exists so seed runs before the consumer polls the bus. Fixes: `b266f85 fix(runtime): align seed manifest + loadService with runtime-seed plan`, spec §8.3.
- **Modules are service-adjacent, not project intake.** Runtime wires `manifest.modules[]`, pre-fetch middleware, the idempotency cache, and gRPC surfaces for a service. It does not yet boot an entire project blueprint folder; `@rntme/blueprint` owns project composition until that runtime spec lands.
- **Graph signature parsing covers API-shaped inputs.** Runtime graph loading
  accepts scalar inputs plus `list<T>`, `row<T>`, and `rowset<T>` signatures.
  gRPC proto emission now collects row/rowset input and output shapes from
  `shapes.json` first, then PDM entities.
- **`seedMode: 'strict'` swallows `SEED_STORE_NOT_EMPTY` only.** On persistent restarts the event-log is non-empty; `applySeed` rejects with that code and `startService` proceeds. Any other seed error tears down the pipeline and re-throws (`start-service.ts` lines 54–63). Spec §5.1, §8.3.
- **Bus pass-through in env overrides.** `applyEnvOverrides` must preserve `v.bus` verbatim — dropping it silently disabled the in-memory bus. Fix: `efc3df6 fix(runtime,docs): bus passthrough in env override + post-migration READMEs`.
- **`pdm-shape` field iteration.** `loadService` iterates `pdmResolver.resolveEntity(name).fields` (array), not `Object.entries`. A mismatched iteration shape returns an empty shape and downstream bindings fail `BINDINGS_INVALID`. Fix: `8410408 fix(runtime): loadService pdm-shape field iteration + drop dead GRAPH_INVALID`.
- **Runtime manifest schema version is hand-maintained.** `RUNTIME_VERSION = { major: 1, minor: 0, patch: 0 }` in `load-service.ts` is bumped manually on breaking manifest changes and is not tied to the npm package semver. A `manifest.rntmeVersion` with a different major returns `MANIFEST_VERSION_MAJOR_MISMATCH`.
- **`persistence.mode: 'persistent'` requires both paths.** `eventStorePath` and `qsmPath` are both required when mode is `persistent`; missing either yields `MANIFEST_MISSING_EVENT_STORE_PATH` / `MANIFEST_MISSING_QSM_PATH`. Ephemeral mode uses `:memory:` for both.
- **Port 0 is honored.** The manifest schema allows `port: 0` (tests bind an ephemeral port); `startService` reads the actual bound port from `server.address()` and returns it in `RunningService.httpPort`.
- **Health probe flips on `stop()`.** `probe` returns `{ ok: true }` while running and `{ ok: false, reason: 'pipeline stopped' }` after `stop()`; Hono returns 503 in the latter case. `test/integration/shutdown.test.ts` asserts `fetch(/health)` rejects once the listener closes.
- **`contract-tests.ts` is not re-exported from `index.ts`.** It imports vitest. Load it from test code only: `import { runDbDriverContract } from '@rntme/runtime/src/plugins/contract-tests.js'`.

## Operability

- **`seen_events` retention** must exceed max Kafka `retention.ms` of subscribed topics plus maximum consumer downtime; violation allows double-apply of late-redelivered envelopes. `startSeenEventsRetention(qsmDb)` is invoked by `startService` after `bootstrapProjections` creates the side-table and sweeps it periodically (defaults: 30-day retention, 1-hour interval). Override via `RNTME_SEEN_EVENTS_RETENTION_DAYS`; the value must be a positive integer number of days, and invalid values fail startup instead of sweeping with an unsafe cutoff.

## Out of scope / known limits

- Single-process runtime. There is no clustering, leader election, or inter-process coordination. Scale-out is a future `@rntme/bus-kafka` + external Turso deployment.
- No project-level runtime intake. Booting from `project.json` + project PDM + N services is validated/composed by `@rntme/blueprint`, but `@rntme/runtime` still starts one service at a time.
- One `manifest.json` per process. Multi-service embedding means multiple `startService` calls, each with its own port.
- SQLite-only default. `BetterSqliteDriver` is the only shipped DbDriver. Postgres is explicitly not a target — target dialect is SQLite forever, scale-out goes through Turso.
- No hot reload. `loadService` runs once at boot; a manifest/artifact edit requires a restart.
- No authentication beyond the header-based `ActorRef`. `manifest.auth.mode` is fixed at `'header'` in MVP.
- No `commands: []` / `rows: []` seed sugar — see `docs/superpowers/specs/done/2026-04-15-runtime-seed-design.md` §1 non-goals.
- `rntme-runtime` CLI has two subcommands (`start`, `validate`). `validate` exits 1 with JSON errors on failure; there is no `diff`, `lint`, or `export`.
- Observability is Prometheus-only via `prom-client`. No OpenTelemetry tracing in MVP.

## Where to look first

- **Add a new `DbDriver`** (e.g. `@rntme/db-turso`): implement `DbDriver` from `src/plugins/interfaces.ts`; use `BetterSqliteDriver` in `src/plugins/better-sqlite-driver.ts` as the pattern; run `runDbDriverContract` from `src/plugins/contract-tests.ts` to verify; inject via `RuntimeConfig.db`.
- **Add a new `EventBus`** (e.g. `@rntme/bus-kafka`): implement `EventBus` from `src/plugins/interfaces.ts`; use `InMemoryBus` as the pattern (wraps `createInMemoryKafkaConsumer` from `@rntme/projection-consumer`); run `runEventBusContract`; inject via `RuntimeConfig.bus`.
- **Add a new `Surface`** (e.g. gRPC, WebSocket): implement `Surface` from `src/plugins/interfaces.ts`; use `HttpSurface` as the pattern; run `runSurfaceContract`; pass via `RuntimeConfig.surfaces` to replace or augment the default HTTP surface.
- **Change startup order**: `src/start/start-service.ts` is the ordered orchestrator. Do not move seed before `bootstrapProjections` (DDL must exist first) or after `pipeline.start` (relay/consumer would observe a partially seeded log). Regression test: `test/integration/seed.test.ts`, `test/unit/wire-event-pipeline-order.test.ts`.
- **Debug a failing `loadService`**: each step in `src/load/load-service.ts` returns a `ServiceError` with the layer-specific `details` array. Reproduce with `rntme-runtime validate <dir>` — emits `{ ok: false, errors: [...] }` JSON. Unit tests in `test/unit/load-service.errors.test.ts`.
- **Add a manifest field**: edit `src/manifest/schema.ts` (Zod, `.strict()`), then `src/manifest/types.ts` (`ParsedManifest` + `ValidatedManifest` shapes), then fill defaults in `src/manifest/validate.ts` and optional env overrides in `applyEnvOverrides`. Add a parse error code to `ManifestErrorCode`. Tests: `test/unit/manifest-parse.test.ts`, `test/unit/manifest-validate.test.ts`, `test/unit/env-override.test.ts`.
- **Tune `/api` ingress safety**: configure `surface.http.bodyLimit` and
  `surface.http.rateLimit` in `manifest.json`. Tests:
  `test/integration/startup.test.ts`.
- **Reproduce an end-to-end failure**: `test/fixtures/issue-tracker/` is a full artifact bundle (manifest, PDM, QSM, bindings, graphs, UI sources, seed). `test/e2e/issue-tracker.test.ts` boots it via `startService`; `test/e2e/validate-cli.test.ts` exercises the CLI.
- **Check observability wiring**: `src/plugins/observability.ts` defines every `rntme_*` metric. `HttpSurface` calls `mountObservability` with `manifest.observability.health.path` and `manifest.observability.metrics.path`. Integration test: `test/integration/health-metrics.test.ts`.

## Specs

- [`../../docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md`](../../docs/superpowers/specs/done/2026-04-23-project-first-blueprint-design.md) — active umbrella spec for the project-first pivot: project blueprint folder, project routing/middleware declarations, service-level execution under a shared project model; actual project runtime architecture is explicitly deferred to a separate spec.
- [`../../docs/superpowers/specs/done/2026-04-15-runtime-packaging-design.md`](../../docs/superpowers/specs/done/2026-04-15-runtime-packaging-design.md) — authoritative packaging/runtime boot spec (§4.1 manifest schema, plugin seams, Docker entry).
- [`../../docs/superpowers/specs/done/2026-04-15-runtime-seed-design.md`](../../docs/superpowers/specs/done/2026-04-15-runtime-seed-design.md) — seed lifecycle, `skipSeed`/`seedMode` config, apply-order guarantees (§3.1, §8.3).
