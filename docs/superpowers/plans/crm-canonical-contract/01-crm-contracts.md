# CRM Canonical Contract v1 — Plan 1: `crm/v1/` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land one new workspace package — `@rntme/contracts-crm-v1` — implementing the protobuf shapes (`crm.proto` + `crm-events.proto`), generated TS bindings, error codes, and README defined by `docs/superpowers/specs/2026-04-27-crm-canonical-contract-design.md`. After this plan, `pnpm -r run build && test && lint && typecheck` passes for the new package and consumers can `import { proto } from '@rntme/contracts-crm-v1'` to access `Contact`, `Company`, `Deal`, `Activity`, `Note`, `AsyncJob`, the `CrmModule` service descriptor, and all twenty-one event payload types.

**Architecture:** One leaf workspace package under `packages/contracts/crm/v1/`. Owns its `proto/*.proto` source and generates `src/proto.gen.{js,d.ts}` via `protobufjs-cli` static-module codegen (`pbjs --target static-module --wrap es6` followed by `pbts`). Declares a workspace dependency on `@rntme/contracts-common-v1` (created by Identity plan 1) and imports its proto via the `protobufjs` `--path` resolver staging-tree pattern adopted from the merged Identity package. Tests are vitest round-trip cases that assert encode→decode preserves the canonical shape, plus a drift-detector test that asserts every RPC short-name in `service CrmModule` matches the expected list.

**Tech Stack:** TypeScript 5.5, `protobufjs` runtime + direct `protobufjs-cli` dev dependency for `pbjs`/`pbts`, Node 20+, pnpm 9.12+ workspaces, vitest, eslint flat config — identical to the merged Identity contract package, inheriting the codegen pipeline decision (closes spec OQ-CRMV1-1 by reuse).

**Spec reference:** `docs/superpowers/specs/2026-04-27-crm-canonical-contract-design.md` §4 (layout), §5 (status enums), §6 (helper messages), §7 (aggregates), §8 (service & request/response), §9 (events), §10 (error codes), §13 (merge order).

**Depends on:** Identity plan 1 (`docs/superpowers/plans/done/identity-canonical-contract/01-common-and-identity-contracts.md`) must be merged first — `packages/contracts/_common/v1/` must exist as a workspace package, the `pnpm-workspace.yaml` glob `packages/contracts/*/v*` must be in place, and `tsconfig.base.json` must exist at repo root. This plan does **not** create or modify `_common/v1/`. AI/LLM plan 1 is **not** a dependency of this plan — the two are sibling categories that touch only their own subdirectories.

---

## File Structure

Files this plan creates or modifies:

**Created**
- `packages/contracts/crm/v1/package.json`
- `packages/contracts/crm/v1/tsconfig.json`
- `packages/contracts/crm/v1/tsconfig.check.json`
- `packages/contracts/crm/v1/eslint.config.mjs`
- `packages/contracts/crm/v1/vitest.config.ts`
- `packages/contracts/crm/v1/proto/crm.proto`
- `packages/contracts/crm/v1/proto/crm-events.proto`
- `packages/contracts/crm/v1/scripts/gen.mjs`
- `packages/contracts/crm/v1/scripts/check-imports.mjs`
- `packages/contracts/crm/v1/src/proto.gen.js` (generated; tracked)
- `packages/contracts/crm/v1/src/proto.gen.d.ts` (generated; tracked)
- `packages/contracts/crm/v1/src/index.ts`
- `packages/contracts/crm/v1/src/error-codes.ts`
- `packages/contracts/crm/v1/test/entities.test.ts`
- `packages/contracts/crm/v1/test/helpers.test.ts`
- `packages/contracts/crm/v1/test/events.test.ts`
- `packages/contracts/crm/v1/test/error-codes.test.ts`
- `packages/contracts/crm/v1/test/service-shape.test.ts`
- `packages/contracts/crm/v1/error-codes.json`
- `packages/contracts/crm/v1/.gitignore`
- `packages/contracts/crm/v1/.gitattributes`
- `packages/contracts/crm/v1/README.md`

**Modified**
- `AGENTS.md` — §3 layering update (add `packages/contracts/crm/v1/`); §10 glossary entries (canonical CRM contract, Lead/Deal Schism resolution, labeled association capability, SyncDelta watermark, CRM helper aggregate AsyncJob, Custom Field FieldMapping).
- `README.md` — packages-table entry for `@rntme/contracts-crm-v1`.

**NOT modified by this plan**
- `pnpm-workspace.yaml` — Identity plan 1 already added `packages/contracts/*/v*`. The new `packages/contracts/crm/v1/` directory is matched by that existing glob.
- `module-manifest-validator` — does not yet exist (modules-monorepo plan 1 owns it). New CRM-specific capability fields (`vendors[]`, `entities[]`, `search_tiers[]`, `labeled_associations: bool`, `bulk_operations.max_size: int`, `async_job_types[]`, `webhook_format`, `webhook_retry_policy`) are documented in the per-package README and become validator extensions when modules-monorepo plan 1 lands. This deferral matches how Identity plan 1 and AI/LLM plan 1 handled the same dependency.

## PLAN challenge updates (2026-04-27)

This plan was re-checked against the merged `_common/v1` and `identity/v1` packages before DEV handoff. The implementation source remains scoped to `packages/contracts/crm/v1/` plus the two index docs (`AGENTS.md`, `README.md`); it does not include the CRM conformance package, category README, vendor module, or manifest-validator extensions. Those belong to companion plan `02-crm-conformance-skeleton.md` and later vendor plans.

Tooling decisions are now pinned to the actual merged Identity pattern and current protobufjs docs:
- `pbjs`/`pbts` come from the direct dev dependency `protobufjs-cli`; Context7 verified the documented install and static-module commands (`pbjs -t static-module -w es6`, `pbts -o ...`), so relying on transitive `protobufjs` binaries is not allowed.
- Use `protobufjs` `^8.0.1` + `protobufjs-cli` `^2.0.1`, not the older `protobufjs` 7-only package shape.
- Patch generated ESM imports to `import $protobuf from "protobufjs/minimal.js"` as Identity does; namespace imports break under protobufjs 8 / Node ESM.
- Keep `allowJs: false`; `build` compiles hand-written TypeScript and then copies committed generated JS/DTS into `dist/`.
- Add `vitest.config.ts`, `.gitignore` for codegen scratch state, and an import smoke script so package exports are verified outside unit tests.

---

## Codegen approach (closes spec OQ-CRMV1-1)

This plan inherits the merged Identity package's codegen decision: `protobufjs-cli` static-module via `pbjs --target static-module --wrap es6` followed by `pbts`. Context7 verified the protobufjs docs for `pbjs -t static-module -w es6`, `pbts -o`, `-p/--path` include roots, and `npm install protobufjs-cli --save-dev`. Reasoning is unchanged: no `protoc` binary required, ESM-friendly output, and the CLI dependency is explicit instead of transitive. Re-evaluation belongs in a v1.minor or v2 if it bites.

The per-package codegen driver is a tiny ESM script (`scripts/gen.mjs`) invoked via `pnpm run proto:gen`. Generated files (`src/proto.gen.js`, `src/proto.gen.d.ts`) are committed (so consumers don't need codegen at install time) and `.gitattributes` marks them `linguist-generated=true` so PR diffs collapse them.

The codegen driver imports proto files **across packages** via the staging-tree pattern adopted from the merged Identity package: a temporary package-local `proto-deps/` tree with symlinks for `rntme/contracts/common/v1/common.proto` and `rntme/contracts/crm/v1/crm.proto`, so `pbjs` can resolve namespaced imports as `--path proto-deps`. `proto-deps/` is ignored and regenerated on every `proto:gen` run.

---

## Task 1: `@rntme/contracts-crm-v1` package skeleton

**Files:**
- Create: `packages/contracts/crm/v1/package.json`
- Create: `packages/contracts/crm/v1/tsconfig.json`
- Create: `packages/contracts/crm/v1/tsconfig.check.json`
- Create: `packages/contracts/crm/v1/eslint.config.mjs`
- Create: `packages/contracts/crm/v1/vitest.config.ts`
- Create: `packages/contracts/crm/v1/.gitignore`
- Create: `packages/contracts/crm/v1/.gitattributes`

- [ ] **Step 1: Create package directory structure**

Run:
```bash
mkdir -p packages/contracts/crm/v1/{proto,scripts,src,test}
```

- [ ] **Step 2: Write `package.json`**

Create `packages/contracts/crm/v1/package.json`:

```json
{
  "name": "@rntme/contracts-crm-v1",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Canonical CRM contract v1 for rntme: Contact, Company, Deal, Activity, Note, AsyncJob; 21 CloudEvents payloads; labeled associations. See docs/superpowers/specs/2026-04-27-crm-canonical-contract-design.md.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./error-codes": {
      "types": "./dist/error-codes.d.ts",
      "import": "./dist/error-codes.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "proto",
    "error-codes.json",
    "README.md"
  ],
  "scripts": {
    "proto:gen": "node scripts/gen.mjs",
    "build": "tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\""
  },
  "dependencies": {
    "@rntme/contracts-common-v1": "workspace:*",
    "protobufjs": "^8.0.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "protobufjs-cli": "^2.0.1",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

Create `packages/contracts/crm/v1/tsconfig.json`:

```json
{
  "extends": "../../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": false,
    "allowJs": false,
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

- [ ] **Step 4: Write `tsconfig.check.json`**

Create `packages/contracts/crm/v1/tsconfig.check.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "composite": false,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 5: Write `eslint.config.mjs`**

Create `packages/contracts/crm/v1/eslint.config.mjs`:

```javascript
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'src/proto.gen.*'] },
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

- [ ] **Step 6: Write `vitest.config.ts`**

Create `packages/contracts/crm/v1/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
    testTimeout: 15_000,
  },
});
```

- [ ] **Step 7: Write `.gitignore`**

Create `packages/contracts/crm/v1/.gitignore`:

```
dist/
proto-deps/
```

- [ ] **Step 8: Write `.gitattributes`**

Create `packages/contracts/crm/v1/.gitattributes`:

```
src/proto.gen.js linguist-generated=true
src/proto.gen.d.ts linguist-generated=true
```

- [ ] **Step 9: Run pnpm install and confirm the package is in the workspace**

Run: `pnpm install --frozen-lockfile=false`

Then: `pnpm list -r --depth -1 | grep contracts-crm-v1`
Expected: line containing `@rntme/contracts-crm-v1 0.0.0`.

- [ ] **Step 10: Commit**

```bash
git add pnpm-lock.yaml packages/contracts/crm/v1/package.json packages/contracts/crm/v1/tsconfig.json packages/contracts/crm/v1/tsconfig.check.json packages/contracts/crm/v1/eslint.config.mjs packages/contracts/crm/v1/vitest.config.ts packages/contracts/crm/v1/.gitignore packages/contracts/crm/v1/.gitattributes
git commit -m "feat(contracts-crm-v1): scaffold package"
```

---

## Task 2: `proto/crm.proto` — status enums

**Files:**
- Create: `packages/contracts/crm/v1/proto/crm.proto` (initial file with imports + enums section only; subsequent tasks append)

- [ ] **Step 1: Write the file with imports and all 12 enums**

Create `packages/contracts/crm/v1/proto/crm.proto`:

```protobuf
syntax = "proto3";
package rntme.contracts.crm.v1;

import "google/protobuf/any.proto";
import "google/protobuf/duration.proto";
import "google/protobuf/struct.proto";
import "google/protobuf/timestamp.proto";
import "rntme/contracts/common/v1/common.proto";

// =====================================================
// Section 1: Status enums
// rntme convention: <TYPE>_UNSPECIFIED = 0 (proto3 zero),
// <TYPE>_VENDOR_SPECIFIC = 100 (escape hatch).
// 1–99 reserved for canonical values; 100+ for vendor extensions.
// =====================================================

enum ContactStatus {
  CONTACT_STATUS_UNSPECIFIED = 0;
  CONTACT_STATUS_ACTIVE = 1;
  CONTACT_STATUS_DELETED = 2;
  CONTACT_STATUS_VENDOR_SPECIFIC = 100;
}

enum CompanyStatus {
  COMPANY_STATUS_UNSPECIFIED = 0;
  COMPANY_STATUS_ACTIVE = 1;
  COMPANY_STATUS_DELETED = 2;
  COMPANY_STATUS_VENDOR_SPECIFIC = 100;
}

enum DealStatus {
  DEAL_STATUS_UNSPECIFIED = 0;
  DEAL_STATUS_OPEN = 1;
  DEAL_STATUS_WON = 2;
  DEAL_STATUS_LOST = 3;
  DEAL_STATUS_DELETED = 4;
  DEAL_STATUS_VENDOR_SPECIFIC = 100;
}

// Lead/Deal Schism resolution (spec §5).
// UNQUALIFIED = what SF/HubSpot/Zoho/Pipedrive call Lead.
// QUALIFIED = what they call Deal/Opportunity.
// amoCRM Lead → Deal{qualification=QUALIFIED}; amoCRM Contact → Contact{}.
enum DealQualification {
  DEAL_QUALIFICATION_UNSPECIFIED = 0;
  DEAL_QUALIFICATION_UNQUALIFIED = 1;
  DEAL_QUALIFICATION_QUALIFIED = 2;
  DEAL_QUALIFICATION_DISQUALIFIED = 3;
}

enum ActivityType {
  ACTIVITY_TYPE_UNSPECIFIED = 0;
  ACTIVITY_TYPE_CALL = 1;
  ACTIVITY_TYPE_MEETING = 2;
  ACTIVITY_TYPE_TASK = 3;
  ACTIVITY_TYPE_EMAIL = 4;
  ACTIVITY_TYPE_VENDOR_SPECIFIC = 100;
}

enum ActivityOutcome {
  ACTIVITY_OUTCOME_UNSPECIFIED = 0;
  ACTIVITY_OUTCOME_PLANNED = 1;
  ACTIVITY_OUTCOME_COMPLETED = 2;
  ACTIVITY_OUTCOME_CANCELLED = 3;
  ACTIVITY_OUTCOME_NO_ANSWER = 4;
  ACTIVITY_OUTCOME_RESCHEDULED = 5;
}

enum CustomFieldType {
  CUSTOM_FIELD_TYPE_UNSPECIFIED = 0;
  CUSTOM_FIELD_TYPE_STRING = 1;
  CUSTOM_FIELD_TYPE_NUMBER = 2;
  CUSTOM_FIELD_TYPE_DATE = 3;
  CUSTOM_FIELD_TYPE_DATETIME = 4;
  CUSTOM_FIELD_TYPE_BOOLEAN = 5;
  CUSTOM_FIELD_TYPE_ENUM = 6;
  CUSTOM_FIELD_TYPE_MULTI_SELECT = 7;
  CUSTOM_FIELD_TYPE_URL = 8;
  CUSTOM_FIELD_TYPE_MONEY = 9;
  CUSTOM_FIELD_TYPE_FILE = 10;
}

// Bitrix24 STAGE_SEMANTIC_ID (P/S/F) is the most explicit vendor encoding;
// SF Closed Won/Lost map to WON/LOST; HubSpot pipeline closed-won maps to WON.
enum StageSemantic {
  STAGE_SEMANTIC_UNSPECIFIED = 0;
  STAGE_SEMANTIC_OPEN = 1;
  STAGE_SEMANTIC_WON = 2;
  STAGE_SEMANTIC_LOST = 3;
}

enum AssociationCategory {
  ASSOCIATION_CATEGORY_UNSPECIFIED = 0;
  ASSOCIATION_CATEGORY_RNTME_DEFINED = 1;
  ASSOCIATION_CATEGORY_USER_DEFINED = 2;
}

enum AsyncJobType {
  ASYNC_JOB_TYPE_UNSPECIFIED = 0;
  ASYNC_JOB_TYPE_SYNC_FULL = 1;
  ASYNC_JOB_TYPE_VENDOR_SPECIFIC = 100;
}

enum AsyncJobStatus {
  ASYNC_JOB_STATUS_UNSPECIFIED = 0;
  ASYNC_JOB_STATUS_QUEUED = 1;
  ASYNC_JOB_STATUS_RUNNING = 2;
  ASYNC_JOB_STATUS_COMPLETED = 3;
  ASYNC_JOB_STATUS_FAILED = 4;
  ASYNC_JOB_STATUS_CANCELLED = 5;
  ASYNC_JOB_STATUS_VENDOR_SPECIFIC = 100;
}

enum SyncDeltaOp {
  SYNC_DELTA_OP_UNSPECIFIED = 0;
  SYNC_DELTA_OP_CREATED = 1;
  SYNC_DELTA_OP_UPDATED = 2;
  SYNC_DELTA_OP_DELETED = 3;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/contracts/crm/v1/proto/crm.proto
git commit -m "feat(contracts-crm-v1): proto enums"
```

---

## Task 3: `proto/crm.proto` — helper messages

**Files:**
- Modify: `packages/contracts/crm/v1/proto/crm.proto` (append helper messages)

- [ ] **Step 1: Append helper messages to the proto file**

Append the following to `packages/contracts/crm/v1/proto/crm.proto`:

```protobuf

// =====================================================
// Section 2: Helper messages (read-only helpers + connector helpers)
// =====================================================

// EntityRef — cross-aggregate reference inside the contract. Used by
// Activity.linked_entities, Note.parent, Association.from/to.
message EntityRef {
  string entity_type = 1;            // "contact" | "company" | "deal" | "activity" | "note"
  string canonical_id = 2;
}

// Pipeline — read-only helper. No events, no Command-RPC; managed by the vendor.
message Pipeline {
  string canonical_id = 1;
  string vendor_id = 2;
  string name = 3;
  string entity_type = 4;            // typically "deal"
  bool is_default = 5;
  repeated Stage stages = 6;          // ordered by Stage.order
  google.protobuf.Struct vendor_raw = 7;
}

message Stage {
  string canonical_id = 1;
  string vendor_id = 2;
  string pipeline_canonical_id = 3;
  string name = 4;
  int32 order = 5;
  StageSemantic semantic = 6;         // OPEN / WON / LOST
  float probability = 7;              // 0..1
  bool is_terminal = 8;
}

// Owner — CRM-local user reference. Distinct from Identity.User aggregate.
// CRMs maintain their own user namespace (Bitrix24 employees, SF Users,
// HubSpot Owners). Linkage to Identity.User is blueprint business logic.
message Owner {
  string canonical_id = 1;
  string vendor_id = 2;
  string email = 3;
  rntme.contracts.common.v1.Name name = 4;
  bool is_active = 5;
}

// CustomFieldDefinition — read-only schema descriptor for UI form generation.
// Module maintains internal FieldMapping table populated at connect time via
// vendor schema introspection. Consumers never see vendor_key in data-plane.
message CustomFieldDefinition {
  string entity_type = 1;
  string logical_name = 2;            // canonical key under metadata.public.<name>
  string vendor_key = 3;              // raw vendor key (UF_CRM_*, __c, 40-char hash)
  CustomFieldType field_type = 4;
  string label = 5;
  bool is_required = 6;
  repeated string options = 7;
  google.protobuf.Struct vendor_raw = 8;
}

// Association — labeled M:N edge (HubSpot v4-shape). For modules without
// native label support (Bitrix24, amoCRM, Pipedrive), vendor_id is empty
// and canonical_id is module-generated UUID; module persists in own state.
message Association {
  rntme.contracts.common.v1.CanonicalRef ref = 1;
  EntityRef from = 2;
  EntityRef to = 3;
  AssociationCategory category = 4;
  string label = 5;
  google.protobuf.Struct metadata = 6;
  google.protobuf.Timestamp created_at = 7;
  google.protobuf.Struct vendor_raw = 8;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/contracts/crm/v1/proto/crm.proto
git commit -m "feat(contracts-crm-v1): proto helper messages"
```

---

## Task 4: `proto/crm.proto` — aggregates

**Files:**
- Modify: `packages/contracts/crm/v1/proto/crm.proto` (append aggregates section)

- [ ] **Step 1: Append the five business aggregates plus AsyncJob and SyncFullPayload**

Append the following to `packages/contracts/crm/v1/proto/crm.proto`:

```protobuf

// =====================================================
// Section 3: Aggregates
// 5 business aggregates (Contact, Company, Deal, Activity, Note) +
// 1 helper aggregate (AsyncJob).
// =====================================================

message Contact {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  string email = 2;
  string phone = 3;
  rntme.contracts.common.v1.Name name = 4;
  string title = 5;

  string company_canonical_id = 6;
  string owner_canonical_id = 7;
  repeated string tags = 8;

  ContactStatus status = 9;
  rntme.contracts.common.v1.Metadata metadata = 10;

  google.protobuf.Timestamp created_at = 11;
  google.protobuf.Timestamp updated_at = 12;
  google.protobuf.Timestamp deleted_at = 13;

  google.protobuf.Struct vendor_raw = 14;
}

message Company {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  string name = 2;
  string domain = 3;
  string industry = 4;
  int32 employee_count = 5;
  double annual_revenue = 6;
  string currency = 7;

  // Generic-named regulatory fields (spec Q6). RU mapping:
  // tax_id=INN, registration_id=OGRN, tax_branch_id=KPP via Bitrix24 crm.requisite.*.
  string tax_id = 8;
  string registration_id = 9;
  string tax_branch_id = 10;

  string parent_company_canonical_id = 11;
  string owner_canonical_id = 12;
  repeated string tags = 13;

  CompanyStatus status = 14;
  rntme.contracts.common.v1.Metadata metadata = 15;

  google.protobuf.Timestamp created_at = 16;
  google.protobuf.Timestamp updated_at = 17;
  google.protobuf.Timestamp deleted_at = 18;

  google.protobuf.Struct vendor_raw = 19;
}

message Deal {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  string name = 2;
  string pipeline_canonical_id = 3;
  string stage_canonical_id = 4;

  DealStatus status = 5;
  DealQualification qualification = 6;

  double amount = 7;
  string currency = 8;
  float probability = 9;

  google.protobuf.Timestamp expected_close_date = 10;
  google.protobuf.Timestamp closed_at = 11;
  string close_reason = 12;

  string primary_contact_canonical_id = 13;
  string company_canonical_id = 14;
  string owner_canonical_id = 15;
  repeated string tags = 16;

  string source = 17;
  rntme.contracts.common.v1.Metadata metadata = 18;

  google.protobuf.Timestamp created_at = 19;
  google.protobuf.Timestamp updated_at = 20;
  google.protobuf.Timestamp deleted_at = 21;

  google.protobuf.Struct vendor_raw = 22;
}

message Activity {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  ActivityType type = 2;
  string subject = 3;
  string description = 4;

  google.protobuf.Timestamp due_at = 5;
  google.protobuf.Timestamp completed_at = 6;
  google.protobuf.Duration duration = 7;

  ActivityOutcome outcome = 8;
  bool is_completed = 9;

  repeated EntityRef linked_entities = 10;

  string owner_canonical_id = 11;
  rntme.contracts.common.v1.Metadata metadata = 12;

  google.protobuf.Timestamp created_at = 13;
  google.protobuf.Timestamp updated_at = 14;

  google.protobuf.Struct vendor_raw = 15;
}

message Note {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  string content = 2;
  string title = 3;

  EntityRef parent = 4;

  string author_canonical_id = 5;
  rntme.contracts.common.v1.Metadata metadata = 6;

  google.protobuf.Timestamp created_at = 7;
  google.protobuf.Timestamp updated_at = 8;

  google.protobuf.Struct vendor_raw = 9;
}

// AsyncJob — helper aggregate for SyncFull (spec Q7=C, Q8=A).
// Mirrors AI/LLM v1 §8 AsyncJob shape.
message AsyncJob {
  rntme.contracts.common.v1.CanonicalRef ref = 1;

  AsyncJobType type = 2;
  AsyncJobStatus status = 3;
  int32 progress_percentage = 4;

  string result_uri = 5;
  int64 record_count = 6;
  string error_message = 7;

  google.protobuf.Timestamp created_at = 8;
  google.protobuf.Timestamp completed_at = 9;
  google.protobuf.Timestamp expires_at = 10;

  google.protobuf.Struct vendor_raw = 11;
}

// Payload for SubmitJob.body oneof.
message SyncFullPayload {
  repeated string entity_types = 1;             // ["contact","company","deal","activity","note"]
  google.protobuf.Timestamp since = 2;          // optional, for re-sync from a watermark
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/contracts/crm/v1/proto/crm.proto
git commit -m "feat(contracts-crm-v1): proto aggregates"
```

---

## Task 5: `proto/crm.proto` — service `CrmModule` and request/response messages

**Files:**
- Modify: `packages/contracts/crm/v1/proto/crm.proto` (append service + RPC requests/responses)

- [ ] **Step 1: Append the service definition and all request/response message pairs**

Append the following to `packages/contracts/crm/v1/proto/crm.proto`:

```protobuf

// =====================================================
// Section 4: Service CrmModule
// 34 RPCs across queries (13), commands (16), sync (1), async-job (4).
// =====================================================

service CrmModule {
  // ─── Queries: Contact ──────────────────────────────────
  rpc GetContact(GetContactRequest) returns (Contact);
  rpc ListContacts(ListContactsRequest) returns (ContactList);

  // ─── Queries: Company ──────────────────────────────────
  rpc GetCompany(GetCompanyRequest) returns (Company);
  rpc ListCompanies(ListCompaniesRequest) returns (CompanyList);

  // ─── Queries: Deal ─────────────────────────────────────
  rpc GetDeal(GetDealRequest) returns (Deal);
  rpc ListDeals(ListDealsRequest) returns (DealList);

  // ─── Queries: Activity ─────────────────────────────────
  rpc GetActivity(GetActivityRequest) returns (Activity);
  rpc ListActivities(ListActivitiesRequest) returns (ActivityList);

  // ─── Queries: Note ─────────────────────────────────────
  rpc GetNote(GetNoteRequest) returns (Note);
  rpc ListNotes(ListNotesRequest) returns (NoteList);

  // ─── Queries: helpers ──────────────────────────────────
  rpc ListPipelines(ListPipelinesRequest) returns (PipelineList);
  rpc ListCustomFieldDefinitions(ListCustomFieldDefinitionsRequest) returns (CustomFieldDefinitionList);
  rpc ListAssociations(ListAssociationsRequest) returns (AssociationList);

  // ─── Commands: Contact ─────────────────────────────────
  rpc CreateContact(CreateContactRequest) returns (Contact);
  rpc UpdateContact(UpdateContactRequest) returns (Contact);
  rpc DeleteContact(DeleteContactRequest) returns (Contact);

  // ─── Commands: Company ─────────────────────────────────
  rpc CreateCompany(CreateCompanyRequest) returns (Company);
  rpc UpdateCompany(UpdateCompanyRequest) returns (Company);
  rpc DeleteCompany(DeleteCompanyRequest) returns (Company);

  // ─── Commands: Deal ────────────────────────────────────
  rpc CreateDeal(CreateDealRequest) returns (Deal);
  rpc UpdateDeal(UpdateDealRequest) returns (Deal);
  rpc DeleteDeal(DeleteDealRequest) returns (Deal);

  // ─── Commands: Activity ────────────────────────────────
  rpc CreateActivity(CreateActivityRequest) returns (Activity);
  rpc UpdateActivity(UpdateActivityRequest) returns (Activity);
  rpc DeleteActivity(DeleteActivityRequest) returns (Activity);

  // ─── Commands: Note ────────────────────────────────────
  // No UpdateNote in v1 — notes are de-facto immutable across most vendors.
  rpc CreateNote(CreateNoteRequest) returns (Note);
  rpc DeleteNote(DeleteNoteRequest) returns (Note);

  // ─── Commands: Association ─────────────────────────────
  rpc CreateAssociation(CreateAssociationRequest) returns (Association);
  rpc DeleteAssociation(DeleteAssociationRequest) returns (Association);

  // ─── Sync ──────────────────────────────────────────────
  rpc SyncDelta(SyncDeltaRequest) returns (SyncDeltaResponse);

  // ─── AsyncJob (SYNC_FULL only in v1) ───────────────────
  rpc SubmitJob(SubmitJobRequest) returns (AsyncJob);
  rpc GetJob(GetJobRequest) returns (AsyncJob);
  rpc CancelJob(CancelJobRequest) returns (AsyncJob);
  rpc ListJobs(ListJobsRequest) returns (AsyncJobList);
}

// =====================================================
// Section 5: Request/response messages
// =====================================================

// ───── Contact ─────
message GetContactRequest { string canonical_id = 1; }

message ListContactsRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  string company_canonical_id = 2;
  string owner_canonical_id = 3;
  ContactStatus status = 4;
  string email = 5;
}

message ContactList {
  repeated Contact items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}

message CreateContactRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string email = 2;
  string phone = 3;
  rntme.contracts.common.v1.Name name = 4;
  string title = 5;
  string company_canonical_id = 6;
  string owner_canonical_id = 7;
  repeated string tags = 8;
  rntme.contracts.common.v1.Metadata metadata = 9;
}

message UpdateContactRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  string email = 3;
  string phone = 4;
  rntme.contracts.common.v1.Name name = 5;
  string title = 6;
  string company_canonical_id = 7;
  string owner_canonical_id = 8;
  repeated string tags = 9;
  ContactStatus status = 10;
  rntme.contracts.common.v1.Metadata metadata = 11;
}

message DeleteContactRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  bool hard_delete = 3;
}

// ───── Company ─────
message GetCompanyRequest { string canonical_id = 1; }

message ListCompaniesRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  string owner_canonical_id = 2;
  CompanyStatus status = 3;
  string domain = 4;
  string tax_id = 5;
}

message CompanyList {
  repeated Company items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}

message CreateCompanyRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string name = 2;
  string domain = 3;
  string industry = 4;
  int32 employee_count = 5;
  double annual_revenue = 6;
  string currency = 7;
  string tax_id = 8;
  string registration_id = 9;
  string tax_branch_id = 10;
  string parent_company_canonical_id = 11;
  string owner_canonical_id = 12;
  repeated string tags = 13;
  rntme.contracts.common.v1.Metadata metadata = 14;
}

message UpdateCompanyRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  string name = 3;
  string domain = 4;
  string industry = 5;
  int32 employee_count = 6;
  double annual_revenue = 7;
  string currency = 8;
  string tax_id = 9;
  string registration_id = 10;
  string tax_branch_id = 11;
  string parent_company_canonical_id = 12;
  string owner_canonical_id = 13;
  repeated string tags = 14;
  CompanyStatus status = 15;
  rntme.contracts.common.v1.Metadata metadata = 16;
}

message DeleteCompanyRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  bool hard_delete = 3;
}

// ───── Deal ─────
message GetDealRequest { string canonical_id = 1; }

message ListDealsRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  string pipeline_canonical_id = 2;
  string stage_canonical_id = 3;
  string company_canonical_id = 4;
  string owner_canonical_id = 5;
  DealStatus status = 6;
  DealQualification qualification = 7;
}

message DealList {
  repeated Deal items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}

message CreateDealRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string name = 2;
  string pipeline_canonical_id = 3;
  string stage_canonical_id = 4;
  DealQualification qualification = 5;
  double amount = 6;
  string currency = 7;
  google.protobuf.Timestamp expected_close_date = 8;
  string primary_contact_canonical_id = 9;
  string company_canonical_id = 10;
  string owner_canonical_id = 11;
  repeated string tags = 12;
  string source = 13;
  rntme.contracts.common.v1.Metadata metadata = 14;
}

message UpdateDealRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  string name = 3;
  string pipeline_canonical_id = 4;
  string stage_canonical_id = 5;
  DealStatus status = 6;
  DealQualification qualification = 7;
  double amount = 8;
  string currency = 9;
  google.protobuf.Timestamp expected_close_date = 10;
  string close_reason = 11;
  string primary_contact_canonical_id = 12;
  string company_canonical_id = 13;
  string owner_canonical_id = 14;
  repeated string tags = 15;
  rntme.contracts.common.v1.Metadata metadata = 16;
}

message DeleteDealRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  bool hard_delete = 3;
}

// ───── Activity ─────
message GetActivityRequest { string canonical_id = 1; }

message ListActivitiesRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  EntityRef linked_to = 2;             // optional scope: filter by linked entity
  string owner_canonical_id = 3;
  ActivityType type = 4;
  ActivityOutcome outcome = 5;
  bool is_completed = 6;
}

message ActivityList {
  repeated Activity items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}

message CreateActivityRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  ActivityType type = 2;
  string subject = 3;
  string description = 4;
  google.protobuf.Timestamp due_at = 5;
  google.protobuf.Duration duration = 6;
  repeated EntityRef linked_entities = 7;
  string owner_canonical_id = 8;
  rntme.contracts.common.v1.Metadata metadata = 9;
}

message UpdateActivityRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  string subject = 3;
  string description = 4;
  google.protobuf.Timestamp due_at = 5;
  google.protobuf.Timestamp completed_at = 6;
  google.protobuf.Duration duration = 7;
  ActivityOutcome outcome = 8;
  repeated EntityRef linked_entities = 9;
  string owner_canonical_id = 10;
  rntme.contracts.common.v1.Metadata metadata = 11;
}

message DeleteActivityRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  bool hard_delete = 3;
}

// ───── Note ─────
message GetNoteRequest { string canonical_id = 1; }

message ListNotesRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  EntityRef parent = 2;                // optional scope: filter by parent entity
  string author_canonical_id = 3;
}

message NoteList {
  repeated Note items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}

message CreateNoteRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string content = 2;
  string title = 3;
  EntityRef parent = 4;
  string author_canonical_id = 5;
  rntme.contracts.common.v1.Metadata metadata = 6;
}

message DeleteNoteRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
  bool hard_delete = 3;
}

// ───── Helper queries ─────
message ListPipelinesRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  string entity_type = 2;              // typically "deal"
}

message PipelineList {
  repeated Pipeline items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}

message ListCustomFieldDefinitionsRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  string entity_type = 2;              // "contact" | "company" | "deal" | "activity" | "note"
}

message CustomFieldDefinitionList {
  repeated CustomFieldDefinition items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}

message ListAssociationsRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  EntityRef from = 2;                  // anchor; required
  string to_entity_type = 3;
  string label = 4;
}

message AssociationList {
  repeated Association items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}

// ───── Association commands ─────
message CreateAssociationRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  EntityRef from = 2;
  EntityRef to = 3;
  AssociationCategory category = 4;
  string label = 5;
  google.protobuf.Struct metadata = 6;
}

message DeleteAssociationRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
}

// ───── Sync ─────
message SyncDeltaRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string entity_type = 2;
  google.protobuf.Timestamp since = 3;
  string cursor = 4;
  int32 limit = 5;
}

message SyncDeltaResponse {
  repeated SyncDeltaItem items = 1;
  string next_cursor = 2;
  google.protobuf.Timestamp watermark = 3;
}

message SyncDeltaItem {
  string canonical_id = 1;
  SyncDeltaOp op = 2;
  google.protobuf.Any entity = 3;
  google.protobuf.Timestamp changed_at = 4;
}

// ───── AsyncJob ─────
message SubmitJobRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  oneof body {
    SyncFullPayload sync_full = 2;
  }
  google.protobuf.Duration ttl = 3;
}

message GetJobRequest { string canonical_id = 1; }

message CancelJobRequest {
  rntme.contracts.common.v1.CommandContext context = 1;
  string canonical_id = 2;
}

message ListJobsRequest {
  rntme.contracts.common.v1.ListRequest base = 1;
  AsyncJobType type = 2;
  AsyncJobStatus status = 3;
}

message AsyncJobList {
  repeated AsyncJob items = 1;
  rntme.contracts.common.v1.ListResponseMeta meta = 2;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/contracts/crm/v1/proto/crm.proto
git commit -m "feat(contracts-crm-v1): service CrmModule + request/response"
```

---

## Task 6: `proto/crm-events.proto` — 21 events

**Files:**
- Create: `packages/contracts/crm/v1/proto/crm-events.proto`

- [ ] **Step 1: Write the events file**

Create `packages/contracts/crm/v1/proto/crm-events.proto`:

```protobuf
syntax = "proto3";
package rntme.contracts.crm.v1;

import "google/protobuf/timestamp.proto";
import "rntme/contracts/crm/v1/crm.proto";

// =====================================================
// 21 canonical CloudEvent payloads for CRM v1.
// CloudEvents type: rntme.crm.v1.<MessageName>
// Topics: rntme.crm.{contact, company, deal, activity, note, association, async_job}
// =====================================================

// ─── Contact (3) ────────────────────────────────────────
message ContactCreated {
  Contact contact = 1;
  string trigger = 2;                    // "command" | "webhook" | "sync_full" | "sync_delta"
}

message ContactUpdated {
  Contact contact = 1;
  repeated string changed_fields = 2;
  Contact previous = 3;
  string trigger = 4;
}

message ContactDeleted {
  string canonical_id = 1;
  string vendor_id = 2;
  bool hard_delete = 3;
  google.protobuf.Timestamp deleted_at = 4;
  string trigger = 5;
}

// ─── Company (3) ────────────────────────────────────────
message CompanyCreated {
  Company company = 1;
  string trigger = 2;
}

message CompanyUpdated {
  Company company = 1;
  repeated string changed_fields = 2;
  Company previous = 3;
  string trigger = 4;
}

message CompanyDeleted {
  string canonical_id = 1;
  string vendor_id = 2;
  bool hard_delete = 3;
  google.protobuf.Timestamp deleted_at = 4;
  string trigger = 5;
}

// ─── Deal (4) ───────────────────────────────────────────
message DealCreated {
  Deal deal = 1;
  string trigger = 2;
}

// changed_fields excludes "stage_canonical_id" (DealStageChanged) and
// terminal status transitions (DealClosed) — those have dedicated events.
message DealUpdated {
  Deal deal = 1;
  repeated string changed_fields = 2;
  Deal previous = 3;
  string trigger = 4;
}

message DealStageChanged {
  Deal deal = 1;
  string from_stage_canonical_id = 2;
  string to_stage_canonical_id = 3;
  string from_pipeline_canonical_id = 4;
  string to_pipeline_canonical_id = 5;
  string actor_canonical_id = 6;
  google.protobuf.Timestamp occurred_at = 7;
  string trigger = 8;
}

message DealClosed {
  Deal deal = 1;
  DealStatus terminal_status = 2;        // WON or LOST
  string close_reason = 3;
  google.protobuf.Timestamp closed_at = 4;
  string trigger = 5;
}

// ─── Activity (3) ───────────────────────────────────────
message ActivityCreated {
  Activity activity = 1;
  string trigger = 2;
}

message ActivityUpdated {
  Activity activity = 1;
  repeated string changed_fields = 2;
  Activity previous = 3;
  string trigger = 4;
}

message ActivityDeleted {
  string canonical_id = 1;
  string vendor_id = 2;
  google.protobuf.Timestamp deleted_at = 3;
  string trigger = 4;
}

// ─── Note (2) ───────────────────────────────────────────
message NoteCreated {
  Note note = 1;
  string trigger = 2;
}

message NoteDeleted {
  string canonical_id = 1;
  string vendor_id = 2;
  google.protobuf.Timestamp deleted_at = 3;
  string trigger = 4;
}

// ─── Association (2) ────────────────────────────────────
message AssociationCreated {
  Association association = 1;
  string trigger = 2;
}

message AssociationDeleted {
  string canonical_id = 1;
  string vendor_id = 2;
  EntityRef from = 3;
  EntityRef to = 4;
  string label = 5;
  google.protobuf.Timestamp deleted_at = 6;
  string trigger = 7;
}

// ─── AsyncJob (4) ───────────────────────────────────────
message AsyncJobSubmitted {
  AsyncJob job = 1;
  AsyncJobType type = 2;
}

message AsyncJobStatusChanged {
  string canonical_id = 1;
  AsyncJobType type = 2;
  AsyncJobStatus previous_status = 3;
  AsyncJobStatus new_status = 4;
  int32 progress_percentage = 5;
  google.protobuf.Timestamp transitioned_at = 6;
}

message AsyncJobCompleted {
  AsyncJob job = 1;
}

message AsyncJobFailed {
  AsyncJob job = 1;
  string error_code = 2;
  string error_message = 3;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/contracts/crm/v1/proto/crm-events.proto
git commit -m "feat(contracts-crm-v1): proto 21 events"
```

---

## Task 7: Codegen wiring + barrel export

**Files:**
- Create: `packages/contracts/crm/v1/scripts/gen.mjs`
- Create: `packages/contracts/crm/v1/scripts/check-imports.mjs`
- Create: `packages/contracts/crm/v1/src/proto.gen.js` (generated; tracked)
- Create: `packages/contracts/crm/v1/src/proto.gen.d.ts` (generated; tracked)
- Create: `packages/contracts/crm/v1/src/index.ts`

- [ ] **Step 1: Write codegen driver**

Create `packages/contracts/crm/v1/scripts/gen.mjs`:

```javascript
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const repoRoot = resolve(pkgRoot, '../../../..');

const require = createRequire(resolve(pkgRoot, 'package.json'));
const cliDir = dirname(require.resolve('protobufjs-cli/package.json'));
const pbjs = resolve(cliDir, 'bin/pbjs');
const pbts = resolve(cliDir, 'bin/pbts');

// Single entry: crm-events imports crm (and transitively common via crm).
const protoEntry = resolve(pkgRoot, 'proto/crm-events.proto');
const outJs = resolve(pkgRoot, 'src/proto.gen.js');
const outDts = resolve(pkgRoot, 'src/proto.gen.d.ts');

const pbjsRoot = resolve(pkgRoot, 'node_modules/protobufjs');

const protoDeps = resolve(pkgRoot, 'proto-deps');
rmSync(protoDeps, { recursive: true, force: true });
mkdirSync(resolve(protoDeps, 'rntme/contracts/common/v1'), { recursive: true });
mkdirSync(resolve(protoDeps, 'rntme/contracts/crm/v1'), { recursive: true });
const commonProtoSrc = resolve(repoRoot, 'packages/contracts/_common/v1/proto/common.proto');
const crmProtoSrc = resolve(pkgRoot, 'proto/crm.proto');
symlinkSync(commonProtoSrc, resolve(protoDeps, 'rntme/contracts/common/v1/common.proto'));
symlinkSync(crmProtoSrc, resolve(protoDeps, 'rntme/contracts/crm/v1/crm.proto'));

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: pkgRoot });
}

/** Node ESM: use default import + explicit .js subpath (namespace import breaks on protobufjs 8). */
function patchPbjsEsmImports(filePath) {
  let js = readFileSync(filePath, 'utf8');
  js = js.replace(
    /import \* as \$protobuf from "protobufjs\/minimal\.js"/g,
    'import $protobuf from "protobufjs/minimal.js"',
  );
  js = js.replace(/import \* as \$protobuf from "protobufjs\/minimal"/g, 'import $protobuf from "protobufjs/minimal.js"');
  writeFileSync(filePath, js);
}

run(
  `${pbjs} --target static-module --wrap es6 --es6 --keep-case ` +
    `--path ${pbjsRoot} --path ${protoDeps} --path ${resolve(pkgRoot, 'proto')} ` +
    `--out ${outJs} ${protoEntry}`,
);
patchPbjsEsmImports(outJs);
run(`${pbts} --out ${outDts} ${outJs}`);

console.log('Codegen complete.');
```

- [ ] **Step 2: Write `src/index.ts` barrel**

Create `packages/contracts/crm/v1/src/index.ts`:

```typescript
export * as proto from './proto.gen.js';
export type { rntme as Rntme } from './proto.gen.js';
export { errorCodes, isErrorCode, layerOf, type ErrorCode, type ErrorLayer } from './error-codes.js';
```

The `errorCodes` re-export depends on `error-codes.ts` which is added in Task 8. Build will fail until Task 8 completes — this is expected.

- [ ] **Step 3: Write `scripts/check-imports.mjs` smoke test**

Create `packages/contracts/crm/v1/scripts/check-imports.mjs`:

```javascript
import { proto, errorCodes } from '@rntme/contracts-crm-v1';

const crm = proto.rntme.contracts.crm.v1;
const deal = crm.Deal.create({
  ref: {
    canonical_id: 'deal_01',
    vendor_id: 'b24_42',
    module_name: 'module-crm-bitrix24',
    module_version: '0.1.0',
    contract_version: 'v1',
  },
  name: 'Acme renewal',
  status: crm.DealStatus.DEAL_STATUS_OPEN,
  qualification: crm.DealQualification.DEAL_QUALIFICATION_QUALIFIED,
});
const buf = crm.Deal.encode(deal).finish();
console.log('encoded deal bytes:', buf.length);
console.log(
  'error code count:',
  errorCodes.structural.length + errorCodes.references.length + errorCodes.consistency.length + errorCodes.vendor.length,
);
```

- [ ] **Step 4: Run codegen**

Run: `pnpm -F @rntme/contracts-crm-v1 run proto:gen`

Expected: writes `src/proto.gen.js` and `src/proto.gen.d.ts`. The output is verbose — `pbjs` logs each message it writes. No errors expected.

If you see "common.proto not found", verify Identity plan 1 was merged and `packages/contracts/_common/v1/proto/common.proto` exists.

- [ ] **Step 5: Verify generated artifacts contain expected names**

Run: `grep -c 'CrmModule\|Contact\|Company\|Deal\|Activity\|Note\|AsyncJob\|Pipeline\|Stage\|Owner\|Association\|CustomFieldDefinition' packages/contracts/crm/v1/src/proto.gen.d.ts`

Expected: a number > 50 (each name appears multiple times in the generated declarations).

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/crm/v1/scripts/gen.mjs packages/contracts/crm/v1/scripts/check-imports.mjs packages/contracts/crm/v1/src/proto.gen.js packages/contracts/crm/v1/src/proto.gen.d.ts packages/contracts/crm/v1/src/index.ts
git commit -m "feat(contracts-crm-v1): codegen wiring + generated bindings"
```

---

## Task 8: `error-codes.json` and typed re-export

**Files:**
- Create: `packages/contracts/crm/v1/error-codes.json`
- Create: `packages/contracts/crm/v1/src/error-codes.ts`

- [ ] **Step 1: Write `error-codes.json`**

Create `packages/contracts/crm/v1/error-codes.json`:

```json
{
  "structural": [
    "CRM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY",
    "CRM_STRUCTURAL_MISSING_REQUIRED_FIELD",
    "CRM_STRUCTURAL_INVALID_EMAIL",
    "CRM_STRUCTURAL_INVALID_PHONE",
    "CRM_STRUCTURAL_INVALID_CURRENCY",
    "CRM_STRUCTURAL_INVALID_TAX_ID",
    "CRM_STRUCTURAL_INVALID_ENTITY_TYPE"
  ],
  "references": [
    "CRM_REFERENCES_CONTACT_NOT_FOUND",
    "CRM_REFERENCES_COMPANY_NOT_FOUND",
    "CRM_REFERENCES_DEAL_NOT_FOUND",
    "CRM_REFERENCES_ACTIVITY_NOT_FOUND",
    "CRM_REFERENCES_NOTE_NOT_FOUND",
    "CRM_REFERENCES_ASSOCIATION_NOT_FOUND",
    "CRM_REFERENCES_PIPELINE_NOT_FOUND",
    "CRM_REFERENCES_STAGE_NOT_FOUND",
    "CRM_REFERENCES_OWNER_NOT_FOUND",
    "CRM_REFERENCES_ASYNC_JOB_NOT_FOUND"
  ],
  "consistency": [
    "CRM_CONSISTENCY_DUPLICATE_EMAIL",
    "CRM_CONSISTENCY_DUPLICATE_DOMAIN",
    "CRM_CONSISTENCY_STAGE_NOT_IN_PIPELINE",
    "CRM_CONSISTENCY_DEAL_ALREADY_CLOSED",
    "CRM_CONSISTENCY_LABELS_NOT_SUPPORTED",
    "CRM_CONSISTENCY_UNSUPPORTED_HARD_DELETE",
    "CRM_CONSISTENCY_UNSUPPORTED_ASYNC_JOB_TYPE",
    "CRM_CONSISTENCY_OPTIMISTIC_LOCK_CONFLICT",
    "CRM_CONSISTENCY_PARENT_ENTITY_TYPE_MISMATCH",
    "CRM_CONSISTENCY_BATCH_TOO_LARGE"
  ],
  "vendor": [
    "CRM_VENDOR_RATE_LIMITED",
    "CRM_VENDOR_DAILY_QUOTA_EXCEEDED",
    "CRM_VENDOR_UNAVAILABLE",
    "CRM_VENDOR_UNAUTHORIZED",
    "CRM_VENDOR_INVALID_REQUEST"
  ]
}
```

- [ ] **Step 2: Write typed re-export**

Create `packages/contracts/crm/v1/src/error-codes.ts`:

```typescript
import errorCodesJson from '../error-codes.json' with { type: 'json' };

export const errorCodes = errorCodesJson as {
  structural: readonly string[];
  references: readonly string[];
  consistency: readonly string[];
  vendor: readonly string[];
};

export type ErrorLayer = keyof typeof errorCodes;

export type ErrorCode =
  | (typeof errorCodes.structural)[number]
  | (typeof errorCodes.references)[number]
  | (typeof errorCodes.consistency)[number]
  | (typeof errorCodes.vendor)[number];

const ALL_CODES = new Set<string>([
  ...errorCodesJson.structural,
  ...errorCodesJson.references,
  ...errorCodesJson.consistency,
  ...errorCodesJson.vendor,
]);

export function isErrorCode(value: string): value is ErrorCode {
  return ALL_CODES.has(value);
}

export function layerOf(code: ErrorCode): ErrorLayer {
  if ((errorCodesJson.structural as readonly string[]).includes(code)) return 'structural';
  if ((errorCodesJson.references as readonly string[]).includes(code)) return 'references';
  if ((errorCodesJson.consistency as readonly string[]).includes(code)) return 'consistency';
  return 'vendor';
}
```

The `with { type: 'json' }` import attribute requires Node 20.10+ and this package's `tsconfig.json` pins `module: "NodeNext"` / `moduleResolution: "NodeNext"`. The merged Identity package already proves this combination works in the repo.

- [ ] **Step 3: Verify build now succeeds**

Run: `pnpm -F @rntme/contracts-crm-v1 run build`
Expected: emits `dist/index.js`, `dist/index.d.ts`, `dist/error-codes.js`, `dist/error-codes.d.ts`. No errors.

Run: `pnpm -F @rntme/contracts-crm-v1 run typecheck`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/crm/v1/error-codes.json packages/contracts/crm/v1/src/error-codes.ts
git commit -m "feat(contracts-crm-v1): error-codes.json + typed re-export"
```

---

## Task 9: Round-trip tests for entities and helpers

**Files:**
- Create: `packages/contracts/crm/v1/test/entities.test.ts`
- Create: `packages/contracts/crm/v1/test/helpers.test.ts`

- [ ] **Step 1: Write `test/entities.test.ts`**

Create `packages/contracts/crm/v1/test/entities.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { proto } from '../src/index.js';

const { Contact, Company, Deal, Activity, Note, AsyncJob, SyncFullPayload } =
  proto.rntme.contracts.crm.v1;

const refOf = (id: string, vendor: string, module = 'module-crm-bitrix24') => ({
  canonical_id: id,
  vendor_id: vendor,
  module_name: module,
  module_version: '0.1.0',
  contract_version: 'v1',
});

describe('CRM v1 aggregates round-trip', () => {
  it('Contact preserves email + phone + name + status + tags + metadata', () => {
    const original = Contact.create({
      ref: refOf('cnt_01J', 'b24_user_42'),
      email: 'alice@acme.com',
      phone: '+14155551212',
      name: { given: 'Alice', family: 'Smith', display: 'Alice Smith' },
      title: 'VP Engineering',
      company_canonical_id: 'co_01J',
      owner_canonical_id: 'own_01',
      tags: ['vip', 'q4-target'],
      status: 1, // ACTIVE
      metadata: { public: { fields: { region: { stringValue: 'eu' } } } },
    });

    const buf = Contact.encode(original).finish();
    const round = Contact.decode(buf);

    expect(round.email).toBe('alice@acme.com');
    expect(round.phone).toBe('+14155551212');
    expect(round.name?.given).toBe('Alice');
    expect(round.title).toBe('VP Engineering');
    expect(round.company_canonical_id).toBe('co_01J');
    expect(round.tags).toEqual(['vip', 'q4-target']);
    expect(round.status).toBe(1);
    expect(round.ref?.canonical_id).toBe('cnt_01J');
  });

  it('Company preserves regulatory fields (tax_id, registration_id, tax_branch_id)', () => {
    const original = Company.create({
      ref: refOf('co_01J', 'b24_company_5'),
      name: 'Acme LLC',
      domain: 'acme.com',
      industry: 'manufacturing',
      employee_count: 250,
      annual_revenue: 5_000_000,
      currency: 'RUB',
      tax_id: '7707083893',         // INN (10 chars, Russian legal entity)
      registration_id: '1027700132195', // OGRN (13 chars)
      tax_branch_id: '770701001',   // KPP (9 chars)
      status: 1,
    });

    const buf = Company.encode(original).finish();
    const round = Company.decode(buf);

    expect(round.tax_id).toBe('7707083893');
    expect(round.registration_id).toBe('1027700132195');
    expect(round.tax_branch_id).toBe('770701001');
    expect(round.currency).toBe('RUB');
    expect(round.employee_count).toBe(250);
    expect(round.annual_revenue).toBe(5_000_000);
  });

  it('Company with empty regulatory fields (international vendor scenario)', () => {
    const original = Company.create({
      ref: refOf('co_02', 'hs_company_99', 'module-crm-hubspot'),
      name: 'Globex Corp',
      domain: 'globex.io',
      currency: 'USD',
      // tax_id, registration_id, tax_branch_id intentionally empty
    });

    const buf = Company.encode(original).finish();
    const round = Company.decode(buf);

    expect(round.tax_id).toBe('');
    expect(round.registration_id).toBe('');
    expect(round.tax_branch_id).toBe('');
    expect(round.currency).toBe('USD');
  });

  it('Deal preserves qualification + status orthogonality (Lead/Deal Schism)', () => {
    // UNQUALIFIED + OPEN — what SF/Pipedrive call a "Lead"
    const lead = Deal.create({
      ref: refOf('dl_01', 'amo_lead_99', 'module-crm-amocrm'),
      name: 'New inquiry from website',
      pipeline_canonical_id: 'pl_01',
      stage_canonical_id: 'st_new',
      status: 1,           // OPEN
      qualification: 1,    // UNQUALIFIED
      amount: 0,
      currency: 'EUR',
    });

    const round = Deal.decode(Deal.encode(lead).finish());
    expect(round.status).toBe(1);
    expect(round.qualification).toBe(1);

    // QUALIFIED + WON — classic closed-won opportunity
    const wonDeal = Deal.create({
      ref: refOf('dl_02', 'sf_opp_77', 'module-crm-salesforce'),
      name: 'Acme Q4 contract',
      pipeline_canonical_id: 'pl_01',
      stage_canonical_id: 'st_closed_won',
      status: 2,           // WON
      qualification: 2,    // QUALIFIED
      amount: 50000,
      currency: 'USD',
      probability: 1.0,
    });

    const wonRound = Deal.decode(Deal.encode(wonDeal).finish());
    expect(wonRound.status).toBe(2);
    expect(wonRound.qualification).toBe(2);
    expect(wonRound.probability).toBe(1.0);
  });

  it('Activity preserves linked_entities[] M:N + outcome', () => {
    const original = Activity.create({
      ref: refOf('act_01', 'hs_engagement_5', 'module-crm-hubspot'),
      type: 2,                   // MEETING
      subject: 'Discovery call',
      description: 'Initial scoping conversation',
      duration: { seconds: 1800, nanos: 0 }, // 30min
      outcome: 1,                // PLANNED
      is_completed: false,
      linked_entities: [
        { entity_type: 'contact', canonical_id: 'cnt_01J' },
        { entity_type: 'contact', canonical_id: 'cnt_02' },
        { entity_type: 'deal', canonical_id: 'dl_02' },
      ],
      owner_canonical_id: 'own_01',
    });

    const round = Activity.decode(Activity.encode(original).finish());
    expect(round.type).toBe(2);
    expect(round.linked_entities).toHaveLength(3);
    expect(round.linked_entities[2].entity_type).toBe('deal');
    expect(round.outcome).toBe(1);
    expect(round.is_completed).toBe(false);
    expect(round.duration?.seconds).toBe(1800);
  });

  it('Note has single parent (universal across vendors)', () => {
    const original = Note.create({
      ref: refOf('nt_01', 'b24_comment_77'),
      content: 'Customer mentioned interest in the new pricing tier.',
      title: 'Pricing follow-up',
      parent: { entity_type: 'deal', canonical_id: 'dl_02' },
      author_canonical_id: 'own_01',
    });

    const round = Note.decode(Note.encode(original).finish());
    expect(round.content).toContain('pricing tier');
    expect(round.parent?.entity_type).toBe('deal');
    expect(round.parent?.canonical_id).toBe('dl_02');
  });

  it('AsyncJob preserves type + progress + result_uri for SYNC_FULL', () => {
    const original = AsyncJob.create({
      ref: refOf('job_01', 'sf_bulk_abc', 'module-crm-salesforce'),
      type: 1,                   // SYNC_FULL
      status: 3,                 // COMPLETED
      progress_percentage: 100,
      record_count: 12345,
      result_uri: 'https://files.example.com/sync/job_01.jsonl',
    });

    const round = AsyncJob.decode(AsyncJob.encode(original).finish());
    expect(round.type).toBe(1);
    expect(round.status).toBe(3);
    expect(round.progress_percentage).toBe(100);
    expect(Number(round.record_count)).toBe(12345);
    expect(round.result_uri).toContain('job_01.jsonl');
  });

  it('SyncFullPayload preserves entity_types[] + since', () => {
    const original = SyncFullPayload.create({
      entity_types: ['contact', 'company', 'deal'],
      since: { seconds: 1700000000, nanos: 0 },
    });

    const round = SyncFullPayload.decode(SyncFullPayload.encode(original).finish());
    expect(round.entity_types).toEqual(['contact', 'company', 'deal']);
    expect(Number(round.since?.seconds)).toBe(1700000000);
  });
});

describe('CRM v1 enums', () => {
  const ns = proto.rntme.contracts.crm.v1;

  it('ContactStatus has UNSPECIFIED=0 and VENDOR_SPECIFIC=100', () => {
    expect(ns.ContactStatus.CONTACT_STATUS_UNSPECIFIED).toBe(0);
    expect(ns.ContactStatus.CONTACT_STATUS_ACTIVE).toBe(1);
    expect(ns.ContactStatus.CONTACT_STATUS_DELETED).toBe(2);
    expect(ns.ContactStatus.CONTACT_STATUS_VENDOR_SPECIFIC).toBe(100);
  });

  it('DealStatus has 4 canonical values + UNSPECIFIED + VENDOR_SPECIFIC', () => {
    expect(ns.DealStatus.DEAL_STATUS_UNSPECIFIED).toBe(0);
    expect(ns.DealStatus.DEAL_STATUS_OPEN).toBe(1);
    expect(ns.DealStatus.DEAL_STATUS_WON).toBe(2);
    expect(ns.DealStatus.DEAL_STATUS_LOST).toBe(3);
    expect(ns.DealStatus.DEAL_STATUS_DELETED).toBe(4);
    expect(ns.DealStatus.DEAL_STATUS_VENDOR_SPECIFIC).toBe(100);
  });

  it('DealQualification has UNQUALIFIED/QUALIFIED/DISQUALIFIED', () => {
    expect(ns.DealQualification.DEAL_QUALIFICATION_UNSPECIFIED).toBe(0);
    expect(ns.DealQualification.DEAL_QUALIFICATION_UNQUALIFIED).toBe(1);
    expect(ns.DealQualification.DEAL_QUALIFICATION_QUALIFIED).toBe(2);
    expect(ns.DealQualification.DEAL_QUALIFICATION_DISQUALIFIED).toBe(3);
  });

  it('ActivityType has 4 canonical types', () => {
    expect(ns.ActivityType.ACTIVITY_TYPE_CALL).toBe(1);
    expect(ns.ActivityType.ACTIVITY_TYPE_MEETING).toBe(2);
    expect(ns.ActivityType.ACTIVITY_TYPE_TASK).toBe(3);
    expect(ns.ActivityType.ACTIVITY_TYPE_EMAIL).toBe(4);
    expect(ns.ActivityType.ACTIVITY_TYPE_VENDOR_SPECIFIC).toBe(100);
  });

  it('ActivityOutcome has 5 canonical states (no VENDOR_SPECIFIC — fully canonical)', () => {
    expect(ns.ActivityOutcome.ACTIVITY_OUTCOME_PLANNED).toBe(1);
    expect(ns.ActivityOutcome.ACTIVITY_OUTCOME_COMPLETED).toBe(2);
    expect(ns.ActivityOutcome.ACTIVITY_OUTCOME_RESCHEDULED).toBe(5);
  });

  it('CustomFieldType has 10 canonical types (no VENDOR_SPECIFIC)', () => {
    expect(ns.CustomFieldType.CUSTOM_FIELD_TYPE_STRING).toBe(1);
    expect(ns.CustomFieldType.CUSTOM_FIELD_TYPE_FILE).toBe(10);
  });

  it('StageSemantic has OPEN/WON/LOST', () => {
    expect(ns.StageSemantic.STAGE_SEMANTIC_OPEN).toBe(1);
    expect(ns.StageSemantic.STAGE_SEMANTIC_WON).toBe(2);
    expect(ns.StageSemantic.STAGE_SEMANTIC_LOST).toBe(3);
  });

  it('AssociationCategory has RNTME_DEFINED + USER_DEFINED', () => {
    expect(ns.AssociationCategory.ASSOCIATION_CATEGORY_RNTME_DEFINED).toBe(1);
    expect(ns.AssociationCategory.ASSOCIATION_CATEGORY_USER_DEFINED).toBe(2);
  });

  it('AsyncJobType has only SYNC_FULL canonical in v1', () => {
    expect(ns.AsyncJobType.ASYNC_JOB_TYPE_UNSPECIFIED).toBe(0);
    expect(ns.AsyncJobType.ASYNC_JOB_TYPE_SYNC_FULL).toBe(1);
    expect(ns.AsyncJobType.ASYNC_JOB_TYPE_VENDOR_SPECIFIC).toBe(100);
  });

  it('AsyncJobStatus has 5 canonical values', () => {
    expect(ns.AsyncJobStatus.ASYNC_JOB_STATUS_QUEUED).toBe(1);
    expect(ns.AsyncJobStatus.ASYNC_JOB_STATUS_RUNNING).toBe(2);
    expect(ns.AsyncJobStatus.ASYNC_JOB_STATUS_COMPLETED).toBe(3);
    expect(ns.AsyncJobStatus.ASYNC_JOB_STATUS_FAILED).toBe(4);
    expect(ns.AsyncJobStatus.ASYNC_JOB_STATUS_CANCELLED).toBe(5);
  });

  it('SyncDeltaOp has CREATED/UPDATED/DELETED', () => {
    expect(ns.SyncDeltaOp.SYNC_DELTA_OP_CREATED).toBe(1);
    expect(ns.SyncDeltaOp.SYNC_DELTA_OP_UPDATED).toBe(2);
    expect(ns.SyncDeltaOp.SYNC_DELTA_OP_DELETED).toBe(3);
  });
});
```

- [ ] **Step 2: Write `test/helpers.test.ts`**

Create `packages/contracts/crm/v1/test/helpers.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { proto } from '../src/index.js';

const { Pipeline, Stage, Owner, CustomFieldDefinition, Association, EntityRef } =
  proto.rntme.contracts.crm.v1;

describe('CRM v1 helper messages round-trip', () => {
  it('Pipeline preserves stages[] in order', () => {
    const original = Pipeline.create({
      canonical_id: 'pl_01',
      vendor_id: 'b24_category_0',
      name: 'Sales pipeline',
      entity_type: 'deal',
      is_default: true,
      stages: [
        { canonical_id: 'st_new', vendor_id: 'NEW', name: 'New', order: 0, semantic: 1, probability: 0.1 },
        { canonical_id: 'st_qual', vendor_id: 'QUALIFIED', name: 'Qualified', order: 1, semantic: 1, probability: 0.3 },
        { canonical_id: 'st_won', vendor_id: 'WON', name: 'Closed Won', order: 99, semantic: 2, probability: 1.0, is_terminal: true },
      ],
    });

    const round = Pipeline.decode(Pipeline.encode(original).finish());
    expect(round.stages).toHaveLength(3);
    expect(round.stages[0].name).toBe('New');
    expect(round.stages[2].is_terminal).toBe(true);
    expect(round.stages[2].semantic).toBe(2);
    expect(round.is_default).toBe(true);
  });

  it('Stage preserves probability + semantic', () => {
    const original = Stage.create({
      canonical_id: 'st_neg',
      vendor_id: 'NEGOTIATION',
      pipeline_canonical_id: 'pl_01',
      name: 'Negotiation',
      order: 5,
      semantic: 1,    // OPEN
      probability: 0.6,
      is_terminal: false,
    });

    const round = Stage.decode(Stage.encode(original).finish());
    expect(round.probability).toBeCloseTo(0.6);
    expect(round.semantic).toBe(1);
  });

  it('Owner preserves email + name + active flag', () => {
    const original = Owner.create({
      canonical_id: 'own_01',
      vendor_id: 'b24_user_42',
      email: 'manager@acme.com',
      name: { given: 'Bob', family: 'Jones', display: 'Bob Jones' },
      is_active: true,
    });

    const round = Owner.decode(Owner.encode(original).finish());
    expect(round.email).toBe('manager@acme.com');
    expect(round.name?.given).toBe('Bob');
    expect(round.is_active).toBe(true);
  });

  it('CustomFieldDefinition preserves logical_name + vendor_key + field_type + options', () => {
    const original = CustomFieldDefinition.create({
      entity_type: 'deal',
      logical_name: 'priority',
      vendor_key: 'UF_CRM_2_PRIORITY',
      field_type: 6,        // ENUM
      label: 'Priority',
      is_required: false,
      options: ['low', 'normal', 'high', 'urgent'],
    });

    const round = CustomFieldDefinition.decode(CustomFieldDefinition.encode(original).finish());
    expect(round.entity_type).toBe('deal');
    expect(round.logical_name).toBe('priority');
    expect(round.vendor_key).toBe('UF_CRM_2_PRIORITY');
    expect(round.field_type).toBe(6);
    expect(round.options).toEqual(['low', 'normal', 'high', 'urgent']);
  });

  it('Association preserves labeled-edge shape (HubSpot v4)', () => {
    const original = Association.create({
      ref: {
        canonical_id: 'as_01',
        vendor_id: 'hs_assoc_99',
        module_name: 'module-crm-hubspot',
        module_version: '0.1.0',
        contract_version: 'v1',
      },
      from: { entity_type: 'contact', canonical_id: 'cnt_01J' },
      to: { entity_type: 'deal', canonical_id: 'dl_02' },
      category: 1,           // RNTME_DEFINED
      label: 'DECISION_MAKER',
      metadata: { fields: { confirmed_at: { stringValue: '2026-04-27T12:00:00Z' } } },
    });

    const round = Association.decode(Association.encode(original).finish());
    expect(round.from?.entity_type).toBe('contact');
    expect(round.to?.canonical_id).toBe('dl_02');
    expect(round.label).toBe('DECISION_MAKER');
    expect(round.category).toBe(1);
  });

  it('Association without vendor_id (emulated label by Bitrix24/amoCRM/Pipedrive)', () => {
    const original = Association.create({
      ref: {
        canonical_id: 'as_emu_01',
        vendor_id: '',       // emulated
        module_name: 'module-crm-bitrix24',
        module_version: '0.1.0',
        contract_version: 'v1',
      },
      from: { entity_type: 'contact', canonical_id: 'cnt_01J' },
      to: { entity_type: 'deal', canonical_id: 'dl_02' },
      // category=UNSPECIFIED, label="" — module declared labeled_associations: false
    });

    const round = Association.decode(Association.encode(original).finish());
    expect(round.ref?.vendor_id).toBe('');
    expect(round.label).toBe('');
  });

  it('EntityRef encodes type + canonical_id pair', () => {
    const original = EntityRef.create({ entity_type: 'company', canonical_id: 'co_42' });
    const round = EntityRef.decode(EntityRef.encode(original).finish());
    expect(round.entity_type).toBe('company');
    expect(round.canonical_id).toBe('co_42');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm -F @rntme/contracts-crm-v1 run test`
Expected: 8 aggregate tests + 12 enum tests + 7 helper tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/crm/v1/test/entities.test.ts packages/contracts/crm/v1/test/helpers.test.ts
git commit -m "test(contracts-crm-v1): round-trip aggregates + helpers"
```

---

## Task 10: Round-trip tests for events

**Files:**
- Create: `packages/contracts/crm/v1/test/events.test.ts`

- [ ] **Step 1: Write `test/events.test.ts`**

Create `packages/contracts/crm/v1/test/events.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { proto } from '../src/index.js';

const ns = proto.rntme.contracts.crm.v1;

const EVENT_NAMES = [
  // Contact (3)
  'ContactCreated',
  'ContactUpdated',
  'ContactDeleted',
  // Company (3)
  'CompanyCreated',
  'CompanyUpdated',
  'CompanyDeleted',
  // Deal (4)
  'DealCreated',
  'DealUpdated',
  'DealStageChanged',
  'DealClosed',
  // Activity (3)
  'ActivityCreated',
  'ActivityUpdated',
  'ActivityDeleted',
  // Note (2)
  'NoteCreated',
  'NoteDeleted',
  // Association (2)
  'AssociationCreated',
  'AssociationDeleted',
  // AsyncJob (4)
  'AsyncJobSubmitted',
  'AsyncJobStatusChanged',
  'AsyncJobCompleted',
  'AsyncJobFailed',
] as const;

const refOf = (id: string, vendor: string, module = 'module-crm-bitrix24') => ({
  canonical_id: id,
  vendor_id: vendor,
  module_name: module,
  module_version: '0.1.0',
  contract_version: 'v1',
});

describe('CRM v1 event payloads', () => {
  it('exports exactly 21 event types', () => {
    for (const name of EVENT_NAMES) {
      expect((ns as Record<string, unknown>)[name], `event ${name} missing`).toBeDefined();
    }
    expect(EVENT_NAMES.length).toBe(21);
  });

  it('ContactCreated round-trip carries trigger', () => {
    const original = ns.ContactCreated.create({
      contact: {
        ref: refOf('cnt_01', 'b24_user_42'),
        email: 'a@b.com',
      },
      trigger: 'webhook',
    });
    const round = ns.ContactCreated.decode(ns.ContactCreated.encode(original).finish());
    expect(round.contact?.email).toBe('a@b.com');
    expect(round.trigger).toBe('webhook');
  });

  it('ContactUpdated carries changed_fields[] and previous snapshot', () => {
    const round = ns.ContactUpdated.decode(
      ns.ContactUpdated.encode(
        ns.ContactUpdated.create({
          contact: { ref: refOf('cnt_01', 'v') },
          changed_fields: ['email', 'phone'],
          previous: { ref: refOf('cnt_01', 'v'), email: 'old@b.com' },
          trigger: 'command',
        }),
      ).finish(),
    );
    expect(round.changed_fields).toEqual(['email', 'phone']);
    expect(round.previous?.email).toBe('old@b.com');
  });

  it('ContactDeleted distinguishes hard_delete', () => {
    const soft = ns.ContactDeleted.decode(
      ns.ContactDeleted.encode(
        ns.ContactDeleted.create({ canonical_id: 'cnt_01', vendor_id: 'v', hard_delete: false }),
      ).finish(),
    );
    expect(soft.hard_delete).toBe(false);

    const hard = ns.ContactDeleted.decode(
      ns.ContactDeleted.encode(
        ns.ContactDeleted.create({ canonical_id: 'cnt_01', vendor_id: 'v', hard_delete: true }),
      ).finish(),
    );
    expect(hard.hard_delete).toBe(true);
  });

  it('CompanyCreated/Updated/Deleted round-trip', () => {
    const created = ns.CompanyCreated.decode(
      ns.CompanyCreated.encode(
        ns.CompanyCreated.create({
          company: { ref: refOf('co_01', 'v'), name: 'Acme', tax_id: '7707083893' },
          trigger: 'sync_full',
        }),
      ).finish(),
    );
    expect(created.company?.tax_id).toBe('7707083893');

    const updated = ns.CompanyUpdated.decode(
      ns.CompanyUpdated.encode(
        ns.CompanyUpdated.create({
          company: { ref: refOf('co_01', 'v'), name: 'Acme Inc' },
          changed_fields: ['name'],
        }),
      ).finish(),
    );
    expect(updated.changed_fields).toEqual(['name']);

    const deleted = ns.CompanyDeleted.decode(
      ns.CompanyDeleted.encode(
        ns.CompanyDeleted.create({ canonical_id: 'co_01', vendor_id: 'v', hard_delete: false }),
      ).finish(),
    );
    expect(deleted.canonical_id).toBe('co_01');
  });

  it('DealCreated round-trip', () => {
    const round = ns.DealCreated.decode(
      ns.DealCreated.encode(
        ns.DealCreated.create({
          deal: { ref: refOf('dl_01', 'v'), name: 'New deal', status: 1, qualification: 1 },
          trigger: 'command',
        }),
      ).finish(),
    );
    expect(round.deal?.name).toBe('New deal');
    expect(round.deal?.qualification).toBe(1);
  });

  it('DealUpdated excludes stage_canonical_id by convention (changed_fields)', () => {
    const round = ns.DealUpdated.decode(
      ns.DealUpdated.encode(
        ns.DealUpdated.create({
          deal: { ref: refOf('dl_01', 'v') },
          changed_fields: ['amount', 'expected_close_date'],
        }),
      ).finish(),
    );
    expect(round.changed_fields).not.toContain('stage_canonical_id');
  });

  it('DealStageChanged carries from/to stage and pipeline + actor', () => {
    const round = ns.DealStageChanged.decode(
      ns.DealStageChanged.encode(
        ns.DealStageChanged.create({
          deal: { ref: refOf('dl_01', 'v'), stage_canonical_id: 'st_negotiation' },
          from_stage_canonical_id: 'st_qualified',
          to_stage_canonical_id: 'st_negotiation',
          from_pipeline_canonical_id: 'pl_01',
          to_pipeline_canonical_id: 'pl_01',
          actor_canonical_id: 'own_01',
          trigger: 'command',
        }),
      ).finish(),
    );
    expect(round.from_stage_canonical_id).toBe('st_qualified');
    expect(round.to_stage_canonical_id).toBe('st_negotiation');
    expect(round.actor_canonical_id).toBe('own_01');
  });

  it('DealClosed terminal_status is WON or LOST only', () => {
    const won = ns.DealClosed.decode(
      ns.DealClosed.encode(
        ns.DealClosed.create({
          deal: { ref: refOf('dl_01', 'v'), status: 2, qualification: 2 },
          terminal_status: 2,    // WON
          close_reason: 'price acceptable',
        }),
      ).finish(),
    );
    expect(won.terminal_status).toBe(2);

    const lost = ns.DealClosed.decode(
      ns.DealClosed.encode(
        ns.DealClosed.create({
          deal: { ref: refOf('dl_01', 'v'), status: 3 },
          terminal_status: 3,    // LOST
          close_reason: 'budget reallocation',
        }),
      ).finish(),
    );
    expect(lost.terminal_status).toBe(3);
  });

  it('ActivityCreated/Updated/Deleted round-trip', () => {
    const created = ns.ActivityCreated.decode(
      ns.ActivityCreated.encode(
        ns.ActivityCreated.create({
          activity: {
            ref: refOf('act_01', 'v'),
            type: 1,             // CALL
            subject: 'Follow-up call',
            outcome: 1,          // PLANNED
          },
        }),
      ).finish(),
    );
    expect(created.activity?.type).toBe(1);

    const updated = ns.ActivityUpdated.decode(
      ns.ActivityUpdated.encode(
        ns.ActivityUpdated.create({
          activity: { ref: refOf('act_01', 'v'), outcome: 2, is_completed: true },
          changed_fields: ['outcome', 'is_completed', 'completed_at'],
        }),
      ).finish(),
    );
    expect(updated.changed_fields).toContain('outcome');

    const deleted = ns.ActivityDeleted.decode(
      ns.ActivityDeleted.encode(
        ns.ActivityDeleted.create({ canonical_id: 'act_01', vendor_id: 'v' }),
      ).finish(),
    );
    expect(deleted.canonical_id).toBe('act_01');
  });

  it('NoteCreated/Deleted round-trip', () => {
    const created = ns.NoteCreated.decode(
      ns.NoteCreated.encode(
        ns.NoteCreated.create({
          note: {
            ref: refOf('nt_01', 'v'),
            content: 'Customer feedback',
            parent: { entity_type: 'deal', canonical_id: 'dl_01' },
          },
        }),
      ).finish(),
    );
    expect(created.note?.parent?.entity_type).toBe('deal');

    const deleted = ns.NoteDeleted.decode(
      ns.NoteDeleted.encode(
        ns.NoteDeleted.create({ canonical_id: 'nt_01', vendor_id: 'v' }),
      ).finish(),
    );
    expect(deleted.canonical_id).toBe('nt_01');
  });

  it('AssociationCreated embeds Association', () => {
    const round = ns.AssociationCreated.decode(
      ns.AssociationCreated.encode(
        ns.AssociationCreated.create({
          association: {
            ref: refOf('as_01', 'v', 'module-crm-hubspot'),
            from: { entity_type: 'contact', canonical_id: 'cnt_01' },
            to: { entity_type: 'deal', canonical_id: 'dl_01' },
            category: 1,
            label: 'BILLING_CONTACT',
          },
          trigger: 'command',
        }),
      ).finish(),
    );
    expect(round.association?.label).toBe('BILLING_CONTACT');
  });

  it('AssociationDeleted carries from/to + label for replay-resolution', () => {
    const round = ns.AssociationDeleted.decode(
      ns.AssociationDeleted.encode(
        ns.AssociationDeleted.create({
          canonical_id: 'as_01',
          vendor_id: 'v',
          from: { entity_type: 'contact', canonical_id: 'cnt_01' },
          to: { entity_type: 'deal', canonical_id: 'dl_01' },
          label: 'BILLING_CONTACT',
        }),
      ).finish(),
    );
    expect(round.from?.canonical_id).toBe('cnt_01');
    expect(round.label).toBe('BILLING_CONTACT');
  });

  it('AsyncJobSubmitted embeds AsyncJob + type', () => {
    const round = ns.AsyncJobSubmitted.decode(
      ns.AsyncJobSubmitted.encode(
        ns.AsyncJobSubmitted.create({
          job: { ref: refOf('job_01', 'v'), type: 1, status: 1 },
          type: 1,
        }),
      ).finish(),
    );
    expect(round.type).toBe(1);
  });

  it('AsyncJobStatusChanged carries previous_status + new_status + progress', () => {
    const round = ns.AsyncJobStatusChanged.decode(
      ns.AsyncJobStatusChanged.encode(
        ns.AsyncJobStatusChanged.create({
          canonical_id: 'job_01',
          type: 1,
          previous_status: 1,    // QUEUED
          new_status: 2,         // RUNNING
          progress_percentage: 35,
        }),
      ).finish(),
    );
    expect(round.previous_status).toBe(1);
    expect(round.new_status).toBe(2);
    expect(round.progress_percentage).toBe(35);
  });

  it('AsyncJobCompleted embeds AsyncJob with result_uri', () => {
    const round = ns.AsyncJobCompleted.decode(
      ns.AsyncJobCompleted.encode(
        ns.AsyncJobCompleted.create({
          job: {
            ref: refOf('job_01', 'v'),
            type: 1,
            status: 3,
            progress_percentage: 100,
            result_uri: 'https://files.example.com/sync/job_01.jsonl',
          },
        }),
      ).finish(),
    );
    expect(round.job?.status).toBe(3);
    expect(round.job?.result_uri).toContain('job_01.jsonl');
  });

  it('AsyncJobFailed carries error_code (CRM_VENDOR_*) + error_message', () => {
    const round = ns.AsyncJobFailed.decode(
      ns.AsyncJobFailed.encode(
        ns.AsyncJobFailed.create({
          job: { ref: refOf('job_01', 'v'), type: 1, status: 4 },
          error_code: 'CRM_VENDOR_DAILY_QUOTA_EXCEEDED',
          error_message: 'Bitrix24 daily portal quota exceeded',
        }),
      ).finish(),
    );
    expect(round.error_code).toBe('CRM_VENDOR_DAILY_QUOTA_EXCEEDED');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm -F @rntme/contracts-crm-v1 run test`
Expected: all tests pass — entities + helpers + 21-event coverage.

- [ ] **Step 3: Commit**

```bash
git add packages/contracts/crm/v1/test/events.test.ts
git commit -m "test(contracts-crm-v1): round-trip 21 events"
```

---

## Task 11: Error-codes lint test + service-shape drift test

**Files:**
- Create: `packages/contracts/crm/v1/test/error-codes.test.ts`
- Create: `packages/contracts/crm/v1/test/service-shape.test.ts`

- [ ] **Step 1: Write `test/error-codes.test.ts`**

Create `packages/contracts/crm/v1/test/error-codes.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { errorCodes, isErrorCode, layerOf, type ErrorCode } from '../src/error-codes.js';

const PATTERN = /^CRM_(STRUCTURAL|REFERENCES|CONSISTENCY|VENDOR)_[A-Z_]+$/;

describe('error-codes.json', () => {
  it('every code matches CRM_<LAYER>_<KIND>', () => {
    for (const layer of ['structural', 'references', 'consistency', 'vendor'] as const) {
      for (const code of errorCodes[layer]) {
        expect(code, `code ${code} does not match pattern`).toMatch(PATTERN);
      }
    }
  });

  it('has expected counts per layer (32 codes total)', () => {
    expect(errorCodes.structural).toHaveLength(7);
    expect(errorCodes.references).toHaveLength(10);
    expect(errorCodes.consistency).toHaveLength(10);
    expect(errorCodes.vendor).toHaveLength(5);
  });

  it('layer prefix matches layer key', () => {
    for (const code of errorCodes.structural) expect(code).toMatch(/^CRM_STRUCTURAL_/);
    for (const code of errorCodes.references) expect(code).toMatch(/^CRM_REFERENCES_/);
    for (const code of errorCodes.consistency) expect(code).toMatch(/^CRM_CONSISTENCY_/);
    for (const code of errorCodes.vendor) expect(code).toMatch(/^CRM_VENDOR_/);
  });

  it('isErrorCode returns true for known codes', () => {
    expect(isErrorCode('CRM_VENDOR_RATE_LIMITED')).toBe(true);
    expect(isErrorCode('CRM_CONSISTENCY_LABELS_NOT_SUPPORTED')).toBe(true);
    expect(isErrorCode('NOT_A_CODE')).toBe(false);
  });

  it('layerOf returns the correct layer', () => {
    expect(layerOf('CRM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY' as ErrorCode)).toBe('structural');
    expect(layerOf('CRM_VENDOR_DAILY_QUOTA_EXCEEDED' as ErrorCode)).toBe('vendor');
    expect(layerOf('CRM_REFERENCES_DEAL_NOT_FOUND' as ErrorCode)).toBe('references');
    expect(layerOf('CRM_CONSISTENCY_STAGE_NOT_IN_PIPELINE' as ErrorCode)).toBe('consistency');
  });

  it('no duplicate codes across layers', () => {
    const all = [
      ...errorCodes.structural,
      ...errorCodes.references,
      ...errorCodes.consistency,
      ...errorCodes.vendor,
    ];
    const set = new Set(all);
    expect(set.size).toBe(all.length);
  });

  it('CRM_VENDOR_RATE_LIMITED is present (canonicalises Bitrix24 HTTP 200 + QUERY_LIMIT_EXCEEDED)', () => {
    expect(errorCodes.vendor).toContain('CRM_VENDOR_RATE_LIMITED');
    expect(errorCodes.vendor).toContain('CRM_VENDOR_DAILY_QUOTA_EXCEEDED');
  });

  it('CRM_CONSISTENCY_LABELS_NOT_SUPPORTED is present (capability-flag for non-HubSpot vendors)', () => {
    expect(errorCodes.consistency).toContain('CRM_CONSISTENCY_LABELS_NOT_SUPPORTED');
  });
});
```

- [ ] **Step 2: Write `test/service-shape.test.ts` (drift detector)**

Create `packages/contracts/crm/v1/test/service-shape.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { proto } from '../src/index.js';

const EXPECTED_RPCS = [
  // Queries: Contact (2)
  'GetContact',
  'ListContacts',
  // Queries: Company (2)
  'GetCompany',
  'ListCompanies',
  // Queries: Deal (2)
  'GetDeal',
  'ListDeals',
  // Queries: Activity (2)
  'GetActivity',
  'ListActivities',
  // Queries: Note (2)
  'GetNote',
  'ListNotes',
  // Queries: helpers (3)
  'ListPipelines',
  'ListCustomFieldDefinitions',
  'ListAssociations',
  // Commands: Contact (3)
  'CreateContact',
  'UpdateContact',
  'DeleteContact',
  // Commands: Company (3)
  'CreateCompany',
  'UpdateCompany',
  'DeleteCompany',
  // Commands: Deal (3)
  'CreateDeal',
  'UpdateDeal',
  'DeleteDeal',
  // Commands: Activity (3)
  'CreateActivity',
  'UpdateActivity',
  'DeleteActivity',
  // Commands: Note (2 — no UpdateNote in v1)
  'CreateNote',
  'DeleteNote',
  // Commands: Association (2)
  'CreateAssociation',
  'DeleteAssociation',
  // Sync (1)
  'SyncDelta',
  // AsyncJob (4)
  'SubmitJob',
  'GetJob',
  'CancelJob',
  'ListJobs',
] as const;

const EXPECTED_EVENTS = [
  // Contact (3)
  'ContactCreated',
  'ContactUpdated',
  'ContactDeleted',
  // Company (3)
  'CompanyCreated',
  'CompanyUpdated',
  'CompanyDeleted',
  // Deal (4)
  'DealCreated',
  'DealUpdated',
  'DealStageChanged',
  'DealClosed',
  // Activity (3)
  'ActivityCreated',
  'ActivityUpdated',
  'ActivityDeleted',
  // Note (2)
  'NoteCreated',
  'NoteDeleted',
  // Association (2)
  'AssociationCreated',
  'AssociationDeleted',
  // AsyncJob (4)
  'AsyncJobSubmitted',
  'AsyncJobStatusChanged',
  'AsyncJobCompleted',
  'AsyncJobFailed',
] as const;

describe('service CrmModule shape', () => {
  it('declares exactly 34 RPCs by canonical name', () => {
    const ns = proto.rntme.contracts.crm.v1 as Record<string, unknown>;
    const ServiceCtor = ns['CrmModule'] as { prototype: Record<string, unknown> };

    expect(ServiceCtor, 'CrmModule service descriptor missing').toBeDefined();
    const declaredMethods = Object.getOwnPropertyNames(ServiceCtor.prototype).filter((n) => n !== 'constructor');
    const expectedMethods = [...EXPECTED_RPCS].map((n) => n.charAt(0).toLowerCase() + n.slice(1)).sort();

    // pbjs lower-cases only the first letter of RPC method names by default:
    // GetContact -> getContact, ListCustomFieldDefinitions -> listCustomFieldDefinitions.
    expect(declaredMethods.sort()).toEqual(expectedMethods);
    expect(EXPECTED_RPCS.length).toBe(34);
  });

  it('every event short-name is exported as a Message constructor', () => {
    const ns = proto.rntme.contracts.crm.v1 as Record<string, unknown>;
    for (const evt of EXPECTED_EVENTS) {
      expect(ns[evt], `event message ${evt} missing from generated proto`).toBeDefined();
    }
    expect(EXPECTED_EVENTS.length).toBe(21);
  });

  it('every aggregate is exported as a Message constructor', () => {
    const ns = proto.rntme.contracts.crm.v1 as Record<string, unknown>;
    const expected = ['Contact', 'Company', 'Deal', 'Activity', 'Note', 'AsyncJob', 'SyncFullPayload'];
    for (const name of expected) {
      expect(ns[name], `aggregate ${name} missing`).toBeDefined();
    }
  });

  it('every helper message is exported', () => {
    const ns = proto.rntme.contracts.crm.v1 as Record<string, unknown>;
    for (const name of ['Pipeline', 'Stage', 'Owner', 'CustomFieldDefinition', 'Association', 'EntityRef']) {
      expect(ns[name], `helper ${name} missing`).toBeDefined();
    }
  });

  it('every request/response message pair is exported', () => {
    const ns = proto.rntme.contracts.crm.v1 as Record<string, unknown>;
    const expected = [
      // Get/List requests + List responses for 5 business aggregates
      'GetContactRequest', 'ListContactsRequest', 'ContactList',
      'GetCompanyRequest', 'ListCompaniesRequest', 'CompanyList',
      'GetDealRequest', 'ListDealsRequest', 'DealList',
      'GetActivityRequest', 'ListActivitiesRequest', 'ActivityList',
      'GetNoteRequest', 'ListNotesRequest', 'NoteList',
      // Helper queries
      'ListPipelinesRequest', 'PipelineList',
      'ListCustomFieldDefinitionsRequest', 'CustomFieldDefinitionList',
      'ListAssociationsRequest', 'AssociationList',
      // Command requests
      'CreateContactRequest', 'UpdateContactRequest', 'DeleteContactRequest',
      'CreateCompanyRequest', 'UpdateCompanyRequest', 'DeleteCompanyRequest',
      'CreateDealRequest', 'UpdateDealRequest', 'DeleteDealRequest',
      'CreateActivityRequest', 'UpdateActivityRequest', 'DeleteActivityRequest',
      'CreateNoteRequest', 'DeleteNoteRequest',
      'CreateAssociationRequest', 'DeleteAssociationRequest',
      // Sync
      'SyncDeltaRequest', 'SyncDeltaResponse', 'SyncDeltaItem',
      // AsyncJob
      'SubmitJobRequest', 'GetJobRequest', 'CancelJobRequest', 'ListJobsRequest', 'AsyncJobList',
    ];
    for (const name of expected) {
      expect(ns[name], `request/response ${name} missing`).toBeDefined();
    }
  });
});
```

This test is the drift detector: if anyone adds an RPC to `service CrmModule` without updating `EXPECTED_RPCS`, or adds an event message without updating `EXPECTED_EVENTS`, the test fails. Conformance plan 2 has a complementary drift test that asserts `EXPECTED_RPCS` matches the scenario filenames.

- [ ] **Step 3: Run tests**

Run: `pnpm -F @rntme/contracts-crm-v1 run test`
Expected: all tests pass (entities + helpers + events + error-codes + service-shape).

- [ ] **Step 4: Run lint and typecheck**

Run: `pnpm -F @rntme/contracts-crm-v1 run lint`
Expected: zero errors.

Run: `pnpm -F @rntme/contracts-crm-v1 run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/crm/v1/test/error-codes.test.ts packages/contracts/crm/v1/test/service-shape.test.ts
git commit -m "test(contracts-crm-v1): error-codes lint + service-shape drift detector"
```

---

## Task 12: Per-package README

**Files:**
- Create: `packages/contracts/crm/v1/README.md`

- [ ] **Step 1: Write the README**

Create `packages/contracts/crm/v1/README.md`:

```markdown
# `@rntme/contracts-crm-v1` — Canonical CRM contract v1

The protobuf shapes, generated TypeScript bindings, and error-code list for the CRM category. Every vendor module (`module-crm-bitrix24`, `module-crm-amocrm`, `module-crm-hubspot`, `module-crm-salesforce`, `module-crm-zoho`, `module-crm-pipedrive`, …) implements this contract.

## File map

```
packages/contracts/crm/v1/
├── proto/
│   ├── crm.proto                # service CrmModule, entities, enums, request/response
│   └── crm-events.proto          # 21 event payloads
├── scripts/
│   ├── gen.mjs                    # codegen driver (pbjs/pbts)
│   └── check-imports.mjs          # package self-import smoke test
├── src/
│   ├── proto.gen.{js,d.ts}       # generated bindings (committed)
│   ├── error-codes.ts             # typed re-export of error-codes.json
│   └── index.ts                   # barrel export
├── test/                          # vitest round-trip + drift tests
├── error-codes.json               # CRM_<LAYER>_<KIND> set
└── README.md
```

## Quick start

```typescript
import { proto, errorCodes, isErrorCode } from '@rntme/contracts-crm-v1';

const { Deal, CreateDealRequest, CrmModule, DealQualification } = proto.rntme.contracts.crm.v1;

const req = CreateDealRequest.create({
  context: {
    idempotency_key: 'req_01J',
    correlation_id: 'corr_01',
    actor_user_id: 'own_01',
    actor_type: 'user',
  },
  name: 'Acme Q4 contract',
  pipeline_canonical_id: 'pl_01',
  stage_canonical_id: 'st_qualified',
  qualification: DealQualification.DEAL_QUALIFICATION_QUALIFIED,
  amount: 50000,
  currency: 'USD',
  primary_contact_canonical_id: 'cnt_01',
  company_canonical_id: 'co_01',
});

// Encode for transport
const bytes = CreateDealRequest.encode(req).finish();

// Decode incoming response
const deal = Deal.decode(responseBytes);

if (isErrorCode(maybeCode)) {
  // ...
}
```

## API

### Aggregates (5 business + 1 helper)

- **`Contact`** — physical person; email/phone/name/title; primary `company_canonical_id`; tags; status.
- **`Company`** — legal entity; name/domain/industry/size/revenue; generic regulatory fields `tax_id`/`registration_id`/`tax_branch_id` (Bitrix24 INN/OGRN/KPP, others empty); parent-company hierarchy.
- **`Deal`** — opportunity; pipeline/stage; orthogonal `status` (OPEN/WON/LOST/DELETED) + `qualification` (UNQUALIFIED/QUALIFIED/DISQUALIFIED) — Lead/Deal Schism resolution.
- **`Activity`** — call/meeting/task/email; `linked_entities[]` M:N attachment; outcome state-machine.
- **`Note`** — text content with single `parent` EntityRef; immutable post-creation in v1 (no `UpdateNote` RPC).
- **`AsyncJob`** — helper aggregate for `SubmitJob`/`GetJob`/`CancelJob`/`ListJobs`. v1 carries only `SYNC_FULL` job type via `SyncFullPayload`.

### Helper messages

`Pipeline` (read-only), `Stage` (read-only, with `StageSemantic` OPEN/WON/LOST), `Owner` (CRM-local user reference, NOT `Identity.User`), `CustomFieldDefinition` (read-only schema descriptor), `Association` (labeled M:N edge, HubSpot v4-shape), `EntityRef` (cross-aggregate reference utility).

### Status enums (12)

`ContactStatus`, `CompanyStatus`, `DealStatus`, `DealQualification`, `ActivityType`, `ActivityOutcome`, `CustomFieldType`, `StageSemantic`, `AssociationCategory`, `AsyncJobType`, `AsyncJobStatus`, `SyncDeltaOp`. Status-like enums follow rntme convention: `<TYPE>_UNSPECIFIED = 0`, `<TYPE>_VENDOR_SPECIFIC = 100` where the vendor escape hatch applies. 1–99 reserved for canonical values.

### `service CrmModule` (34 RPCs)

| Group | RPCs |
|---|---|
| Queries: Contact (2) | `GetContact`, `ListContacts` |
| Queries: Company (2) | `GetCompany`, `ListCompanies` |
| Queries: Deal (2) | `GetDeal`, `ListDeals` |
| Queries: Activity (2) | `GetActivity`, `ListActivities` |
| Queries: Note (2) | `GetNote`, `ListNotes` |
| Queries: helpers (3) | `ListPipelines`, `ListCustomFieldDefinitions`, `ListAssociations` |
| Commands: Contact (3) | `CreateContact`, `UpdateContact`, `DeleteContact` |
| Commands: Company (3) | `CreateCompany`, `UpdateCompany`, `DeleteCompany` |
| Commands: Deal (3) | `CreateDeal`, `UpdateDeal`, `DeleteDeal` |
| Commands: Activity (3) | `CreateActivity`, `UpdateActivity`, `DeleteActivity` |
| Commands: Note (2) | `CreateNote`, `DeleteNote` |
| Commands: Association (2) | `CreateAssociation`, `DeleteAssociation` |
| Sync (1) | `SyncDelta` |
| AsyncJob (4) | `SubmitJob`, `GetJob`, `CancelJob`, `ListJobs` |

### Events (21)

CloudEvents `type: rntme.crm.v1.<MessageName>`. Topics: `rntme.crm.contact`, `rntme.crm.company`, `rntme.crm.deal`, `rntme.crm.activity`, `rntme.crm.note`, `rntme.crm.association`, `rntme.crm.async_job`. No `.v1` suffix per CLAUDE.md.

| Topic | Events |
|---|---|
| `contact` | ContactCreated, ContactUpdated, ContactDeleted |
| `company` | CompanyCreated, CompanyUpdated, CompanyDeleted |
| `deal` | DealCreated, DealUpdated, DealStageChanged, DealClosed |
| `activity` | ActivityCreated, ActivityUpdated, ActivityDeleted |
| `note` | NoteCreated, NoteDeleted |
| `association` | AssociationCreated, AssociationDeleted |
| `async_job` | AsyncJobSubmitted, AsyncJobStatusChanged, AsyncJobCompleted, AsyncJobFailed |

### Error codes

`error-codes.json` lists every `CRM_<LAYER>_<KIND>` constant. Layers: `structural`, `references`, `consistency`, `vendor`. See spec §10 for gRPC code mapping. Notable codes:

- **`CRM_VENDOR_RATE_LIMITED`** normalises both HTTP 429 and **Bitrix24's HTTP 200 + body `{"error":"QUERY_LIMIT_EXCEEDED"}`** quirk into a single canonical signal.
- **`CRM_VENDOR_DAILY_QUOTA_EXCEEDED`** is split from rate-limit because retry policies differ (seconds vs. hours/days).
- **`CRM_CONSISTENCY_LABELS_NOT_SUPPORTED`** — module declared `labeled_associations: false` and consumer passed `label != ""`.
- **`CRM_CONSISTENCY_STAGE_NOT_IN_PIPELINE`** — module enforces this before the upstream call (SF/HubSpot/Pipedrive don't validate server-side).

## Invariants & gotchas

- **No `UpdateNote` in v1.** Notes are de-facto immutable across most vendors (HubSpot, amoCRM lack Update). v1.minor adds it when concrete consumer surfaces.
- **No separate `MoveDealToStage` RPC.** Stage transitions ride through `UpdateDeal{stage_canonical_id, pipeline_canonical_id?}`. The high-signal `DealStageChanged` event still fires.
- **Lead/Deal Schism resolution via `Deal.qualification`.** UNQUALIFIED is what SF/Pipedrive call a "Lead"; QUALIFIED is what they call "Deal/Opportunity". amoCRM Lead → Deal{qualification=QUALIFIED}; amoCRM Contact → Contact{}.
- **`Company.tax_id`/`registration_id`/`tax_branch_id` are generic-named.** Russian INN/OGRN/KPP map to them via Bitrix24 `crm.requisite.*`. International modules leave them empty.
- **Idempotency required on every Command.** Missing `context.idempotency_key` → `CRM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY`. Most CRM vendors do not provide native idempotency; modules implement an internal dedup-store with at least 24h TTL.
- **`pipeline_canonical_id` on `UpdateDeal` is conditionally required** when changing `stage_canonical_id` to a stage in a different pipeline. Bitrix24 enforces this server-side via `crm.item.update`'s `categoryId`+`stageId`; modules for SF/HubSpot/Pipedrive validate locally before the upstream call.
- **`Association.vendor_id` is empty for label-emulating modules** (Bitrix24, amoCRM, Pipedrive). Module persists association in own state; `canonical_id` is module-generated UUID.
- **`Owner` is CRM-local** — not the Identity v1 `User` aggregate. Linkage is blueprint business logic.
- **`vendor_raw` is on upstream-backed records only.** `Contact`, `Company`, `Deal`, `Activity`, `Note`, `AsyncJob`, `Pipeline`, `CustomFieldDefinition`, and `Association` carry it. Pure utility/local helper messages (`Stage`, `Owner`, `EntityRef`) do not.

### Capability fields (`module.json#capabilities`)

This contract introduces eight capability fields. Until `module-manifest-validator` lands (modules-monorepo plan 1), these are documented here:

```json
{
  "capabilities": {
    "vendors": ["bitrix24"],                                       // string[], required, ≥1 entry
    "entities": ["contact", "company", "deal", "activity", "note"], // string[], subset of canonical 5
    "rpcs": ["GetContact", "CreateContact", ...],                  // string[], subset of EXPECTED_RPCS
    "events": ["ContactCreated", ...],                             // string[], subset of EXPECTED_EVENTS
    "search_tiers": ["simple"],                                    // string[], subset of {"simple","advanced","fulltext"}; v1 ships only "simple"
    "labeled_associations": false,                                  // boolean, false → CRM_CONSISTENCY_LABELS_NOT_SUPPORTED for label != ""
    "bulk_operations": { "max_size": 50 },                         // object, max_size hints at vendor batch cap (Bitrix24=50, HubSpot=100, etc.)
    "async_job_types": ["SYNC_FULL"],                              // string[], subset of declared AsyncJobType canonical values
    "webhook_format": "json",                                       // "json" | "urlencoded" — amoCRM is "urlencoded"
    "webhook_retry_policy": "none"                                  // "none" | "exponential_24h_10retries" | "..." — vendor-specific retry behaviour
  }
}
```

## Out of scope

- `Quote`, `Invoice`, `Product`/`LineItem` — separate `crm-quote/v1`, `crm-invoice/v1`, `crm-product/v1` categories.
- `Tag` as a managed aggregate — strings inside `tags[]` suffice for v1.
- `RoleAssignment` as a separate aggregate — roles ride inside `Association.label`.
- `MoveDealToStage` as a separate RPC — folded into `UpdateDeal`.
- `UpdateNote`, schema-mutating custom-field RPCs (`CreateCustomField`, …), `search.advanced`/`search.fulltext`, `IMPORT_BULK`/`EXPORT_FILTERED` AsyncJob types, streaming `SyncDelta` — added in v1.minor with concrete consumer demand.
- Multi-instance support (one module backing N tenant Bitrix24 portals) — `CommandContext.tenant_id` covers logical tenant routing; physical instance addressing is decided in first vendor brainstorm.

## Where to look first

- `proto/crm.proto` — start at `service CrmModule` to see the surface; aggregates above; helpers and enums at the top.
- `proto/crm-events.proto` — all 21 events.
- `error-codes.json` — error-code set.
- `test/service-shape.test.ts` — drift detector and authoritative list of canonical RPC + event short-names.

## Specs

- `docs/superpowers/specs/2026-04-27-crm-canonical-contract-design.md` — design.
- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` — directory layout, capability-based UNION conformance.
- `docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md` — sibling spec; defines `_common/v1/` reused here.
- `docs/superpowers/specs/2026-04-26-ai-llm-canonical-contract-design.md` — sibling spec; introduced AsyncJob pattern reused here.
- `docs/superpowers/plans/crm-canonical-contract/01-crm-contracts.md` — this plan.
- `docs/superpowers/plans/crm-canonical-contract/02-crm-conformance-skeleton.md` — companion plan for conformance package.
```

- [ ] **Step 2: Commit**

```bash
git add packages/contracts/crm/v1/README.md
git commit -m "docs(contracts-crm-v1): per-package README"
```

---

## Task 13: Documentation-touch — `AGENTS.md`

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Read current `AGENTS.md` §3 (layering) and find Identity / AI-LLM entries**

Run: `grep -n "packages/contracts/identity\|packages/contracts/ai-llm\|packages/contracts/_common" AGENTS.md`

You should see lines added by Identity plan 1 and AI/LLM plan 1. Identify the section and the form of the entries.

- [ ] **Step 2: Add `packages/contracts/crm/v1/` entry under §3**

Insert next to existing contracts-package entries (alphabetical inside the contracts subsection). The line should mirror Identity / AI-LLM wording. Locate the existing entries — they likely read something like:

```
- packages/contracts/_common/v1/      — shared cross-category primitives (CanonicalRef, CommandContext, Name, ListRequest, Metadata)
- packages/contracts/ai-llm/v1/       — canonical AI/LLM contract (Completion, AssistantThread, AsyncJob; 16 events)
- packages/contracts/identity/v1/     — canonical Identity contract (User, Organization, Membership, Invitation, Session)
```

Add after AI/LLM (alphabetical: `ai-llm` < `crm` < `identity`):

```
- packages/contracts/crm/v1/          — canonical CRM contract (Contact, Company, Deal, Activity, Note, AsyncJob; 21 events; labeled associations)
```

- [ ] **Step 3: Add glossary entries to §10**

Locate §10 (glossary). Insert these entries in alphabetical order; preserve existing identity / ai-llm specific terms inserted by sibling plans:

```markdown
- **canonical CRM contract** — `@rntme/contracts-crm-v1`: service `CrmModule`, 5 business aggregates (Contact / Company / Deal / Activity / Note) + 1 helper aggregate (AsyncJob), 21 events. The wrapper protocol every CRM vendor module implements.

- **CRM helper aggregate (AsyncJob)** — `AsyncJob` aggregate inside `crm/v1` carrying long-running operations (currently only `SYNC_FULL`). `SubmitJob.body` is a `oneof` so future `IMPORT_BULK` / `EXPORT_FILTERED` job types add non-breaking. Pattern shared with `ai-llm/v1` AsyncJob (where the variant is `BATCH_COMPLETION`).

- **Custom Field FieldMapping** — module-internal table mapping canonical `logical_name` to vendor-specific raw key (Pipedrive 40-char hash, Bitrix24 `UF_CRM_*`, Salesforce `__c`). Populated at connect time via vendor schema introspection. Consumers never see vendor keys in the data-plane; `ListCustomFieldDefinitions` exposes the mapping for UI form generation only.

- **labeled association capability** — `module.json#capabilities.labeled_associations: bool` flag. `true` → module supports `Association.label` (HubSpot, Salesforce junction-objects, Zoho Contact Roles). `false` → passing `label != ""` to `CreateAssociation` returns `CRM_CONSISTENCY_LABELS_NOT_SUPPORTED`. The contract preserves the canonical edge while leaking the capability gap explicitly to the consumer.

- **Lead/Deal Schism resolution** — `Deal.qualification` enum (UNQUALIFIED / QUALIFIED / DISQUALIFIED) encodes what SF/HubSpot/Zoho/Pipedrive call "Lead" vs "Deal/Opportunity" without introducing a separate `Prospect` aggregate. amoCRM's vendor-Lead → canonical `Deal{qualification=QUALIFIED}`; amoCRM Contact → canonical `Contact{}`. Resolves the most cited cross-vendor semantic clash in CRM canonisation.

- **SyncDelta watermark** — monotonic timestamp returned by `SyncDelta` that the consumer passes back as the next `since` to drive incremental reconciliation. Closes the gap left by Bitrix24's zero-retry webhook delivery; valid pull-mode recovery for any vendor.
```

- [ ] **Step 4: Confirm or add the "Add a category contract package" how-to (§6)**

Run: `grep -n "Add a category contract\|6.17 Add" AGENTS.md`

If AI/LLM plan 1 task 13 added §6.17 "Add a category contract package", verify it remains category-agnostic. The recipe should generalize to CRM. If it has Identity- or AI/LLM-specific assumptions, replace with category-agnostic wording. If no such how-to exists, add one (using the AI/LLM plan 1 task 13 step 4 template, with reference to this CRM plan as the third example).

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "docs(AGENTS): layering + glossary entries for crm contract"
```

---

## Task 14: Documentation-touch — root `README.md` packages table

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Locate the packages table**

Run: `grep -n "@rntme/contracts-identity-v1\|@rntme/contracts-common-v1\|@rntme/contracts-ai-llm-v1\|## Packages\|## Workspace packages" README.md`

You should see entries added by Identity plan 1 and AI/LLM plan 1.

- [ ] **Step 2: Append the CRM contract package row**

Add a row matching the table format used by Identity / AI-LLM. The row should look like (adjust columns to match the existing schema):

```markdown
| `@rntme/contracts-crm-v1` | Canonical CRM contract (Contact, Company, Deal, Activity, Note, AsyncJob; 21 events; labeled associations) |
```

If the table has more columns (e.g. `Stage`, `Owner`), match exactly what Identity's row uses.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(README): list @rntme/contracts-crm-v1 in packages table"
```

---

## Task 15: Final cross-package verification

**Files:** none (verification only).

- [ ] **Step 1: Run full workspace build**

Run: `pnpm -r run build`
Expected: every package builds, including `@rntme/contracts-crm-v1`.

- [ ] **Step 2: Run full workspace tests**

Run: `pnpm -r run test`
Expected: every test passes. CRM has ~75 test cases (8 aggregate + 12 enum + 7 helper + 18 event + 7 error-code + 5 service-shape).

- [ ] **Step 3: Run full workspace lint**

Run: `pnpm -r run lint`
Expected: zero errors.

- [ ] **Step 4: Run full workspace typecheck**

Run: `pnpm -r run typecheck`
Expected: zero errors.

- [ ] **Step 5: Run package import smoke test**

Run after `build` has emitted `dist/`:
```bash
node packages/contracts/crm/v1/scripts/check-imports.mjs
```
Expected: prints `encoded deal bytes: <positive number>` and `error code count: 32`.

- [ ] **Step 6: Confirm Identity / AI-LLM packages not touched**

Run:
```bash
git diff --name-only origin/main...HEAD -- packages/contracts/identity/v1/ packages/contracts/_common/v1/ packages/contracts/ai-llm/v1/
```
Expected: no output (no commits in this plan touched Identity v1, `_common/v1/`, or `ai-llm/v1/`).

- [ ] **Step 7: Confirm spec coverage**

Run a quick mental cross-check against `docs/superpowers/specs/2026-04-27-crm-canonical-contract-design.md`:
- §4 layout — `packages/contracts/crm/v1/` exists with the right structure ✓
- §5 status enums — 12 enums in proto, tested ✓
- §6 helper messages — 6 helper messages in proto, tested ✓
- §7 aggregates — 5 business + 1 helper (AsyncJob) + SyncFullPayload, tested ✓
- §8 service — 34 RPCs in service, drift-tested; request/response messages exported ✓
- §9 events — 21 event payloads, tested ✓
- §10 error codes — 32 codes in JSON, lint-tested ✓
- §13 dependencies — package depends on `@rntme/contracts-common-v1` (workspace:*) ✓

- [ ] **Step 8: Final commit (if any leftover staging)**

If `git status` is clean, no commit needed. Otherwise:

```bash
git add -A
git commit -m "chore(contracts-crm-v1): final cross-package verification"
```

---

## Self-review checklist

Run this checklist after the last task and before closing the PR:

1. **Spec coverage:** Every section §4–§10 in the spec has a corresponding task above. Confirmed in Task 15 step 7.
2. **Unresolved-marker scan:** Search the plan body for common unfinished-work markers and unresolved template syntax. The only acceptable occurrence of the word `placeholder` is this self-review instruction.
3. **Type consistency:** RPC names in Task 5 match `EXPECTED_RPCS` in Task 11; event names in Task 6 match `EXPECTED_EVENTS` in Task 11; error codes in Task 8 match the count assertions in Task 11; `DealQualification` / `DealStatus` orthogonality preserved across Tasks 4, 5, 9, 10.
4. **Cross-task naming:** `proto.rntme.contracts.crm.v1` namespace used uniformly across Tasks 7, 9, 10, 11. `@rntme/contracts-crm-v1` package name uniform across Tasks 1, 2, 7, 12. `module-crm-<vendor>` naming convention used uniformly in fixtures and README examples.

If any check fails: fix inline, re-run the affected task's tests.
