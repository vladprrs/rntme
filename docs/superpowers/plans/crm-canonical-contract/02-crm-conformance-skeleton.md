# CRM Canonical Contract v1 — Plan 2: `modules/crm/conformance/` Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land `modules/crm/README.md` (category-doc) and `modules/crm/conformance/` (workspace package `@rntme/conformance-crm`) — the per-category conformance scaffolding for CRM v1. The package ships a minimal local `Scenario` type stub (until `@rntme/conformance-framework` lands), 34 scenario stub files (one per canonical RPC) that export non-empty typed `pending` scenarios, text + webhook fixtures (including the unique `amocrm-update.urlencoded` URL-encoded form-data fixture for amoCRM), a `suite.ts` exporting `CategoryConformanceSuite`, and a drift-detection test that fails when any canonical RPC lacks a matching scenarios file.

**Architecture:** New `modules/crm/` directory under the existing `modules/*/*` workspace glob (added by Identity plan 2 / AI/LLM plan 2). Inside, `modules/crm/conformance/` is a workspace package depending on `@rntme/contracts-crm-v1`. The package exports executable typed scaffolding only — every scenario file ships one `pendingScenario(...)` entry plus a docstring pointing at spec §11.2 listing the assertions each scenario must cover when the framework lands. The drift-detection test introspects `proto.rntme.contracts.crm.v1.CrmModule` and asserts a 1:1 file match against `src/scenarios/`. A fixture-sanity test validates the webhook fixtures (JSON parses; URL-encoded amoCRM payload decodes to a known `leads[update][0][id]` shape).

**Tech Stack:** Same as Plan 1 — TypeScript 5.5, vitest, eslint flat config, pnpm 9.12+ workspaces.

**External tooling notes verified via Context7 (2026-04-27):**
- ESLint v9 flat config uses `import js from '@eslint/js'` and `js.configs.recommended`, so `@eslint/js` must be declared in this package's `devDependencies`.
- Vitest supports `vitest run <file>` for a single test file; this plan's `pnpm -F @rntme/conformance-crm run test test/drift.test.ts` command is valid because the package script expands to `vitest run test/drift.test.ts`.
- pnpm workspace filtering accepts `--filter` / `-F <package_selector>` for package-scoped script runs.

**Spec reference:** `docs/superpowers/specs/2026-04-27-crm-canonical-contract-design.md` §11 (conformance suite). Modules-monorepo `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` §7 (conformance suite layout, authorship rule, anti-conformance, capability-coverage report).

**Depends on:**
- Plan 1 must be merged first — `@rntme/contracts-crm-v1` must exist as a workspace package and its generated proto must export `CrmModule` so the drift-detection test can introspect it.
- Identity plan 2 (`docs/superpowers/plans/done/identity-canonical-contract/02-identity-conformance-skeleton.md`) must be merged first — it adds the `modules/*/*` glob to `pnpm-workspace.yaml` and creates the `modules/` top-level directory. This plan reuses both. If Identity plan 2 has not landed, Step 1 of Task 1 below adds the glob; otherwise it verifies and skips.
- CRM `module-manifest-validator` capability-field support (`vendors[]`, `entities[]`, `search_tiers[]`, `labeled_associations`, `bulk_operations.max_size`, `async_job_types[]`, `webhook_format`, `webhook_retry_policy`) must be merged before the first CRM vendor module starts. If it has not landed before this conformance skeleton, DEV must leave the plan comment and PR description caveat explicit: this package can compile and test, but CRM vendor modules remain blocked from claiming manifest-valid readiness until validator support lands. This resolves the spec §13 merge-order tension without forcing this skeleton package to edit validator code.

---

## File Structure

Files this plan creates or modifies:

**Created**
- `modules/crm/README.md`
- `modules/crm/conformance/package.json`
- `modules/crm/conformance/tsconfig.json`
- `modules/crm/conformance/tsconfig.check.json`
- `modules/crm/conformance/eslint.config.mjs`
- `modules/crm/conformance/README.md`
- `modules/crm/conformance/src/types.ts` (local `Scenario` / `CategoryConformanceSuite` stub)
- `modules/crm/conformance/src/index.ts`
- `modules/crm/conformance/src/suite.ts`
- `modules/crm/conformance/src/fixtures/contacts.ts`
- `modules/crm/conformance/src/fixtures/companies.ts`
- `modules/crm/conformance/src/fixtures/deals.ts`
- `modules/crm/conformance/src/fixtures/activities.ts`
- `modules/crm/conformance/src/fixtures/notes.ts`
- `modules/crm/conformance/src/fixtures/associations.ts`
- `modules/crm/conformance/src/fixtures/pipelines.ts`
- `modules/crm/conformance/src/fixtures/custom-fields.ts`
- `modules/crm/conformance/src/fixtures/owners.ts`
- `modules/crm/conformance/src/fixtures/webhooks/bitrix24-event.json`
- `modules/crm/conformance/src/fixtures/webhooks/hubspot-batch.json`
- `modules/crm/conformance/src/fixtures/webhooks/amocrm-update.urlencoded`
- `modules/crm/conformance/src/fixtures/webhooks/pipedrive-v2.json`
- `modules/crm/conformance/src/fixtures/webhooks/index.ts`
- 34 scenario stub files (listed in Tasks 7, 8, 9)
- `modules/crm/conformance/test/drift.test.ts`
- `modules/crm/conformance/test/suite-shape.test.ts`
- `modules/crm/conformance/test/fixtures-sanity.test.ts`

**Modified**
- `pnpm-workspace.yaml` — verify `modules/*/*` glob exists (added by Identity plan 2); add if missing.
- `AGENTS.md` — §3 add `modules/crm/` note; §6 entry "Add a CRM vendor module" stub pointer.
- `README.md` — packages table: append `@rntme/conformance-crm`.

---

## Task 1: Workspace bootstrap — verify globs, create `modules/crm/` tree

**Files:**
- Modify: `pnpm-workspace.yaml` (only if `modules/*/*` glob is missing)
- Create: `modules/crm/conformance/.gitkeep`

- [ ] **Step 1: Check current `pnpm-workspace.yaml`**

Run: `cat pnpm-workspace.yaml`

If the output already includes `- "modules/*/*"`, proceed to Step 3. If not (Identity plan 2 hasn't landed yet), continue to Step 2.

- [ ] **Step 2 (only if `modules/*/*` is missing): Add the glob**

Edit `pnpm-workspace.yaml` to insert `- "modules/*/*"` between `packages/contracts/*/v*` and `demo/*`:

```yaml
packages:
  - "packages/*"
  - "packages/contracts/*/v*"
  - "modules/*/*"
  - "demo/*"
  - "rntme-cli/packages/*"
```

The `modules/*/*` glob matches `modules/crm/conformance` (this plan), `modules/identity/conformance` (Identity plan 2), `modules/ai-llm/conformance` (AI/LLM plan 2), and future vendor packages. Two-level depth is the published convention in modules-monorepo §5.1.

- [ ] **Step 3: Create the CRM module tree**

Run:
```bash
mkdir -p modules/crm/conformance/src/scenarios
mkdir -p modules/crm/conformance/src/fixtures/webhooks
mkdir -p modules/crm/conformance/test
touch modules/crm/conformance/.gitkeep
```

(`modules/crm/` itself does not get a `package.json` — it is a category container. Only `modules/crm/conformance/` and future vendor subdirs are workspace packages.)

- [ ] **Step 4: Verify pnpm still installs cleanly**

Run: `pnpm install --frozen-lockfile=false`
Expected: install succeeds. The empty `modules/crm/conformance` directory has no `package.json` yet.

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml modules/crm/conformance/.gitkeep
git commit -m "chore: bootstrap modules/crm/ tree for conformance package"
```

If Step 2 was skipped (glob already present), `pnpm-workspace.yaml` will not be in the staged set — that is fine.

---

## Task 2: Category README at `modules/crm/README.md`

**Files:**
- Create: `modules/crm/README.md`

- [ ] **Step 1: Write the category README**

Create `modules/crm/README.md`:

```markdown
# CRM category — module contributor entry point

This directory hosts vendor implementations of the CRM canonical contract `@rntme/contracts-crm-v1`. Each vendor lives at `modules/crm/<vendor>/` and ships:

- A handler implementation against the `CrmModule` gRPC service.
- An idempotency dedup-store (Redis / in-memory / Postgres — chosen by the vendor module; ≥24h TTL). Required because most CRM vendors do not provide native idempotency on create/update endpoints, so replays would create duplicate records.
- A webhook receiver that verifies signatures (HubSpot HMAC-SHA256 v3, Zoho `X-Zoho-Signature`), parses the vendor format (JSON for most; URL-encoded form data for amoCRM), dedupes, and emits canonical CloudEvents.
- A `module.json` manifest declaring `capabilities[]` (vendors, entities, rpcs, events, search_tiers, labeled_associations, bulk_operations.max_size, async_job_types, webhook_format, webhook_retry_policy).
- Conformance scenarios passing under both mock-vendor and live-sandbox modes.

The shared conformance suite lives at `modules/crm/conformance/` and is consumed by every vendor module via `pnpm test:conformance:mock` and `pnpm test:conformance:live` (when the framework lands).

## Vendors landed here

None yet. The first vendor (`module-crm-bitrix24`, RU P0 priority — 57.5% RU market, 152-FZ data-residency) is brainstormed and planned separately after this conformance skeleton merges.

## Recommended capability presets (documentation-only — NOT validated tiers)

These presets are reading aids for module authors and blueprint authors. Conformance enforces only the capability-based UNION model from modules-monorepo §7.3 — no Level 1/2/3 gates.

| Preset | Implies |
|---|---|
| **Core** (typical for `module-crm-amocrm`, `module-crm-pipedrive` baseline) | Contact + Company + Deal CRUD + simple search + flat associations + read-only Pipeline |
| **Full** (typical for `module-crm-hubspot`, `module-crm-bitrix24`, `module-crm-zoho`) | Core + Activity + Note + labeled associations + custom field definitions + webhook signature verification |
| **Extended** (typical for `module-crm-salesforce`, `module-crm-zoho-enterprise`) | Full + SyncFull through AsyncJob + cross-pipeline UpdateDeal + Optimistic Lock |

## Capability decision tree (for module authors)

When you scaffold a new CRM vendor module, fill out `module.json#capabilities[]` based on what the vendor supports natively:

| Capability | Decision |
|---|---|
| `vendors[]` | Single SaaS module: 1 entry. Multi-CRM gateway: list every upstream you route to. |
| `entities[]` | Subset of `["contact", "company", "deal", "activity", "note"]`. All five vendors covered support all five entities; this field exists for future custom-entity-only modules. |
| `rpcs[]` | Subset of the 34 canonical RPCs. Unclaimed RPCs return `UNIMPLEMENTED` (anti-conformance enforces this). |
| `events[]` | Subset of the 21 canonical events. Only emit events you actually publish. |
| `search_tiers[]` | v1 ships only `["simple"]`. Modules may declare `["simple"]`; `advanced`/`fulltext` are v1.minor extensions. |
| `labeled_associations` | `true` only if vendor has native typed-edge support (HubSpot Associations API v4, SF junction-objects with Role, Zoho Contact Roles). `false` for Bitrix24, amoCRM, Pipedrive — they emulate by storing label in own state. |
| `bulk_operations.max_size` | Vendor batch cap: Bitrix24=50 (`batch.execute`), HubSpot=100 (`/batch/{action}`), Salesforce=200 (composite/sobjects) or 150_000_000 (Bulk API 2.0 jobs), Zoho=100 sync / 25000 bulk write, Pipedrive=1 (no native batch — module sequentially calls). |
| `async_job_types[]` | v1 ships only `["SYNC_FULL"]`. Vendors with Bulk API (SF Bulk 2.0, HubSpot CRM Export, Zoho Bulk Read) populate this; Pipedrive sequential-paginates and may declare `[]`. |
| `webhook_format` | `"json"` for HubSpot / Bitrix24 / Pipedrive / Zoho. `"urlencoded"` for amoCRM (unique). Salesforce uses `"grpc"` (CDC Pub/Sub) — but v1 of the contract treats Pub/Sub as out-of-band signal and only labels HTTP webhook formats here. |
| `webhook_retry_policy` | `"none"` for Bitrix24 (no retries — pulls via `event.offline.get` instead). `"exponential_24h_10retries"` for HubSpot. `"exponential_3retries_<intervals>"` for Pipedrive (3, 30, 150s). `"exponential_3retries"` for Zoho. `"undocumented"` for amoCRM. |

## Specs

- `docs/superpowers/specs/2026-04-27-crm-canonical-contract-design.md` — canonical contract design.
- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` — module pattern, capability UNION conformance.

## Where to look first

- `modules/crm/conformance/src/scenarios/` — full list of scenarios per RPC (one file per canonical RPC, 34 total).
- `packages/contracts/crm/v1/proto/crm.proto` — the contract you implement.
- `packages/contracts/crm/v1/error-codes.json` — error codes you map vendor errors to. Pay attention to `CRM_VENDOR_RATE_LIMITED` — it normalises Bitrix24's HTTP 200 + body `{"error":"QUERY_LIMIT_EXCEEDED"}` quirk into the same canonical signal as HTTP 429 from other vendors.
```

- [ ] **Step 2: Commit**

```bash
git add modules/crm/README.md
git commit -m "docs(modules/crm): category README"
```

---

## Task 3: `@rntme/conformance-crm` package skeleton

**Files:**
- Create: `modules/crm/conformance/package.json`
- Create: `modules/crm/conformance/tsconfig.json`
- Create: `modules/crm/conformance/tsconfig.check.json`
- Create: `modules/crm/conformance/eslint.config.mjs`
- Delete: `modules/crm/conformance/.gitkeep`

- [ ] **Step 1: Write `package.json`**

Create `modules/crm/conformance/package.json`:

```json
{
  "name": "@rntme/conformance-crm",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Conformance scenarios for CRM canonical contract v1. Consumed by every modules/crm/<vendor>/ module via the conformance runner.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "src/fixtures/webhooks",
    "README.md"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\""
  },
  "dependencies": {
    "@rntme/contracts-crm-v1": "workspace:*"
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

Create `modules/crm/conformance/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

- [ ] **Step 3: Write `tsconfig.check.json`**

Create `modules/crm/conformance/tsconfig.check.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "composite": false,
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 4: Write `eslint.config.mjs`**

Create `modules/crm/conformance/eslint.config.mjs`:

```javascript
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: 'module', ecmaVersion: 2022 },
      globals: {
        console: 'readonly',
        process: 'readonly',
        structuredClone: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'warn',
    },
  },
];
```

- [ ] **Step 5: Remove `.gitkeep`**

Run: `rm modules/crm/conformance/.gitkeep`

- [ ] **Step 6: Run pnpm install and confirm package is in workspace**

Run: `pnpm install --frozen-lockfile=false`

Then: `pnpm list -r --depth -1 | grep conformance-crm`
Expected: line containing `@rntme/conformance-crm 0.0.0`.

- [ ] **Step 7: Commit**

```bash
git add pnpm-lock.yaml modules/crm/conformance/package.json modules/crm/conformance/tsconfig.json modules/crm/conformance/tsconfig.check.json modules/crm/conformance/eslint.config.mjs
git commit -m "feat(conformance-crm): scaffold package"
```

---

## Task 4: Local `Scenario` / `CategoryConformanceSuite` types stub

**Files:**
- Create: `modules/crm/conformance/src/types.ts`

- [ ] **Step 1: Write the types stub**

Create `modules/crm/conformance/src/types.ts`:

```typescript
/**
 * Local type stubs that mirror the (not-yet-extant) `@rntme/conformance-framework`
 * surface. When the framework lands, this file is deleted and types come from
 * `@rntme/conformance-framework`.
 *
 * This file MUST stay structurally compatible with the framework spec
 * (modules-monorepo §7). If the framework lands with a different signature,
 * migrate scenarios in the same PR.
 */

/**
 * A capability-gating predicate. Scenarios skip on modules whose `module.json#capabilities`
 * does not satisfy these constraints.
 */
export interface ScenarioRequirements {
  entities?: readonly ('contact' | 'company' | 'deal' | 'activity' | 'note')[];
  search_tiers?: readonly ('simple' | 'advanced' | 'fulltext')[];
  labeled_associations?: boolean;
  async_job_types?: readonly ('SYNC_FULL')[];
  bulk_operations_min_size?: number;
  webhook_format?: 'json' | 'urlencoded';
  webhook_retry_policy?: string;
}

/**
 * A scenario step is either a single RPC call or a meta-instruction
 * (assertion-only, fixture-substitution scaffold).
 */
export interface ScenarioStep {
  rpc?: string;
  input?: Record<string, unknown>;
  assertEventWithin?: { type: string; seconds: number };
  // additional helper steps may be added when the framework lands
}

/**
 * A single conformance scenario. v1 ships scenarios as stubs (empty `steps`,
 * status=`pending`) until the framework runner can interpret them.
 */
export interface Scenario {
  id: string;
  name: string;
  status: 'pending' | 'mock_only' | 'live_only' | 'mock_and_live';
  capability?: string;            // canonical RPC name this scenario gates on
  requires?: ScenarioRequirements;
  /**
   * For single-RPC scenarios, set `action`. For multi-step (Deal stage transition,
   * SyncDelta watermark progression, AsyncJob lifecycle), set `steps` instead.
   */
  action?: ScenarioStep;
  steps?: ScenarioStep[];
  /** Free-form description of assertions; framework will replace with typed assertion array. */
  assertionsDescription?: string;
}

/**
 * The category-suite shape consumed by the (future) runner.
 */
export interface CategoryConformanceSuite {
  category: 'crm';
  contract_version: 'v1';
  scenarios: Record<string, Scenario[]>;   // keyed by RPC short-name
}

export const UNIMPLEMENTED_SCENARIO_STATUS = 'pending' as const;

export function pendingScenario(input: Omit<Scenario, 'status'>): Scenario {
  return {
    ...input,
    status: UNIMPLEMENTED_SCENARIO_STATUS,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add modules/crm/conformance/src/types.ts
git commit -m "feat(conformance-crm): local Scenario / CategoryConformanceSuite stubs"
```

---

## Task 5: Fixtures — text fixtures for all aggregates

**Files:**
- Create: `modules/crm/conformance/src/fixtures/contacts.ts`
- Create: `modules/crm/conformance/src/fixtures/companies.ts`
- Create: `modules/crm/conformance/src/fixtures/deals.ts`
- Create: `modules/crm/conformance/src/fixtures/activities.ts`
- Create: `modules/crm/conformance/src/fixtures/notes.ts`
- Create: `modules/crm/conformance/src/fixtures/associations.ts`
- Create: `modules/crm/conformance/src/fixtures/pipelines.ts`
- Create: `modules/crm/conformance/src/fixtures/custom-fields.ts`
- Create: `modules/crm/conformance/src/fixtures/owners.ts`

- [ ] **Step 1: `fixtures/contacts.ts`**

Create `modules/crm/conformance/src/fixtures/contacts.ts`:

```typescript
/**
 * Canonical Contact fixtures — short, deterministic, suitable for the generic
 * mock-vendor and acceptable for live-vendor smoke runs.
 */

export const aliceFields = {
  email: 'alice@acme.example',
  phone: '+14155551212',
  name: { given: 'Alice', family: 'Smith', display: 'Alice Smith' },
  title: 'VP Engineering',
  tags: ['vip', 'q4-target'],
};

export const bobFields = {
  email: 'bob@acme.example',
  phone: '+14155551313',
  name: { given: 'Bob', family: 'Jones', display: 'Bob Jones' },
  title: 'Procurement Manager',
};

export const charlieFields = {
  email: 'charlie@globex.example',
  phone: '+44 20 7946 0958',
  name: { given: 'Charlie', family: 'Brown' },
};

/** Used in negative-path scenarios (duplicate-detection by email). */
export const aliceDuplicate = aliceFields;
```

- [ ] **Step 2: `fixtures/companies.ts`**

Create `modules/crm/conformance/src/fixtures/companies.ts`:

```typescript
/**
 * Canonical Company fixtures. Includes a Russian-tax-fields fixture (Bitrix24
 * INN/OGRN/KPP via Company.tax_id/registration_id/tax_branch_id) and an
 * international fixture (HubSpot/SF — empty regulatory fields).
 */

export const acmeRu = {
  name: 'ООО «Акме»',
  domain: 'acme.example',
  industry: 'manufacturing',
  employee_count: 250,
  annual_revenue: 5_000_000,
  currency: 'RUB',
  tax_id: '7707083893',                  // valid 10-char INN
  registration_id: '1027700132195',      // 13-char OGRN
  tax_branch_id: '770701001',            // 9-char KPP
};

export const globexInt = {
  name: 'Globex Corp',
  domain: 'globex.example',
  industry: 'tech',
  employee_count: 1500,
  annual_revenue: 50_000_000,
  currency: 'USD',
  // tax_id, registration_id, tax_branch_id intentionally empty
};

export const acmeChild = {
  name: 'Acme Operations LLC',
  domain: 'ops.acme.example',
  // parent_company_canonical_id wired at scenario time
};

/** Duplicate-domain fixture for HubSpot dedup-by-domain assertions. */
export const acmeDuplicateDomain = {
  name: 'Acme Holdings',
  domain: 'acme.example',
};
```

- [ ] **Step 3: `fixtures/deals.ts`**

Create `modules/crm/conformance/src/fixtures/deals.ts`:

```typescript
/**
 * Canonical Deal fixtures. Covers the full Deal.qualification × Deal.status matrix
 * for Lead/Deal Schism resolution scenarios.
 */

export const newLeadFields = {
  // UNQUALIFIED + OPEN — what SF/Pipedrive call a "Lead", what amoCRM Lead also is
  // (after canonical mapping). HubSpot lifecyclestage = "subscriber" / "lead".
  name: 'Inbound: pricing inquiry',
  qualification: 1,    // UNQUALIFIED
  amount: 0,
  currency: 'USD',
};

export const qualifiedDealFields = {
  // QUALIFIED + OPEN — classic mid-pipeline Deal/Opportunity.
  name: 'Acme Q4 contract',
  qualification: 2,    // QUALIFIED
  amount: 50_000,
  currency: 'USD',
};

export const wonDealFields = {
  // QUALIFIED + WON — closed-won. Used in DealClosed event scenarios.
  name: 'Globex Pro license',
  qualification: 2,
  amount: 75_000,
  currency: 'USD',
  close_reason: 'Q4 budget approved',
};

export const lostDealFields = {
  // QUALIFIED + LOST — closed-lost. close_reason populated.
  name: 'Initech expansion',
  qualification: 2,
  amount: 25_000,
  currency: 'EUR',
  close_reason: 'Selected competitor',
};

export const disqualifiedDealFields = {
  // DISQUALIFIED + DELETED-or-LOST — used in negative scenarios.
  name: 'Spam inquiry',
  qualification: 3,
  amount: 0,
  currency: 'USD',
};
```

- [ ] **Step 4: `fixtures/activities.ts`**

Create `modules/crm/conformance/src/fixtures/activities.ts`:

```typescript
/**
 * Canonical Activity fixtures spanning all 4 ActivityType enum values
 * (CALL/MEETING/TASK/EMAIL) and the M:N linked_entities[] pattern.
 */

export const followupCallFields = {
  type: 1,               // CALL
  subject: 'Follow-up call with Alice',
  description: 'Confirm pricing structure',
  duration: { seconds: 900, nanos: 0 },
  outcome: 1,            // PLANNED
};

export const discoveryMeetingFields = {
  type: 2,               // MEETING
  subject: 'Discovery: Acme Q4 scoping',
  duration: { seconds: 1800, nanos: 0 },
  outcome: 1,
};

export const proposalEmailFields = {
  type: 4,               // EMAIL
  subject: 'Proposal sent: Acme Q4',
  outcome: 2,            // COMPLETED
  is_completed: true,
};

export const finalizeContractTaskFields = {
  type: 3,               // TASK
  subject: 'Send final contract',
  outcome: 1,
};

/** Multi-link fixture: meeting attended by 2 contacts and ties to 1 deal. */
export const multiLinkedMeetingFields = {
  type: 2,
  subject: 'Three-way call: Alice + Bob + Acme deal',
  outcome: 1,
  // linked_entities filled at scenario time:
  //   [{entity_type: 'contact', canonical_id: 'cnt_alice'},
  //    {entity_type: 'contact', canonical_id: 'cnt_bob'},
  //    {entity_type: 'deal',    canonical_id: 'dl_acme_q4'}]
};
```

- [ ] **Step 5: `fixtures/notes.ts`**

Create `modules/crm/conformance/src/fixtures/notes.ts`:

```typescript
/**
 * Canonical Note fixtures. Single-parent invariant — every note belongs to
 * exactly one Contact / Company / Deal / Activity.
 */

export const dealNoteFields = {
  content: 'Customer mentioned interest in the new pricing tier. Needs CFO sign-off by Q4 close.',
  title: 'Pricing follow-up',
  // parent: { entity_type: 'deal', canonical_id: '...' } — wired at scenario time
};

export const contactNoteFields = {
  content: 'Alice prefers email contact. Best time: 9-11am Pacific.',
  // parent: { entity_type: 'contact', canonical_id: '...' }
};

export const companyNoteFields = {
  content: 'Acme legal review takes 2-3 weeks; factor into close-date estimates.',
  // parent: { entity_type: 'company', canonical_id: '...' }
};

/**
 * Note with HTML content. Modules receiving `metadata.public.content_type=text/html`
 * MUST preserve the markup; modules without HTML support MUST round-trip as plain
 * text (HubSpot Engagements support HTML; Bitrix24 timeline-comments support a
 * subset; amoCRM Notes are plain text).
 */
export const htmlNoteFields = {
  content: '<p>Customer wants <strong>multi-year</strong> commitment.</p>',
  metadata: { public: { fields: { content_type: { stringValue: 'text/html' } } } },
};
```

- [ ] **Step 6: `fixtures/associations.ts`**

Create `modules/crm/conformance/src/fixtures/associations.ts`:

```typescript
/**
 * Association fixtures — both labeled (HubSpot v4) and emulated (Bitrix24/amoCRM/PD).
 * Used by CreateAssociation / DeleteAssociation / ListAssociations scenarios.
 */

export const billingContactLabel = 'BILLING_CONTACT';
export const decisionMakerLabel = 'DECISION_MAKER';
export const technicalContactLabel = 'TECHNICAL_CONTACT';

/** Labeled, RNTME_DEFINED — works on labeled-supporting modules only. */
export const labeledBillingFields = (fromContactId: string, toDealId: string) => ({
  from: { entity_type: 'contact', canonical_id: fromContactId },
  to: { entity_type: 'deal', canonical_id: toDealId },
  category: 1,           // RNTME_DEFINED
  label: billingContactLabel,
});

/** Unlabeled — works on every module. */
export const unlabeledFields = (fromContactId: string, toDealId: string) => ({
  from: { entity_type: 'contact', canonical_id: fromContactId },
  to: { entity_type: 'deal', canonical_id: toDealId },
  category: 0,           // UNSPECIFIED
  label: '',
});

/** USER_DEFINED label — tenant-custom, accepted only when labeled_associations=true. */
export const userDefinedLabelFields = (fromCompanyId: string, toContactId: string, customLabel: string) => ({
  from: { entity_type: 'company', canonical_id: fromCompanyId },
  to: { entity_type: 'contact', canonical_id: toContactId },
  category: 2,           // USER_DEFINED
  label: customLabel,
});
```

- [ ] **Step 7: `fixtures/pipelines.ts`**

Create `modules/crm/conformance/src/fixtures/pipelines.ts`:

```typescript
/**
 * Pipeline fixtures used by ListPipelines and pipeline-aware scenarios.
 * The mock-vendor returns these as if it were a vendor pipeline configuration.
 */

export const salesPipeline = {
  canonical_id: 'pl_sales',
  vendor_id: 'b24_category_0',
  name: 'Sales pipeline',
  entity_type: 'deal',
  is_default: true,
  stages: [
    { canonical_id: 'st_new',          vendor_id: 'NEW',         name: 'New',          order: 0,  semantic: 1, probability: 0.1, is_terminal: false },
    { canonical_id: 'st_qualified',    vendor_id: 'QUALIFIED',   name: 'Qualified',    order: 10, semantic: 1, probability: 0.3, is_terminal: false },
    { canonical_id: 'st_negotiation',  vendor_id: 'NEGOTIATION', name: 'Negotiation',  order: 20, semantic: 1, probability: 0.6, is_terminal: false },
    { canonical_id: 'st_won',          vendor_id: 'WON',         name: 'Closed Won',   order: 99, semantic: 2, probability: 1.0, is_terminal: true  },
    { canonical_id: 'st_lost',         vendor_id: 'LOST',        name: 'Closed Lost',  order: 99, semantic: 3, probability: 0.0, is_terminal: true  },
  ],
};

/** Second pipeline for cross-pipeline UpdateDeal scenarios. */
export const partnerPipeline = {
  canonical_id: 'pl_partner',
  vendor_id: 'b24_category_1',
  name: 'Partner channel',
  entity_type: 'deal',
  is_default: false,
  stages: [
    { canonical_id: 'st_partner_intro',    vendor_id: 'P_INTRO',    name: 'Intro',     order: 0,  semantic: 1, probability: 0.2, is_terminal: false },
    { canonical_id: 'st_partner_signed',   vendor_id: 'P_SIGNED',   name: 'Signed',    order: 50, semantic: 2, probability: 1.0, is_terminal: true  },
  ],
};
```

- [ ] **Step 8: `fixtures/custom-fields.ts`**

Create `modules/crm/conformance/src/fixtures/custom-fields.ts`:

```typescript
/**
 * CustomFieldDefinition fixtures used by ListCustomFieldDefinitions scenarios.
 * Demonstrates the FieldMapping concept: vendor_key varies (UF_CRM_, __c, 40-char hash);
 * logical_name is canonical and is the data-plane key under metadata.public.
 */

export const dealPriorityField = {
  entity_type: 'deal',
  logical_name: 'priority',
  vendor_key: 'UF_CRM_2_PRIORITY',         // Bitrix24 form
  field_type: 6,                            // ENUM
  label: 'Priority',
  is_required: false,
  options: ['low', 'normal', 'high', 'urgent'],
};

export const contactSegmentField = {
  entity_type: 'contact',
  logical_name: 'segment',
  vendor_key: 'segment__c',                 // SF form
  field_type: 6,
  label: 'Segment',
  is_required: false,
  options: ['enterprise', 'mid-market', 'smb'],
};

export const dealCustomerSatisfactionField = {
  entity_type: 'deal',
  logical_name: 'csat',
  vendor_key: 'a3f7c982e1b4d56abc12345f6d7e8a9b0c1d2e3f', // Pipedrive 40-char hash
  field_type: 2,                            // NUMBER
  label: 'CSAT score',
  is_required: false,
};

export const companyAnnualRevenueRangeField = {
  entity_type: 'company',
  logical_name: 'revenue_range',
  vendor_key: 'annual_revenue_range',       // HubSpot snake_case
  field_type: 6,
  label: 'Annual Revenue Range',
  is_required: false,
  options: ['<1M', '1M-10M', '10M-100M', '100M+'],
};
```

- [ ] **Step 9: `fixtures/owners.ts`**

Create `modules/crm/conformance/src/fixtures/owners.ts`:

```typescript
/**
 * Owner fixtures. Owner is CRM-local — distinct from Identity.User. These represent
 * users in the CRM vendor's namespace (Bitrix24 employees, SF Users, HubSpot Owners).
 */

export const sallySalesOwner = {
  canonical_id: 'own_sally',
  vendor_id: 'b24_user_42',
  email: 'sally@example.com',
  name: { given: 'Sally', family: 'Smith', display: 'Sally Smith' },
  is_active: true,
};

export const bobBackupOwner = {
  canonical_id: 'own_bob',
  vendor_id: 'b24_user_77',
  email: 'bob@example.com',
  name: { given: 'Bob', family: 'Backup', display: 'Bob Backup' },
  is_active: true,
};

export const carolDeactivatedOwner = {
  canonical_id: 'own_carol',
  vendor_id: 'b24_user_99',
  email: 'carol@example.com',
  name: { given: 'Carol', family: 'Carter' },
  is_active: false,                         // used in negative-path scenarios
};
```

- [ ] **Step 10: Commit**

```bash
git add modules/crm/conformance/src/fixtures/contacts.ts modules/crm/conformance/src/fixtures/companies.ts modules/crm/conformance/src/fixtures/deals.ts modules/crm/conformance/src/fixtures/activities.ts modules/crm/conformance/src/fixtures/notes.ts modules/crm/conformance/src/fixtures/associations.ts modules/crm/conformance/src/fixtures/pipelines.ts modules/crm/conformance/src/fixtures/custom-fields.ts modules/crm/conformance/src/fixtures/owners.ts
git commit -m "feat(conformance-crm): text fixtures (9 files)"
```

---

## Task 6: Webhook fixtures (4 vendor formats)

**Files:**
- Create: `modules/crm/conformance/src/fixtures/webhooks/bitrix24-event.json`
- Create: `modules/crm/conformance/src/fixtures/webhooks/hubspot-batch.json`
- Create: `modules/crm/conformance/src/fixtures/webhooks/amocrm-update.urlencoded`
- Create: `modules/crm/conformance/src/fixtures/webhooks/pipedrive-v2.json`
- Create: `modules/crm/conformance/src/fixtures/webhooks/index.ts`

These fixtures are the **input** to a vendor module's `event-transformer`; the conformance assertion is that the resulting CloudEvent matches the canonical event shape (`ContactCreated` / `DealUpdated` / etc).

- [ ] **Step 1: `webhooks/bitrix24-event.json`**

Create `modules/crm/conformance/src/fixtures/webhooks/bitrix24-event.json`:

```json
{
  "event": "ONCRMDEALUPDATE",
  "data": {
    "FIELDS": {
      "ID": "5"
    }
  },
  "ts": "1714200000",
  "auth": {
    "domain": "example.bitrix24.com",
    "client_endpoint": "https://example.bitrix24.com/rest/",
    "server_endpoint": "https://oauth.bitrix.info/rest/",
    "member_id": "abcdef1234567890",
    "application_token": "redacted-token"
  }
}
```

This is the canonical Bitrix24 outgoing-webhook envelope (JSON, POST, no signature; Bitrix24 does not retry — `webhook_retry_policy: "none"`).

- [ ] **Step 2: `webhooks/hubspot-batch.json`**

Create `modules/crm/conformance/src/fixtures/webhooks/hubspot-batch.json`:

```json
[
  {
    "eventId": 100,
    "subscriptionId": 1,
    "portalId": 99999,
    "appId": 12345,
    "occurredAt": 1714200000000,
    "subscriptionType": "contact.creation",
    "attemptNumber": 0,
    "objectId": 17001,
    "changeSource": "CRM",
    "changeFlag": "NEW"
  },
  {
    "eventId": 101,
    "subscriptionId": 1,
    "portalId": 99999,
    "appId": 12345,
    "occurredAt": 1714200001000,
    "subscriptionType": "deal.propertyChange",
    "attemptNumber": 0,
    "objectId": 4500,
    "propertyName": "dealstage",
    "propertyValue": "qualifiedtobuy",
    "changeSource": "CRM"
  }
]
```

This is the canonical HubSpot batch-webhook payload (up to 100 events per HTTP request; HMAC-SHA256 v3 signature in headers, not embedded in body).

- [ ] **Step 3: `webhooks/amocrm-update.urlencoded`**

Create `modules/crm/conformance/src/fixtures/webhooks/amocrm-update.urlencoded`:

```
account%5Bid%5D=12345&account%5Bsubdomain%5D=example&leads%5Bupdate%5D%5B0%5D%5Bid%5D=42&leads%5Bupdate%5D%5B0%5D%5Bname%5D=Acme+Q4&leads%5Bupdate%5D%5B0%5D%5Bstatus_id%5D=143&leads%5Bupdate%5D%5B0%5D%5Bprice%5D=50000&leads%5Bupdate%5D%5B0%5D%5Bresponsible_user_id%5D=99
```

This is the unique amoCRM webhook format: `application/x-www-form-urlencoded` form data with bracket-notation nested keys. Modules MUST parse this with a URL-decoder + bracket-path decoder before transforming to CloudEvents. The decoded structure is:

```json
{
  "account": { "id": "12345", "subdomain": "example" },
  "leads": {
    "update": [
      { "id": "42", "name": "Acme Q4", "status_id": "143", "price": "50000", "responsible_user_id": "99" }
    ]
  }
}
```

amoCRM's "Lead" maps to canonical `Deal{qualification=QUALIFIED}` (Lead/Deal Schism resolution).

- [ ] **Step 4: `webhooks/pipedrive-v2.json`**

Create `modules/crm/conformance/src/fixtures/webhooks/pipedrive-v2.json`:

```json
{
  "meta": {
    "action": "change",
    "entity": "deal",
    "entity_id": 7700,
    "company_id": 999,
    "user_id": 12345,
    "timestamp": 1714200000,
    "attempt": 1,
    "id": "evt_a1b2c3d4e5f6",
    "version": "2.0"
  },
  "current": {
    "id": 7700,
    "title": "Acme Q4 contract",
    "stage_id": 5,
    "pipeline_id": 1,
    "value": 50000,
    "currency": "USD",
    "status": "open"
  },
  "previous": {
    "id": 7700,
    "title": "Acme Q4 contract",
    "stage_id": 4,
    "pipeline_id": 1,
    "value": 50000,
    "currency": "USD",
    "status": "open"
  }
}
```

Pipedrive v2 webhook envelope: `meta` block carries `action` / `entity` / `id` / `attempt`; `current` and `previous` carry full state — useful for differential projections. Pipedrive retries 3 times (intervals: 3s, 30s, 150s) — `webhook_retry_policy: "exponential_3retries_<intervals>"`.

- [ ] **Step 5: `webhooks/index.ts`**

Create `modules/crm/conformance/src/fixtures/webhooks/index.ts`:

```typescript
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

export const bitrix24EventPath = resolve(here, 'bitrix24-event.json');
export const hubspotBatchPath = resolve(here, 'hubspot-batch.json');
export const amocrmUpdatePath = resolve(here, 'amocrm-update.urlencoded');
export const pipedriveV2Path = resolve(here, 'pipedrive-v2.json');

// URL forms for vendors that publish webhook samples on their docs:
export const bitrix24EventUrl = 'file://' + bitrix24EventPath;
export const hubspotBatchUrl = 'file://' + hubspotBatchPath;
export const amocrmUpdateUrl = 'file://' + amocrmUpdatePath;
export const pipedriveV2Url = 'file://' + pipedriveV2Path;
```

- [ ] **Step 6: Commit**

```bash
git add modules/crm/conformance/src/fixtures/webhooks/
git commit -m "feat(conformance-crm): webhook fixtures for 4 vendor formats (incl. amoCRM URL-encoded)"
```

---

## Task 7: Scenario stubs — Contact (5) + Company (5) = 10 files

Each scenario stub is a comment-rich pending fixture citing spec §11.2. The `scenarios` array is non-empty from day one: it contains one typed `pendingScenario(...)` entry so package consumers, drift tests, and the eventual runner can exercise the suite shape before full assertions land. The docstrings remain the contract for the eventual filled-in scenarios.

**Files:**
- Create: `modules/crm/conformance/src/scenarios/GetContact.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/ListContacts.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/CreateContact.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/UpdateContact.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/DeleteContact.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/GetCompany.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/ListCompanies.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/CreateCompany.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/UpdateCompany.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/DeleteCompany.scenarios.ts`

- [ ] **Step 1: `GetContact.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/GetContact.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.GetContact.
 *
 * Spec § 11.2 mandates:
 *
 *   Happy path:
 *     - GetContact: returns canonical Contact shape for a previously-Created canonical_id;
 *       custom fields appear under metadata.public.<logical_name>, never as raw vendor keys.
 *
 *   Negative:
 *     - GetContact: unknown canonical_id returns CRM_REFERENCES_CONTACT_NOT_FOUND.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 2: `ListContacts.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/ListContacts.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.ListContacts.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - ListContacts: returns items in created_at DESC by default.
 *     - ListContacts: filter by company_canonical_id returns contacts of that company only.
 *     - ListContacts: filter by status=ACTIVE excludes deleted.
 *     - ListContacts: filter by exact-match email returns 0 or 1 result.
 *     - ListContacts: cursor pagination round-trip yields the full set without dupes.
 *     - ListContacts: limit=N returns at most N items, has_more accurate.
 *
 *   Negative:
 *     - ListContacts: invalid email format in filter returns CRM_STRUCTURAL_INVALID_EMAIL.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 3: `CreateContact.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/CreateContact.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.CreateContact.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - CreateContact: returns canonical Contact with system-set canonical_id, vendor_id,
 *       created_at, updated_at; ContactCreated event published within 5s on rntme.crm.contact.
 *     - CreateContact: idempotency replay returns same canonical_id, no duplicate event.
 *     - CreateContact: with metadata.public.<logical_name> custom field; round-trip preserves
 *       logical name (vendor_key never appears in response).
 *     - CreateContact: with company_canonical_id sets primary-company link; vendor-side
 *       mapping (HubSpot association, SF AccountId, B24 COMPANY_ID) is module-internal.
 *
 *   Negative (structural):
 *     - CreateContact: missing idempotency_key returns CRM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY.
 *     - CreateContact: invalid email format returns CRM_STRUCTURAL_INVALID_EMAIL.
 *     - CreateContact: invalid phone format returns CRM_STRUCTURAL_INVALID_PHONE.
 *
 *   Negative (consistency):
 *     - CreateContact: duplicate email when vendor dedups (HubSpot) returns
 *       CRM_CONSISTENCY_DUPLICATE_EMAIL OR upserts silently — module declares
 *       behaviour in capabilities.
 *     - CreateContact: missing company_canonical_id when company_id refers to nothing
 *       returns CRM_REFERENCES_COMPANY_NOT_FOUND.
 *
 *   Vendor:
 *     - CreateContact when vendor returns rate-limit (HTTP 429 OR Bitrix24 HTTP 200 +
 *       QUERY_LIMIT_EXCEEDED body) returns CRM_VENDOR_RATE_LIMITED with retry-info.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 4: `UpdateContact.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/UpdateContact.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.UpdateContact.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - UpdateContact: full replacement semantic; ContactUpdated event with changed_fields[]
 *       lists all modified fields; previous snapshot embedded.
 *     - UpdateContact: idempotency replay returns same final state, no duplicate event.
 *     - UpdateContact: status transitions ACTIVE → DELETED via UpdateContact (alternative to
 *       DeleteContact RPC) — emits ContactDeleted event, not ContactUpdated.
 *
 *   Negative:
 *     - UpdateContact: unknown canonical_id returns CRM_REFERENCES_CONTACT_NOT_FOUND.
 *     - UpdateContact: optimistic-lock conflict (where vendor supports If-Match / ETag)
 *       returns CRM_CONSISTENCY_OPTIMISTIC_LOCK_CONFLICT.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 5: `DeleteContact.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/DeleteContact.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.DeleteContact.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - DeleteContact soft (default): contact transitions to status=DELETED, deleted_at set;
 *       ContactDeleted event with hard_delete=false.
 *     - DeleteContact hard: returns terminal contact, ContactDeleted with hard_delete=true
 *       (only on vendors with native hard-delete; otherwise CRM_CONSISTENCY_UNSUPPORTED_HARD_DELETE).
 *     - DeleteContact idempotency replay returns same final state, no duplicate event.
 *
 *   Negative:
 *     - DeleteContact: unknown canonical_id returns CRM_REFERENCES_CONTACT_NOT_FOUND.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 6: `GetCompany.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/GetCompany.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.GetCompany.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - GetCompany: returns canonical Company shape; regulatory fields (tax_id,
 *       registration_id, tax_branch_id) populated from Bitrix24 crm.requisite.* if present;
 *       empty string for international vendors.
 *
 *   Negative:
 *     - GetCompany: unknown canonical_id returns CRM_REFERENCES_COMPANY_NOT_FOUND.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 7: `ListCompanies.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/ListCompanies.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.ListCompanies.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - ListCompanies: returns items in created_at DESC by default.
 *     - ListCompanies: filter by domain returns 0 or 1 result (HubSpot enforces dedup).
 *     - ListCompanies: filter by tax_id (RU INN lookup, Bitrix24-style) returns matching.
 *     - ListCompanies: cursor pagination round-trip.
 *
 *   Negative:
 *     - ListCompanies: invalid tax_id format returns CRM_STRUCTURAL_INVALID_TAX_ID.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 8: `CreateCompany.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/CreateCompany.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.CreateCompany.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - CreateCompany: international (no regulatory fields) — CompanyCreated published.
 *     - CreateCompany: Russian entity with INN/OGRN/KPP (tax_id/registration_id/
 *       tax_branch_id) — Bitrix24 module persists via crm.requisite.*; round-trip preserves.
 *     - CreateCompany: idempotency replay returns same canonical_id, no duplicate event.
 *     - CreateCompany: with parent_company_canonical_id sets hierarchy link (SF/HubSpot/Zoho).
 *
 *   Negative (structural):
 *     - CreateCompany: missing idempotency_key returns CRM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY.
 *     - CreateCompany: invalid currency (not ISO-4217) returns CRM_STRUCTURAL_INVALID_CURRENCY.
 *     - CreateCompany: invalid INN checksum (Bitrix24-only validation) returns
 *       CRM_STRUCTURAL_INVALID_TAX_ID.
 *
 *   Negative (consistency):
 *     - CreateCompany: duplicate domain when HubSpot dedups returns CRM_CONSISTENCY_DUPLICATE_DOMAIN.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 9: `UpdateCompany.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/UpdateCompany.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.UpdateCompany.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - UpdateCompany: full replacement semantic; CompanyUpdated event with changed_fields[].
 *     - UpdateCompany: regulatory fields update (tax_id/registration_id/tax_branch_id) on
 *       Bitrix24 → adapter calls crm.requisite.update; on others, fields are unmapped (empty).
 *     - UpdateCompany: idempotency replay yields same final state, no duplicate event.
 *
 *   Negative:
 *     - UpdateCompany: unknown canonical_id returns CRM_REFERENCES_COMPANY_NOT_FOUND.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 10: `DeleteCompany.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/DeleteCompany.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.DeleteCompany.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - DeleteCompany soft (default): status=DELETED, deleted_at set; CompanyDeleted event.
 *     - DeleteCompany hard: only on vendors with native hard-delete; else
 *       CRM_CONSISTENCY_UNSUPPORTED_HARD_DELETE.
 *     - DeleteCompany idempotency replay yields same final state.
 *
 *   Negative:
 *     - DeleteCompany: unknown canonical_id returns CRM_REFERENCES_COMPANY_NOT_FOUND.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 11: Commit**

```bash
git add modules/crm/conformance/src/scenarios/GetContact.scenarios.ts modules/crm/conformance/src/scenarios/ListContacts.scenarios.ts modules/crm/conformance/src/scenarios/CreateContact.scenarios.ts modules/crm/conformance/src/scenarios/UpdateContact.scenarios.ts modules/crm/conformance/src/scenarios/DeleteContact.scenarios.ts modules/crm/conformance/src/scenarios/GetCompany.scenarios.ts modules/crm/conformance/src/scenarios/ListCompanies.scenarios.ts modules/crm/conformance/src/scenarios/CreateCompany.scenarios.ts modules/crm/conformance/src/scenarios/UpdateCompany.scenarios.ts modules/crm/conformance/src/scenarios/DeleteCompany.scenarios.ts
git commit -m "feat(conformance-crm): Contact + Company scenario stubs (10 files)"
```

---

## Task 8: Scenario stubs — Deal (5) + Activity (5) + Note (4) = 14 files

**Files:**
- Create: `modules/crm/conformance/src/scenarios/GetDeal.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/ListDeals.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/CreateDeal.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/UpdateDeal.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/DeleteDeal.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/GetActivity.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/ListActivities.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/CreateActivity.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/UpdateActivity.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/DeleteActivity.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/GetNote.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/ListNotes.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/CreateNote.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/DeleteNote.scenarios.ts`

- [ ] **Step 1: `GetDeal.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/GetDeal.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.GetDeal.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - GetDeal: returns canonical Deal shape with status + qualification orthogonal;
 *       primary_contact_canonical_id resolves to a known contact.
 *
 *   Negative:
 *     - GetDeal: unknown canonical_id returns CRM_REFERENCES_DEAL_NOT_FOUND.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 2: `ListDeals.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/ListDeals.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.ListDeals.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - ListDeals: filter by pipeline_canonical_id + stage_canonical_id returns deals at that stage.
 *     - ListDeals: filter by qualification=UNQUALIFIED returns "leads" (Lead/Deal Schism).
 *     - ListDeals: filter by qualification=QUALIFIED + status=OPEN returns active deals.
 *     - ListDeals: filter by qualification=QUALIFIED + status=WON returns closed-won.
 *     - ListDeals: filter by company_canonical_id returns deals of that company.
 *     - ListDeals: cursor pagination round-trip.
 *
 *   Negative: standard filter validation paths.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 3: `CreateDeal.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/CreateDeal.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.CreateDeal.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - CreateDeal: as UNQUALIFIED (Lead) — module routes to Lead aggregate on SF/Zoho or
 *       to Lead module on Bitrix24; on amoCRM, UNQUALIFIED maps to Lead with no qualification
 *       set; on HubSpot, sets lifecyclestage=lead.
 *     - CreateDeal: as QUALIFIED (Deal/Opportunity) — classic Deal create path.
 *     - CreateDeal: idempotency replay returns same canonical_id, no duplicate event.
 *     - CreateDeal: links primary_contact_canonical_id and company_canonical_id.
 *     - CreateDeal: stage_canonical_id within specified pipeline_canonical_id.
 *
 *   Negative (structural):
 *     - CreateDeal: missing idempotency_key returns CRM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY.
 *     - CreateDeal: missing pipeline_canonical_id returns CRM_STRUCTURAL_MISSING_REQUIRED_FIELD.
 *     - CreateDeal: missing stage_canonical_id returns CRM_STRUCTURAL_MISSING_REQUIRED_FIELD.
 *
 *   Negative (consistency):
 *     - CreateDeal: stage_canonical_id not in specified pipeline_canonical_id returns
 *       CRM_CONSISTENCY_STAGE_NOT_IN_PIPELINE.
 *     - CreateDeal: unknown pipeline_canonical_id returns CRM_REFERENCES_PIPELINE_NOT_FOUND.
 *     - CreateDeal: unknown stage_canonical_id returns CRM_REFERENCES_STAGE_NOT_FOUND.
 *     - CreateDeal: primary_contact_canonical_id refers to deleted contact returns
 *       CRM_REFERENCES_CONTACT_NOT_FOUND.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 4: `UpdateDeal.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/UpdateDeal.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.UpdateDeal — the most complex Command in v1.
 *
 * Spec § 11.2:
 *   Happy path (multi-step):
 *     - Pipeline transition (in-pipeline):
 *         steps:
 *           1. CreateDeal at stage=st_new
 *           2. UpdateDeal{stage_canonical_id=st_qualified}
 *           3. assertEventWithin: DealStageChanged (5s) on rntme.crm.deal
 *              with from_stage=st_new, to_stage=st_qualified, same pipeline.
 *
 *     - Cross-pipeline transition:
 *         steps:
 *           1. CreateDeal at pipeline=pl_sales / stage=st_qualified
 *           2. UpdateDeal{pipeline_canonical_id=pl_partner, stage_canonical_id=st_partner_intro}
 *           3. assertEventWithin: DealStageChanged with from_pipeline + to_pipeline both populated.
 *
 *     - Lead-to-Deal qualification transition:
 *         steps:
 *           1. CreateDeal{qualification=UNQUALIFIED}
 *           2. UpdateDeal{qualification=QUALIFIED}
 *           3. assertEventWithin: DealUpdated with changed_fields including "qualification".
 *
 *     - Close-won terminal:
 *         steps:
 *           1. CreateDeal in OPEN/QUALIFIED state
 *           2. UpdateDeal{stage_canonical_id=st_won, status=WON, close_reason="..."}
 *           3. assertEventWithin: DealClosed (5s) with terminal_status=WON; closed_at populated.
 *           4. assertEventWithin: DealStageChanged (5s) — both events fire on terminal stage move.
 *
 *     - UpdateDeal idempotency replay returns same final state, no duplicate events.
 *
 *   Negative (consistency):
 *     - UpdateDeal: stage_canonical_id from foreign pipeline without pipeline_canonical_id
 *       set returns CRM_CONSISTENCY_STAGE_NOT_IN_PIPELINE.
 *     - UpdateDeal: re-open a status=WON / status=LOST deal where vendor archives
 *       (Bitrix24) returns CRM_CONSISTENCY_DEAL_ALREADY_CLOSED. HubSpot allows re-open.
 *     - UpdateDeal: unknown canonical_id returns CRM_REFERENCES_DEAL_NOT_FOUND.
 *     - UpdateDeal: optimistic-lock conflict (where supported) returns
 *       CRM_CONSISTENCY_OPTIMISTIC_LOCK_CONFLICT.
 *
 *   Vendor:
 *     - UpdateDeal under Bitrix24 rate-limit: HTTP 200 + body QUERY_LIMIT_EXCEEDED maps to
 *       CRM_VENDOR_RATE_LIMITED (NOT INVALID_ARGUMENT — adapter parses body before status).
 *
 * Scenarios export one typed pending fixture in v1 skeleton; the multi-step pipeline-transition family is the
 * canonical acceptance test for this RPC and lands first when the framework gains
 * step+substitution support ($1.canonical_id).
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 5: `DeleteDeal.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/DeleteDeal.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.DeleteDeal.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - DeleteDeal soft: status=DELETED, deleted_at set; ContactDeleted event NOT
 *       fired — Deal-specific events live in rntme.crm.deal topic with no separate
 *       DealDeleted event in v1 (folded as DealUpdated with status=DELETED OR via DealClosed
 *       when terminal). Spec §9 design: "DealClosed" terminal events cover WON+LOST;
 *       soft-delete is treated as DealUpdated with changed_fields=["status","deleted_at"].
 *     - DeleteDeal hard: only on vendors with native hard-delete; else
 *       CRM_CONSISTENCY_UNSUPPORTED_HARD_DELETE.
 *
 *   Negative:
 *     - DeleteDeal: unknown canonical_id returns CRM_REFERENCES_DEAL_NOT_FOUND.
 *
 * NOTE: spec §9.2 lists only DealCreated/Updated/StageChanged/Closed — there is no
 * DealDeleted event in v1. DeleteDeal emits DealUpdated. Verify with spec when filling
 * scenarios.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 6: `GetActivity.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/GetActivity.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.GetActivity.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - GetActivity: returns canonical Activity with linked_entities[] M:N populated;
 *       outcome and is_completed consistent (is_completed derived from outcome).
 *
 *   Negative:
 *     - GetActivity: unknown canonical_id returns CRM_REFERENCES_ACTIVITY_NOT_FOUND.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 7: `ListActivities.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/ListActivities.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.ListActivities.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - ListActivities: filter by linked_to (any one of the M:N targets) returns activities
 *       linked to that entity.
 *     - ListActivities: filter by type=CALL returns calls only.
 *     - ListActivities: filter by is_completed=false returns open activities.
 *     - ListActivities: filter by owner_canonical_id returns activities of that owner.
 *     - ListActivities: cursor pagination round-trip.
 *
 *   Negative:
 *     - ListActivities: invalid linked_to.entity_type returns CRM_STRUCTURAL_INVALID_ENTITY_TYPE.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 8: `CreateActivity.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/CreateActivity.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.CreateActivity.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - CreateActivity TASK linked to deal: ActivityCreated event published.
 *     - CreateActivity MEETING linked to multiple contacts + deal (M:N): all linked_entities[]
 *       persisted on vendor side (HubSpot: multi-association; Bitrix24: OWNER_TYPE_ID with
 *       fanout; SF: WhoId+WhatId pair, splits into N records server-side).
 *     - CreateActivity CALL with duration set: round-trip preserves Duration.
 *     - CreateActivity idempotency replay returns same canonical_id, no duplicate event.
 *
 *   Negative (structural):
 *     - CreateActivity: missing idempotency_key returns CRM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY.
 *     - CreateActivity: missing type returns CRM_STRUCTURAL_MISSING_REQUIRED_FIELD.
 *     - CreateActivity: missing subject returns CRM_STRUCTURAL_MISSING_REQUIRED_FIELD.
 *
 *   Negative (references):
 *     - CreateActivity: linked_entity refers to unknown entity returns CRM_REFERENCES_*_NOT_FOUND.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 9: `UpdateActivity.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/UpdateActivity.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.UpdateActivity.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - UpdateActivity: outcome transition PLANNED → COMPLETED — module sets completed_at,
 *       is_completed=true; ActivityUpdated event with changed_fields=["outcome",
 *       "is_completed", "completed_at"].
 *     - UpdateActivity: linked_entities[] add/remove — vendor may emit per-link events;
 *       canonical aggregator emits one ActivityUpdated.
 *     - UpdateActivity: idempotency replay returns same final state, no duplicate event.
 *
 *   Negative:
 *     - UpdateActivity: unknown canonical_id returns CRM_REFERENCES_ACTIVITY_NOT_FOUND.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 10: `DeleteActivity.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/DeleteActivity.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.DeleteActivity.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - DeleteActivity: returns terminal activity, ActivityDeleted event published.
 *     - DeleteActivity hard: only on vendors with native hard-delete; else
 *       CRM_CONSISTENCY_UNSUPPORTED_HARD_DELETE.
 *
 *   Negative:
 *     - DeleteActivity: unknown canonical_id returns CRM_REFERENCES_ACTIVITY_NOT_FOUND.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 11: `GetNote.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/GetNote.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.GetNote.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - GetNote: returns canonical Note with parent EntityRef populated;
 *       content preserved verbatim (HTML preserved when content_type=text/html).
 *
 *   Negative:
 *     - GetNote: unknown canonical_id returns CRM_REFERENCES_NOTE_NOT_FOUND.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 12: `ListNotes.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/ListNotes.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.ListNotes.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - ListNotes: filter by parent (deal or contact or company) returns notes attached
 *       to that entity, ordered created_at DESC.
 *     - ListNotes: filter by author_canonical_id returns notes by that author.
 *     - ListNotes: cursor pagination round-trip.
 *
 *   Negative:
 *     - ListNotes: invalid parent.entity_type returns CRM_STRUCTURAL_INVALID_ENTITY_TYPE.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 13: `CreateNote.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/CreateNote.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.CreateNote.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - CreateNote on deal: NoteCreated event published with parent={entity_type:"deal",...}.
 *     - CreateNote on contact: same flow.
 *     - CreateNote on company: same flow.
 *     - CreateNote with HTML content (metadata.public.content_type=text/html) — round-trip
 *       preserves markup on supporting vendors (HubSpot); plain-text vendors strip tags
 *       and document so in their per-vendor extension proto.
 *     - CreateNote idempotency replay returns same canonical_id, no duplicate event.
 *
 *   Negative (structural):
 *     - CreateNote: missing idempotency_key returns CRM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY.
 *     - CreateNote: missing content returns CRM_STRUCTURAL_MISSING_REQUIRED_FIELD.
 *     - CreateNote: missing parent returns CRM_STRUCTURAL_MISSING_REQUIRED_FIELD.
 *
 *   Negative (consistency):
 *     - CreateNote: parent.entity_type the vendor cannot attach notes to (e.g. Bitrix24
 *       cannot attach timeline-comments to activities) returns
 *       CRM_CONSISTENCY_PARENT_ENTITY_TYPE_MISMATCH.
 *
 *   Negative (references):
 *     - CreateNote: parent.canonical_id refers to nothing returns CRM_REFERENCES_*_NOT_FOUND.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 14: `DeleteNote.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/DeleteNote.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.DeleteNote.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - DeleteNote: NoteDeleted event published.
 *     - DeleteNote hard: only on vendors with native hard-delete; else
 *       CRM_CONSISTENCY_UNSUPPORTED_HARD_DELETE.
 *     - DeleteNote idempotency replay returns same final state.
 *
 *   Negative:
 *     - DeleteNote: unknown canonical_id returns CRM_REFERENCES_NOTE_NOT_FOUND.
 *
 * NOTE: v1 has no UpdateNote — notes are de-facto immutable across most vendors. v1.minor
 * adds it when concrete consumer surfaces.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 15: Commit**

```bash
git add modules/crm/conformance/src/scenarios/GetDeal.scenarios.ts modules/crm/conformance/src/scenarios/ListDeals.scenarios.ts modules/crm/conformance/src/scenarios/CreateDeal.scenarios.ts modules/crm/conformance/src/scenarios/UpdateDeal.scenarios.ts modules/crm/conformance/src/scenarios/DeleteDeal.scenarios.ts modules/crm/conformance/src/scenarios/GetActivity.scenarios.ts modules/crm/conformance/src/scenarios/ListActivities.scenarios.ts modules/crm/conformance/src/scenarios/CreateActivity.scenarios.ts modules/crm/conformance/src/scenarios/UpdateActivity.scenarios.ts modules/crm/conformance/src/scenarios/DeleteActivity.scenarios.ts modules/crm/conformance/src/scenarios/GetNote.scenarios.ts modules/crm/conformance/src/scenarios/ListNotes.scenarios.ts modules/crm/conformance/src/scenarios/CreateNote.scenarios.ts modules/crm/conformance/src/scenarios/DeleteNote.scenarios.ts
git commit -m "feat(conformance-crm): Deal + Activity + Note scenario stubs (14 files)"
```

---

## Task 9: Scenario stubs — helpers (3) + Association (2) + Sync (1) + AsyncJob (4) = 10 files

**Files:**
- Create: `modules/crm/conformance/src/scenarios/ListPipelines.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/ListCustomFieldDefinitions.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/ListAssociations.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/CreateAssociation.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/DeleteAssociation.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/SyncDelta.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/SubmitJob.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/GetJob.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/CancelJob.scenarios.ts`
- Create: `modules/crm/conformance/src/scenarios/ListJobs.scenarios.ts`

- [ ] **Step 1: `ListPipelines.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/ListPipelines.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.ListPipelines.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - ListPipelines for entity_type=deal: returns all configured pipelines, each with
 *       embedded stages[] in order; one pipeline marked is_default=true.
 *     - ListPipelines: stage.semantic populated correctly (Bitrix24 STAGE_SEMANTIC_ID
 *       maps directly P/S/F → OPEN/WON/LOST; SF Closed Won/Lost → WON/LOST; HubSpot
 *       pipeline-stage with metadata.probability=1.0 → WON, 0.0 → LOST when terminal).
 *
 *   Negative:
 *     - ListPipelines for invalid entity_type returns CRM_STRUCTURAL_INVALID_ENTITY_TYPE.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 2: `ListCustomFieldDefinitions.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/ListCustomFieldDefinitions.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.ListCustomFieldDefinitions.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - ListCustomFieldDefinitions for entity_type=deal: returns CustomFieldDefinition[];
 *       logical_name + vendor_key + field_type + label populated. vendor_key shows the
 *       raw vendor identifier (UF_CRM_*, __c, 40-char hash) — for debugging only.
 *     - ListCustomFieldDefinitions for entity_type=contact: scoped to contact fields only.
 *     - ListCustomFieldDefinitions: enum/multi_select fields include options[].
 *
 *   Negative:
 *     - ListCustomFieldDefinitions for invalid entity_type returns
 *       CRM_STRUCTURAL_INVALID_ENTITY_TYPE.
 *
 *   Anti-conformance:
 *     - Modules that do not declare ListCustomFieldDefinitions in capabilities.rpcs[]
 *       return UNIMPLEMENTED.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 3: `ListAssociations.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/ListAssociations.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.ListAssociations.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - ListAssociations from contact: returns all edges anchored at that contact.
 *     - ListAssociations from contact, to_entity_type=deal: returns contact↔deal edges only.
 *     - ListAssociations from contact, label="BILLING_CONTACT": returns labeled edges only
 *       (capability-gated: requires labeled_associations=true on module).
 *     - ListAssociations: cursor pagination round-trip.
 *
 *   Negative:
 *     - ListAssociations: from refers to unknown entity returns CRM_REFERENCES_*_NOT_FOUND.
 *     - ListAssociations: invalid to_entity_type returns CRM_STRUCTURAL_INVALID_ENTITY_TYPE.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 4: `CreateAssociation.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/CreateAssociation.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.CreateAssociation.
 *
 * Spec § 11.2:
 *   Happy path (capability: any):
 *     - CreateAssociation unlabeled: any-to-any edge; AssociationCreated event published.
 *     - CreateAssociation idempotency replay returns same canonical_id, no duplicate event.
 *
 *   Happy path (capability: labeled_associations=true):
 *     - CreateAssociation with category=RNTME_DEFINED + label="BILLING_CONTACT": HubSpot
 *       maps to USER_DEFINED associationTypeId; SF maps to OpportunityContactRole.Role;
 *       Zoho maps to Contact Role.
 *     - CreateAssociation with category=USER_DEFINED + arbitrary label: tenant-custom edge;
 *       module persists in own state if vendor cannot create custom association labels.
 *
 *   Negative (consistency):
 *     - CreateAssociation with label != "" against a module declaring labeled_associations=false
 *       returns CRM_CONSISTENCY_LABELS_NOT_SUPPORTED — checked before any upstream call.
 *
 *   Negative (references):
 *     - CreateAssociation: from or to refers to unknown entity returns
 *       CRM_REFERENCES_*_NOT_FOUND.
 *
 *   Negative (structural):
 *     - CreateAssociation: missing idempotency_key returns CRM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY.
 *     - CreateAssociation: from.entity_type == to.entity_type AND from.id == to.id (self-loop)
 *       returns CRM_STRUCTURAL_INVALID_ENTITY_TYPE (or implementation-defined dedup).
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 5: `DeleteAssociation.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/DeleteAssociation.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.DeleteAssociation.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - DeleteAssociation: AssociationDeleted event published with from/to/label
 *       populated for replay-resolution (consumer can rebuild canonical association
 *       graph from the event stream alone).
 *     - DeleteAssociation idempotency replay returns same final state.
 *
 *   Negative:
 *     - DeleteAssociation: unknown canonical_id returns CRM_REFERENCES_ASSOCIATION_NOT_FOUND.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 6: `SyncDelta.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/SyncDelta.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.SyncDelta — the canonical pull-mode reconciliation.
 *
 * Spec § 11.2 — multi-step semantic test:
 *
 *   Happy path:
 *     - Delta-watermark progression:
 *         steps:
 *           1. CreateContact A at t1
 *           2. CreateContact B at t2 (t2 > t1)
 *           3. SyncDelta(entity_type="contact", since=t0)
 *              assert: items contains both A and B; next_cursor is empty (or not, with limit=1);
 *                      watermark > t2.
 *           4. UpdateContact A at t3 (t3 > t2)
 *           5. SyncDelta(entity_type="contact", since=watermark from step 3)
 *              assert: items contains only A with op=UPDATED; watermark > t3.
 *
 *     - Deletion observability:
 *         steps:
 *           1. DeleteContact A
 *           2. SyncDelta(entity_type="contact", since=watermark)
 *              assert: items contains A with op=DELETED; entity is empty (None per spec).
 *
 *     - Cursor pagination over a large delta:
 *         steps:
 *           1. CreateContact × 100
 *           2. SyncDelta(entity_type="contact", limit=20)
 *              assert: items.length=20; next_cursor non-empty.
 *           3. SyncDelta(entity_type="contact", since=<unchanged>, cursor=<step2.next_cursor>)
 *              assert: items.length=20; cursor advances; full set obtained without dupes after 5 calls.
 *
 *   Bitrix24 specifically (capability-gated):
 *     - SyncDelta against a portal that suffered webhook-loss: assert that SyncDelta
 *       still returns the lost-window deltas (this is the Bitrix24 no-webhook-retry
 *       recovery path; module implements via event.offline.get + timestamp filter).
 *
 *   Negative:
 *     - SyncDelta: invalid entity_type returns CRM_STRUCTURAL_INVALID_ENTITY_TYPE.
 *     - SyncDelta: limit > 500 returns CRM_STRUCTURAL_MISSING_REQUIRED_FIELD or clamps.
 *
 * Scenarios export one typed pending fixture in v1 skeleton; the multi-step watermark-progression family is the
 * canonical acceptance test for pull-mode reconciliation and lands first when the framework
 * gains step+watermark-substitution support.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 7: `SubmitJob.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/SubmitJob.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.SubmitJob (capability: async_job_types ⊇ ["SYNC_FULL"]).
 *
 * Spec § 11.2:
 *   Happy path (multi-step):
 *     - Full-sync job lifecycle:
 *         steps:
 *           1. SubmitJob(body=sync_full{entity_types=["contact","company","deal"]})
 *           2. assertEventWithin: AsyncJobSubmitted (5s) on rntme.crm.async_job
 *              with type=SYNC_FULL, job.canonical_id populated.
 *           3. wait + GetJob; status progresses QUEUED→RUNNING→COMPLETED.
 *           4. assertEventWithin: AsyncJobStatusChanged (intermediate; multiple allowed).
 *           5. assertEventWithin: AsyncJobCompleted (live: minutes; mock: ~5s).
 *           6. job.result_uri reachable; JSONL of records matches submitted entity_types.
 *
 *     - SubmitJob idempotency replay returns same canonical_id, no duplicate event.
 *
 *   Negative (structural):
 *     - SubmitJob: missing idempotency_key returns CRM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY.
 *     - SubmitJob: empty body.sync_full returns CRM_STRUCTURAL_MISSING_REQUIRED_FIELD.
 *     - SubmitJob: invalid entity_type in body.sync_full returns
 *       CRM_STRUCTURAL_INVALID_ENTITY_TYPE.
 *
 *   Negative (consistency):
 *     - SubmitJob with declared async_job_types not including SYNC_FULL returns
 *       CRM_CONSISTENCY_UNSUPPORTED_ASYNC_JOB_TYPE — caught before upstream call.
 *     - SubmitJob with batch too large for vendor (Bitrix24 daily portal cap × record count)
 *       returns CRM_CONSISTENCY_BATCH_TOO_LARGE — caught structurally.
 *
 *   Vendor:
 *     - SubmitJob when vendor returns rate-limit: CRM_VENDOR_RATE_LIMITED with retry-info.
 *     - SubmitJob when daily quota exceeded (Salesforce daily limit): CRM_VENDOR_DAILY_QUOTA_EXCEEDED.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 8: `GetJob.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/GetJob.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.GetJob.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - GetJob: returns canonical AsyncJob with progress_percentage in [0,100];
 *       status reflects current vendor state.
 *     - GetJob after completion: returns COMPLETED status with result_uri and record_count;
 *       expires_at populated.
 *
 *   Negative:
 *     - GetJob: unknown canonical_id returns CRM_REFERENCES_ASYNC_JOB_NOT_FOUND.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 9: `CancelJob.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/CancelJob.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.CancelJob (best-effort).
 *
 * Spec § 11.2:
 *   Happy path:
 *     - CancelJob on RUNNING job: transitions to CANCELLED; AsyncJobFailed event with
 *       error_code mentioning user-cancellation in error_message.
 *       (NOTE: spec §9 collapsed AsyncJobCancelled into AsyncJobFailed; the latter is
 *       reused with cancellation reasoning rather than a distinct event.)
 *     - CancelJob on already-COMPLETED job: returns current state without error
 *       (best-effort semantic; no NotFound, no ConsistencyError).
 *
 *   Negative:
 *     - CancelJob: unknown canonical_id returns CRM_REFERENCES_ASYNC_JOB_NOT_FOUND.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 10: `ListJobs.scenarios.ts`**

Create `modules/crm/conformance/src/scenarios/ListJobs.scenarios.ts`:

```typescript
/**
 * Conformance scenarios for CrmModule.ListJobs.
 *
 * Spec § 11.2:
 *   Happy path:
 *     - ListJobs: returns submitted jobs in created_at DESC order.
 *     - ListJobs filter by status=COMPLETED returns only finished jobs.
 *     - ListJobs filter by type=SYNC_FULL returns sync-full jobs only (in v1 only one type
 *       is canonical, but the filter still works).
 *     - ListJobs cursor pagination round-trip.
 *
 *   Negative:
 *     - ListJobs: standard filter validation paths.
 *
 * Scenarios export one typed pending fixture in v1 skeleton.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
```

- [ ] **Step 11: Commit**

```bash
git add modules/crm/conformance/src/scenarios/ListPipelines.scenarios.ts modules/crm/conformance/src/scenarios/ListCustomFieldDefinitions.scenarios.ts modules/crm/conformance/src/scenarios/ListAssociations.scenarios.ts modules/crm/conformance/src/scenarios/CreateAssociation.scenarios.ts modules/crm/conformance/src/scenarios/DeleteAssociation.scenarios.ts modules/crm/conformance/src/scenarios/SyncDelta.scenarios.ts modules/crm/conformance/src/scenarios/SubmitJob.scenarios.ts modules/crm/conformance/src/scenarios/GetJob.scenarios.ts modules/crm/conformance/src/scenarios/CancelJob.scenarios.ts modules/crm/conformance/src/scenarios/ListJobs.scenarios.ts
git commit -m "feat(conformance-crm): helpers + Association + Sync + AsyncJob scenario stubs (10 files)"
```

---

## Task 10: `suite.ts` — assemble `CategoryConformanceSuite` + `index.ts` barrel

**Files:**
- Create: `modules/crm/conformance/src/suite.ts`
- Create: `modules/crm/conformance/src/index.ts`

- [ ] **Step 1: Write `suite.ts`**

Create `modules/crm/conformance/src/suite.ts`:

```typescript
import type { CategoryConformanceSuite } from './types.js';

import { scenarios as GetContact } from './scenarios/GetContact.scenarios.js';
import { scenarios as ListContacts } from './scenarios/ListContacts.scenarios.js';
import { scenarios as CreateContact } from './scenarios/CreateContact.scenarios.js';
import { scenarios as UpdateContact } from './scenarios/UpdateContact.scenarios.js';
import { scenarios as DeleteContact } from './scenarios/DeleteContact.scenarios.js';
import { scenarios as GetCompany } from './scenarios/GetCompany.scenarios.js';
import { scenarios as ListCompanies } from './scenarios/ListCompanies.scenarios.js';
import { scenarios as CreateCompany } from './scenarios/CreateCompany.scenarios.js';
import { scenarios as UpdateCompany } from './scenarios/UpdateCompany.scenarios.js';
import { scenarios as DeleteCompany } from './scenarios/DeleteCompany.scenarios.js';
import { scenarios as GetDeal } from './scenarios/GetDeal.scenarios.js';
import { scenarios as ListDeals } from './scenarios/ListDeals.scenarios.js';
import { scenarios as CreateDeal } from './scenarios/CreateDeal.scenarios.js';
import { scenarios as UpdateDeal } from './scenarios/UpdateDeal.scenarios.js';
import { scenarios as DeleteDeal } from './scenarios/DeleteDeal.scenarios.js';
import { scenarios as GetActivity } from './scenarios/GetActivity.scenarios.js';
import { scenarios as ListActivities } from './scenarios/ListActivities.scenarios.js';
import { scenarios as CreateActivity } from './scenarios/CreateActivity.scenarios.js';
import { scenarios as UpdateActivity } from './scenarios/UpdateActivity.scenarios.js';
import { scenarios as DeleteActivity } from './scenarios/DeleteActivity.scenarios.js';
import { scenarios as GetNote } from './scenarios/GetNote.scenarios.js';
import { scenarios as ListNotes } from './scenarios/ListNotes.scenarios.js';
import { scenarios as CreateNote } from './scenarios/CreateNote.scenarios.js';
import { scenarios as DeleteNote } from './scenarios/DeleteNote.scenarios.js';
import { scenarios as ListPipelines } from './scenarios/ListPipelines.scenarios.js';
import { scenarios as ListCustomFieldDefinitions } from './scenarios/ListCustomFieldDefinitions.scenarios.js';
import { scenarios as ListAssociations } from './scenarios/ListAssociations.scenarios.js';
import { scenarios as CreateAssociation } from './scenarios/CreateAssociation.scenarios.js';
import { scenarios as DeleteAssociation } from './scenarios/DeleteAssociation.scenarios.js';
import { scenarios as SyncDelta } from './scenarios/SyncDelta.scenarios.js';
import { scenarios as SubmitJob } from './scenarios/SubmitJob.scenarios.js';
import { scenarios as GetJob } from './scenarios/GetJob.scenarios.js';
import { scenarios as CancelJob } from './scenarios/CancelJob.scenarios.js';
import { scenarios as ListJobs } from './scenarios/ListJobs.scenarios.js';

export const suite: CategoryConformanceSuite = {
  category: 'crm',
  contract_version: 'v1',
  scenarios: {
    GetContact,
    ListContacts,
    CreateContact,
    UpdateContact,
    DeleteContact,
    GetCompany,
    ListCompanies,
    CreateCompany,
    UpdateCompany,
    DeleteCompany,
    GetDeal,
    ListDeals,
    CreateDeal,
    UpdateDeal,
    DeleteDeal,
    GetActivity,
    ListActivities,
    CreateActivity,
    UpdateActivity,
    DeleteActivity,
    GetNote,
    ListNotes,
    CreateNote,
    DeleteNote,
    ListPipelines,
    ListCustomFieldDefinitions,
    ListAssociations,
    CreateAssociation,
    DeleteAssociation,
    SyncDelta,
    SubmitJob,
    GetJob,
    CancelJob,
    ListJobs,
  },
};
```

- [ ] **Step 2: Write `index.ts`**

Create `modules/crm/conformance/src/index.ts`:

```typescript
export { suite } from './suite.js';
export { pendingScenario, UNIMPLEMENTED_SCENARIO_STATUS } from './types.js';
export type { Scenario, ScenarioStep, ScenarioRequirements, CategoryConformanceSuite } from './types.js';

// Re-export fixtures so vendor modules can compose scenarios on top.
export * as contacts from './fixtures/contacts.js';
export * as companies from './fixtures/companies.js';
export * as deals from './fixtures/deals.js';
export * as activities from './fixtures/activities.js';
export * as notes from './fixtures/notes.js';
export * as associations from './fixtures/associations.js';
export * as pipelines from './fixtures/pipelines.js';
export * as customFields from './fixtures/custom-fields.js';
export * as owners from './fixtures/owners.js';
export {
  bitrix24EventPath,
  hubspotBatchPath,
  amocrmUpdatePath,
  pipedriveV2Path,
  bitrix24EventUrl,
  hubspotBatchUrl,
  amocrmUpdateUrl,
  pipedriveV2Url,
} from './fixtures/webhooks/index.js';
```

- [ ] **Step 3: Verify build**

Run: `pnpm -F @rntme/conformance-crm run build`
Expected: emits `dist/index.js` and `dist/index.d.ts`. No errors.

Run: `pnpm -F @rntme/conformance-crm run typecheck`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add modules/crm/conformance/src/suite.ts modules/crm/conformance/src/index.ts
git commit -m "feat(conformance-crm): suite.ts wiring + barrel"
```

---

## Task 11: Drift test — RPC names ↔ scenario filenames

**Files:**
- Create: `modules/crm/conformance/test/drift.test.ts`

- [ ] **Step 1: Write the drift test**

Create `modules/crm/conformance/test/drift.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { proto } from '@rntme/contracts-crm-v1';
import { suite } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const scenariosDir = resolve(here, '../src/scenarios');

const EXPECTED_RPCS = [
  'GetContact', 'ListContacts', 'CreateContact', 'UpdateContact', 'DeleteContact',
  'GetCompany', 'ListCompanies', 'CreateCompany', 'UpdateCompany', 'DeleteCompany',
  'GetDeal', 'ListDeals', 'CreateDeal', 'UpdateDeal', 'DeleteDeal',
  'GetActivity', 'ListActivities', 'CreateActivity', 'UpdateActivity', 'DeleteActivity',
  'GetNote', 'ListNotes', 'CreateNote', 'DeleteNote',
  'ListPipelines', 'ListCustomFieldDefinitions', 'ListAssociations',
  'CreateAssociation', 'DeleteAssociation',
  'SyncDelta',
  'SubmitJob', 'GetJob', 'CancelJob', 'ListJobs',
] as const;

describe('CRM conformance drift detector', () => {
  it('every canonical RPC has a matching scenario file (34 files)', () => {
    const filenames = readdirSync(scenariosDir).filter((n) => n.endsWith('.scenarios.ts'));
    const rpcNamesFromFiles = filenames.map((n) => n.replace('.scenarios.ts', '')).sort();
    const expected = [...EXPECTED_RPCS].sort();
    expect(rpcNamesFromFiles).toEqual(expected);
    expect(rpcNamesFromFiles).toHaveLength(34);
  });

  it('every scenario file is wired in suite.ts', () => {
    const filenames = readdirSync(scenariosDir).filter((n) => n.endsWith('.scenarios.ts'));
    const rpcNamesFromFiles = filenames.map((n) => n.replace('.scenarios.ts', ''));
    const wiredKeys = Object.keys(suite.scenarios);
    expect(wiredKeys.sort()).toEqual(rpcNamesFromFiles.sort());
  });

  it('EXPECTED_RPCS matches the canonical contract service', () => {
    // Introspect CrmModule to confirm the file list matches the proto definition.
    const ns = proto.rntme.contracts.crm.v1 as Record<string, unknown>;
    const ServiceCtor = ns['CrmModule'] as { prototype: Record<string, unknown> };
    expect(ServiceCtor, 'CrmModule service descriptor missing').toBeDefined();
    const declaredMethods = Object.getOwnPropertyNames(ServiceCtor.prototype).filter((n) => n !== 'constructor');
    // pbjs lower-cases the first letter of RPC method names.
    const camelExpected = [...EXPECTED_RPCS].map((n) => n.charAt(0).toLowerCase() + n.slice(1)).sort();
    expect(declaredMethods.sort()).toEqual(camelExpected);
  });

  it('suite metadata is fixed', () => {
    expect(suite.category).toBe('crm');
    expect(suite.contract_version).toBe('v1');
  });
});
```

- [ ] **Step 2: Run test**

Run: `pnpm -F @rntme/conformance-crm run test test/drift.test.ts`
Expected: 4 passing tests.

- [ ] **Step 3: Commit**

```bash
git add modules/crm/conformance/test/drift.test.ts
git commit -m "test(conformance-crm): drift detector for RPC ↔ scenario filenames"
```

---

## Task 12: Suite-shape and fixtures-sanity tests

**Files:**
- Create: `modules/crm/conformance/test/suite-shape.test.ts`
- Create: `modules/crm/conformance/test/fixtures-sanity.test.ts`

- [ ] **Step 1: Write `test/suite-shape.test.ts`**

Create `modules/crm/conformance/test/suite-shape.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { suite } from '../src/index.js';

describe('CategoryConformanceSuite shape', () => {
  it('every scenarios entry is an array (non-empty in v1 skeleton)', () => {
    for (const [rpc, scenarios] of Object.entries(suite.scenarios)) {
      expect(Array.isArray(scenarios), `scenarios[${rpc}] must be an array`).toBe(true);
    }
  });

  it('exactly 34 RPCs wired', () => {
    expect(Object.keys(suite.scenarios)).toHaveLength(34);
  });

  it('all scenario arrays contain typed pending fixtures in v1 skeleton (until framework lands)', () => {
    for (const [rpc, scenarios] of Object.entries(suite.scenarios)) {
      expect(scenarios.length, `scenarios[${rpc}] should contain one pending fixture`).toBeGreaterThanOrEqual(1);
      for (const scenario of scenarios) {
        expect(scenario.id, `${rpc} scenario id`).toMatch(new RegExp(`^${rpc}\\.\\w+`));
        expect(scenario.capability).toBe(rpc);
        expect(scenario.status).toBe('pending');
        expect(scenario.assertionsDescription).toContain('CRM spec §11.2');
      }
    }
  });
});
```

- [ ] **Step 2: Write `test/fixtures-sanity.test.ts`**

Create `modules/crm/conformance/test/fixtures-sanity.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { statSync, readFileSync } from 'node:fs';
import {
  bitrix24EventPath,
  hubspotBatchPath,
  amocrmUpdatePath,
  pipedriveV2Path,
} from '../src/fixtures/webhooks/index.js';

const MAX_SIZE_BYTES = 50 * 1024;  // 50 KB per fixture

describe('webhook fixtures', () => {
  it('bitrix24-event.json is valid JSON ≤ 50KB with event=ONCRMDEALUPDATE', () => {
    const stat = statSync(bitrix24EventPath);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(MAX_SIZE_BYTES);
    const payload = JSON.parse(readFileSync(bitrix24EventPath, 'utf8'));
    expect(payload.event).toBe('ONCRMDEALUPDATE');
    expect(payload.data?.FIELDS?.ID).toBeDefined();
    expect(payload.auth?.application_token).toBeDefined();
  });

  it('hubspot-batch.json is a valid JSON array ≤ 50KB with subscriptionType events', () => {
    const stat = statSync(hubspotBatchPath);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(MAX_SIZE_BYTES);
    const payload = JSON.parse(readFileSync(hubspotBatchPath, 'utf8'));
    expect(Array.isArray(payload)).toBe(true);
    expect(payload.length).toBeGreaterThanOrEqual(1);
    for (const event of payload) {
      expect(event.subscriptionType).toMatch(/^(contact|company|deal|ticket)\.(creation|propertyChange|deletion)$/);
      expect(event.eventId).toBeDefined();
      expect(event.portalId).toBeDefined();
    }
  });

  it('amocrm-update.urlencoded parses as URL-encoded form data ≤ 50KB', () => {
    const stat = statSync(amocrmUpdatePath);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(MAX_SIZE_BYTES);
    const raw = readFileSync(amocrmUpdatePath, 'utf8').trim();
    // URLSearchParams handles the percent-encoding + flat key=value structure.
    const params = new URLSearchParams(raw);
    // amoCRM's bracket-notation keys are preserved as-is; assert presence of canonical keys.
    expect(params.get('account[id]')).toBe('12345');
    expect(params.get('account[subdomain]')).toBe('example');
    expect(params.get('leads[update][0][id]')).toBe('42');
    expect(params.get('leads[update][0][name]')).toBe('Acme Q4');
    expect(params.get('leads[update][0][status_id]')).toBe('143');
    expect(params.get('leads[update][0][price]')).toBe('50000');
    expect(params.get('leads[update][0][responsible_user_id]')).toBe('99');
  });

  it('pipedrive-v2.json is valid JSON ≤ 50KB with meta.version=2.0', () => {
    const stat = statSync(pipedriveV2Path);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(MAX_SIZE_BYTES);
    const payload = JSON.parse(readFileSync(pipedriveV2Path, 'utf8'));
    expect(payload.meta?.version).toBe('2.0');
    expect(payload.meta?.entity).toBeDefined();
    expect(payload.meta?.action).toBeDefined();
    expect(payload.current).toBeDefined();
    expect(payload.previous).toBeDefined();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm -F @rntme/conformance-crm run test`
Expected: all tests pass (drift + suite-shape + fixtures-sanity).

- [ ] **Step 4: Run lint and typecheck**

Run: `pnpm -F @rntme/conformance-crm run lint`
Expected: zero errors.

Run: `pnpm -F @rntme/conformance-crm run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add modules/crm/conformance/test/suite-shape.test.ts modules/crm/conformance/test/fixtures-sanity.test.ts
git commit -m "test(conformance-crm): suite-shape + fixtures-sanity tests"
```

---

## Task 13: Per-package README

**Files:**
- Create: `modules/crm/conformance/README.md`

- [ ] **Step 1: Write the README**

Create `modules/crm/conformance/README.md`:

```markdown
# `@rntme/conformance-crm` — CRM conformance scaffolding

Conformance scenarios for the CRM canonical contract `@rntme/contracts-crm-v1`. Consumed by every `modules/crm/<vendor>/` module via the (future) shared conformance runner.

## File map

```
modules/crm/conformance/
├── src/
│   ├── types.ts                     # local Scenario / CategoryConformanceSuite (until framework lands)
│   ├── index.ts                     # barrel
│   ├── suite.ts                     # CategoryConformanceSuite wiring (34 RPCs)
│   ├── fixtures/
│   │   ├── contacts.ts              # Contact field fixtures
│   │   ├── companies.ts             # Company fixtures incl. RU regulatory fields
│   │   ├── deals.ts                 # Deal fixtures across qualification × status matrix
│   │   ├── activities.ts            # Activity fixtures across CALL/MEETING/TASK/EMAIL
│   │   ├── notes.ts                 # Note fixtures (single-parent invariant + HTML variant)
│   │   ├── associations.ts          # labeled / unlabeled / user-defined Association factories
│   │   ├── pipelines.ts             # Pipeline + Stage fixtures (sales + partner)
│   │   ├── custom-fields.ts         # CustomFieldDefinition fixtures across vendor_key formats
│   │   ├── owners.ts                # Owner fixtures (active + deactivated)
│   │   └── webhooks/                # vendor webhook payloads (input to event-transformer)
│   │       ├── bitrix24-event.json   # Bitrix24 outgoing-webhook envelope
│   │       ├── hubspot-batch.json    # HubSpot batch (up to 100 events per HTTP)
│   │       ├── amocrm-update.urlencoded   # amoCRM URL-encoded form data (unique format)
│   │       ├── pipedrive-v2.json     # Pipedrive v2 meta + current + previous
│   │       └── index.ts              # path/URL helpers
│   └── scenarios/                    # one file per canonical RPC (34 total)
│       ├── GetContact.scenarios.ts ... DeleteContact.scenarios.ts (5 Contact)
│       ├── GetCompany.scenarios.ts ... DeleteCompany.scenarios.ts (5 Company)
│       ├── GetDeal.scenarios.ts ... DeleteDeal.scenarios.ts (5 Deal)
│       ├── GetActivity.scenarios.ts ... DeleteActivity.scenarios.ts (5 Activity)
│       ├── GetNote.scenarios.ts ... DeleteNote.scenarios.ts (4 Note)
│       ├── ListPipelines.scenarios.ts (1)
│       ├── ListCustomFieldDefinitions.scenarios.ts (1)
│       ├── ListAssociations.scenarios.ts (1)
│       ├── CreateAssociation.scenarios.ts ... DeleteAssociation.scenarios.ts (2)
│       ├── SyncDelta.scenarios.ts (1)
│       └── SubmitJob.scenarios.ts ... ListJobs.scenarios.ts (4)
├── test/
│   ├── drift.test.ts                # RPC ↔ scenario file drift
│   ├── suite-shape.test.ts          # suite metadata + 34-key invariant
│   └── fixtures-sanity.test.ts       # webhook fixture parse + canonical-key check
└── README.md
```

## Quick start

```typescript
import { suite, contacts, deals, amocrmUpdatePath } from '@rntme/conformance-crm';

console.log(suite.category);                        // 'crm'
console.log(suite.contract_version);                // 'v1'
console.log(Object.keys(suite.scenarios));          // 34 canonical RPC names

// Compose a scenario using a fixture:
const aliceFields = contacts.aliceFields;
const wonDealFields = deals.wonDealFields;

// Read the amoCRM webhook fixture for parser tests:
import { readFileSync } from 'node:fs';
const amocrmRaw = readFileSync(amocrmUpdatePath, 'utf8');
const params = new URLSearchParams(amocrmRaw);
console.log(params.get('leads[update][0][id]'));   // '42'
```

When `@rntme/conformance-framework` lands, point its runner at this `suite` and a vendor module's gRPC handler:

```typescript
import { run } from '@rntme/conformance-framework';
import { suite } from '@rntme/conformance-crm';

const report = await run(suite, vendorModuleHandler, { mode: 'mock' });
```

## API

### `suite: CategoryConformanceSuite`

Frozen metadata + `scenarios` keyed by canonical RPC name (34 keys). Every scenarios array contains typed pending entries in the v1 skeleton — populated when the framework gains assertion DSL.

### Fixture re-exports

- `contacts` — `aliceFields`, `bobFields`, `charlieFields`, `aliceDuplicate`.
- `companies` — `acmeRu` (RU regulatory fields populated), `globexInt` (international, regulatory empty), `acmeChild` (parent-company hierarchy), `acmeDuplicateDomain`.
- `deals` — `newLeadFields` (UNQUALIFIED+OPEN), `qualifiedDealFields`, `wonDealFields`, `lostDealFields`, `disqualifiedDealFields`.
- `activities` — `followupCallFields`, `discoveryMeetingFields`, `proposalEmailFields`, `finalizeContractTaskFields`, `multiLinkedMeetingFields`.
- `notes` — `dealNoteFields`, `contactNoteFields`, `companyNoteFields`, `htmlNoteFields`.
- `associations` — `labeledBillingFields(from,to)`, `unlabeledFields(from,to)`, `userDefinedLabelFields(from,to,label)` factories.
- `pipelines` — `salesPipeline`, `partnerPipeline`.
- `customFields` — `dealPriorityField` (UF_CRM_), `contactSegmentField` (__c), `dealCustomerSatisfactionField` (40-char hash), `companyAnnualRevenueRangeField` (HubSpot snake_case).
- `owners` — `sallySalesOwner`, `bobBackupOwner`, `carolDeactivatedOwner`.
- `bitrix24Event{Path,Url}`, `hubspotBatch{Path,Url}`, `amocrmUpdate{Path,Url}`, `pipedriveV2{Path,Url}` — webhook fixture references.

## Invariants & gotchas

- **One scenario file per canonical RPC.** Drift detector enforces 1:1 mapping between `service CrmModule` RPCs and `src/scenarios/<RPC>.scenarios.ts` files. Adding an RPC to the contract without a scenario file (or vice versa) fails CI.
- **Scenarios export one typed pending fixture in v1 skeleton.** Real scenarios land when `@rntme/conformance-framework` ships. Until then, every file is a documented scaffold citing spec §11.2.
- **Webhook fixtures stay ≤ 50KB.** Sanity test enforces. Use `git diff --stat` after touching fixtures to confirm.
- **`amocrm-update.urlencoded` is intentionally NOT JSON.** This is the canonical reproduction of amoCRM's unique webhook format. Module's `event-transformer` MUST decode URL-encoded bracket-paths before transforming. Bracket keys are preserved verbatim by `URLSearchParams` — vendor modules use a bracket-path → object decoder (e.g. `qs.parse(raw, { allowDots: false })`).
- **`types.ts` is a temporary mirror** of (future) `@rntme/conformance-framework` types. Migrate when framework lands.
- **No binary fixtures.** Unlike AI/LLM (which ships sample.png/mp3/pdf for multimodal), CRM only needs textual webhook payloads — kept under `fixtures/webhooks/` not under `fixtures/media/`.

## Out of scope

- Actual scenario implementations — wait for framework runner.
- Live-vendor mode (real Bitrix24 / amoCRM / HubSpot calls) — runner plus secret-management is framework-side.
- Framework runner itself — separate `@rntme/conformance-framework` package, separate plan.
- Vendor-quirk normalisation tests against full mock servers — those land in each `modules/crm/<vendor>/` test suite.

## Where to look first

- `src/scenarios/UpdateDeal.scenarios.ts` — canonical structure for a multi-step pipeline-transition stub; comments cite spec §11.2 line-by-line.
- `src/scenarios/SyncDelta.scenarios.ts` — structure for the multi-step watermark-progression family.
- `src/scenarios/CreateAssociation.scenarios.ts` — structure for capability-gating against `labeled_associations`.
- `src/fixtures/webhooks/amocrm-update.urlencoded` — the URL-encoded webhook fixture (unique to amoCRM).
- `test/drift.test.ts` — authoritative list of canonical RPCs.

## Specs

- `docs/superpowers/specs/2026-04-27-crm-canonical-contract-design.md` §11 — conformance suite design.
- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` §7 — conformance suite layout, anti-conformance, capability-coverage report.
- `docs/superpowers/plans/crm-canonical-contract/02-crm-conformance-skeleton.md` — this plan.
- `docs/superpowers/plans/done/crm-canonical-contract/01-crm-contracts.md` — companion plan for contracts package.
```

- [ ] **Step 2: Commit**

```bash
git add modules/crm/conformance/README.md
git commit -m "docs(conformance-crm): per-package README"
```

---

## Task 14: Documentation-touch — `AGENTS.md` and root `README.md`

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`

- [ ] **Step 1: Add `modules/crm/` to `AGENTS.md` §3**

Run: `grep -n "modules/identity\|modules/ai-llm" AGENTS.md`

You should see entries from Identity plan 2 / AI/LLM plan 2. Insert next to them, alphabetical (`ai-llm` < `crm` < `identity`):

```
- modules/crm/                          — CRM category root: README + conformance/ workspace package
- modules/crm/conformance/              — workspace package @rntme/conformance-crm: 34 scenario stubs + fixtures (incl. amoCRM URL-encoded webhook)
```

- [ ] **Step 2: Add §6 how-to entry "Add a CRM vendor module"**

Run: `grep -n "Add an Identity vendor module\|Add an AI/LLM vendor module\|6.1[0-9]" AGENTS.md`

If sibling plans added "6.18 Add an Identity vendor module" / "6.19 Add an AI/LLM vendor module", add a parallel entry after them:

```markdown
### 6.20 Add a CRM vendor module

The pattern is the same as Identity / AI-LLM vendor modules but with the CRM canonical contract. Each vendor lands at `modules/crm/<vendor>/` with:

1. A handler implementation against `proto.rntme.contracts.crm.v1.CrmModule`. SaaS module wraps one CRM vendor; multi-CRM gateway proxies to many.
2. An idempotency dedup-store (in-memory, Redis sidecar, or Postgres) with ≥24h TTL — mandatory because most CRM vendors do not provide native idempotency on create/update.
3. A webhook receiver that handles the vendor's specific payload format. Most vendors send JSON; **amoCRM is the unique exception** — it sends `application/x-www-form-urlencoded` with bracket-notation nested keys (`leads[update][0][id]`). Use `qs` or equivalent for bracket-path decode.
4. **Special vendor quirks to map in the error-mapper:**
   - **Bitrix24** returns `HTTP 200 + body {"error":"QUERY_LIMIT_EXCEEDED"}` instead of HTTP 429. Adapter MUST parse body before status code.
   - **Bitrix24** does not retry webhooks (`webhook_retry_policy: "none"`). Use `event.offline.get` + `SyncDelta` for recovery.
   - **amoCRM** rotates refresh tokens on every refresh. Atomic save of new (access, refresh) pair is mandatory.
   - **Pipedrive** custom fields use 40-char hex hashes as keys; module's `FieldMapping` table is mandatory.
   - **Salesforce** custom fields use `__c` suffix; same FieldMapping pattern.
5. A `module.json` manifest declaring all ten capability fields (see `modules/crm/README.md` for the decision tree).
6. Vendor-specific extensions in `<vendor>-extensions.proto` if the vendor has features not in canon (Bitrix24 Smart Processes, SF Composite API graph, HubSpot Journal API v4 pull mode, etc.).
7. Conformance scenarios passing under both mock-vendor and live-sandbox modes (live mode requires API keys in a secret store).

Reference the canonical contract package at `packages/contracts/crm/v1/` and the conformance suite at `modules/crm/conformance/`.

Recommended first vendor: `module-crm-bitrix24` (RU P0 priority — 57.5% RU market, 152-FZ data-residency).
```

If sibling plans did NOT add such entries, skip Step 2 — when the first vendor module brainstorm/plan lands, all how-to entries can land together.

- [ ] **Step 3: Append `@rntme/conformance-crm` to root `README.md` packages table**

Run: `grep -n "@rntme/conformance-identity\|@rntme/conformance-ai-llm\|@rntme/contracts-crm-v1" README.md`

Add a row after the AI/LLM conformance entry (or after the CRM contracts entry from plan 1):

```markdown
| `@rntme/conformance-crm` | CRM conformance scenarios + fixtures (34 RPCs, 4 webhook formats incl. amoCRM URL-encoded) |
```

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: AGENTS layering + how-to + README packages-table for crm conformance"
```

---

## Task 15: Final cross-package verification

**Files:** none (verification only).

- [ ] **Step 1: Run full workspace build**

Run: `pnpm -r run build`
Expected: every package builds, including `@rntme/conformance-crm`.

- [ ] **Step 2: Run full workspace tests**

Run: `pnpm -r run test`
Expected: every test passes. Conformance package contributes ~11 test cases (4 drift + 3 suite-shape + 4 fixtures-sanity).

- [ ] **Step 3: Run full workspace lint and typecheck**

Run: `pnpm -r run lint && pnpm -r run typecheck`
Expected: zero errors.

- [ ] **Step 4: Confirm Identity / AI-LLM packages and CRM contracts not touched**

Run:
```bash
git log --since="<start-of-this-plan>" -- packages/contracts/crm/v1/ packages/contracts/identity/v1/ packages/contracts/_common/v1/ packages/contracts/ai-llm/v1/ modules/identity/ modules/ai-llm/
```
Expected: empty (this plan only touched `modules/crm/` and the two doc files).

- [ ] **Step 5: Confirm spec coverage**

Cross-check against `docs/superpowers/specs/2026-04-27-crm-canonical-contract-design.md`:
- §11.1 layout — `modules/crm/` + `conformance/` exists with the right structure ✓
- §11.2 per-RPC scenarios — 34 stub files, one per canonical RPC, each citing spec §11.2 ✓
- §11.3 anti-conformance — documented in scenario stub comments (esp. ListCustomFieldDefinitions, CreateAssociation); runner-side enforcement deferred to framework ✓
- §11.4 capability-coverage report — documented in category README ✓
- §11.5 mock-vendor — documented as deferred to `@rntme/conformance-framework` ✓
- §11.6 CRM-specific in template vs Identity/AI-LLM — webhook fixtures + multi-step scenarios + capability gating breadth + Bitrix24 vendor-quirk normalisation, all documented in scenario stub comments ✓

- [ ] **Step 6: Final commit (if any leftover staging)**

If `git status` is clean, no commit needed. Otherwise:

```bash
git add -A
git commit -m "chore(conformance-crm): final cross-package verification"
```

---

## Self-review checklist

Run this checklist after the last task and before closing the PR:

1. **Spec coverage:** §11.1–§11.6 each have a corresponding task above. Confirmed in Task 15 step 5.
2. **Red-flag scan:** Search generated task content for `TBD`, `TODO`, `FIXME`, `XXX`, `export const scenarios: Scenario[] = []`, and `should be empty`. Expected result: no hits. Pending scenarios are intentional typed scaffolds.
3. **Type consistency:** RPC names in Tasks 7–9 match `EXPECTED_RPCS` in Task 11. Filename pattern `<RPC>.scenarios.ts` enforced consistently. The `Scenario` type in Task 4 used by every scenario file in Tasks 7–9 and by `suite.ts` in Task 10.
4. **Cross-task naming:** `@rntme/conformance-crm` package name uniform across Tasks 3, 11, 13. `proto.rntme.contracts.crm.v1` namespace import in Task 11 matches Plan 1's barrel export.
5. **Capability gating coverage:** Every scenario stub that depends on a capability cites it explicitly in its docstring (e.g. CreateAssociation cites `labeled_associations`; SubmitJob cites `async_job_types ⊇ ["SYNC_FULL"]`; ListCustomFieldDefinitions cites anti-conformance via capabilities.rpcs[]). UpdateDeal multi-step pipeline-transition family covers cross-pipeline + qualification-transition + close-won terminal cases.
6. **Vendor-quirk coverage:** Bitrix24 HTTP 200 + QUERY_LIMIT_EXCEEDED quirk cited in CreateContact + UpdateDeal + SubmitJob scenario stubs. amoCRM URL-encoded webhook fixture present and parser-tested. RU regulatory fields cited in Company scenario stubs.

If any check fails: fix inline, re-run the affected task's tests.
