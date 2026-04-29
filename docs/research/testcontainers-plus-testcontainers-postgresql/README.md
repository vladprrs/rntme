# Dependency Research: testcontainers + @testcontainers/postgresql

Researched: 2026-04-28
Repository: /home/coder/work/rntme
Domain/ecosystem: npm/integration-testing-docker
Current version(s) in rntme: ^10.13.0 (resolved to 10.28.0; packages/platform-storage, packages/platform-http package.json; integration/e2e tests)
Latest stable version: 11.14.0 (released 2025-05-26, npm dist-tag `latest`)
Confidence: HIGH

## User Constraints
- Goal: understand current dependencies and migrate rntme to latest safe versions later.
- Output must be written to `docs/research/testcontainers-plus-testcontainers-postgresql/README.md`.
- Research-only: do not perform dependency upgrades or runtime code migrations in this issue.
- Look for better-suited libraries/solutions, not only latest version of the current choice.
- Use authoritative current sources: Context7 where applicable, official docs/changelog/releases, npm/GitHub/container registry, migration guides, security advisories.

## Summary

`testcontainers` is the de-facto standard for integration testing with real Docker containers in Node.js. The rntme CLI packages (`platform-storage`, `platform-http`) use it to spin up PostgreSQL and MinIO containers for integration/e2e tests. Current pinned version is `^10.13.0` (resolved to `10.28.0` in lockfile). The latest stable release is `11.14.0` (May 2025), representing a full major version bump with several breaking changes.

The v11 release introduces **minimum Node 20 requirement**, **removal of default container images** (modules must now explicitly pass an image tag), **dropped Docker Compose v1 support**, and **stop-timeout unit change from seconds to milliseconds**. For rntme, the impact is **low-to-moderate**: Node 20+ is already required; rntme already specifies explicit image tags (`postgres:16-alpine`, `minio/minio:latest`); no Docker Compose v1 usage was found; and rntme does not use `container.stop({ timeout })` with explicit values.

Experts in 2024-2026 continue to use `testcontainers` as the primary tool for Docker-based integration tests. The main alternative paradigm gaining traction is **in-process/in-memory databases** (e.g., `@electric-sql/pglite`) for unit-level tests that do not need full SQL compatibility, but testcontainers remains the standard for integration tests that must verify against the real database engine.

**Primary recommendation:** Upgrade to `testcontainers@^11.14.0` + `@testcontainers/postgresql@^11.14.0` in a dedicated follow-up issue. The migration effort is small (likely <1 day), risk is low, and the upgrade keeps rntme on the supported major line. No replacement is warranted.

## Current Usage in rntme

| Package / image / tool | Current version | Used by | Source file(s) | Runtime/dev/build/test | Notes |
|---|---|---|---|---|---|
| `testcontainers` | `^10.13.0` (10.28.0) | `platform-http` | `rntme-cli/packages/platform-http/package.json` | dev/test | `GenericContainer` for MinIO e2e tests |
| `@testcontainers/postgresql` | `^10.13.0` (10.28.0) | `platform-storage`, `platform-http` | `rntme-cli/packages/platform-storage/package.json`, `rntme-cli/packages/platform-http/package.json` | dev/test | `PostgreSqlContainer` for PG integration/e2e tests |
| `postgres:16-alpine` | n/a (image tag) | `platform-storage`, `platform-http` | `test/integration/harness.ts`, `test/e2e/harness.ts` | test | Explicit image tag already passed to constructor |
| `minio/minio:latest` | n/a (image tag) | `platform-http` | `test/e2e/harness.ts` | test | Explicit image tag already passed to constructor |

**Commands used to verify usage:**
```bash
grep -r "testcontainers" --include="package.json" -l | grep -v node_modules | grep -v .worktrees
grep -r "testcontainers" --include="*.ts" -l | grep -v node_modules | grep -v .worktrees
grep "testcontainers" pnpm-lock.yaml
```

**Code references:**
- PostgreSQL harness (integration): `rntme-cli/packages/platform-storage/test/integration/harness.ts:24`
- PostgreSQL harness (e2e): `rntme-cli/packages/platform-http/test/e2e/harness.ts:40`
- Docker availability guard: `rntme-cli/packages/platform-storage/test/integration/docker-available.ts`, `rntme-cli/packages/platform-http/test/e2e/docker-available.ts`

## Latest Versions / Release State

| Channel | Version | Release date | Source | Notes |
|---|---|---|---|---|
| Stable (latest) | 11.14.0 | 2025-05-26 | npm dist-tag `latest` | Current major line |
| Previous stable | 10.28.0 | 2025-04-18 | npm | Current resolved version in rntme |
| v10 last | 10.28.0 | 2025-04-18 | npm | v10 line is effectively frozen |

Both `testcontainers` and `@testcontainers/postgresql` are version-locked and released together from the same monorepo ([`testcontainers-node`](https://github.com/testcontainers/testcontainers-node)).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| `testcontainers` | 11.14.0 | Generic Docker container management in tests | De-facto standard; 2.5k GitHub stars; backed by Testcontainers OSS community |
| `@testcontainers/postgresql` | 11.14.0 | PostgreSQL-specific container helper | Official module; wraps `testcontainers` with PG-specific convenience methods (`getConnectionUri`, etc.) |

### Supporting
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `@electric-sql/pglite` | ^0.2.x | In-memory PostgreSQL-compatible engine (WASM) | When test speed matters more than 100% PG compatibility; no Docker required |
| `docker-compose` (CLI) | v2+ | Multi-container orchestration in tests | When tests need several linked containers; testcontainers also supports compose via `DockerComposeEnvironment` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff | Recommendation for rntme |
|---|---|---|---|
| `testcontainers` + PG module | `@electric-sql/pglite` | Much faster, no Docker daemon, but not 100% PG compatible | Not recommended for integration tests that exercise PG-specific features (RLS, migrations, etc.) |
| `testcontainers` + PG module | Manual `docker run` + `dockerode` | More control, but significantly more boilerplate | Not recommended; testcontainers already abstracts exactly what rntme needs |
| `testcontainers` + PG module | `pg-testcontainer` (community) | Smaller, but less maintained, fewer modules | Not recommended; official modules are better supported |

If eventually recommended, upgrade command:
```bash
# Do NOT run during research issue; for reference only
pnpm add -D testcontainers@^11.14.0 @testcontainers/postgresql@^11.14.0
```

## Architecture Patterns

### System Architecture Diagram
```mermaid
flowchart LR
  Test[test file] --> Guard{Docker available?}
  Guard --|yes| Harness[test harness]
  Guard --|no / SKIP_TESTCONTAINERS| External[external DB/S3 URL]
  Harness --> PG[PostgreSqlContainer]
  Harness --> MinIO[GenericContainer]
  PG --> Docker[(Docker daemon)]
  MinIO --> Docker
  Docker --> Running[Running containers]
  Running --> App[app under test]
```

### Component Responsibilities
| Component | Responsibility | Implementation mapping | Notes |
|---|---|---|---|
| `docker-available.ts` | Detect Docker daemon availability | `spawnSync('docker', ['info'])` | Skips tests when Docker is absent |
| `harness.ts` | Start/stop containers, run migrations, build app deps | `PostgreSqlContainer.start()`, `GenericContainer.start()` | Also supports external DB/S3 via env vars |
| `*.test.ts` | Exercise app logic against real DB | Uses harness-returned pools/apps | |

### Recommended Project Structure
```text
packages/<pkg>/
├── test/
│   ├── integration/
│   │   ├── docker-available.ts   # Docker detection guard
│   │   ├── harness.ts            # Container lifecycle + DB setup
│   │   └── *.test.ts             # Integration tests
│   └── e2e/
│       ├── docker-available.ts
│       ├── harness.ts
│       └── *.test.ts
```

### Pattern 1: Container Harness with External Fallback
What: Start testcontainers when Docker is available; fall back to an external URL when running in CI environments that provide a managed database.
When to use: When tests must run both locally (Docker) and in CI (external managed DB for speed/reliability).
Example:
```ts
// Source: rntme-cli/packages/platform-storage/test/integration/harness.ts
export async function startPostgres(): Promise<PgHandles> {
  const externalUrl = process.env.PLATFORM_TEST_DATABASE_URL;
  let container: StartedPostgreSqlContainer | null = null;
  let ownerUrl: string;
  if (externalUrl) {
    ownerUrl = externalUrl;
  } else {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    ownerUrl = container.getConnectionUri();
  }
  // ... run migrations, create pools
}
```

### Pattern 2: Docker Guard for Conditional Test Skipping
What: Skip integration/e2e tests when Docker is not available, preventing false failures on machines without Docker.
When to use: Always, for any test suite that depends on testcontainers.
Example:
```ts
// Source: rntme-cli/packages/platform-storage/test/integration/docker-available.ts
export function integrationContainersAvailable(): boolean {
  if (process.env['PLATFORM_TEST_DATABASE_URL']) return true;
  if (process.env['SKIP_TESTCONTAINERS'] === '1') return false;
  return dockerAvailable();
}
```

### Anti-Patterns to Avoid
- **Hard-coding default image tags in every test file**: Centralize image tags in harness files so upgrades require touching one location.
- **Not stopping containers**: Always call `container.stop()` in teardown, ideally in a `try/finally` or `afterAll`/`afterEach` block. rntme already does this via harness teardown functions.
- **Using `latest` image tags in CI**: Pin image tags (e.g., `postgres:16-alpine`) for reproducibility. rntme already pins `postgres:16-alpine` but uses `minio/minio:latest` — consider pinning MinIO as well.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Spinning up Docker containers for tests | Shell scripts wrapping `docker run` | `testcontainers` | Cross-platform, automatic port mapping, health checks, cleanup on process exit, retry logic |
| Waiting for container readiness | Custom `setTimeout` loops | `testcontainers` built-in wait strategies | Built-in strategies for log pattern, port, HTTP health checks; handles race conditions |
| Reaper / cleanup on test crash | Custom process signal handlers | `testcontainers` Ryuk reaper | Automatically removes orphaned containers even if the test process crashes |

Key insight: testcontainers encodes years of production-hardened logic for container lifecycle management. A hand-rolled solution will miss edge cases (port conflicts, Docker daemon unavailability, zombie containers, race conditions) that testcontainers handles out of the box.

## Common Pitfalls

### Pitfall 1: v11 Breaking Change — Default Images Removed
What goes wrong: `new PostgreSqlContainer().start()` throws because no default image is provided in v11.
Why it happens: testcontainers v11 removed all default module images for reproducibility and supply-chain security.
How to avoid: Always pass an explicit image tag: `new PostgreSqlContainer('postgres:16-alpine').start()`.
Warning signs: Tests fail immediately on upgrade with an error about missing image.

**rntme impact: NONE** — rntme already passes `'postgres:16-alpine'` explicitly.

### Pitfall 2: v11 Breaking Change — Stop Timeout Unit Changed
What goes wrong: `container.stop({ timeout: 10 })` now means 10 milliseconds instead of 10 seconds.
Why it happens: v11 standardized timeout units to milliseconds across the API.
How to avoid: Update to `container.stop({ timeout: 10_000 })` for 10 seconds.
Warning signs: Containers fail to stop gracefully, leading to test flakiness or leaked containers.

**rntme impact: NONE** — rntme does not use explicit stop timeouts.

### Pitfall 3: Docker Daemon Not Available in CI
What goes wrong: Tests fail with connection errors or are silently skipped, reducing CI coverage.
Why it happens: Some CI runners (e.g., lightweight GitHub Actions runners) do not expose Docker.
How to avoid: Maintain the external-DB fallback (`PLATFORM_TEST_DATABASE_URL`) and ensure CI matrices test both paths.
Warning signs: CI passes but integration tests are skipped; coverage drops unexpectedly.

**rntme impact: LOW** — rntme already has the external-DB fallback and `docker-available.ts` guards.

## Code Examples

### Starting PostgreSQL with Explicit Image
```ts
// Source: https://github.com/testcontainers/testcontainers-node/blob/main/docs/modules/postgresql.md
import { PostgreSqlContainer } from "@testcontainers/postgresql";

const container = await new PostgreSqlContainer("postgres:16-alpine")
  .withDatabase("testdb")
  .withUsername("testuser")
  .withPassword("testpass")
  .start();

const uri = container.getConnectionUri();
// ... run tests
await container.stop();
```

### Generic Container (MinIO)
```ts
// Source: rntme-cli/packages/platform-http/test/e2e/harness.ts
const minio = await new GenericContainer('minio/minio:latest')
  .withCommand(['server', '/data'])
  .withEnvironment({ MINIO_ROOT_USER: 'minio', MINIO_ROOT_PASSWORD: 'minio12345' })
  .withExposedPorts(9000)
  .start();

const endpoint = `http://${minio.getHost()}:${minio.getMappedPort(9000)}`;
// ... run tests
await minio.stop();
```

### Teardown Pattern
```ts
// Source: rntme-cli/packages/platform-http/test/e2e/harness.ts
return {
  // ...
  teardown: async () => {
    await pool.end();
    await ownerPool.end();
    await minio?.stop();
    await pg?.stop();
  },
};
```

## State of the Art (2024-2026)

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| testcontainers v10 | testcontainers v11 | May 2025 | Node 20+ required; default images removed; timeout units changed |
| Docker Compose v1 | Docker Compose v2 | July 2023 (EOL) | v11 dropped v1 support entirely |
| `RandomUniquePortGenerator` | `RandomPortGenerator` | v11 | API rename |

New tools/patterns to consider:
- `@electric-sql/pglite` — in-memory PG for ultra-fast tests without Docker; worth evaluating for unit tests that do not need full PG feature parity.

Deprecated/outdated:
- Docker Compose v1 — no longer supported by testcontainers v11.
- testcontainers v10 — still functional but no longer the active major line; will not receive new modules or major features.

## Migration Assessment

| Area | Finding | Impact | Risk | Evidence |
|---|---|---|---|---|
| Breaking changes | v11 removes default images | LOW | LOW | rntme already passes explicit image tags |
| Breaking changes | v11 requires Node 20+ | NONE | NONE | rntme already requires Node 20+ (`@types/node: ^20.14.0`) |
| Breaking changes | v11 stop timeout in ms | NONE | NONE | rntme does not use explicit `timeout` option |
| Breaking changes | v11 drops Docker Compose v1 | NONE | NONE | rntme does not use Docker Compose via testcontainers |
| API compatibility | `PostgreSqlContainer`, `GenericContainer`, `getConnectionUri()`, `getHost()`, `getMappedPort()` unchanged | LOW | LOW | Verified against v11 release notes and Context7 examples |
| Test coverage | All integration/e2e tests use harness pattern | LOW | LOW | Harness files centralize container usage |
| Lockfile | `pnpm-lock.yaml` pins 10.28.0 | LOW | LOW | Standard pnpm upgrade workflow |
| Security | No published security advisories for either version | LOW | LOW | GitHub Security Advisories page checked |
| Maintenance | v10 line is frozen; v11 is actively maintained | MEDIUM | LOW | GitHub release history |

**Migration effort estimate:** <1 day (update `package.json` specs, run `pnpm install`, verify tests pass locally and in CI).

**Test strategy:** Run `pnpm -F @rntme-cli/platform-storage test` and `pnpm -F @rntme-cli/platform-http test` after upgrade. No code changes expected in harness files.

## Recommendation

**Decision:** KEEP + UPGRADE

**Rationale:**
- testcontainers remains the standard for Docker-based integration testing in Node.js.
- v11 breaking changes have **zero impact** on rntme's current usage patterns.
- Staying on v10 incurs gradual technical debt (no new features, modules, or security patches on the frozen line).
- The migration is low-effort, low-risk, and can be done in a single focused PR.

**Follow-up tasks to create later:**
1. **RNT-XXX** — Upgrade `testcontainers` and `@testcontainers/postgresql` to `^11.14.0` in `platform-storage` and `platform-http`.
2. **RNT-XXX** — Evaluate `@electric-sql/pglite` as a faster alternative for non-integration tests (optional, low priority).
3. **RNT-XXX** — Pin `minio/minio` image tag in `platform-http` e2e harness instead of `latest` for reproducibility.

## Open Questions

1. **Should rntme adopt `@electric-sql/pglite` for faster unit tests?**
   - What we know: pglite provides a WASM PostgreSQL engine with no Docker dependency; startup is nearly instant.
   - What's unclear: Whether pglite supports all PG features used by rntme (RLS, custom types, specific migration DDL).
   - Recommendation: Spike in a separate issue; not a blocker for the testcontainers upgrade.

2. **Should CI continue to use external PostgreSQL or switch to testcontainers?**
   - What we know: rntme CI currently supports both via `PLATFORM_TEST_DATABASE_URL` and `SKIP_TESTCONTAINERS`.
   - What's unclear: Whether testcontainers v11 startup time is acceptable in GitHub Actions runners.
   - Recommendation: Keep dual-mode support; testcontainers v11 performance is comparable to v10.

## Sources

### Primary (HIGH confidence)
- Context7 `/testcontainers/testcontainers-node` — library ID confirmed; PostgreSQL usage examples and API patterns fetched.
- GitHub Release `v11.0.0` — https://github.com/testcontainers/testcontainers-node/releases/tag/v11.0.0 — breaking changes enumerated.
- npm registry — `npm view testcontainers@11.14.0` and `npm view @testcontainers/postgresql@11.14.0` — version metadata verified.

### Secondary (MEDIUM confidence)
- GitHub Security Advisories — https://github.com/testcontainers/testcontainers-node/security/advisories — no published advisories as of 2026-04-28.
- pnpm-lock.yaml in rntme — verified exact resolved version (10.28.0).

### Tertiary (LOW confidence - needs validation)
- `@electric-sql/pglite` official docs — feature compatibility with full PostgreSQL not fully verified against rntme's migration DDL.

## Metadata

Research scope:
- Core technology: testcontainers Node.js library + PostgreSQL module
- Ecosystem: Docker-based integration testing, alternative in-memory PG engines
- Patterns: Container harness with external fallback, Docker availability guards
- Pitfalls: v11 breaking changes, CI Docker availability

Confidence breakdown:
- Standard stack: HIGH — testcontainers is the clear market leader; Context7 and npm confirm.
- Architecture: HIGH — rntme's existing harness pattern is idiomatic and matches official docs.
- Pitfalls: HIGH — v11 breaking changes are explicitly documented in the release notes.
- Code examples: HIGH — Verified against Context7 and rntme's own codebase.

Research date: 2026-04-28
Valid until: 2026-10-28 (or until testcontainers v12 is released)
Ready for migration planning: **YES**
