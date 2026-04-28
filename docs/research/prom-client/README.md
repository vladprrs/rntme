# Dependency Research: prom-client

Researched: 2026-04-28
Repository: /home/coder/work/rntme
Domain/ecosystem: npm/observability-metrics
Current version(s) in rntme: ^15.1.3 (packages/runtime package.json; Prometheus metrics exposition)
Latest stable version: 15.1.3 (2024-06-27, npm + GitHub releases)
Confidence: HIGH

## User Constraints
- Goal: understand current dependencies and migrate rntme to latest safe versions later.
- Output must be written to `docs/research/prom-client/README.md`.
- Research-only: do not perform dependency upgrades or runtime code migrations in this issue.
- Look for better-suited libraries/solutions, not only latest version of the current choice.
- Use authoritative current sources: Context7 where applicable, official docs/changelog/releases, npm/GitHub/container registry, migration guides, security advisories.

## Summary

`prom-client` is the de-facto standard Prometheus client for Node.js. rntme currently pins `^15.1.3` in `@rntme/runtime`, which **is the latest stable release** (published 2024-06-27). The library is mature, widely adopted (3.4k GitHub stars, 399 forks), and has zero public security advisories. However, release velocity has stalled — no new release in ~22 months despite active development on `master` (last commit 2025-12-21). The unreleased `master` branch contains a backlog of performance improvements, a new `WorkerRegistry` for cluster aggregation, and a breaking change to internal metric storage (`hashMap` → `LabelMap`).

The Node.js observability landscape in 2024–2026 is shifting toward OpenTelemetry (OTel) as the unified telemetry standard. OTel's metrics SDK (`@opentelemetry/sdk-metrics@2.7.0`) is stable, actively maintained, and can export to Prometheus via `@opentelemetry/exporter-prometheus`. For rntme's long-term positioning as a safe, repeatable runtime, adopting OTel metrics would align with industry standards and reduce vendor lock-in to Prometheus. However, the current `prom-client` footprint in rntme is small and well-contained — a single `observability.ts` plugin with six custom metrics and a `/metrics` endpoint.

**Primary recommendation:** Keep `prom-client` pinned at `^15.1.3` for now (it is already the latest stable). Plan a migration spike to OpenTelemetry metrics in Q3/Q4 2026, contingent on OTel exporter maturity and rntme's observability roadmap. Do not upgrade to an unreleased `master` commit.

## Current Usage in rntme

| Package / image / tool | Current version | Used by | Source file(s) | Runtime/dev/build/test | Notes |
|---|---:|---|---|---|---|
| `prom-client` | `^15.1.3` | `@rntme/runtime` | `packages/runtime/package.json:57` | runtime | Prometheus metrics exposition |

Code references:
- `packages/runtime/src/plugins/observability.ts` — creates `Registry`, `Counter`, `Gauge`, and `collectDefaultMetrics`; defines `rntme_commands_total`, `rntme_events_appended_total`, `rntme_http_requests_total`, `rntme_projection_lag_events`, `rntme_relay_cursor`, `external_pre_step_total`.
- `packages/runtime/src/plugins/http-surface.ts` — wires `metricsPath` and `metrics` into the Hono router.
- `packages/runtime/src/start/start-service.ts` — bootstraps metrics at service start.
- `packages/runtime/src/manifest/validate.ts` — reserves `/metrics` path.

Commands used to verify usage:
```bash
grep -rn "prom-client\|prometheus\|metrics" packages/runtime/src --include="*.ts" --include="*.json"
grep -r "prom-client" packages/runtime/package.json
```

## Latest Versions / Release State

| Channel | Version | Release date | Source | Notes |
|---|---|---|---|---|
| Latest stable | 15.1.3 | 2024-06-27 | npm, GitHub releases | Current pin in rntme is already latest. |
| Unreleased `master` | N/A | 2025-12-21 (last commit) | GitHub `master` | Contains breaking changes (Node 16/18/21/23 dropped, `LabelMap` refactor, `WorkerRegistry`). No ETA for v16. |

Release cadence observation: v15.1.3 was the last release. The project has ~138 open issues and active PRs (e.g., perf improvements, WHATWG URL migration, V8 heap limit metric), but maintainers have not cut a release in ~22 months.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| `prom-client` | 15.1.3 | Prometheus metrics registry + default Node.js metrics | De-facto standard for Node.js; zero-config default metrics; battle-tested. |
| `@opentelemetry/sdk-metrics` | 2.7.0 | OTel metrics SDK (counters, histograms, gauges, up-down-counters) | Industry-standard unified telemetry; vendor-neutral; active development (2026-04-17 release). |
| `@opentelemetry/api` | 1.9.1 | OTel API surface (meter creation, instrument recording) | Stable API contract; works with any OTel SDK backend. |

### Supporting

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `@opentelemetry/exporter-prometheus` | 0.215.0 | Expose OTel metrics in Prometheus text format | When migrating from `prom-client` to OTel but keeping Prometheus scraping. |
| `express-prom-bundle` | 8.0.0 | Express middleware with bundled Prometheus metrics | Not applicable — rntme uses Hono, not Express. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Recommendation for rntme |
|---|---|---|---|
| `prom-client` | `@opentelemetry/sdk-metrics` + `@opentelemetry/exporter-prometheus` | Vendor-neutral, unified traces/metrics/logs; slightly higher setup cost; exporter is still `0.x` (experimental) despite SDK being `2.x`. | **Recommended for future migration** — aligns with rntme's "safe, standard runtime" positioning. |
| `prom-client` | Custom `/metrics` endpoint + `perf_hooks` | High maintenance; no standard metric names; brittle. | Do not hand-roll. |
| `prom-client` | `express-prom-bundle` | Express-only; rntme uses Hono. | Not applicable. |

Installation / upgrade commands, if eventually recommended:
```bash
# Option A: keep current (no-op)
# prom-client is already at latest stable

# Option B: future OTel migration (do not run in research issue)
pnpm add @opentelemetry/api @opentelemetry/sdk-metrics @opentelemetry/exporter-prometheus
pnpm remove prom-client
```

## Architecture Patterns

### System Architecture Diagram

```mermaid
flowchart LR
    Runtime[rntme Runtime] --> Observability[Observability Plugin]
    Observability --> Metrics[Metrics Registry]
    Metrics -->|collectDefaultMetrics| NodeMetrics[Node.js Default Metrics]
    Metrics -->|custom counters/gauges| RntmeMetrics[rntme Custom Metrics]
    Scraping[Prometheus Scraper] -->|HTTP GET| MetricsEndpoint[/metrics Endpoint]
    MetricsEndpoint --> Metrics
```

### Component Responsibilities

| Component | Responsibility | Implementation mapping | Notes |
|---|---|---|---|
| `createMetrics()` | Initialize `Registry` with default labels + default metrics + custom counters/gauges | `packages/runtime/src/plugins/observability.ts:16` | Runs once per service boot. |
| `mountObservability()` | Mount `/health` and `/metrics` routes on Hono app | `packages/runtime/src/plugins/observability.ts:75` | Served via `@rntme/bindings-http` Hono surface. |
| `Registry` | Metric storage + Prometheus text serialization | `prom-client` class | Thread-local; no cluster aggregation in current usage. |
| `collectDefaultMetrics` | Auto-collect Node.js runtime metrics (event loop, GC, memory, CPU) | `prom-client` built-in | Enabled in rntme (`observability.ts:19`). |

### Recommended Project Structure

```text
packages/runtime/src/plugins/
├── observability.ts      # Metrics creation + HTTP mounting
├── http-surface.ts       # Router wiring (metricsPath injection)
└── ...
```

### Pattern 1: Registry-per-Service with Default Labels
What: Each service boot creates a dedicated `Registry` pre-tagged with `{ service: <serviceName> }`.
When to use: Multi-service deployments where metrics need service-level disambiguation.
Example:
```ts
// Source: https://github.com/siimon/prom-client/blob/master/README.md
const registry = new Registry();
registry.setDefaultLabels({ service: serviceName });
collectDefaultMetrics({ register: registry });
```

### Pattern 2: Custom Business Metrics via Counter/Gauge
What: Define domain-specific metrics (commands executed, events appended, projection lag) alongside runtime metrics.
When to use: When you need SLO/SLI signals beyond what `collectDefaultMetrics` provides.
Example:
```ts
// Source: packages/runtime/src/plugins/observability.ts (rntme current implementation)
const commandsTotal = new Counter({
  name: 'rntme_commands_total',
  help: 'Command executions.',
  labelNames: ['graph', 'status'],
  registers: [registry],
});
```

### Anti-Patterns to Avoid
- **Creating a new Registry per request**: Registries are long-lived process singletons. Per-request registries leak memory and break aggregation.
- **High-cardinality labels**: Using unbounded values (e.g., `userId`, `requestId`) as label values explodes metric cardinality and can crash Prometheus. rntme currently uses bounded labels (`graph`, `status`, `route`, `method`, `stream_type`, `module`, `rpc`, `result`) — keep it that way.
- **Blocking `/metrics` endpoint**: `registry.metrics()` is synchronous and fast, but avoid adding async I/O inside the metric collection callback.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Prometheus text format serialization | Custom string concatenation | `prom-client` `Registry.metrics()` | Escaping, timestamp, content-type, and OpenMetrics compliance are subtle and error-prone. |
| Node.js runtime metrics collection | `perf_hooks` + custom gauges | `prom-client` `collectDefaultMetrics` | Covers event loop lag, GC histograms, heap stats, CPU usage — all with stable metric names. |
| Histogram bucket configuration | Manual array buckets | `prom-client` `Histogram` with `buckets` option | Client-side quantile approximation (via `tdigest`) is mathematically involved. |

Key insight: Prometheus exposition format and Node.js runtime internals are well-covered by `prom-client`. A custom implementation would miss edge cases (OpenMetrics vs Prometheus content negotiation, cluster aggregation, garbage collection hooks) and add maintenance burden with zero differentiation for rntme.

## Common Pitfalls

### Pitfall 1: Label Cardinality Explosion
What goes wrong: Using high-cardinality or unbounded values as label values causes memory growth and Prometheus scrape failures.
Why it happens: `prom-client` stores a time series per unique label combination. 1M unique combinations = 1M in-memory data points.
How to avoid: Only use bounded, low-cardinality labels (status codes, graph names, stream types). Never use IDs, UUIDs, or timestamps.
Warning signs: Memory usage grows linearly with traffic; `/metrics` response size increases over time.

### Pitfall 2: Cluster Mode Metric Duplication
What goes wrong: In Node.js cluster mode (e.g., PM2), each worker exposes its own metrics. Prometheus scrapes duplicate or conflicting series.
Why it happens: `prom-client` registries are in-memory and per-process.
How to avoid: Use `AggregatorRegistry` (to be renamed `ClusterRegistry` in next major) or a single worker scraping pattern. rntme currently does not run in cluster mode (single Hono process per container), so this is not an immediate issue.
Warning signs: Metrics fluctuate wildly between scrapes; sum() queries return incorrect totals.

### Pitfall 3: Unreleased Dependency on `master`
What goes wrong: Pinning to a Git commit on `master` for features not yet released introduces instability.
Why it happens: `master` may contain breaking changes (e.g., `LabelMap` refactor, dropped Node versions) without migration documentation.
How to avoid: Only consume released npm versions. Wait for v16.0.0 if `WorkerRegistry` or perf improvements are needed.
Warning signs: CI breaks after `pnpm update` from git; TypeScript compilation errors in `prom-client` internals.

## Code Examples

Verified patterns from official sources.

### Counter with Labels
```ts
// Source: https://github.com/siimon/prom-client/blob/master/README.md
import { Counter } from 'prom-client';

const c = new Counter({
  name: 'my_counter',
  help: 'Example counter',
  labelNames: ['method', 'status'],
});

c.inc({ method: 'GET', status: '200' });
```

### Gauge with setToCurrentTime
```ts
// Source: https://github.com/siimon/prom-client/blob/master/README.md
import { Gauge } from 'prom-client';

const g = new Gauge({
  name: 'my_gauge',
  help: 'Example gauge',
});

g.setToCurrentTime();
```

### Default Metrics Collection
```ts
// Source: https://github.com/siimon/prom-client/blob/master/README.md
import { collectDefaultMetrics, Registry } from 'prom-client';

const register = new Registry();
collectDefaultMetrics({ register });

// In HTTP handler:
const metrics = await register.metrics();
```

## State of the Art (2024–2026)

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Direct `prom-client` only | `prom-client` + OpenTelemetry bridge | 2023–2026 (gradual) | OTel is becoming the unified telemetry standard; `prom-client` already depends on `@opentelemetry/api` for compatibility. |
| Manual histogram buckets | `tdigest`-backed quantiles | v15+ | More accurate percentile approximation with lower memory overhead. |
| `AggregatorRegistry` (cluster) | `ClusterRegistry` / `WorkerRegistry` | Unreleased (`master`) | Better support for Node.js `worker_threads` and cluster aggregation. |

New tools/patterns to consider:
- **OpenTelemetry Metrics SDK**: Vendor-neutral instrumentation; single SDK for traces, metrics, logs.
- **Prometheus Remote Write**: For high-cardinality or long-term storage scenarios (PR #644 in prom-client adds support).

Deprecated/outdated:
- Node.js 16/18/21/23 support in `prom-client` — dropped in unreleased `master`. rntme targets Node 20+ so this is not a concern.

## Migration Assessment

| Area | Finding | Impact | Risk | Evidence |
|---|---|---|---|---|
| Version gap | rntme is already on latest stable (15.1.3). | None | Low | npm registry + GitHub releases confirm 15.1.3 is latest. |
| Security | Zero public CVEs or GHSA advisories for `prom-client`. | None | Low | GitHub Advisory Database + npm audit. |
| Breaking changes in next major | `LabelMap` refactor, `AggregatorRegistry` → `ClusterRegistry`, dropped Node versions. | Medium | Medium | CHANGELOG.md `Unreleased` section on `master`. |
| OTel migration | `@opentelemetry/exporter-prometheus` is `0.x` (experimental) despite SDK being `2.x`. | Medium | Medium | npm registry shows `0.215.0`. |
| Effort to upgrade within `prom-client` | Zero — already latest. | N/A | N/A | — |
| Effort to migrate to OTel | Rewrite `observability.ts`; swap `Registry` for `MeterProvider`; update manifest schema if metric paths change. | Medium | Medium | ~1–2 days of work; well-scoped to one plugin. |
| Test strategy | Add golden tests for `/metrics` output; validate Prometheus scrape compatibility. | Low | Low | rntme already has integration/e2e test infrastructure. |

## Recommendation

**Decision:** KEEP PINNED

**Rationale:**
- `prom-client@15.1.3` is the latest stable release. There is no newer version to upgrade to.
- The library is secure, mature, and covers rntme's current observability needs with minimal code surface (one plugin, ~90 lines).
- OpenTelemetry metrics is the strategic future, but the Prometheus exporter is still experimental (`0.x`). Migrating now would introduce instability for limited gain.
- The unreleased `master` branch contains breaking changes. Consuming it directly would violate rntme's "safe runtime" positioning.

**Follow-up tasks to create later:**
1. **RNT-XXX** Monitor `@opentelemetry/exporter-prometheus` for `1.x` stable release. Once stable, schedule a migration spike.
2. **RNT-XXX** Add integration test that scrapes `/metrics` and validates Prometheus text format compliance.
3. **RNT-XXX** When `prom-client` v16 is released, evaluate release notes for breaking changes and plan upgrade (likely low effort — only `observability.ts` uses the API directly).
4. **RNT-XXX** Document observability plugin contract in `packages/runtime/README.md` so agent-generated services can extend metrics safely.

## Open Questions

1. **Does rntme plan to adopt OpenTelemetry traces/logs in addition to metrics?**
   - What we know: rntme currently only exposes Prometheus metrics. No tracing or structured logging pipeline is documented.
   - What's unclear: Whether the platform roadmap includes OTel as a first-class telemetry target.
   - Recommendation: If OTel traces are on the roadmap, metrics migration should be batched with traces to avoid dual instrumentation.

2. **Will `prom-client` v16 be released before rntme needs new metrics features?**
   - What we know: Active development on `master` but ~22 months without a release.
   - What's unclear: Maintainer release schedule and v16 ETA.
   - Recommendation: Do not block on v16. If new features (e.g., `WorkerRegistry`, remote write) are needed, re-evaluate OTel migration as the primary path.

3. **Is Prometheus the target scraper, or does rntme need OTLP export directly?**
   - What we know: Current setup exposes a Prometheus text endpoint (`/metrics`).
   - What's unclear: Whether hosted deployments use Prometheus, Grafana Agent, or a cloud-native monitoring stack (e.g., Datadog, CloudWatch).
   - Recommendation: If the target is Prometheus-only, staying on `prom-client` is optimal. If OTLP export is needed, OTel migration becomes higher priority.

## Sources

### Primary (HIGH confidence)
- npm registry `prom-client@15.1.3` — version verification, dependency metadata (`@opentelemetry/api ^1.4.0`, `tdigest ^0.1.1`).
- GitHub `siimon/prom-client` — `CHANGELOG.md` (unreleased changes, v15.1.3 release notes), `package.json` (engines: `^20 || ^22 || >=24`), commit history (`master`, last push 2025-12-21).
- GitHub `siimon/prom-client` releases API — confirmed v15.1.3 as latest release (2024-06-27).

### Secondary (MEDIUM confidence)
- GitHub Advisory Database search — zero advisories for `prom-client` package.
- npm registry `@opentelemetry/sdk-metrics@2.7.0`, `@opentelemetry/exporter-prometheus@0.215.0` — OTel version verification.
- GitHub `open-telemetry/opentelemetry-js` releases — v2.7.0 published 2026-04-17, active development.

### Tertiary (LOW confidence - needs validation)
- GitHub open issues #745, #744, #742 — indicate ongoing maintenance but not release readiness.

## Metadata

Research scope:
- Core technology: Prometheus metrics exposition for Node.js
- Ecosystem: `prom-client`, OpenTelemetry metrics SDK, `@opentelemetry/exporter-prometheus`
- Patterns: Registry-per-service, default metrics collection, custom counter/gauge instrumentation, label cardinality safety
- Pitfalls: Cardinality explosion, cluster duplication, unreleased dependency risks
Confidence breakdown:
- Standard stack: HIGH — `prom-client` is the established leader; OTel is the clear successor.
- Architecture: HIGH — rntme's current usage is simple and well-contained.
- Pitfalls: HIGH — Cardinality and cluster issues are well-documented in Prometheus community.
- Code examples: HIGH — All examples verified against official `prom-client` README and rntme source.
Research date: 2026-04-28
Valid until: 2026-10-28 (re-evaluate when `prom-client` v16 or `@opentelemetry/exporter-prometheus` 1.x ships)
Ready for migration planning: yes — migration path to OTel is clear and low-risk.
