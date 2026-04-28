# Dependency Research: @shevernitskiy/amo

Researched: 2026-04-28
Repository: /home/coder/work/rntme
Domain/ecosystem: npm/crm-sdk
Current version(s) in rntme: ^0.2.15 (modules/crm/amocrm package.json; amoCRM module)
Latest stable version: 0.2.15 (published 2025-12-28)
Confidence: HIGH

## User Constraints
- Goal: understand current dependencies and migrate rntme to latest safe versions later.
- Output must be written to `docs/research/shevernitskiy-amo/README.md`.
- Research-only: do not perform dependency upgrades or runtime code migrations in this issue.
- Look for better-suited libraries/solutions, not only latest version of the current choice.
- Use authoritative current sources: Context7 where applicable, official docs/changelog/releases, npm/GitHub/container registry, migration guides, security advisories.

## Summary

`@shevernitskiy/amo` is a TypeScript-first, zero-dependency amoCRM REST API client. It provides typed wrappers for almost all amoCRM API modules (leads, contacts, companies, tasks, pipelines, custom fields, webhooks, etc.), handles OAuth2 token refresh automatically, and includes a built-in request queue to respect amoCRM's 7 req/sec rate limit. The library supports Node.js >=18 (Fetch API), Deno, and JSR.

rntme currently pins `^0.2.15`, which is **already the latest stable version** (published 2025-12-28). The library is actively maintained with 34 releases, the most recent being December 2025. It has 11 GitHub stars and a small but responsive maintainer community.

**Primary recommendation: KEEP PINNED** — rntme is already on the latest stable version. No migration is needed at this time. Monitor for future releases, particularly any v0.3.x or v1.x that might introduce breaking changes.

The library is a good fit for rntme's architecture because:
- Zero runtime dependencies (reduces supply-chain attack surface)
- Native TypeScript with good type coverage
- Built-in rate limiting and token refresh
- Webhook handling support
- Active maintenance (last release 4 months ago)

Alternatives like `amocrm-js` (3.6.0, 4 deps, larger but less focused) or `amocrm-connector` (0.4.13, 3 deps, axios-based) exist, but none offer a compelling advantage over `@shevernitskiy/amo` for rntme's use case. The main risk is the library's relatively small community (11 stars, single maintainer), which creates bus-factor concerns for a production CRM integration.

## Current Usage in rntme

| Package / image / tool | Current version | Used by | Source file(s) | Runtime/dev/build/test | Notes |
|---|---|---|---|---|---|
| `@shevernitskiy/amo` | ^0.2.15 | `@rntme/crm-amocrm` | `modules/crm/amocrm/package.json` | runtime | Zero dependencies, MIT license |

### Code references and commands used to verify usage

```bash
# Verify current dependency
cd /home/coder/work/rntme/modules/crm/amocrm
cat package.json | grep -A1 -B1 shevernitskiy

# Verify npm latest version
npm view @shevernitskiy/amo@latest

# Search for all imports across the module
grep -r "@shevernitskiy/amo" src/
```

**Adapter usage** (`modules/crm/amocrm/src/adapter.ts`):
- `import { Amo } from '@shevernitskiy/amo'` — main client class
- `import type { OAuth, Options } from '@shevernitskiy/amo'` — auth and options types
- Wraps `Amo` instance to provide `AmoCrmAdapter` interface for rntme's canonical contract
- Uses: leads, contacts, companies, tasks, notes, pipelines, custom_fields, users, links

**Module usage** (`modules/crm/amocrm/src/handlers.ts`):
- All CRM operations go through the adapter abstraction; no direct `@shevernitskiy/amo` imports
- Handlers map between rntme canonical protobuf contracts and amoCRM API payloads

## Latest Versions / Release State

| Channel | Version | Release date | Source | Notes |
|---|---|---|---|---|
| Latest stable | 0.2.15 | 2025-12-28 | npm / GitHub releases | Current; no newer versions available |
| Previous | 0.2.14 | 2025-12-27 | npm / GitHub releases | Typo fix in `getStatusById` |
| Previous | 0.2.13 | 2025-12-14 | npm / GitHub releases | Note typings fixes |
| Previous | 0.2.12 | 2025-10-28 | npm / GitHub releases | Note typings fixes |
| Previous | 0.2.11 | 2025-10-24 | npm / GitHub releases | Typo fix |
| Previous | 0.2.10 | 2025-10-23 | npm / GitHub releases | `note_id` parameter for note update |

Release cadence: ~1-2 releases per month. All releases are automated via GitHub Actions.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| `@shevernitskiy/amo` | 0.2.15 | amoCRM REST API client | Zero deps, TS-native, rate limiting, token refresh, webhook support |

### Supporting
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| `node:crypto` | built-in | Webhook HMAC-SHA1 signature verification | Required for amoCRM webhook security |
| `node:fs` | built-in | Token persistence (example pattern) | Recommended for production token storage |

### Alternatives Considered
| Instead of | Could Use | Tradeoff | Recommendation for rntme |
|---|---|---|---|
| `@shevernitskiy/amo` | `amocrm-js@3.6.0` | Larger (524KB vs 284KB), 4 deps (deepmerge, qs, tslib, typescript), more features but less focused | Not recommended — heavier, no clear advantage |
| `@shevernitskiy/amo` | `amocrm-connector@0.4.13` | axios-based (3 deps), class-validator decorators, 170KB | Not recommended — introduces axios dependency, less type-safe |
| `@shevernitskiy/amo` | `amocrm-nodejs-client@0.7.0` | Minimal, 0 deps, but very limited API coverage | Not recommended — missing many endpoints rntme uses |
| `@shevernitskiy/amo` | Direct `fetch` + custom wrapper | Full control, but must handle auth, rate limits, typings manually | Not recommended — `@shevernitskiy/amo` already handles this well |

Installation / upgrade commands, if eventually recommended:
```bash
# Already on latest; no upgrade needed
# pnpm add @shevernitskiy@latest
```

## Architecture Patterns

### System Architecture Diagram

```mermaid
flowchart LR
  Client[rntme CRM RPC Client] -->|gRPC/HTTP| Handler[Canonical Contract Handler]
  Handler -->|calls| Adapter[AmoCrmAdapter]
  Adapter -->|REST API| AmoSdk[@shevernitskiy/amo SDK]
  AmoSdk -->|OAuth2 + Rate Limited| AmoApi[(amoCRM REST API)]
  AmoApi -->|Webhooks| WebhookReceiver[Webhook Receiver]
  WebhookReceiver -->|CloudEvents| EventBus[rntme Event Bus]
```

### Component Responsibilities

| Component | Responsibility | Implementation mapping | Notes |
|---|---|---|---|
| `createAmoCrmAdapter` | Wraps `@shevernitskiy/amo` into rntme's adapter interface | `src/adapter.ts` | Handles all direct SDK interactions |
| `createAmoCrmModule` | Implements canonical CRM contract RPCs | `src/handlers.ts` | Maps between protobuf types and amoCRM JSON |
| `createAmoCrmWebhookReceiver` | Receives, verifies, dedupes, translates webhooks | `src/webhooks.ts` | HMAC-SHA1 verification, URL-encoded payload parsing |
| Mapper functions | Transform amoCRM JSON ↔ canonical protobuf types | `src/mappers.ts` | `mapAmoContact`, `mapAmoLead`, etc. |
| Error mapping | Translate SDK errors → canonical error codes | `src/errors.ts` | HTTP status → `CRM_VENDOR_*` codes |

### Recommended Project Structure

```text
modules/crm/amocrm/
├── src/
│   ├── adapter.ts          # SDK wrapper (already exists)
│   ├── handlers.ts         # RPC handlers (already exists)
│   ├── webhooks.ts         # Webhook receiver (already exists)
│   ├── mappers.ts          # Data transformation (already exists)
│   ├── types.ts            # Shared types (already exists)
│   ├── errors.ts           # Error mapping (already exists)
│   └── capabilities.ts     # Capability manifest (already exists)
└── test/
    ├── unit/               # Unit tests (already exists)
    └── conformance.mock.test.ts  # Contract conformance (already exists)
```

### Pattern 1: Adapter Wrapper

What: Isolate third-party SDK behind an internal adapter interface so the rest of the module depends only on local abstractions.
When to use: Always, for any vendor-specific SDK integration.
Example:
```ts
// Source: rntme modules/crm/amocrm/src/adapter.ts
export interface AmoCrmAdapter {
  getLead(id: number): Promise<JsonObject>;
  listLeads(params?: JsonObject): Promise<Paginated<JsonObject>>;
  // ... etc
}

export function createAmoCrmAdapter(options: CreateAmoCrmAdapterOptions): AmoCrmAdapter {
  const amo = new Amo(options.subdomain, options.auth, options.options);
  return {
    getLead: async (id) => asRecord(await amo.lead.getLeadById(id)),
    // ... etc
  };
}
```

### Pattern 2: Idempotency Store

What: Dedupe create operations using an external store to prevent duplicate CRM records on retries.
When to use: All mutating operations that support idempotency keys.
Example:
```ts
// Source: rntme modules/crm/amocrm/src/handlers.ts
export interface IdempotencyStore {
  get<T>(key: string): T | undefined | Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): void | Promise<void>;
}

async function dedupeCreate<T>(
  store: IdempotencyStore,
  rpc: string,
  idempotencyKey: string,
  operation: () => Promise<T>,
): Promise<T> {
  const key = `${rpc}:${idempotencyKey}`;
  const cached = await store.get<T>(key);
  if (cached !== undefined) return cached;
  const result = await operation();
  await store.set(key, result, IDEMPOTENCY_TTL_MS);
  return result;
}
```

### Anti-Patterns to Avoid

- **Direct SDK imports in handlers**: Handlers should only use `AmoCrmAdapter`, never import from `@shevernitskiy/amo` directly. This is already followed in rntme.
- **Ignoring rate limits**: amoCRM limits to 7 req/sec. The SDK handles this by default, but custom `fetch`-based solutions would need manual throttling.
- **Storing tokens in memory only**: The SDK's `on_token` callback should persist tokens to durable storage (Redis, DB, filesystem) to survive restarts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| amoCRM OAuth2 token refresh | Custom refresh logic | `@shevernitskiy/amo` built-in refresh | Handles expiration, refresh_token rotation, and concurrent request deduping |
| Rate limiting (7 req/sec) | Manual `setTimeout` loops | SDK's built-in concurrent request queue | Configurable `concurrent_request` / `concurrent_timeframe` / `request_delay` |
| Webhook payload parsing | Custom URL-encoded parser | SDK's `webhookHandler()` or rntme's `decodeUrlEncodedPayload` | amoCRM uses bracket notation (`leads[update][0][id]`) which is error-prone to parse |
| amoCRM API typings | Hand-written types | SDK's generated types | API has 200+ endpoints with complex filter/query parameters |

Key insight: amoCRM's API documentation is known to have mistakes and incorrect typings. The SDK author explicitly warns about this. Building a custom client would require continuous maintenance to track API changes and fix typings.

## Common Pitfalls

### Pitfall 1: Typing Inaccuracies

What goes wrong: SDK types may not match actual API responses due to poor amoCRM documentation.
Why it happens: The amoCRM API docs have "many mistakes, inaccuracies, mismatched examples, and incorrect types" (per SDK README).
How to avoid: Use runtime validation (e.g., zod) for critical paths; report discrepancies to the SDK repo via PR/issue.
Warning signs: TypeScript compilation passes but runtime errors occur; `as never` casts in adapter code.

### Pitfall 2: Token Expiration Without Persistence

What goes wrong: Access tokens expire (default 86400s), and without persistent storage, the app loses OAuth state on restart.
Why it happens: The SDK manages refresh automatically but requires the initial token and a callback to save new tokens.
How to avoid: Always provide `on_token` callback that persists to Redis/DB/filesystem; reload token on startup.
Warning signs: 401 errors after restart; users needing to re-authorize frequently.

### Pitfall 3: Soft Deletes vs Hard Deletes

What goes wrong: amoCRM supports both soft delete (`is_deleted: true`) and hard delete. Using the wrong one can cause data loss or unexpected behavior.
Why it happens: The SDK exposes both update (soft delete) and delete endpoints; rntme's canonical contract uses delete.
How to avoid: rntme currently uses soft delete via `updateContact([{ id, is_deleted: true }])`. Document this decision and ensure it's consistent with user expectations.
Warning signs: Deleted records reappearing (soft delete not purged); irreversible data loss (hard delete used incorrectly).

## Code Examples

### Common Operation 1: Initialize Client with Token Persistence

```ts
// Source: https://github.com/shevernitskiy/amo#basic-example
import { readFileSync, writeFileSync } from 'node:fs';
import { Amo, ApiError, AuthError } from '@shevernitskiy/amo';

const auth = {
  client_id: '1111-2222-3333',
  client_secret: 'myclientsecret',
  redirect_uri: 'https://myredirect.org',
};

const token = JSON.parse(readFileSync('./token.json', 'utf-8'));

const amo = new Amo('mydomain.amocrm.ru', { ...auth, ...token }, {
  on_token: (new_token) => {
    console.log('New token obtained', new_token);
    writeFileSync('./token.json', JSON.stringify(new_token, null, 2), 'utf8');
  },
});
```

### Common Operation 2: Filtered Lead Search

```ts
// Source: https://github.com/shevernitskiy/amo#filter
const leads = await amo.lead.getLeads({
  filter: (filter) =>
    filter
      .single('id', 6969)
      .multi('created_by', ['john', 'smith'])
      .range('closed_at', 2418124812, 123124712712),
});
```

### Common Operation 3: Webhook Handler

```ts
// Source: https://github.com/shevernitskiy/amo#webhooks
const amo = new Amo('mydomain.amocrm.ru', auth_object, options_object);

amo.on('leads:status', (lead) => console.log(lead.id));

const handler = amo.webhookHandler();
Deno.serve({ port: 4545 }, handler);
```

## State of the Art (2024-2025)

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `amocrm-js` v2.x | `amocrm-js` v3.6.0 | 2024 | Still maintained but heavier than `@shevernitskiy/amo` |
| Custom axios wrappers | `@shevernitskiy/amo` | 2023-2025 | Zero-dependency SDK gaining traction in TypeScript/Deno ecosystem |
| Callback-based auth | OAuth2 with auto-refresh | 2023 | Standard in all modern amoCRM SDKs |

New tools/patterns to consider:
- **JSR distribution**: `@shevernitskiy/amo` is published on JSR (JavaScript Registry) for modern Deno/Node module resolution
- **MCP server for amoCRM**: `@theyahia/amocrm-mcp@2.0.2` — Model Context Protocol server for AI agent integration with amoCRM

Deprecated/outdated:
- `amocrm` (v1.0.1, 2016) — unmaintained
- `amocrm-api` (v1.3.1, 2017) — unmaintained
- `npm-api-client-amocrm` (v0.6.3, 2018) — unmaintained

## Migration Assessment

| Area | Finding | Impact | Risk | Evidence |
|---|---|---|---|---|
| Version gap | rntme is on latest (0.2.15) | None | None | `npm view @shevernitskiy/amo@latest` confirms 0.2.15 is latest |
| Breaking changes | No v0.3.x or v1.x announced | Low | Low | GitHub releases show only patch/minor releases |
| Security posture | Zero dependencies = minimal attack surface | Positive | Low | No CVEs found for `@shevernitskiy/amo` |
| Type safety | Good, but SDK warns about API doc inaccuracies | Medium | Medium | `as never` casts in rntme adapter indicate type gaps |
| Maintenance risk | Single maintainer, 11 stars | Medium | Medium | Bus factor concern for production dependency |
| Alternative availability | Several alternatives exist, none clearly superior | Low | Low | `amocrm-js`, `amocrm-connector`, `amocrm-nodejs-client` all have tradeoffs |
| Test coverage | rntme has unit tests + conformance mock tests | Positive | Low | `test/unit/` and `test/conformance.mock.test.ts` present |
| Lockfile impact | No upgrade needed | None | None | Current version is latest |

## Recommendation

**Decision: KEEP PINNED**

Rationale:
- rntme is already on the latest stable version (0.2.15)
- The library is actively maintained (last release 2025-12-28)
- Zero dependencies reduces supply-chain risk
- Good architectural fit with rntme's adapter pattern
- No compelling alternative offers a better risk/reward tradeoff

Follow-up tasks to create later:
- Monitor `@shevernitskiy/amo` releases for v0.3.x or v1.x announcements
- Consider runtime validation (zod) for amoCRM API responses to mitigate typing inaccuracies
- Evaluate migration to a more widely-adopted SDK if amoCRM integration becomes mission-critical and bus-factor concerns grow
- Add integration/smoke tests against a live amoCRM sandbox (similar to Bitrix24's `test:smoke:live`)

## Open Questions

1. **Should rntme implement runtime validation for amoCRM responses?**
   - What we know: SDK types may not match actual API responses; rntme uses `as never` casts
   - What's unclear: Impact of typing mismatches in production; whether zod schemas would be worth the maintenance overhead
   - Recommendation: Add optional response validation in adapter layer for critical mutations (CreateContact, CreateDeal, etc.)

2. **Should rntme add a live smoke test for amoCRM?**
   - What we know: Bitrix24 module has `test:smoke:live`; amoCRM module does not
   - What's unclear: Availability of a stable amoCRM test account/credentials
   - Recommendation: Create a spike issue to investigate amoCRM sandbox/test account setup

3. **What is the mitigation plan if `@shevernitskiy/amo` becomes unmaintained?**
   - What we know: Single maintainer, small community (11 stars)
   - What's unclear: Whether the maintainer has long-term commitment
   - Recommendation: Document fallback plan (fork, migrate to `amocrm-js`, or build minimal custom client); monitor GitHub activity monthly

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view @shevernitskiy/amo@latest`) — version confirmation, metadata
- GitHub repository `shevernitskiy/amo` — README, releases, source code
- rntme source code (`modules/crm/amocrm/`) — current usage patterns, adapter implementation

### Secondary (MEDIUM confidence)
- npm search results for `amocrm` — alternative libraries identified and compared
- GitHub releases page for `shevernitskiy/amo` — release history and changelog

### Tertiary (LOW confidence - needs validation)
- amoCRM official API documentation — referenced in SDK README as having inaccuracies

## Metadata

Research scope:
- Core technology: `@shevernitskiy/amo` amoCRM REST API SDK
- Ecosystem: amoCRM API v4, Node.js >=18, Deno, JSR
- Patterns: Adapter pattern, idempotency, webhook handling, OAuth2 token refresh
- Pitfalls: Typing inaccuracies, token persistence, delete semantics

Confidence breakdown:
- Standard stack: HIGH — verified via npm registry and GitHub
- Architecture: HIGH — directly observed in rntme source code
- Pitfalls: MEDIUM — based on SDK README warnings and code analysis
- Code examples: HIGH — from official SDK README

Research date: 2026-04-28
Valid until: 2026-07-28 (recommend quarterly review)
Ready for migration planning: yes (no migration needed — already on latest)
