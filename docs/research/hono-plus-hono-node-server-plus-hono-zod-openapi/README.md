# Dependency Research: hono + @hono/node-server + @hono/zod-openapi

Researched: 2026-04-28
Repository: /home/coder/work/rntme
Domain/ecosystem: npm/http-api-framework
Current version(s) in rntme: hono ^4.6.0; @hono/node-server ^1.13.0 - ^1.13.1; @hono/zod-openapi ^0.16.0
Latest stable version: hono 4.12.15 (2026-04-28); @hono/node-server 2.0.0 (2026-04-21); @hono/zod-openapi 1.3.0 (2026-04-13)
Confidence: HIGH

## User Constraints
- Goal: understand current dependencies and migrate rntme to latest safe versions later.
- Output must be written to `docs/research/hono-plus-hono-node-server-plus-hono-zod-openapi/README.md`.
- Research-only: do not perform dependency upgrades or runtime code migrations in this issue.
- Look for better-suited libraries/solutions, not only latest version of the current choice.
- Use authoritative current sources: Context7 where applicable, official docs/changelog/releases, npm/GitHub/container registry, migration guides, security advisories.

## Summary

Hono has evolved significantly since rntme pinned `^4.6.0` in late 2024. The framework remains the dominant lightweight, Web-Standards-based HTTP router for TypeScript across edge and Node.js runtimes, with 30k+ GitHub stars and a mature middleware ecosystem. Between 4.6 and 4.12.15, Hono shipped multiple performance improvements (TrieRouter 1.5-2x faster, `c.json()` fast path), new middleware (JWK auth, language detection, proxy helper), and the important Standard Schema Validator abstraction.

The two companion packages have both undergone **major version bumps**:
- `@hono/node-server` jumped from 1.x to **2.0.0**, dropping Node 18 support (rntme already requires Node 20+) and delivering up to **2.3x throughput improvement** on body parsing via optimized request body reading.
- `@hono/zod-openapi` jumped from 0.x to **1.x**, aligning its peer dependency with Zod v4 (which rntme already uses) and adding batch route registration utilities.

**Primary recommendation:** Upgrade all three packages in a single migration wave. The breaking changes are minimal for rntme's usage pattern (no serveStatic, no toSSG, no Vercel adapter), and the security patches plus performance gains justify the effort. No alternative framework offers a better fit for rntme's "zero service-specific code" architecture on Node.js.

## Current Usage in rntme

| Package / image / tool | Current version | Used by | Source file(s) | Runtime/dev/build/test | Notes |
|---|---:|---|---|---|---|
| `hono` | `^4.6.0` | `@rntme/bindings-http`, `@rntme/db-studio`, `@rntme/ui-runtime`, `@rntme/platform-http` | `packages/bindings-http/package.json`, `packages/db-studio/package.json`, `packages/ui-runtime/package.json`, `apps/platform-http/package.json` | Runtime | HTTP framework core |
| `@hono/node-server` | `^1.13.0` / `^1.13.1` | `@rntme/runtime`, `@rntme/platform-http` | `packages/runtime/package.json`, `apps/platform-http/package.json` | Runtime | Node.js adapter for `serve()` |
| `@hono/zod-openapi` | `^0.16.0` | `@rntme/platform-http` | `apps/platform-http/package.json` | Runtime | OpenAPI 3.1 + Zod route definitions |

**Code references:**
```bash
# Verified via
grep -r "hono" --include="package.json" packages/ packages/
grep -r "@hono" --include="*.ts" packages/ | head -20
```

**Runtime usage pattern:** `@rntme/runtime` calls `serve()` from `@hono/node-server` to boot the HTTP surface (`packages/runtime/src/start/start-service.ts`). `@rntme/bindings-http` creates Hono sub-routers from validated binding artifacts. `@rntme/db-studio` uses Hono for the libSQL Hrana v3 read-only HTTP endpoint. `@rntme/ui-runtime` serves the SPA bundle via Hono. The platform HTTP server (`@rntme/platform-http`) uses Hono + `@hono/zod-openapi` for control-plane REST APIs.

## Latest Versions / Release State

| Channel | Version | Release date | Source | Notes |
|---|---|---|---|---|
| `hono` stable | 4.12.15 | 2026-04-28 | npm / GitHub | Latest patch; security fixes included |
| `hono` previous major | 3.12.12 | 2024-08 | npm | Not relevant; rntme is on 4.x |
| `@hono/node-server` stable | 2.0.0 | 2026-04-21 | npm / GitHub | Major version bump; v1.x maintenance ended |
| `@hono/node-server` previous | 1.19.14 | 2026-04-17 | npm | Last v1 release; no new features planned |
| `@hono/zod-openapi` stable | 1.3.0 | 2026-04-13 | npm / GitHub | Zod v4 peer dependency; batch route utilities |
| `@hono/zod-openapi` previous | 0.19.10 | 2025-01 | npm | Zod v3 peer dependency |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| `hono` | 4.12.15 | Web-standards HTTP framework | Lightweight, cross-runtime, TypeScript-first, 30k+ stars |
| `@hono/node-server` | 2.0.0 | Node.js adapter | Bridges Hono to Node.js native APIs; 2.3x faster than v1 |
| `@hono/zod-openapi` | 1.3.0 | OpenAPI 3.1 + Zod integration | Type-safe OpenAPI generation from Zod schemas |

### Supporting
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `@hono/zod-validator` | 0.3.0+ | Zod validation middleware | When you need request validation outside OpenAPI |
| `@hono/standard-validator` | latest | Standard Schema validator | When supporting multiple validators (Zod, Valibot, ArkType) |
| `hono/proxy` | built-in | Reverse proxy helper | When proxying to upstream services |
| `hono/jwk` | built-in | JWK authentication | When validating JWTs from JWKS endpoints |

### Alternatives Considered
| Instead of | Could Use | Tradeoff | Recommendation for rntme |
|---|---|---|---|
| Hono | Fastify | Fastify has richer plugin ecosystem and better Node.js performance history, but is Node-only and heavier | **Keep Hono** — rntme's cross-runtime (Node + potential edge) positioning and Web Standards alignment favor Hono |
| Hono | Express | Express is mature but legacy; no native TypeScript, no Web Standards | **Keep Hono** — Express is a regression for new architecture |
| Hono | Koa | Koa is lighter than Express but less active, smaller ecosystem | **Keep Hono** — Hono supersedes Koa in the lightweight category |
| Hono | Elysia (Bun) | Elysia is Bun-optimized and very fast, but Bun-only | **Keep Hono** — rntme targets Node.js primary; Bun is experimental |
| `@hono/zod-openapi` | `zod-to-openapi` + manual Hono wiring | More control, but more boilerplate | **Keep @hono/zod-openapi** — the integration is mature and reduces service-specific code |
| `@hono/node-server` | Node.js native `http.createServer` + manual fetch bridge | Maximum control, but loses optimizations | **Keep @hono/node-server** — v2 performance is now best-in-class |

## Architecture Patterns

### System Architecture Diagram
```mermaid
flowchart LR
  Client[HTTP Client] --> Node[Node.js HTTP Server]
  Node --> Adapter[@hono/node-server v2<br/>LightweightRequest/Response]
  Adapter --> Hono[Hono Router<br/>TrieRouter / PatternRouter]
  Hono --> Middleware[Middleware Stack<br/>Auth / Validation / CORS]
  Middleware --> BindingRouter[@rntme/bindings-http<br/>Sub-router per service]
  BindingRouter --> Executor[CommandExecutor /<br/>QueryExecutor]
  Executor --> Runtime[@rntme/runtime<br/>Event Store / Projection]
  Runtime --> SQLite[(SQLite / Turso)]
```

### Component Responsibilities
| Component | Responsibility | Implementation mapping | Notes |
|---|---|---|---|
| `@hono/node-server` | Bridge Node.js `IncomingMessage` to Web Standards `Request` | `packages/runtime/src/start/start-service.ts` | v2 uses lazy `Request` instantiation for speed |
| Hono Router | Match URL paths to handlers, execute middleware chain | `packages/bindings-http/src/` | TrieRouter is default; 1.5-2x faster in 4.12 |
| `@hono/zod-openapi` | Generate OpenAPI 3.1 spec from Zod schemas + Hono routes | `apps/platform-http/src/` | v1.x requires Zod v4 peer dep |
| Hono Context | Encapsulate request/response lifecycle | Used throughout bindings-http | `c.req.valid()`, `c.json()`, `c.text()` |

### Pattern 1: Sub-router Composition
What: Each service's bindings artifact creates an isolated Hono `Hono` instance that is mounted under a project-level route prefix.
When to use: rntme's core pattern — each service contributes a sub-router to the project HTTP surface.
Example:
```ts
// Source: packages/bindings-http/src/index.ts (conceptual)
import { Hono } from 'hono'

const serviceRouter = new Hono()
serviceRouter.get('/v1/issues', async (c) => {
  const result = await queryExecutor.execute(/* ... */)
  return c.json(result)
})

const projectApp = new Hono()
projectApp.route('/issue-tracker', serviceRouter)
```

### Pattern 2: OpenAPI-first Route Definition
What: Define routes with Zod schemas inline, deriving both runtime validation and OpenAPI spec.
When to use: Platform HTTP APIs where type safety and documentation must stay in sync.
Example:
```ts
// Source: apps/platform-http/src/ (conceptual)
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'

const app = new OpenAPIHono()

const route = createRoute({
  method: 'get',
  path: '/projects',
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(ProjectSchema) } },
      description: 'List projects'
    }
  }
})

app.openapi(route, (c) => {
  return c.json(projects)
})
```

### Pattern 3: Middleware Pipeline for Idempotency
What: Use Hono middleware to inject pre-fetch steps (idempotency key resolution, module RPC) before the handler.
When to use: rntme's command path where `pre[]` steps must run before the executor.
Example:
```ts
// Source: docs/history/specs/historical/2026-04-19-platform-modules-integration-design.md
app.use('/v1/*', async (c, next) => {
  const idempotencyKey = c.req.header('x-idempotency-key')
  c.set('idempotencyKey', idempotencyKey)
  await next()
})
```

### Anti-Patterns to Avoid
- **Using `app.use('*')` for route guards on static files**: This was the root cause of GHSA-q5qw-h33p-qvwr and GHSA-wmmm-f939-6g9c. rntme does not serve static files via Hono, so this is not a current risk.
- **Manually instantiating `new Request()` in middleware**: Bypasses `@hono/node-server` v2 optimizations.
- **Mixing Zod v3 and v4 schemas**: `@hono/zod-openapi` 1.x requires Zod v4 exclusively; mixing versions causes type errors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| HTTP routing | Custom regex router | Hono TrieRouter | Handles params, wildcards, middleware ordering; tested at scale |
| Node.js fetch bridge | Manual `IncomingMessage` -> `Request` | `@hono/node-server` | v2 optimizes body reading, URL construction, headers; 2.3x faster than hand-rolled |
| OpenAPI generation | Manual YAML/JSON editing | `@hono/zod-openapi` | Single source of truth from Zod schemas; types stay in sync |
| Request validation | Manual `JSON.parse` + asserts | `@hono/zod-validator` or `@hono/zod-openapi` | Type inference, error formatting, OpenAPI integration |

Key insight: Hono's value is not just the router — it is the **cross-runtime Web Standards abstraction**. Building a custom bridge to Node.js `http` module loses the performance optimizations in `@hono/node-server` v2 and the portability to edge runtimes.

## Common Pitfalls

### Pitfall 1: Zod v3/v4 Peer Dependency Mismatch
What goes wrong: `@hono/zod-openapi` 1.x declares `zod: ^4.0.0` in `peerDependencies`. If a workspace package still imports Zod v3 types, TypeScript compilation fails with opaque type errors.
Why it happens: Zod v4 changed internal type structures; the middleware is now compiled against v4.
How to avoid: Ensure all workspace packages resolve to Zod v4 before upgrading `@hono/zod-openapi`. rntme already uses `zod: ^4.0.0`, so this is low risk.
Warning signs: `Type 'ZodType<any>' is not assignable to type 'ZodType<any, ZodTypeDef, any>'` during `tsc`.

### Pitfall 2: Node 18 Support Drop in @hono/node-server v2
What goes wrong: v2 requires Node.js >= 20.0.0. If any deployment target still runs Node 18, the adapter will fail to import or crash at runtime.
Why it happens: Node 18 reached EOL in April 2025; the adapter removed compatibility shims.
How to avoid: Verify all Dokploy deploy targets and Docker base images use Node 20+ before upgrading. rntme's `Dockerfile.template` and CI already specify Node 20+.
Warning signs: `Error: @hono/node-server requires Node.js 20 or higher` at startup.

### Pitfall 3: Security Advisories on Unpatched Versions
What goes wrong: Running hono < 4.12.12 exposes applications to serveStatic middleware bypass (GHSA-wmmm-f939-6g9c) and toSSG path traversal (GHSA-xf4j-xp2r-rqqx).
Why it happens: URL decoding inconsistencies between router and static file handler.
How to avoid: Upgrade to hono >= 4.12.12. Even if rntme does not use `serveStatic` or `toSSG`, staying on an unpatched version creates audit noise and transitive risk if any dependency uses these features.
Warning signs: `npm audit` flags; Dependabot alerts.

## Code Examples

### Basic Hono + Node Server Setup
```ts
// Source: https://hono.dev/docs/getting-started/nodejs
import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()
app.get('/', (c) => c.text('Hello Hono!'))

serve({ fetch: app.fetch, port: 3000 })
```

### OpenAPI Route with Zod v4
```ts
// Source: https://github.com/honojs/middleware/releases/tag/%40hono%2Fzod-openapi%401.0.0
import { OpenAPIHono, createRoute } from '@hono/zod-openapi'
import { z } from 'zod'

const app = new OpenAPIHono()

const route = createRoute({
  method: 'get',
  path: '/users/{id}',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: {
      description: 'User found',
      content: { 'application/json': { schema: z.object({ name: z.string() }) } }
    }
  }
})

app.openapi(route, (c) => {
  const { id } = c.req.valid('param')
  return c.json({ name: `User ${id}` })
})
```

### Batch Route Registration (zod-openapi 1.3.0)
```ts
// Source: https://github.com/honojs/middleware/releases/tag/%40hono%2Fzod-openapi%401.3.0
import { defineOpenAPIRoute, openapiRoutes } from '@hono/zod-openapi'

const routes = [
  defineOpenAPIRoute({ method: 'get', path: '/projects', /* ... */ }),
  defineOpenAPIRoute({ method: 'post', path: '/projects', /* ... */ })
]

openapiRoutes(app, routes)
```

## State of the Art (2024-2026)

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Zod v3 | Zod v4 | 2025-04 | Better performance, stricter types, `.pipe()` removal; `@hono/zod-openapi` 1.x aligned |
| `@hono/node-server` v1 | v2 with LightweightRequest | 2026-04 | 2.3x body-parsing throughput; Node 18 dropped |
| Manual OpenAPI YAML | `@hono/zod-openapi` | 2024+ | Single-source-of-truth schemas |
| Express + `swagger-ui-express` | Hono + `@hono/zod-openapi` | 2024+ | Lighter, type-safe, edge-compatible |

New tools/patterns to consider:
- **Standard Schema Validator** (`@hono/standard-validator`): If rntme ever wants to support Valibot or ArkType alongside Zod, this middleware provides a unified interface.
- **Hono Proxy Helper** (`hono/proxy`): If the platform needs reverse-proxy capabilities to upstream services, this is now built-in as of 4.7.0.
- **WebSocket support in @hono/node-server v2**: First-class WebSocket support landed in v2 via PR #328. Not needed for rntme today, but worth noting for future real-time features.

Deprecated/outdated:
- **Vercel adapter** (`@hono/node-server/vercel`): Removed in v2. Vercel's modern runtimes no longer need it.
- **Zod v3**: No longer supported by `@hono/zod-openapi` 1.x.

## Migration Assessment

| Area | Finding | Impact | Risk | Evidence |
|---|---|---|---|---|
| **Breaking changes** | `@hono/node-server` v2 drops Node 18; removes Vercel adapter. `@hono/zod-openapi` 1.x drops Zod v3 support. | Low for rntme | Low | rntme requires Node 20+; already uses Zod v4; no Vercel adapter usage |
| **API compatibility** | `serve()` signature unchanged; `OpenAPIHono` API unchanged. | None | Very Low | Official release notes confirm API compatibility |
| **Performance** | Body parsing 2.3x faster; router 1.5-2x faster. | Positive | None | Benchmarks from official release notes |
| **Security** | Multiple CVEs patched in hono >= 4.12.12. | High if unpatched | Medium | GHSA-q5qw-h33p-qvwr, GHSA-wmmm-f939-6g9c, GHSA-xf4j-xp2r-rqqx |
| **TypeScript** | No known type regressions between 4.6 and 4.12. | Low | Low | Community reports; CI typecheck will catch |
| **Testing** | Full test suite should pass after version bump. | Low | Low | Hono follows semver; minor versions are additive |
| **Lockfile** | pnpm-lock.yaml will change significantly. | Medium | Low | Expected for major version bumps |
| **Docker images** | Runtime image must rebuild with new hono/node-server versions. | Low | Low | Dockerfile.template uses `pnpm install` |

### Security Advisories Requiring Attention

| Advisory | Severity | Affected Versions | Patched Version | Relevance to rntme |
|---|---|---|---|---|
| GHSA-q5qw-h33p-qvwr (CVE-2026-29045) | High | hono < 4.12.4 | 4.12.4 | **Indirect** — rntme does not use `serveStatic`, but staying unpatched creates audit risk |
| GHSA-wmmm-f939-6g9c (CVE-2026-39407) | Moderate | hono < 4.12.12 | 4.12.12 | **Indirect** — same as above |
| GHSA-xf4j-xp2r-rqqx (CVE-2026-39408) | Moderate | hono >= 4.0.0, <= 4.12.11 | 4.12.12 | **Indirect** — rntme does not use `toSSG` |
| GHSA-26pp-8wgv-hjvm | Moderate | hono < 4.12.12 | 4.12.12 | Cookie validation; platform-http may be affected |
| GHSA-r5rp-j6wh-rvv4 | Moderate | hono < 4.12.12 | 4.12.12 | Cookie name handling; platform-http may be affected |

## Recommendation

**Decision: KEEP + UPGRADE**

Rationale:
- Hono remains the best-fit framework for rntme's Web-Standards-first, cross-runtime architecture.
- `@hono/node-server` v2 delivers significant performance gains with no API breakage.
- `@hono/zod-openapi` 1.x aligns with rntme's existing Zod v4 dependency.
- Security advisories are patched in the latest versions.
- The migration effort is low-risk because rntme does not use the features that broke (serveStatic, toSSG, Vercel adapter).

Follow-up tasks to create later:
1. **Create migration issue** to upgrade `hono` to `^4.12.15`, `@hono/node-server` to `^2.0.0`, `@hono/zod-openapi` to `^1.3.0` across all packages.
2. **Run full CI** (`pnpm -r run build → typecheck → test → lint`) after version bump.
3. **Verify Docker image** builds and runtime starts without errors.
4. **Load test** the demo issue-tracker-api to validate the 2.3x body-parsing improvement claim.
5. **Update `@hono/zod-openapi` usage** in `platform-http` to leverage `defineOpenAPIRoute` / `openapiRoutes` if it reduces boilerplate.

## Open Questions

1. **Does rntme's custom middleware order rely on any undocumented Hono behavior that changed between 4.6 and 4.12?**
   - What we know: Hono's middleware execution order is stable and well-tested.
   - What's unclear: Whether rntme's `pre[]` orchestration in bindings-http depends on subtle timing.
   - Recommendation: Add an integration test that asserts middleware execution order before upgrading.

2. **Should rntme adopt `@hono/standard-validator` for future multi-validator support?**
   - What we know: Standard Schema is a new cross-validator spec supported by Zod, Valibot, and ArkType.
   - What's unclear: Whether rntme will ever need non-Zod validators.
   - Recommendation: Defer until a concrete requirement emerges; document the option in ADR.

3. **What is the impact of `@hono/node-server` v2 on memory usage under rntme's typical load?**
   - What we know: v2 uses lazy `Request` instantiation, which should reduce memory pressure for simple routes.
   - What's unclear: Memory behavior under rntme's heavy Graph IR query execution.
   - Recommendation: Measure memory baseline before and after upgrade using `prom-client` metrics.

## Sources

### Primary (HIGH confidence)
- `/websites/hono_dev` (Context7) — Hono docs, getting started, middleware reference
- `/honojs/node-server` (Context7) — Node.js adapter architecture and requirements
- https://github.com/honojs/hono/releases/tag/v4.12.0 — Release notes for 4.12.0 (performance, features)
- https://github.com/honojs/hono/releases/tag/v4.7.0 — Release notes for 4.7.0 (Standard Schema, JWK, proxy)
- https://github.com/honojs/node-server/releases/tag/v2.0.0 — v2.0.0 release notes (breaking changes, performance)
- https://github.com/honojs/middleware/releases/tag/%40hono%2Fzod-openapi%401.0.0 — Zod v4 migration
- https://github.com/honojs/middleware/releases/tag/%40hono%2Fzod-openapi%401.3.0 — Batch route utilities

### Secondary (MEDIUM confidence)
- npm registry version listings — verified latest versions via `npm view`
- GitHub Security Advisories — verified affected/patched version ranges

### Tertiary (LOW confidence - needs validation)
- Benchmark claims from release notes (2.3x, 1.5-2x) — should be validated with rntme's own load tests

## Metadata

Research scope:
- Core technology: Hono HTTP framework v4.x, Node.js adapter, Zod-OpenAPI middleware
- Ecosystem: Hono middleware monorepo, Zod v4, Standard Schema
- Patterns: Sub-router composition, OpenAPI-first routes, middleware pipelines
- Pitfalls: Zod v3/v4 peer deps, Node 18 drop, security advisories

Confidence breakdown:
- Standard stack: HIGH — multiple authoritative sources, active community
- Architecture: HIGH — rntme's usage is straightforward sub-router mounting
- Pitfalls: HIGH — security advisories are documented with exact version ranges
- Code examples: HIGH — sourced from official docs and release notes

Research date: 2026-04-28
Valid until: 2026-07-28 (next quarterly dependency review)
Ready for migration planning: **YES**
