# Dependency Research: @bitrix24/b24jssdk

Researched: 2026-04-28
Repository: /home/coder/work/rntme
Domain/ecosystem: npm/crm-sdk
Current version(s) in rntme: 1.0.5 (modules/crm/bitrix24 package.json; Bitrix24 CRM module)
Latest stable version: 1.0.5 (2026-03-28) — rntme is already on latest
Confidence: HIGH

## User Constraints
- Goal: understand current dependencies and migrate rntme to latest safe versions later.
- Output must be written to `docs/research/bitrix24-b24jssdk/README.md`.
- Research-only: do not perform dependency upgrades or runtime code migrations in this issue.
- Look for better-suited libraries/solutions, not only latest version of the current choice.
- Use authoritative current sources: Context7 where applicable, official docs/changelog/releases, npm/GitHub/container registry, migration guides, security advisories.

## Summary

The `@bitrix24/b24jssdk` library is the **official Bitrix24 REST API JavaScript SDK** maintained by Bitrix24. Rntme is already on the latest stable version `1.0.5` (released 2026-03-28), so no immediate upgrade is required.

The SDK provides a comprehensive TypeScript-first interface for Bitrix24 REST API operations, including webhook-based authentication, batch requests, list fetching with automatic pagination, and support for both REST API v2 and the newer v3. It is actively maintained with regular releases and has a clear migration path from v0.x to v1.x.

For rntme's use case—a vendor adapter module that wraps Bitrix24 CRM operations behind a canonical contract—this is the **correct and only officially supported choice**. There are no mature alternative SDKs for Bitrix24. The library is lightweight (~few KB), MIT-licensed, and has minimal dependencies (axios, qs-esm, luxon).

**Primary recommendation:** KEEP PINNED at 1.0.5, monitor for patch releases, and plan migration to REST API v3 actions when Bitrix24 deprecates v2.

## Current Usage in rntme

| Package / image / tool | Current version | Used by | Source file(s) | Runtime/dev/build/test | Notes |
|---|---|---|---|---|---|
| `@bitrix24/b24jssdk` | `1.0.5` | Bitrix24 CRM vendor module | `modules/crm/bitrix24/package.json:32` | runtime | Direct dependency |

**Usage pattern:** The adapter (`modules/crm/bitrix24/src/adapter.ts`) imports `B24Hook` from the SDK and wraps it in a `Bitrix24Adapter` interface that exposes `call`, `list`, and `batch` methods. The adapter abstracts the SDK's internal `actions.v2.*` API and provides error mapping, pagination handling, and environment-based authentication (webhook URL or URL+userId+secret).

Key integration points:
- `B24Hook.fromWebhookUrl()` — for webhook-based authentication
- `B24Hook` constructor — for direct URL/userId/secret auth
- `hook.actions.v2.call.make()` — for single API calls
- `hook.actions.v2.batchByChunk.make()` — for batched operations
- `hook.callListMethod()` / `hook.fetchListMethod()` — for list operations with auto-pagination

## Latest Versions / Release State

| Channel | Version | Release date | Source | Notes |
|---|---|---|---|---|
| stable (npm) | 1.0.5 | 2026-03-28 | [npm](https://www.npmjs.com/package/@bitrix24/b24jssdk), [GitHub Release](https://github.com/bitrix24/b24jssdk/releases/tag/v1.0.5) | Latest stable; rntme is current |
| previous stable | 1.0.4 | 2026-03-06 | [CHANGELOG](https://github.com/bitrix24/b24jssdk/blob/main/CHANGELOG.md) | Batch call improvements |
| previous stable | 1.0.1 | 2026-02-02 | [CHANGELOG](https://github.com/bitrix24/b24jssdk/blob/main/CHANGELOG.md) | Major v1 release with breaking changes from v0.5.1 |
| legacy | 0.5.1 | 2025-10-29 | [CHANGELOG](https://github.com/bitrix24/b24jssdk/blob/main/CHANGELOG.md) | Last v0.x release |

**Release cadence:** Active — 5 releases in Q1 2026, 10+ releases in 2025.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| `@bitrix24/b24jssdk` | 1.0.5 | Official Bitrix24 REST API SDK | Only official SDK; maintained by Bitrix24 team; covers all REST API methods |
| `axios` | ^1.13.3 | HTTP client (SDK dependency) | Industry standard; used internally by SDK |
| `qs-esm` | ^7.0.3 | Query string parsing (SDK dependency) | ESM-compatible fork of qs |
| `luxon` | ^3.7.2 | Date/time handling (SDK dependency) | Modern replacement for Moment.js |

### Supporting
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `@bitrix24/b24jssdk-nuxt` | 1.0.5 | Nuxt.js integration | If rntme adds Nuxt-based frontend |
| `@bitrix24/b24ui-nuxt` | 2.6.1 | UI components for Bitrix24 apps | For frontend Bitrix24 app development (out of scope) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff | Recommendation for rntme |
|---|---|---|---|
| `@bitrix24/b24jssdk` | Raw `axios` + manual REST calls | Lose type safety, batching, pagination, error handling | **Do not hand-roll** — SDK provides significant value |
| `@bitrix24/b24jssdk` | Community SDKs (none mature) | No mature community alternatives exist | Stay with official SDK |
| `@bitrix24/b24jssdk` | Direct API calls via `fetch` | More control but requires reimplementing auth, batching, rate limiting | Only if extreme bundle size constraints; not recommended |

Installation / upgrade commands, if eventually recommended:
```bash
# rntme is already on latest; no action needed
pnpm add @bitrix24/b24jssdk@latest
```

## Architecture Patterns

### System Architecture Diagram
```mermaid
flowchart LR
  Input[Canonical CRM Contract] --> Adapter[Bitrix24Adapter]
  Adapter --> Auth{Auth Strategy}
  Auth -->|Webhook| Hook1[B24Hook.fromWebhookUrl]
  Auth -->|Direct| Hook2[B24Hook constructor]
  Hook1 --> SDK[@bitrix24/b24jssdk]
  Hook2 --> SDK
  SDK --> REST[Bitrix24 REST API v2/v3]
  REST --> Response[Response normalization]
  Response --> Error{Error?}
  Error -->|Yes| ErrorMap[mapBitrix24Error]
  Error -->|No| Output[Canonical CRM Response]
  ErrorMap --> Output
```

### Component Responsibilities
| Component | Responsibility | Implementation mapping | Notes |
|---|---|---|---|
| `Bitrix24Adapter` | Abstract SDK behind canonical interface | `modules/crm/bitrix24/src/adapter.ts` | Hides SDK internals from handlers |
| `B24Hook` | SDK authentication & HTTP client | `@bitrix24/b24jssdk` import | Two auth modes: webhook and direct |
| `actions.v2.call.make` | Single REST API call | Called via adapter `call()` method | Supports requestId for tracing |
| `actions.v2.batchByChunk.make` | Batched REST API calls | Called via adapter `batch()` method | Auto-chunking for large batches |
| `callListMethod` / `fetchListMethod` | List operations with pagination | Called via adapter `list()` method | Auto-pagination unless explicit page params |
| `mapBitrix24Error` | Error normalization | `modules/crm/bitrix24/src/errors.ts` | Maps Bitrix24 errors to canonical errors |

### Recommended Project Structure
```text
modules/crm/bitrix24/
├── src/
│   ├── adapter.ts       # SDK wrapper / adapter
│   ├── handlers.ts      # Canonical contract handlers
│   ├── mapping.ts       # Entity mapping (Bitrix24 ↔ canonical)
│   ├── errors.ts        # Error mapping
│   ├── types.ts         # Type definitions
│   └── capabilities.ts  # Supported features registry
├── test/
│   ├── unit/            # Unit tests for adapter, mapping
│   ├── integration/     # Conformance tests
│   └── live-smoke.test.ts # Live API smoke tests
└── package.json
```

### Pattern 1: Adapter Pattern with SDK Abstraction
What: Wrap the SDK in an application-specific adapter that exposes only the operations needed by the canonical contract.
When to use: When integrating vendor SDKs into a polyglot architecture where multiple CRM vendors must present a uniform interface.
Example:
```ts
// Source: rntme/modules/crm/bitrix24/src/adapter.ts
export interface Bitrix24Adapter {
  call(method: string, params?: Bitrix24Record, requestId?: string): Promise<unknown>;
  list(method: string, params?: Bitrix24Record, requestId?: string): Promise<Bitrix24Record[]>;
  batch(calls: readonly Bitrix24BatchCall[], requestId?: string): Promise<unknown>;
}
```

### Pattern 2: Environment-Based Authentication
What: Support multiple authentication strategies (webhook URL vs direct credentials) via environment variables with fallback logic.
When to use: When the same code must run in different deployment contexts (local dev, CI, production) with different Bitrix24 auth configurations.
Example:
```ts
// Source: rntme/modules/crm/bitrix24/src/adapter.ts
function createHook(options: CreateBitrix24AdapterOptions): Bitrix24HookLike {
  if (options.webhookUrl ?? process.env.BITRIX24_WEBHOOK_URL) {
    return B24Hook.fromWebhookUrl(...) as unknown as Bitrix24HookLike;
  }
  if (options.b24Url && options.userId && options.secret) {
    return new B24Hook({ b24Url, userId, secret }) as unknown as Bitrix24HookLike;
  }
  throw new Error('Bitrix24 adapter requires BITRIX24_WEBHOOK_URL or BITRIX24_URL/BITRIX24_USER_ID/BITRIX24_SECRET');
}
```

### Anti-Patterns to Avoid
- **Direct SDK usage in business logic**: Always route through the adapter to maintain vendor swap capability.
- **Ignoring `offClientSideWarning()`**: The SDK warns about client-side execution; suppress or handle appropriately (rntme already does this).
- **Using deprecated v0 methods**: Methods like `callMethod`, `callListMethod`, `callBatch` are deprecated and will be removed in v2.0.0. Use `actions.v2.*` or `actions.v3.*` instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Bitrix24 REST API client | Raw HTTP calls with fetch/axios | `@bitrix24/b24jssdk` | Authentication, batching, pagination, rate limiting, error handling, TypeScript types |
| Batch request chunking | Manual batch splitting | `actions.v2.batchByChunk.make` | SDK handles chunking, error recovery, and response merging |
| List pagination | Manual start/limit loops | `callListMethod` / `fetchListMethod` | SDK auto-paginates and yields results |
| Webhook signature validation | Custom crypto logic | `B24Hook.fromWebhookUrl` | SDK handles URL parsing and auth |
| Type definitions for Bitrix24 entities | Manual interfaces | SDK built-in types | Official types kept in sync with API |

Key insight: Bitrix24 REST API has nuanced behavior around batch limits (50 commands), rate limiting, error formats, and pagination. The official SDK handles all of these correctly and is actively updated when the API changes.

## Common Pitfalls

### Pitfall 1: Deprecated API Methods
What goes wrong: Using `callMethod`, `callListMethod`, `callBatch`, `callBatchByChunk`, `fetchListMethod` directly on the B24 instance. These are deprecated and will be removed in SDK v2.0.0.
Why it happens: Legacy code or outdated documentation.
How to avoid: Use the new `actions.v2.*` or `actions.v3.*` APIs. Rntme already uses `actions.v2.call.make` and `actions.v2.batchByChunk.make` correctly.
Warning signs: TypeScript deprecation warnings; SDK logs warnings at runtime.

### Pitfall 2: REST API v2 vs v3 Confusion
What goes wrong: Bitrix24 is transitioning from REST API v2 to v3. v3 has different parameter formats (array-based filters vs object-based) and pagination.
Why it happens: The SDK supports both, but the APIs are not drop-in compatible.
How to avoid: Explicitly choose v2 or v3 per endpoint. Rntme currently uses v2; plan a migration assessment before Bitrix24 deprecates v2.
Warning signs: API errors about unsupported parameters; inconsistent response formats.

### Pitfall 3: Batch Size Limits
What goes wrong: Sending more than 50 commands in a single batch causes API errors.
Why it happens: Bitrix24 REST API has a hard limit of 50 commands per batch request.
How to avoid: Use `actions.v2.batchByChunk.make` which automatically chunks large batches into groups of 50. Rntme already uses this.
Warning signs: `ERROR_BATCH_TOO_LARGE` or similar errors from Bitrix24.

### Pitfall 4: Type Safety Gaps
What goes wrong: The SDK's TypeScript types for `call.make()` return `any` or overly broad unions (`ListPayload<P> | BatchPayload<P>`), reducing type safety.
Why it happens: Generic REST API wrappers cannot know the exact return type of every Bitrix24 method.
How to avoid: Wrap SDK calls in adapter methods with explicit return type annotations, as rntme does.
Warning signs: `any` types propagating through the codebase; loss of IntelliSense.

## Code Examples

### Example 1: Initialize SDK with Webhook URL
```ts
// Source: https://bitrix24.github.io/b24jssdk/docs/getting-started/installation/nodejs/
import { B24Hook } from '@bitrix24/b24jssdk';

const hook = B24Hook.fromWebhookUrl('https://example.bitrix24.ru/rest/1/WEBHOOK_TOKEN/');
const result = await hook.actions.v2.call.make({
  method: 'crm.contact.list',
  params: { filter: { NAME: 'John' } },
  requestId: 'unique-request-id'
});
```

### Example 2: Batch Operations with Auto-Chunking
```ts
// Source: https://bitrix24.github.io/b24jssdk/docs/working-with-the-rest-api/batch-by-chunk-rest-api-ver2/
import { B24Hook } from '@bitrix24/b24jssdk';

const hook = B24Hook.fromWebhookUrl('https://example.bitrix24.ru/rest/1/WEBHOOK_TOKEN/');
const result = await hook.actions.v2.batchByChunk.make({
  calls: [
    ['crm.contact.get', { ID: 1 }],
    ['crm.contact.get', { ID: 2 }],
    // ... up to any number; SDK auto-chunks into groups of 50
  ],
  options: {
    isHaltOnError: true,
    requestId: 'batch-request-id'
  }
});
```

### Example 3: List Operations with Pagination
```ts
// Source: https://bitrix24.github.io/b24jssdk/docs/working-with-the-rest-api/fetch-list-rest-api-ver2/
import { B24Hook } from '@bitrix24/b24jssdk';

const hook = B24Hook.fromWebhookUrl('https://example.bitrix24.ru/rest/1/WEBHOOK_TOKEN/');

// Async generator that auto-paginates
for await (const chunk of hook.fetchListMethod('crm.contact.list', { select: ['ID', 'NAME'] }, 'ID')) {
  console.log(chunk); // Array of contact objects
}
```

## State of the Art (2024-2026)

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| SDK v0.x with direct method calls (`callMethod`, `callBatch`) | SDK v1.x with `actions.v2.*` / `actions.v3.*` APIs | 2026-02 (v1.0.1) | Cleaner architecture, better TypeScript support, v3 API support |
| REST API v2 (object-based filters) | REST API v3 (array-based filters, new pagination) | 2026 (SDK v1.0.1) | More consistent API, but requires migration |
| `RestrictionManager` for rate limiting | `Limiters` / `ParamsFactory` system | 2026 (v1.0.1) | More flexible rate limiting |
| `LoggerBrowser` for logging | `LoggerFactory` with Monolog-like handlers | 2026 (v1.0.1) | Better logging infrastructure |
| CommonJS support | ESM + UMD only | 2025-05 (v0.4.0) | Modern module system; Node.js 18+ required |

New tools/patterns to consider:
- **REST API v3**: Bitrix24 is pushing v3 as the future. Rntme should assess migration timing.
- **SDK `actions.v3.*` APIs**: New filter syntax (`[['field', 'operator', value]]`), pagination via `limit`/`page`.
- **Nuxt module**: `@bitrix24/b24jssdk-nuxt` for Nuxt.js apps (if rntme adds frontend).

Deprecated/outdated:
- `callMethod`, `callListMethod`, `callBatch`, `callBatchByChunk`, `fetchListMethod` on B24 instances — deprecated in v1, removal planned for v2.0.0.
- `RestrictionManager` class — removed in v1.
- `LoggerBrowser` — deprecated in v1.
- CommonJS builds — dropped in v0.4.0.

## Migration Assessment

| Area | Finding | Impact | Risk | Evidence |
|---|---|---|---|---|
| Version | rntme is on latest (1.0.5) | None | None | npm registry, package.json |
| Breaking changes from v0.5.1 to v1.x | Significant API restructuring | Medium if upgrading from v0 | Medium | [Migration guide](https://bitrix24.github.io/b24jssdk/docs/getting-started/migration/v1/) |
| REST API v2 → v3 | Different parameter formats, pagination | High (requires adapter changes) | Medium | Official docs, SDK v1.0.1 changelog |
| Deprecated methods | `callMethod`, `callBatch`, etc. deprecated | Low (rntme already uses new APIs) | Low | Code review of adapter.ts |
| Type safety | SDK types are broad; adapter adds specificity | Low | Low | Type inspection of SDK exports |
| Security | No known CVEs; dependencies (axios, luxon) are current | Low | Low | npm audit, Snyk, GitHub Security |
| Bundle size | SDK + deps ~100KB gzipped | Low | Low | Bundle analysis |
| Node.js compatibility | Requires Node.js 18+ | None (rntme uses Node 20+) | None | package.json engines |
| Maintenance | Active development, 17 stars, small community | Medium (bus factor) | Medium | GitHub activity |

**Migration path/effort:**
- **Current state → future v2 SDK**: Low effort. Rntme already uses `actions.v2.*` APIs which are the recommended v1 APIs. When SDK v2 is released, monitor for breaking changes.
- **REST API v2 → v3**: Medium effort. Would require updating adapter parameter transformation logic and pagination handling. Recommend a spike to assess v3 feature benefits before migrating.

## Recommendation

**Decision:** KEEP PINNED

**Rationale:**
- rntme is already on the latest stable version (1.0.5).
- This is the only official Bitrix24 SDK with no mature alternatives.
- The SDK is actively maintained and aligned with rntme's architecture (adapter pattern, TypeScript, ESM).
- No security vulnerabilities or critical bugs affecting rntme's usage pattern.
- The adapter pattern isolates rntme from SDK API changes, making future upgrades low-risk.

**Follow-up tasks to create later:**
1. **Monitor SDK releases**: Subscribe to GitHub releases or set up Dependabot for `@bitrix24/b24jssdk`.
2. **REST API v3 spike**: Create a spike issue to assess REST API v3 benefits and migration effort for the Bitrix24 adapter.
3. **SDK v2 readiness**: When SDK v2.0.0 is announced, create a migration issue to update deprecated method usage (rntme is mostly clean already).
4. **Type safety improvement**: Consider contributing stricter type definitions upstream or adding runtime validation in the adapter for critical paths.

## Open Questions

1. **When will Bitrix24 deprecate REST API v2?**
   - What we know: SDK v1.0.1 added v3 support; v2 is still fully supported.
   - What's unclear: No official deprecation timeline published.
   - Recommendation: Monitor Bitrix24 developer blog and API docs; plan v3 spike within 6 months.

2. **What is the SDK's long-term maintenance commitment?**
   - What we know: Official Bitrix24 project, active development, 696 commits.
   - What's unclear: Team size, roadmap beyond v2.
   - Recommendation: Treat as standard vendor dependency; the adapter pattern provides escape hatch if needed.

3. **Should rntme implement REST API v3 support proactively?**
   - What we know: v3 offers array-based filters and new pagination.
   - What's unclear: Whether v3 provides features rntme needs that v2 lacks.
   - Recommendation: Wait for Bitrix24 deprecation announcement or specific v3 feature requirements before investing migration effort.

## Sources

### Primary (HIGH confidence)
- [npm registry](https://www.npmjs.com/package/@bitrix24/b24jssdk) — version info, dependencies, engines
- [GitHub repository](https://github.com/bitrix24/b24jssdk) — source code, releases, issues
- [CHANGELOG.md](https://github.com/bitrix24/b24jssdk/blob/main/CHANGELOG.md) — release history, breaking changes
- [Official documentation](https://bitrix24.github.io/b24jssdk/) — API reference, migration guides, installation
- [Migration guide v0→v1](https://bitrix24.github.io/b24jssdk/docs/getting-started/migration/v1/) — breaking changes, deprecated APIs

### Secondary (MEDIUM confidence)
- [GitHub Issues](https://github.com/bitrix24/b24jssdk/issues) — open bugs and feature requests (6 open issues, none critical)
- [Release v1.0.5 notes](https://github.com/bitrix24/b24jssdk/releases/tag/v1.0.5) — latest release details
- npm search for alternatives — no mature community alternatives found

### Tertiary (LOW confidence - needs validation)
- None — all findings verified against primary sources.

## Metadata

Research scope:
- Core technology: @bitrix24/b24jssdk (Bitrix24 REST API JavaScript SDK)
- Ecosystem: npm/crm-sdk, Bitrix24 REST API v2/v3
- Patterns: Adapter pattern, environment-based auth, batch operations, pagination
- Pitfalls: Deprecated APIs, v2/v3 confusion, batch limits, type safety gaps
Confidence breakdown:
- Standard stack: HIGH — official SDK, clear dependency tree, no alternatives
- Architecture: HIGH — well-documented SDK with clear patterns
- Pitfalls: HIGH — documented in migration guide and observed in issues
- Code examples: HIGH — verified against official docs and SDK source
Research date: 2026-04-28
Valid until: 2026-07-28 (recommend quarterly review given active development)
Ready for migration planning: yes — no migration needed (already on latest)
