# Identity Canonical Contract v1 — Plan 2: `modules/identity/conformance/` Skeleton Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land `modules/identity/README.md` (category-doc) and `modules/identity/conformance/` (workspace package `@rntme/conformance-identity`) — the per-category conformance scaffolding required by `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` §7. The package ships a minimal local `Scenario` type stub (until `@rntme/conformance-framework` lands), 24 scenario stub files (one per canonical RPC), fixtures stubs, a `suite.ts` exporting `CategoryConformanceSuite`, and a drift-detection test that fails when any canonical RPC lacks a matching scenarios file.

**Architecture:** New `modules/` top-level directory (workspace glob extension). Inside, `modules/identity/conformance/` is a workspace package depending on `@rntme/contracts-identity-v1`. The package exports stubs only — every scenario file ships an empty `Scenario[]` array plus a docstring pointing at the spec section that lists the assertions each scenario must cover when the framework lands. The drift-detection test parses `IdentityModule` from the contract package's generated proto and asserts a 1:1 file match against `src/scenarios/`. This guarantees that any future RPC addition to the contract is paired with a scenarios file, in the same PR, per modules-monorepo §7.2.

**Tech Stack:** Same as Plan 1 — TypeScript 5.5, vitest, eslint flat config, pnpm 9.12+ workspaces.

**Spec reference:** `docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md` §9 (conformance suite). Modules-monorepo `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` §7 (conformance suite layout, authorship rule, anti-conformance, capability-coverage report).

**Depends on:** Plan 1 must be merged first — `@rntme/contracts-identity-v1` must exist as a workspace package and its generated proto must export `IdentityModule` so the drift-detection test can introspect it.

---

## File Structure

Files this plan creates or modifies:

**Created**
- `modules/identity/README.md`
- `modules/identity/conformance/package.json`
- `modules/identity/conformance/tsconfig.json`
- `modules/identity/conformance/tsconfig.check.json`
- `modules/identity/conformance/eslint.config.mjs`
- `modules/identity/conformance/README.md`
- `modules/identity/conformance/src/types.ts` (local `Scenario` / `CategoryConformanceSuite` stub)
- `modules/identity/conformance/src/index.ts`
- `modules/identity/conformance/src/suite.ts`
- `modules/identity/conformance/src/fixtures/users.ts`
- `modules/identity/conformance/src/fixtures/organizations.ts`
- `modules/identity/conformance/src/fixtures/invitations.ts`
- `modules/identity/conformance/src/scenarios/<RPC>.scenarios.ts` × 24 files
- `modules/identity/conformance/test/drift.test.ts`
- `modules/identity/conformance/test/suite-shape.test.ts`

**Modified**
- `pnpm-workspace.yaml` — add `modules/*/*` glob.
- `AGENTS.md` — §3 add modules-tree note; §6 how-to "Add an Identity vendor module" stub pointer.
- `README.md` — packages table: append `@rntme/conformance-identity`.

---

## Task 1: Workspace bootstrap — extend globs, create `modules/` tree

**Files:**
- Modify: `pnpm-workspace.yaml`
- Create: `modules/identity/conformance/.gitkeep`

- [ ] **Step 1: Extend `pnpm-workspace.yaml`**

Open `pnpm-workspace.yaml`. After Plan 1 it reads:

```yaml
packages:
  - "packages/*"
  - "packages/contracts/*/v*"
  - "demo/*"
  - "rntme-cli/packages/*"
```

Insert `- "modules/*/*"` between `packages/contracts/*/v*` and `demo/*`:

```yaml
packages:
  - "packages/*"
  - "packages/contracts/*/v*"
  - "modules/*/*"
  - "demo/*"
  - "rntme-cli/packages/*"
```

The `modules/*/*` glob matches `modules/identity/conformance` (this plan) and future vendor packages like `modules/identity/clerk`, `modules/payments/stripe`, etc. Two-level depth is the published convention in modules-monorepo §5.1.

- [ ] **Step 2: Create the directory tree**

Run:
```bash
mkdir -p modules/identity/conformance
touch modules/identity/conformance/.gitkeep
```

(`modules/identity/` itself does not get a `package.json` — it is a category container. Only `modules/identity/conformance/` and future vendor subdirs are workspace packages.)

- [ ] **Step 3: Verify pnpm still installs cleanly**

Run: `pnpm install --frozen-lockfile=false`
Expected: install succeeds. The empty `modules/identity/conformance` directory has no `package.json` yet, so pnpm does not list it as a workspace package — fine for now.

- [ ] **Step 4: Commit**

```bash
git add pnpm-workspace.yaml modules/identity/conformance/.gitkeep
git commit -m "chore: extend pnpm workspace to modules/*/*"
```

---

## Task 2: Category README at `modules/identity/README.md`

**Files:**
- Create: `modules/identity/README.md`

- [ ] **Step 1: Write the category README**

Create `modules/identity/README.md`:

```markdown
# Identity category — module contributor entry point

This directory hosts vendor implementations of the Identity canonical contract `@rntme/contracts-identity-v1`. Each vendor lives at `modules/identity/<vendor>/` and ships:

- A handler implementation against the `IdentityModule` gRPC service.
- A webhook receiver that verifies signatures, dedupes, and emits canonical CloudEvents.
- A `module.json` manifest declaring `capabilities[]`.
- Conformance scenarios passing under both mock-vendor and live-sandbox modes.

The shared conformance suite lives at `modules/identity/conformance/` and is consumed by every vendor module via `pnpm test:conformance:mock` and `pnpm test:conformance:live`.

## Canonical contract

Vendor modules implement `@rntme/contracts-identity-v1`. The contract is the source of truth for:

- The `service IdentityModule` gRPC surface (24 RPCs).
- The seventeen canonical CloudEvents payloads.
- The `IDENTITY_<LAYER>_<KIND>` error-code catalogue.
- The three-level metadata model and status enums.

Read the contract's README first: [`packages/contracts/identity/v1/README.md`](../../packages/contracts/identity/v1/README.md). Then read the contract spec: [`docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md`](../../docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md).

## Capability claims

A module declares which canonical RPCs and events it supports via `module.json#capabilities[]`. The runtime blueprint validator checks that every domain blueprint's used RPC/event subset is covered by the module's claims; missing coverage rejects the blueprint with `BLUEPRINT_CAPABILITY_MISSING`.

A recommended Tier-1 baseline (not enforced — capabilities are UNION) is:

- RPCs: `GetUser`, `ListUsers`, `CreateUser`, `UpdateUser`, `DeleteUser`, `IntrospectSession`, `RevokeSession`, `ResolveIdentity`.
- Events: `UserCreated`, `UserUpdated`, `UserDeleted`, `SessionCreated`, `SessionRevoked`.

Modules below this baseline are technically valid but rarely useful in practice. Module authors are expected to be explicit about why they fall short, in the module's README.

## Vendors not yet shipped

The first concrete Identity vendor module (Clerk, Auth0, or WorkOS — TBD) ships in a subsequent spec. This category currently contains the conformance scaffolding only.

## Where to look first

- Canonical contract: [`packages/contracts/identity/v1/`](../../packages/contracts/identity/v1).
- Conformance suite: [`./conformance/`](./conformance).
- Modules-monorepo spec: [`docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md`](../../docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md) §7 covers the conformance framework split.
- Module pattern (wrapper, no choreography): [`docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md`](../../docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md).
```

- [ ] **Step 2: Commit**

```bash
git add modules/identity/README.md
git commit -m "docs(modules/identity): category contributor entry point"
```

---

## Task 3: `@rntme/conformance-identity` package skeleton

**Files:**
- Create: `modules/identity/conformance/package.json`
- Create: `modules/identity/conformance/tsconfig.json`
- Create: `modules/identity/conformance/tsconfig.check.json`
- Create: `modules/identity/conformance/eslint.config.mjs`
- Delete: `modules/identity/conformance/.gitkeep`

- [ ] **Step 1: Write `package.json`**

Create `modules/identity/conformance/package.json`:

```json
{
  "name": "@rntme/conformance-identity",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Per-RPC conformance scenarios for the Identity canonical contract. Consumed by every Identity-category vendor module.",
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
    "@rntme/contracts-identity-v1": "workspace:*",
    "@rntme/contracts-common-v1": "workspace:*"
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

- [ ] **Step 2: Write `tsconfig.json` and `tsconfig.check.json`**

Create `modules/identity/conformance/tsconfig.json`:

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

Create `modules/identity/conformance/tsconfig.check.json`:

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

- [ ] **Step 3: Write `eslint.config.mjs`**

Create `modules/identity/conformance/eslint.config.mjs`:

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

- [ ] **Step 4: Remove `.gitkeep` and run install**

Run:
```bash
rm modules/identity/conformance/.gitkeep
pnpm install --frozen-lockfile=false
```

Expected: `@rntme/conformance-identity` shows in `pnpm list -r --depth -1`. Workspace deps resolve.

- [ ] **Step 5: Commit**

```bash
git add pnpm-lock.yaml modules/identity/conformance
git commit -m "feat(conformance-identity): scaffold package"
```

---

## Task 4: Local `Scenario` and `CategoryConformanceSuite` type stub

**Files:**
- Create: `modules/identity/conformance/src/types.ts`

The shared `@rntme/conformance-framework` is slated for modules-monorepo plan 1, which has not yet shipped. To keep this plan unblocked, define a minimal local stub of the types this package exports. When the framework lands, this stub is removed and the imports rewrite to the framework — see modules-monorepo §7.1 for the canonical types.

- [ ] **Step 1: Write the stub**

Create `modules/identity/conformance/src/types.ts`:

```typescript
/**
 * Local stub of the contracts that @rntme/conformance-framework will
 * publish. Replace these with imports from the framework once it lands.
 *
 * Source-of-truth shape: docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md §7.
 */

export type ScenarioStatus =
  | 'pending'        // scaffold only; not yet implementable
  | 'mock_only'      // runs against generic mock-vendor
  | 'live_only'      // requires vendor sandbox secrets
  | 'mock_and_live'; // covers both

export interface ScenarioContext {
  readonly idempotencyKey: string;
  readonly correlationId: string;
}

export interface Scenario {
  /** Unique within its scenarios file. Convention: `{rpc}_{shortName}`. */
  readonly id: string;
  /** Human-readable purpose. */
  readonly description: string;
  /** When this scenario can run. */
  readonly status: ScenarioStatus;
  /** Pre-condition seed for the vendor (mock or live). */
  readonly seed?: () => Promise<void> | void;
  /** Action under test. */
  readonly action: (ctx: ScenarioContext) => Promise<unknown> | unknown;
  /** Assertions over the action's result. */
  readonly assertions: ReadonlyArray<(result: unknown, ctx: ScenarioContext) => Promise<void> | void>;
}

export interface CategoryConformanceSuite {
  readonly category: 'identity';
  readonly contractVersion: 'v1';
  readonly scenariosByRpc: Readonly<Record<string, ReadonlyArray<Scenario>>>;
}

/**
 * Marker for stub scenarios that must be filled before the package
 * declares conformance against any real vendor. The runner from the
 * future framework reports these as `pending`.
 */
export const UNIMPLEMENTED_SCENARIO_STATUS: ScenarioStatus = 'pending';
```

- [ ] **Step 2: Commit**

```bash
git add modules/identity/conformance/src/types.ts
git commit -m "feat(conformance-identity): local Scenario / CategoryConformanceSuite stub"
```

---

## Task 5: Fixtures stubs

**Files:**
- Create: `modules/identity/conformance/src/fixtures/users.ts`
- Create: `modules/identity/conformance/src/fixtures/organizations.ts`
- Create: `modules/identity/conformance/src/fixtures/invitations.ts`
- Create: `modules/identity/conformance/src/fixtures/index.ts`

Fixtures are the canonical seed objects scenarios reference. They live as proto-shaped plain objects, so any vendor adapter can map them onto its own seeding API.

- [ ] **Step 1: Write `fixtures/users.ts`**

Create `modules/identity/conformance/src/fixtures/users.ts`:

```typescript
import { proto } from '@rntme/contracts-identity-v1';
const id = proto.rntme.contracts.identity.v1;
const common = proto.rntme.contracts.common.v1;

function ref(canonicalId: string, vendorId: string): typeof common.CanonicalRef.prototype {
  return common.CanonicalRef.create({
    canonical_id: canonicalId,
    vendor_id: vendorId,
    module_name: 'identity-fixture',
    module_version: '0.0.0',
    contract_version: 'v1',
  });
}

export const fixtureUsers = {
  ada: id.User.create({
    ref: ref('user-ada', 'fixt_user_ada'),
    email: 'ada@example.com',
    email_verified: true,
    name: common.Name.create({ given: 'Ada', family: 'Lovelace', display: 'Ada Lovelace' }),
    status: id.UserStatus.USER_STATUS_ACTIVE,
  }),
  bob: id.User.create({
    ref: ref('user-bob', 'fixt_user_bob'),
    email: 'bob@example.com',
    email_verified: false,
    status: id.UserStatus.USER_STATUS_PENDING,
  }),
} as const;
```

- [ ] **Step 2: Write `fixtures/organizations.ts`**

Create `modules/identity/conformance/src/fixtures/organizations.ts`:

```typescript
import { proto } from '@rntme/contracts-identity-v1';
const id = proto.rntme.contracts.identity.v1;
const common = proto.rntme.contracts.common.v1;

function ref(canonicalId: string, vendorId: string): typeof common.CanonicalRef.prototype {
  return common.CanonicalRef.create({
    canonical_id: canonicalId,
    vendor_id: vendorId,
    module_name: 'identity-fixture',
    module_version: '0.0.0',
    contract_version: 'v1',
  });
}

export const fixtureOrganizations = {
  acme: id.Organization.create({
    ref: ref('org-acme', 'fixt_org_acme'),
    name: 'Acme',
    slug: 'acme',
    max_members: 50,
    status: id.OrgStatus.ORG_STATUS_ACTIVE,
  }),
  initech: id.Organization.create({
    ref: ref('org-initech', 'fixt_org_initech'),
    name: 'Initech',
    slug: 'initech',
    max_members: 0,
    status: id.OrgStatus.ORG_STATUS_ACTIVE,
  }),
} as const;
```

- [ ] **Step 3: Write `fixtures/invitations.ts`**

Create `modules/identity/conformance/src/fixtures/invitations.ts`:

```typescript
import { proto } from '@rntme/contracts-identity-v1';
const id = proto.rntme.contracts.identity.v1;
const common = proto.rntme.contracts.common.v1;

function ref(canonicalId: string, vendorId: string): typeof common.CanonicalRef.prototype {
  return common.CanonicalRef.create({
    canonical_id: canonicalId,
    vendor_id: vendorId,
    module_name: 'identity-fixture',
    module_version: '0.0.0',
    contract_version: 'v1',
  });
}

export const fixtureInvitations = {
  pendingForAcme: id.Invitation.create({
    ref: ref('inv-1', 'fixt_inv_1'),
    email: 'newcomer@example.com',
    organization_id: 'org-acme',
    inviter_user_id: 'user-ada',
    roles: ['member'],
    status: id.InvitationStatus.INVITATION_STATUS_PENDING,
  }),
} as const;
```

- [ ] **Step 4: Write `fixtures/index.ts`**

Create `modules/identity/conformance/src/fixtures/index.ts`:

```typescript
export { fixtureUsers } from './users.js';
export { fixtureOrganizations } from './organizations.js';
export { fixtureInvitations } from './invitations.js';
```

- [ ] **Step 5: Verify typecheck passes**

Run: `pnpm -F @rntme/conformance-identity run typecheck`
Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add modules/identity/conformance/src/fixtures
git commit -m "feat(conformance-identity): canonical seed fixtures (users/orgs/invitations)"
```

---

## Task 6: Twenty-four scenario stub files

**Files:**
- Create: `modules/identity/conformance/src/scenarios/<RPC>.scenarios.ts` × 24

The exact filename per RPC — drift-detection (Task 8) asserts a 1:1 match.

| Filename | RPC |
|---|---|
| `GetUser.scenarios.ts` | GetUser |
| `ListUsers.scenarios.ts` | ListUsers |
| `GetOrganization.scenarios.ts` | GetOrganization |
| `ListOrganizations.scenarios.ts` | ListOrganizations |
| `GetMembership.scenarios.ts` | GetMembership |
| `ListMemberships.scenarios.ts` | ListMemberships |
| `GetInvitation.scenarios.ts` | GetInvitation |
| `ListInvitations.scenarios.ts` | ListInvitations |
| `GetSession.scenarios.ts` | GetSession |
| `ListSessions.scenarios.ts` | ListSessions |
| `ResolveIdentity.scenarios.ts` | ResolveIdentity |
| `IntrospectSession.scenarios.ts` | IntrospectSession |
| `CreateUser.scenarios.ts` | CreateUser |
| `UpdateUser.scenarios.ts` | UpdateUser |
| `DeleteUser.scenarios.ts` | DeleteUser |
| `CreateOrganization.scenarios.ts` | CreateOrganization |
| `UpdateOrganization.scenarios.ts` | UpdateOrganization |
| `DeleteOrganization.scenarios.ts` | DeleteOrganization |
| `CreateInvitation.scenarios.ts` | CreateInvitation |
| `RevokeInvitation.scenarios.ts` | RevokeInvitation |
| `AddMembership.scenarios.ts` | AddMembership |
| `UpdateMembership.scenarios.ts` | UpdateMembership |
| `RemoveMembership.scenarios.ts` | RemoveMembership |
| `RevokeSession.scenarios.ts` | RevokeSession |

- [ ] **Step 1: Write the first stub by hand to lock the format**

Create `modules/identity/conformance/src/scenarios/GetUser.scenarios.ts`:

```typescript
import type { Scenario } from '../types.js';

/**
 * Conformance scenarios for `IdentityModule.GetUser`.
 *
 * Stubs only — fill when @rntme/conformance-framework lands. Each
 * scenario should cover at minimum:
 *   - happy path: seeded user is returned with full ref + email + status
 *   - canonical_id miss: returns IDENTITY_REFERENCES_USER_NOT_FOUND
 *   - soft-deleted user: returned with status = USER_STATUS_DELETED and deleted_at set
 *
 * See spec docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md §9.2.
 */
export const scenarios: ReadonlyArray<Scenario> = [];
```

- [ ] **Step 2: Generate the remaining 23 stubs via a one-off script**

Write a one-off generator at the repo root, run it, then delete it. Create `/tmp/gen-scenario-stubs.mjs`:

```javascript
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const dir = resolve(process.cwd(), 'modules/identity/conformance/src/scenarios');
mkdirSync(dir, { recursive: true });

const rpcs = [
  ['ListUsers', ''],
  ['GetOrganization', ''],
  ['ListOrganizations', ''],
  ['GetMembership', ''],
  ['ListMemberships', ''],
  ['GetInvitation', ''],
  ['ListInvitations', ''],
  ['GetSession', ''],
  ['ListSessions', ''],
  ['ResolveIdentity', ''],
  ['IntrospectSession', ''],
  ['CreateUser', ''],
  ['UpdateUser', ''],
  ['DeleteUser', ''],
  ['CreateOrganization', ''],
  ['UpdateOrganization', ''],
  ['DeleteOrganization', ''],
  ['CreateInvitation', ''],
  ['RevokeInvitation', ''],
  ['AddMembership', ''],
  ['UpdateMembership', ''],
  ['RemoveMembership', ''],
  ['RevokeSession', ''],
];

const template = (rpc) => `import type { Scenario } from '../types.js';

/**
 * Conformance scenarios for \`IdentityModule.${rpc}\`.
 *
 * Stubs only — fill when @rntme/conformance-framework lands. Each
 * scenario asserts shape match against canonical proto, idempotent replay
 * with the same idempotency_key, expected error code on negative branches,
 * and (for command RPCs) expected CloudEvents \`type\` published within 5s.
 *
 * See spec docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md §9.2.
 */
export const scenarios: ReadonlyArray<Scenario> = [];
`;

for (const [rpc] of rpcs) {
  writeFileSync(resolve(dir, `${rpc}.scenarios.ts`), template(rpc));
}

console.log(`Wrote ${rpcs.length} scenario stub files.`);
```

Run: `node /tmp/gen-scenario-stubs.mjs`
Expected output: `Wrote 23 scenario stub files.`

Then: `rm /tmp/gen-scenario-stubs.mjs`

- [ ] **Step 3: Verify all 24 files exist**

Run: `ls modules/identity/conformance/src/scenarios/ | wc -l`
Expected: `24`

Run: `ls modules/identity/conformance/src/scenarios/`
Expected: lists exactly these 24 files (alphabetical order):
```
AddMembership.scenarios.ts
CreateInvitation.scenarios.ts
CreateOrganization.scenarios.ts
CreateUser.scenarios.ts
DeleteOrganization.scenarios.ts
DeleteUser.scenarios.ts
GetInvitation.scenarios.ts
GetMembership.scenarios.ts
GetOrganization.scenarios.ts
GetSession.scenarios.ts
GetUser.scenarios.ts
IntrospectSession.scenarios.ts
ListInvitations.scenarios.ts
ListMemberships.scenarios.ts
ListOrganizations.scenarios.ts
ListSessions.scenarios.ts
ListUsers.scenarios.ts
RemoveMembership.scenarios.ts
ResolveIdentity.scenarios.ts
RevokeInvitation.scenarios.ts
RevokeSession.scenarios.ts
UpdateMembership.scenarios.ts
UpdateOrganization.scenarios.ts
UpdateUser.scenarios.ts
```

- [ ] **Step 4: Verify typecheck passes**

Run: `pnpm -F @rntme/conformance-identity run typecheck`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add modules/identity/conformance/src/scenarios
git commit -m "feat(conformance-identity): 24 scenario stubs (one per canonical RPC)"
```

---

## Task 7: `suite.ts` — assemble `CategoryConformanceSuite`

**Files:**
- Create: `modules/identity/conformance/src/suite.ts`
- Create: `modules/identity/conformance/src/index.ts`
- Create: `modules/identity/conformance/test/suite-shape.test.ts`

- [ ] **Step 1: Write `suite.ts`**

Create `modules/identity/conformance/src/suite.ts`:

```typescript
import type { CategoryConformanceSuite } from './types.js';
import { scenarios as AddMembership } from './scenarios/AddMembership.scenarios.js';
import { scenarios as CreateInvitation } from './scenarios/CreateInvitation.scenarios.js';
import { scenarios as CreateOrganization } from './scenarios/CreateOrganization.scenarios.js';
import { scenarios as CreateUser } from './scenarios/CreateUser.scenarios.js';
import { scenarios as DeleteOrganization } from './scenarios/DeleteOrganization.scenarios.js';
import { scenarios as DeleteUser } from './scenarios/DeleteUser.scenarios.js';
import { scenarios as GetInvitation } from './scenarios/GetInvitation.scenarios.js';
import { scenarios as GetMembership } from './scenarios/GetMembership.scenarios.js';
import { scenarios as GetOrganization } from './scenarios/GetOrganization.scenarios.js';
import { scenarios as GetSession } from './scenarios/GetSession.scenarios.js';
import { scenarios as GetUser } from './scenarios/GetUser.scenarios.js';
import { scenarios as IntrospectSession } from './scenarios/IntrospectSession.scenarios.js';
import { scenarios as ListInvitations } from './scenarios/ListInvitations.scenarios.js';
import { scenarios as ListMemberships } from './scenarios/ListMemberships.scenarios.js';
import { scenarios as ListOrganizations } from './scenarios/ListOrganizations.scenarios.js';
import { scenarios as ListSessions } from './scenarios/ListSessions.scenarios.js';
import { scenarios as ListUsers } from './scenarios/ListUsers.scenarios.js';
import { scenarios as RemoveMembership } from './scenarios/RemoveMembership.scenarios.js';
import { scenarios as ResolveIdentity } from './scenarios/ResolveIdentity.scenarios.js';
import { scenarios as RevokeInvitation } from './scenarios/RevokeInvitation.scenarios.js';
import { scenarios as RevokeSession } from './scenarios/RevokeSession.scenarios.js';
import { scenarios as UpdateMembership } from './scenarios/UpdateMembership.scenarios.js';
import { scenarios as UpdateOrganization } from './scenarios/UpdateOrganization.scenarios.js';
import { scenarios as UpdateUser } from './scenarios/UpdateUser.scenarios.js';

export const identityConformanceSuite: CategoryConformanceSuite = {
  category: 'identity',
  contractVersion: 'v1',
  scenariosByRpc: {
    AddMembership,
    CreateInvitation,
    CreateOrganization,
    CreateUser,
    DeleteOrganization,
    DeleteUser,
    GetInvitation,
    GetMembership,
    GetOrganization,
    GetSession,
    GetUser,
    IntrospectSession,
    ListInvitations,
    ListMemberships,
    ListOrganizations,
    ListSessions,
    ListUsers,
    RemoveMembership,
    ResolveIdentity,
    RevokeInvitation,
    RevokeSession,
    UpdateMembership,
    UpdateOrganization,
    UpdateUser,
  },
};
```

- [ ] **Step 2: Write the barrel `src/index.ts`**

Create `modules/identity/conformance/src/index.ts`:

```typescript
export { identityConformanceSuite } from './suite.js';
export type { Scenario, ScenarioContext, ScenarioStatus, CategoryConformanceSuite } from './types.js';
export * as fixtures from './fixtures/index.js';
```

- [ ] **Step 3: Write the suite-shape test**

Create `modules/identity/conformance/test/suite-shape.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { identityConformanceSuite } from '../src/suite.js';

describe('identityConformanceSuite', () => {
  it('declares category=identity, contractVersion=v1', () => {
    expect(identityConformanceSuite.category).toBe('identity');
    expect(identityConformanceSuite.contractVersion).toBe('v1');
  });

  it('contains exactly 24 RPC entries', () => {
    expect(Object.keys(identityConformanceSuite.scenariosByRpc).length).toBe(24);
  });

  it('every scenarios entry is an array (empty stubs OK at this stage)', () => {
    for (const [rpc, scenarios] of Object.entries(identityConformanceSuite.scenariosByRpc)) {
      expect(Array.isArray(scenarios), `${rpc} scenarios must be an array`).toBe(true);
    }
  });
});
```

- [ ] **Step 4: Run tests and full check**

Run: `pnpm -F @rntme/conformance-identity run test`
Expected: 3 tests pass.

Run: `pnpm -F @rntme/conformance-identity run build && pnpm -F @rntme/conformance-identity run typecheck && pnpm -F @rntme/conformance-identity run lint`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add modules/identity/conformance/src modules/identity/conformance/test/suite-shape.test.ts
git commit -m "feat(conformance-identity): suite assembly + shape test"
```

---

## Task 8: Drift-detection test — RPCs ↔ scenarios files

**Files:**
- Create: `modules/identity/conformance/test/drift.test.ts`

The structural invariant from modules-monorepo §7.2: any change to canonical RPC list MUST land matching scenarios in the same PR. We enforce this by reading the `IdentityModule` client prototype from the contract package's generated `protobufjs` static module and comparing against `src/scenarios/*.scenarios.ts`.

- [ ] **Step 1: Write the failing test**

Create `modules/identity/conformance/test/drift.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { IdentityModule } from '@rntme/contracts-identity-v1';
import { identityConformanceSuite } from '../src/suite.js';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function rpcsFromContract(): Set<string> {
  const names = new Set<string>();
  for (const key of Object.getOwnPropertyNames(IdentityModule.prototype)) {
    if (key === 'constructor') continue;
    const fn = (IdentityModule.prototype as unknown as Record<string, unknown>)[key];
    if (typeof fn !== 'function') continue;
    const rpcName = (fn as { name?: string }).name;
    if (rpcName && /^[A-Z][a-zA-Z0-9]*$/.test(rpcName)) names.add(rpcName);
  }
  return names;
}

function rpcsFromScenarioFiles(): Set<string> {
  // Scenario files live at src/scenarios/<RPC>.scenarios.ts. The drift test
  // reads from the source tree (not dist) because the package may not be built.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const dir = resolve(__dirname, '..', 'src', 'scenarios');
  return new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith('.scenarios.ts'))
      .map((f) => f.replace(/\.scenarios\.ts$/, '')),
  );
}

function rpcsFromSuite(): Set<string> {
  return new Set(Object.keys(identityConformanceSuite.scenariosByRpc));
}

describe('drift detection', () => {
  it('every canonical RPC in IdentityModule has a matching scenarios file', () => {
    const contract = rpcsFromContract();
    const files = rpcsFromScenarioFiles();
    const missing = [...contract].filter((rpc) => !files.has(rpc));
    expect(missing, `missing scenarios files for: ${missing.join(', ')}`).toEqual([]);
  });

  it('every scenarios file maps to a canonical RPC (no orphan files)', () => {
    const contract = rpcsFromContract();
    const files = rpcsFromScenarioFiles();
    const orphans = [...files].filter((rpc) => !contract.has(rpc));
    expect(orphans, `orphan scenarios files: ${orphans.join(', ')}`).toEqual([]);
  });

  it('suite.scenariosByRpc keys exactly match scenarios files', () => {
    const files = rpcsFromScenarioFiles();
    const suiteKeys = rpcsFromSuite();
    const missingFromSuite = [...files].filter((rpc) => !suiteKeys.has(rpc));
    const orphanInSuite = [...suiteKeys].filter((rpc) => !files.has(rpc));
    expect(missingFromSuite, `scenarios files not registered in suite: ${missingFromSuite.join(', ')}`).toEqual([]);
    expect(orphanInSuite, `suite registers RPCs without scenarios files: ${orphanInSuite.join(', ')}`).toEqual([]);
  });
});
```

Do not use `(IdentityModule as any).service.methods` here. Plan 1 verified that the generated static module exposes RPC names reliably on prototype method `name` values (`getUser` has function name `GetUser`), while reflection metadata is not guaranteed by the `protobufjs` static-module output.

- [ ] **Step 2: Run the test**

Run: `pnpm -F @rntme/conformance-identity run test -- drift`
Expected: 3 tests pass — all three sets are equal (contract RPCs == scenarios files == suite keys).

- [ ] **Step 3: Verify drift detection actually fails when expected**

Temporarily delete one scenarios file:
```bash
mv modules/identity/conformance/src/scenarios/GetUser.scenarios.ts /tmp/
```

Run: `pnpm -F @rntme/conformance-identity run test -- drift`
Expected: the first assertion fails with `missing scenarios files for: GetUser`. The third also fails on `suite registers RPCs without scenarios files: GetUser`.

Restore the file and re-run:
```bash
mv /tmp/GetUser.scenarios.ts modules/identity/conformance/src/scenarios/
pnpm -F @rntme/conformance-identity run test -- drift
```
Expected: pass.

- [ ] **Step 4: Run full check**

Run: `pnpm -F @rntme/conformance-identity run test && pnpm -F @rntme/conformance-identity run typecheck && pnpm -F @rntme/conformance-identity run lint && pnpm -F @rntme/conformance-identity run build`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add modules/identity/conformance/test/drift.test.ts
git commit -m "test(conformance-identity): drift detection between IdentityModule RPCs and scenarios files"
```

---

## Task 9: Conformance package README

**Files:**
- Create: `modules/identity/conformance/README.md`

- [ ] **Step 1: Write the README**

Create `modules/identity/conformance/README.md`:

```markdown
# @rntme/conformance-identity

Per-RPC conformance scenarios for the Identity canonical contract `@rntme/contracts-identity-v1`. Every Identity-category vendor module (Clerk, Auth0, WorkOS, …) imports this package and runs the suite under both mock-vendor and live-sandbox modes.

## File map

- `src/types.ts` — local stub of `Scenario` and `CategoryConformanceSuite`. Replace with import from `@rntme/conformance-framework` once it lands.
- `src/fixtures/{users,organizations,invitations}.ts` — canonical seed objects (proto-shaped) referenced from scenarios.
- `src/scenarios/<RPC>.scenarios.ts` × 24 — one file per canonical RPC. All currently empty stubs; fill alongside the framework wiring.
- `src/suite.ts` — assembled `CategoryConformanceSuite`.
- `src/index.ts` — barrel.
- `test/drift.test.ts` — drift detection: contract RPCs ↔ scenarios files ↔ suite keys.
- `test/suite-shape.test.ts` — basic suite invariants.

## Quick start

```ts
import { identityConformanceSuite } from '@rntme/conformance-identity';

console.log(identityConformanceSuite.category);                // 'identity'
console.log(identityConformanceSuite.contractVersion);         // 'v1'
console.log(Object.keys(identityConformanceSuite.scenariosByRpc).length); // 24
```

## What scenarios cover (when filled)

Each scenario asserts, in this order:

1. Response shape matches canonical proto (no extra fields, no missing required scope).
2. Replay with the same `idempotency_key` returns the same logical result without producing a duplicate event.
3. Negative branches return the expected error code from `error-codes.json`.
4. For command RPCs, the expected CloudEvents `type` is published on the matching topic within a 5-second window.

Plus the unconditional anti-conformance check (modules-monorepo §7.3): any RPC NOT in `module.json#capabilities.rpcs[]` must return gRPC `UNIMPLEMENTED`.

## Mock-vendor vs live-sandbox

- `pnpm test:conformance:mock` (vendor module, after framework lands) — runs every scenario against the generic mock-vendor in `@rntme/conformance-framework`. No secrets, runs on every PR.
- `pnpm test:conformance:live` — same suite, vendor sandbox credentials. Runs at release tag only.

Both filter scenarios by the module's `capabilities[]`.

## Invariants & gotchas

- **Drift test is mandatory CI.** Adding an RPC to `IdentityModule` without a matching `<RPC>.scenarios.ts` file fails `pnpm test`. This enforces modules-monorepo §7.2.
- **Scenarios are vendor-agnostic.** A scenario references canonical proto types and fixture seeds — never vendor-specific behavior. Vendor adapters in `modules/identity/<vendor>/test/conformance.test.ts` import this suite and feed it through the framework runner.
- **Stubs return empty `Scenario[]`.** Until `@rntme/conformance-framework` ships, the runner does not exist. Empty scenarios files preserve the structural invariant (one file per RPC) without committing to runtime semantics that may shift.

## Where to look first

- Spec: [`docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md`](../../../docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md) §9.
- Modules-monorepo conformance design: [`docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md`](../../../docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md) §7.
- Canonical contract this exercises: [`packages/contracts/identity/v1/`](../../../packages/contracts/identity/v1).

## Specs

- `docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md` (v1 contract).
- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` (umbrella conventions).
```

- [ ] **Step 2: Commit**

```bash
git add modules/identity/conformance/README.md
git commit -m "docs(conformance-identity): README"
```

---

## Task 10: Documentation-touch — `AGENTS.md` and root `README.md`

**Files:**
- Modify: `AGENTS.md` §3 (mention modules tree), §6 (point at conformance scaffolding), §10 (glossary entry for `modules/<category>/conformance/`).
- Modify: `README.md` packages table.

- [ ] **Step 1: `AGENTS.md` §3 — append a note about the modules tree**

Open `AGENTS.md`. After the "Canonical contracts (Identity track)" block (added in Plan 1 Task 11), append:

```
Modules tree (vendor implementations):

- **`modules/<category>/`** — Category container. Holds the category
  README and a `conformance/` workspace package. Vendor modules live as
  `modules/<category>/<vendor>/` (e.g. `modules/identity/clerk/`); none
  shipped yet.
- **`@rntme/conformance-identity`** — Per-RPC conformance scenarios for
  the Identity canonical contract. Drift-tested against
  `service IdentityModule`. Imported by every Identity vendor module.
  → `modules/identity/conformance/README.md`.
```

- [ ] **Step 2: `AGENTS.md` §6 — add the "Add an Identity vendor module" how-to (stub)**

Locate `### 6.17 Add a category contract package` (added in Plan 1). After it, append:

```
### 6.18 Add an Identity vendor module

The first vendor module is shipped by a separate brainstorm + plan
(spec: TBD). When that lands, the steps will be:

1. Copy `packages/module-skeleton/` to `modules/identity/<vendor>/`.
2. Implement `service IdentityModule` from
   `@rntme/contracts-identity-v1` against the vendor's SDK.
3. Declare supported RPCs and events in `module.json#capabilities[]`.
4. Wire conformance: `import { identityConformanceSuite } from
   '@rntme/conformance-identity'` and run it through the framework
   runner (`@rntme/conformance-framework`, slated for modules-monorepo
   plan 1).
5. Pass mock-conformance on every PR; pass live-conformance on release
   tag.

Until that brainstorm lands, stop here — do NOT freelance an
implementation, because it would freeze a vendor-shaped contract before
the vendor selection (Clerk vs WorkOS vs …) is recorded in a spec.
```

- [ ] **Step 3: `AGENTS.md` §10 — add a glossary entry for the modules tree**

In §10 glossary, insert (alphabetically):

```
- **Module conformance suite** — Per-category package
  `modules/<category>/conformance/` (e.g. `@rntme/conformance-identity`).
  Holds `Scenario` files keyed by canonical RPC. Drift-tested against
  the canonical contract's service definition; imported by every
  vendor module to run the suite under mock and live modes.
```

Also correct the existing `Conformance scenarios` glossary entry if it still points at `modules/<category>/conformance/scenarios/`; the path must be `modules/<category>/conformance/src/scenarios/`.

- [ ] **Step 4: Root `README.md` packages table — append conformance package**

In `README.md` packages table, after the `@rntme/contracts-identity-v1` row (added in Plan 1 Task 12), append:

```markdown
| **Identity vendor track** |  |
| [`@rntme/conformance-identity`](modules/identity/conformance) | Per-RPC conformance scenarios for `@rntme/contracts-identity-v1`. Drift-tested against the canonical `service IdentityModule`. Imported by every Identity vendor module. |
```

- [ ] **Step 5: Verify everything still builds and lints**

Run:
```bash
pnpm install --frozen-lockfile=false
pnpm -r run build
pnpm -r run test
pnpm -r run lint
pnpm -r run typecheck
```
Expected: all four green.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md README.md
git commit -m "docs: list modules tree and conformance-identity in AGENTS and README"
```

---

## Task 11: Final cross-package verification

- [ ] **Step 1: Top-level smoke**

Run:
```bash
pnpm -r run build
pnpm -r run test
pnpm -r run lint
pnpm -r run typecheck
```
Expected: all green. The drift test in `@rntme/conformance-identity` runs against the freshly-built `@rntme/contracts-identity-v1` and reports zero drift.

- [ ] **Step 2: Confirm pnpm sees the new workspace package**

Run: `pnpm list -r --depth -1 | grep -E '(conformance-identity|contracts-identity|contracts-common)'`
Expected: three lines, one per package.

- [ ] **Step 3: No commit — verification only.**

If anything fails, fix the underlying issue and back-propagate to the relevant earlier task.

---

## Self-review checklist

- [x] Spec §9.1 layout — Tasks 1-7 build the package.
- [x] Spec §9.2 per-RPC scenarios — Task 6 lands all 24 stub files.
- [x] Spec §9.3 anti-conformance — documented in README; enforcement waits for framework.
- [x] Spec §9.4 capability-coverage report — out of scope here (framework concern).
- [x] Spec §9.5 generic mock-vendor decision — recorded in README; no work in this plan.
- [x] Spec §11 documentation-touch — Tasks 9 (package README), 10 (AGENTS / root README).
- [x] Modules-monorepo §7.1 layout — directory matches `modules/<category>/conformance/src/scenarios/`.
- [x] Modules-monorepo §7.2 PR invariant — drift test in Task 8.
- [x] Modules-monorepo §7.3 anti-conformance — documented; runner enforcement future.

Open questions deferred from the contract spec:
- **OQ-IDV1-2** — remains open; first vendor decides.
- **OQ-IDV1-3** — remains open; either this package's `IntrospectSession.scenarios.ts` adopts the dual-input shape when filled, or first vendor adopts and we update the canonical proto in v1.minor.
