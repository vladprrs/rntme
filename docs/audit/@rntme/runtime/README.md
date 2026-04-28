# Architecture audit — `@rntme/runtime`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-210` (`03aff2ac-4d22-4d38-b24e-c9519e0b3869`) |
| **Issue title** | Audit: package architecture — @rntme/runtime |
| **Package / scope** | `@rntme/runtime` |
| **Verdict (summary)** | needs cleanup — no fundamental redesign required, but several architectural risks and debt items need addressing before  |
| **Audit comment id** | `9fac0e04-e035-4a92-a6b0-f8ddb4f52021` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


# Audit Report: @rntme/runtime

**Verdict:** needs cleanup — no fundamental redesign required, but several architectural risks and debt items need addressing before scaling to production workloads or additional surfaces.

---

## Blocker

### 1. `zod` dependency targets non-existent stable version
- **Evidence:** `package.json:35` — `"zod": "^4.0.0"`. npm registry shows only canary releases (`4.4.0-canary.*`) for v4; latest stable is 3.x.
- **Impact:** Fresh installs may resolve to a canary with breaking API changes. The manifest parser relies on Zod v3-specific internals (`zodIssueToError` casts `issue.received` and checks `issue.code === 'unrecognized_keys'`).
- **Recommendation:** Pin to `^3.23.0` (latest stable) or explicitly depend on a tested canary with a locked version. Add a regression test that validates a manifest with every known error code to catch Zod behavior changes.

### 2. `GrpcAdapterClient` hardcodes insecure gRPC credentials
- **Evidence:** `src/plugins/adapter-client/grpc-adapter-client.ts:73` — `new grpc.Client(cfg.address, grpc.credentials.createInsecure())`.
- **Impact:** Any production deployment connecting to external modules over a network transmits data unencrypted. No TLS/mTLS option exists in `GrpcAdapterClientConfig`.
- **Recommendation:** Add `tls?: grpc.ChannelCredentials` to `GrpcAdapterClientConfig`. Default to insecure only when `process.env.NODE_ENV !== 'production'` and emit a startup warning. Document the security model for module-to-module communication.

### 3. `loadService` catch-all error handling loses error specificity
- **Evidence:** `src/load/load-service.ts` — every `catch (e)` block returns `{ code: 'IO_ERROR', details: { message: ... } }`, even when the thrown error is a validation failure from `@rntme/pdm`, `@rntme/qsm`, or `@rntme/bindings`.
- **Impact:** Operators cannot distinguish between "file not found" and "PDM schema invalid" without reading stack traces. This breaks automated alerting and debugging.
- **Recommendation:** Inspect caught errors for a `code` or `errors` property before falling back to `IO_ERROR`. Preserve downstream error codes in a `cause` chain.

---

## High

### 4. `VERSION` export is permanently `0.0.0`
- **Evidence:** `src/index.ts:1` — `export const VERSION = '0.0.0';`. Also reflected in `package.json:4`.
- **Impact:** Runtime version diagnostics are useless for identifying which runtime binary is running in production.
- **Recommendation:** Inject version at build time (e.g., `esbuild define`, `tsc` pre-build script, or `genversion`). Add an assertion in the e2e CLI test that `rntme-runtime validate` output matches the built version.

### 5. `seen-events-retention.ts` lacks env variable validation
- **Evidence:** `src/projections/seen-events-retention.ts:24` — `Number(process.env.RNTME_SEEN_EVENTS_RETENTION_DAYS ?? 30)` without `isNaN` or bounds check.
- **Impact:** Invalid env values produce `NaN`, which silently deletes all `seen_events` rows or none.
- **Recommendation:** Add explicit validation: `Number.isInteger(days) && days >= 1 && days <= 3650`. Fail fast on invalid values.

### 6. `buildActorFromRequest` has minimal actor ID validation
- **Evidence:** `src/start/build-actor-from-request.ts:10` — only checks `id === undefined || id === ''`.
- **Impact:** Whitespace-only strings, overly long IDs, or injection payloads are accepted as valid actor references.
- **Recommendation:** Add configurable validation (max length, regex whitelist). Default to rejecting whitespace-only IDs.

### 7. `RuntimeConfig` accepts arbitrary partial objects without validation
- **Evidence:** `src/start/start-service.ts:23` — `Partial<RuntimeConfig>` with no runtime validation of field combinations.
- **Impact:** Invalid configs (e.g., `bus` without `start`/`stop`, contradictory `skipSeed` + `seedMode`) crash at arbitrary points during boot.
- **Recommendation:** Add a `validateRuntimeConfig` function that checks invariants (e.g., if `externalAdapterClient` is provided, `artifactDir` is unnecessary).

### 8. `collectShapesFromService` is explicitly incomplete
- **Evidence:** `src/start/build-grpc-surface.ts:40` — comment says "MVP: union of binding output shapes. Row/rowset inputs are not yet resolved... add a full shape registry when a real module with row-typed inputs ships (plan 5)."
- **Impact:** gRPC surface will fail silently or produce invalid proto schemas for commands with row-typed inputs.
- **Recommendation:** Either complete the shape registry or emit a startup warning when row-typed inputs are detected and gRPC is enabled.

### 9. `loadService` is tightly coupled to the filesystem
- **Evidence:** `src/load/load-service.ts` reads files via `readTextFile`, `readJsonFile`, `readGraphsDir` with no abstraction.
- **Impact:** Testing requires real filesystem I/O. No way to load artifacts from an in-memory store (e.g., S3, database, embedded bundle).
- **Recommendation:** Extract an `ArtifactLoader` interface with methods like `loadText(name)`, `loadJson(name)`, `listGraphs()`. Provide a default `FsArtifactLoader` and an `InMemoryArtifactLoader` for tests.

### 10. No graceful shutdown timeout
- **Evidence:** `src/start/start-service.ts:162` — `server.close()` waits indefinitely for keep-alive connections.
- **Impact:** SIGTERM/SIGINT handlers may hang forever in production (e.g., under load balancer health check deregistration delays).
- **Recommendation:** Add a `shutdownTimeoutMs` to `RuntimeConfig` (default 30s). Force-close remaining connections after timeout.

---

## Medium

### 11. `crossValidateDerivedProjections` passes unvalidated raw artifacts to compiler
- **Evidence:** `src/projections/cross-validate.ts:86` — `compileProjectionGraph(input.authoringSpec, input.rawPdm, input.rawQsm, ...)` where `rawPdm` and `rawQsm` are typed as `unknown`.
- **Impact:** If upstream validators have a gap, the compiler receives garbage and may throw uncaught exceptions.
- **Recommendation:** Add a lightweight structural guard (e.g., check `typeof rawPdm === 'object' && rawPdm !== null`) before passing to `compileProjectionGraph`.

### 12. Dockerfile inflates build context with `demo/`
- **Evidence:** `Dockerfile:7` — `COPY demo ./demo`. The runtime image does not need demo applications.
- **Impact:** Slower builds, larger images, potential leakage of demo secrets if any exist.
- **Recommendation:** Remove `COPY demo ./demo` from the builder stage. Use `.dockerignore` to exclude demo, test, and docs directories.

### 13. `ProtoRegistry` silently ignores multiple services per proto file
- **Evidence:** `src/plugins/adapter-client/proto-registry.ts:23` — `if (obj instanceof protobuf.Service && service === null)` stops at the first service.
- **Impact:** Proto files with multiple services will have methods dropped without error.
- **Recommendation:** Either support multiple services per file (key by fully-qualified name) or throw when more than one service is found.

### 14. `Surface` interface inconsistency between `mount` and `listen`
- **Evidence:** `src/plugins/interfaces.ts:37` — `listen?` is optional. `HttpSurface` implements `mount` but not `listen`; `GrpcSurface` implements both but `mount` is a no-op.
- **Impact:** Confusing abstraction — callers must special-case surface types to know which lifecycle methods to invoke.
- **Recommendation:** Split into `HttpSurface` (mount-only) and `GrpcSurface` (listen-only) with a shared base type, or make `listen` required and have `HttpSurface` return the Hono server port.

### 15. `GraphIrCommandExecutor.mapError` loses stack traces for unexpected errors
- **Evidence:** `src/plugins/executors/graph-ir-command-executor.ts:44` — `detail: e instanceof Error ? { name: e.name } : undefined`.
- **Impact:** Production debugging of graph-ir runtime failures is impossible without reproducing locally.
- **Recommendation:** Include `stack` in `detail` when `NODE_ENV !== 'production'`, or log the full error via the runtime logger before mapping.

### 16. `applyEnvOverrides` uses different error accumulation pattern than `validateManifest`
- **Evidence:** `src/manifest/validate.ts:95` vs `src/manifest/validate.ts:24`. `validateManifest` collects all errors; `applyEnvOverrides` also collects all but the pattern differs slightly (early return on `errors.length > 0` in one, not the other).
- **Impact:** Minor inconsistency in error reporting behavior.
- **Recommendation:** Refactor both to use a shared `ManifestValidator` class or accumulate errors in a single array with a consistent helper.

### 17. `InMemoryBus` ignores consumer `topic` parameter
- **Evidence:** `src/plugins/in-memory-bus.ts:20` — `consumer(_opts: { groupId: string; topic: string }): KafkaConsumer` returns `this.inner` regardless of topic.
- **Impact:** All consumers receive all messages, breaking topic isolation in tests.
- **Recommendation:** Add a simple topic filter to `InMemoryKafkaConsumer` or document that topic filtering is the consumer's responsibility.

---

## Low

### 18. `package.json` `files` array includes unused `Dockerfile.template`
- **Evidence:** `package.json:16` — `"Dockerfile.template"`. The template references `ghcr.io/vladprrs/rntme-runtime:1.0` which does not match the current version.
- **Recommendation:** Either keep the template updated with correct versions or remove it from `files` and document it separately.

### 19. Custom semver parser instead of library
- **Evidence:** `src/manifest/validate.ts:19` — hand-rolled regex `/^(\d+)\.(\d+)(?:\.(\d+))?$/`.
- **Impact:** Pre-release tags (`1.0.0-beta.1`) and build metadata are rejected, limiting future versioning schemes.
- **Recommendation:** Use `semver` npm package or document that only `major.minor[.patch]` is supported.

### 20. No HTTP request size limits or rate limiting
- **Evidence:** `src/plugins/http-surface.ts` — no `bodyLimit` or rate limit middleware.
- **Impact:** Vulnerable to large payload DoS and brute-force attacks.
- **Recommendation:** Add a default 1MB body limit to Hono and optional rate-limiting headers.

### 21. Test timeout may be tight for CI under load
- **Evidence:** `vitest.config.ts:8` — `testTimeout: 15_000`.
- **Impact:** Flaky CI failures on shared runners.
- **Recommendation:** Increase to 30s or make it configurable via env var.

### 22. `contract-tests.ts` usage pattern is undocumented
- **Evidence:** `src/plugins/contract-tests.ts` is not re-exported from `index.ts` (correctly), but README doesn't explain how to use it.
- **Recommendation:** Add a "Testing custom plugins" section to README showing `runDbDriverContract`, `runEventBusContract`, etc.

---

## Quick Wins (can be implemented without product decisions)

1. Pin `zod` to stable `^3.23.0`.
2. Add env validation to `seen-events-retention.ts`.
3. Fix `VERSION` to match `package.json` at build time.
4. Remove `demo/` from Dockerfile.
5. Increase `testTimeout` to 30s.
6. Add stack traces to `GraphIrCommandExecutor` error detail in non-production.
7. Document `contract-tests.ts` in README.

## Requires Product/Architectural Decision

1. **TLS for gRPC modules** — security model and cert management strategy.
2. **Actor ID validation rules** — product decision on allowed formats and max lengths.
3. **Filesystem abstraction (`ArtifactLoader`)** — impacts build pipeline, deployment formats, and caching strategy.
4. **Graceful shutdown semantics** — timeout defaults, force-kill behavior, draining in-flight requests.
5. **gRPC surface completeness** — plan 5 dependency; when will row-typed input shapes be supported?
6. **`Surface` interface redesign** — split into mount-only and listen-only abstractions.

---

## Positive Observations

- **Strong test coverage:** 119 tests across 28 files (unit, integration, e2e, contract tests). All passing.
- **Clean error taxonomy:** `ServiceError` union and `RuntimeResult` pattern are consistently applied.
- **Good separation of concerns:** manifest → load → start → plugins pipeline is easy to follow.
- **Contract tests for plugins:** `contract-tests.ts` ensures custom DbDriver/EventBus/Surface implementations behave correctly.
- **Observability built-in:** Prometheus metrics and health probes are first-class.
- **Cross-artifact validation:** `crossValidateDerivedProjections` catches QSM/graph misalignment at load time, not runtime.
