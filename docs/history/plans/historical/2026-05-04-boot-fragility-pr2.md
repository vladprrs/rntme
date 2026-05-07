> Status: historical.
> Date: 2026-05-04.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Boot Fragility (PR2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `mountUiRuntime` survive any module's `boot()` failure: render proceeds, errors are recorded, identity modules get an `'anon'` fallback only when they crashed before setting `/auth/status`.

**Architecture:** Wrap each module's boot in `try/catch` inside `entry.tsx`. Add an optional `client.contract: "identity"` flag in `module.json`, surface it through blueprint catalog and the virtual entry, expose it on the `ModuleSpec` runtime descriptor as `bootContract`. Add a state slot `/runtime/bootErrors` for diagnostic visibility. No styled UI in this PR.

**Tech Stack:** TypeScript, Zod (manifest schema in `@rntme/module-skeleton`), Vitest, React 18.

**Spec reference:** `docs/history/specs/historical/2026-05-04-notes-demo-fresh-tenant-deployable-design.md` §6.

**File map:**
- `packages/tooling/module-skeleton/src/manifest-shape.ts` — extend `ClientBlockSchema` with `contract` enum.
- `packages/artifacts/blueprint/src/types/artifact.ts` — widen `modulesWithBoot` element type.
- `packages/artifacts/blueprint/src/compose/catalog.ts` — populate the new shape.
- `packages/artifacts/blueprint/src/compose/virtual-entry.ts` — emit `bootContract` literal in module spec.
- `packages/runtime/ui-runtime/src/client/entry.tsx` — try/catch + identity-aware fallback + `/runtime/bootErrors`.
- `packages/runtime/ui-runtime/test/unit/entry.boot.test.tsx` (new) — five-case boot resilience suite.
- `modules/identity/auth0/module.json` — add `client.contract: "identity"`.
- Module-conformance test (location TBD per Task 8).
- `packages/runtime/ui-runtime/README.md` — boot lifecycle section.

---

### Task 1: Extend `ClientBlockSchema` to accept `contract`

**Files:**
- Modify: `packages/tooling/module-skeleton/src/manifest-shape.ts`

- [ ] **Step 1: Read the schema**

```bash
sed -n '65,75p' packages/tooling/module-skeleton/src/manifest-shape.ts
```

Expected: see `ClientBlockSchema` strict-object with `entry`, `boot`, `bootTimeoutMs`, `config`, `components`, `operations`.

- [ ] **Step 2: Add `contract` field**

Edit `packages/tooling/module-skeleton/src/manifest-shape.ts` lines 65-74. Replace with:

```ts
export const ClientBlockSchema = z
  .object({
    entry: z.string().min(1),
    boot: z.boolean().optional(),
    bootTimeoutMs: z.number().int().positive().optional(),
    contract: z.enum(['identity']).optional(),
    config: ClientConfigSchema.optional(),
    components: z.array(ComponentDeclarationSchema).optional(),
    operations: z.array(OperationDeclarationSchema).optional(),
  })
  .strict();
```

- [ ] **Step 3: Add a unit test for the new field**

Add to `packages/tooling/module-skeleton/test/unit/manifest-shape.test.ts` (or the existing test file for ClientBlockSchema):

```ts
import { describe, it, expect } from 'vitest';
import { ClientBlockSchema } from '../../src/manifest-shape.js';

describe('ClientBlockSchema.contract', () => {
  it('accepts contract: "identity"', () => {
    const result = ClientBlockSchema.safeParse({
      entry: './client/index.js',
      boot: true,
      contract: 'identity',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown contract values', () => {
    const result = ClientBlockSchema.safeParse({
      entry: './client/index.js',
      contract: 'analytics',
    });
    expect(result.success).toBe(false);
  });

  it('treats contract as optional', () => {
    const result = ClientBlockSchema.safeParse({
      entry: './client/index.js',
      boot: true,
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm -F @rntme/module-skeleton test`
Expected: all green, including the three new cases.

- [ ] **Step 5: Commit**

```bash
git add packages/tooling/module-skeleton/src/manifest-shape.ts packages/tooling/module-skeleton/test/
git commit -m "feat(module-skeleton): add optional client.contract enum (identity)"
```

---

### Task 2: Widen `modulesWithBoot` element type

**Files:**
- Modify: `packages/artifacts/blueprint/src/types/artifact.ts`

- [ ] **Step 1: Locate the type**

```bash
grep -n "modulesWithBoot" packages/artifacts/blueprint/src/types/artifact.ts
```

Expected: line with `readonly modulesWithBoot: readonly string[];`.

- [ ] **Step 2: Replace with widened element shape**

Edit `packages/artifacts/blueprint/src/types/artifact.ts`. Find:

```ts
readonly modulesWithBoot: readonly string[];
```

Replace with:

```ts
readonly modulesWithBoot: readonly Readonly<{
  name: string;
  contract?: 'identity';
}>[];
```

- [ ] **Step 3: Build the package to find type errors in callers**

Run: `pnpm -F @rntme/blueprint typecheck`
Expected: failures in `catalog.ts`, `validate-modules.ts`, `virtual-entry.ts` — those are fixed in Tasks 3-5.

- [ ] **Step 4: Commit (intermediate, type-only)**

```bash
git add packages/artifacts/blueprint/src/types/artifact.ts
git commit -m "refactor(blueprint): widen CatalogManifest.modulesWithBoot to carry contract

Element changes from string to { name; contract? }. Callers updated in
follow-up commits in this PR."
```

---

### Task 3: Update `catalog.ts` to populate the new shape

**Files:**
- Modify: `packages/artifacts/blueprint/src/compose/catalog.ts`

- [ ] **Step 1: Read the current populate site**

```bash
sed -n '15,50p' packages/artifacts/blueprint/src/compose/catalog.ts
```

Expected: `const modulesWithBoot: string[] = [];` and `if (m.client?.boot) modulesWithBoot.push(moduleName);`.

- [ ] **Step 2: Replace both lines**

In `packages/artifacts/blueprint/src/compose/catalog.ts`:

Replace:
```ts
const modulesWithBoot: string[] = [];
```
with:
```ts
const modulesWithBoot: Array<{ name: string; contract?: 'identity' }> = [];
```

Replace:
```ts
if (m.client?.boot) modulesWithBoot.push(moduleName);
```
with:
```ts
if (m.client?.boot) {
  const entry: { name: string; contract?: 'identity' } = { name: moduleName };
  if (m.client.contract === 'identity') entry.contract = 'identity';
  modulesWithBoot.push(entry);
}
```

- [ ] **Step 3: Update existing tests that asserted `modulesWithBoot: ['name']`**

Run: `grep -rn "modulesWithBoot" packages/artifacts/blueprint/test/ 2>/dev/null`

For each test that asserts the array shape, change `['@rntme/identity-auth0']` to `[{ name: '@rntme/identity-auth0' }]` (no contract for tests on non-identity modules). For a test with an identity module, also assert `contract: 'identity'`.

- [ ] **Step 4: Run blueprint tests**

Run: `pnpm -F @rntme/blueprint test`
Expected: green after test fixture updates.

- [ ] **Step 5: Commit**

```bash
git add packages/artifacts/blueprint/src/compose/catalog.ts packages/artifacts/blueprint/test/
git commit -m "feat(blueprint): catalog records client.contract on modulesWithBoot entries"
```

---

### Task 4: Fix `validate-modules.ts` against new shape

**Files:**
- Modify: `packages/artifacts/blueprint/src/compose/validate-modules.ts:72`

- [ ] **Step 1: Read the line**

```bash
sed -n '68,80p' packages/artifacts/blueprint/src/compose/validate-modules.ts
```

Expected: `for (const m of catalog.modulesWithBoot) needsClient.add(m);`.

- [ ] **Step 2: Patch**

Replace:
```ts
for (const m of catalog.modulesWithBoot) needsClient.add(m);
```
with:
```ts
for (const m of catalog.modulesWithBoot) needsClient.add(m.name);
```

- [ ] **Step 3: Run blueprint tests**

Run: `pnpm -F @rntme/blueprint test`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add packages/artifacts/blueprint/src/compose/validate-modules.ts
git commit -m "fix(blueprint): adapt validate-modules to new modulesWithBoot shape"
```

---

### Task 5: Emit `bootContract` in virtual entry

**Files:**
- Modify: `packages/artifacts/blueprint/src/compose/virtual-entry.ts`

- [ ] **Step 1: Read both touch points**

```bash
sed -n '10,20p' packages/artifacts/blueprint/src/compose/virtual-entry.ts
sed -n '54,70p' packages/artifacts/blueprint/src/compose/virtual-entry.ts
```

- [ ] **Step 2: Patch the modulePkgs collector**

Replace:
```ts
for (const b of catalog.modulesWithBoot) modulePkgs.add(b);
```
with:
```ts
for (const b of catalog.modulesWithBoot) modulePkgs.add(b.name);
```

- [ ] **Step 3: Patch the rntmeModules emitter**

Replace:
```ts
if (catalog.modulesWithBoot.length > 0) {
  lines.push(
    ...[...catalog.modulesWithBoot].map((name) => {
      const v = pkgImportVar(name);
      return `  { name: ${JSON.stringify(name)}, boot: ${v}.boot },`;
    }),
  );
}
```
with:
```ts
if (catalog.modulesWithBoot.length > 0) {
  lines.push(
    ...[...catalog.modulesWithBoot].map((entry) => {
      const v = pkgImportVar(entry.name);
      const contractField =
        entry.contract === 'identity' ? `, bootContract: 'identity'` : '';
      return `  { name: ${JSON.stringify(entry.name)}, boot: ${v}.boot${contractField} },`;
    }),
  );
}
```

- [ ] **Step 4: Update virtual-entry test**

Run: `grep -rn "rntmeModules\|bootContract" packages/artifacts/blueprint/test/`

Find the snapshot/string-comparison test for `renderVirtualEntry`. Update the expected output to match: `{ name: "@rntme/identity-auth0", boot: mod_X.boot, bootContract: 'identity' }` for an identity module fixture.

Add a new test case where a module has `boot: true` but no `contract` — assert no `bootContract` field is emitted.

- [ ] **Step 5: Run tests**

Run: `pnpm -F @rntme/blueprint test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/artifacts/blueprint/src/compose/virtual-entry.ts packages/artifacts/blueprint/test/
git commit -m "feat(blueprint): virtual entry emits bootContract for identity modules"
```

---

### Task 6: Extend `ModuleSpec` type in ui-runtime

**Files:**
- Modify: `packages/runtime/ui-runtime/src/client/entry.tsx:53-57`

- [ ] **Step 1: Read the type**

```bash
sed -n '53,57p' packages/runtime/ui-runtime/src/client/entry.tsx
```

- [ ] **Step 2: Add the field**

Replace:
```ts
export type ModuleSpec = {
  name: string;
  boot?: (ctx: ModuleBootContext) => void | Promise<void>;
  bootTimeoutMs?: number;
};
```
with:
```ts
export type ModuleSpec = {
  name: string;
  boot?: (ctx: ModuleBootContext) => void | Promise<void>;
  bootTimeoutMs?: number;
  /** When set to "identity", a boot failure that left /auth/status unset
   *  causes the runtime to set /auth/status = 'anon' on the module's behalf. */
  bootContract?: 'identity';
};
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm -F @rntme/ui-runtime typecheck`
Expected: green (the loop in entry.tsx doesn't reference `bootContract` yet — that comes in Task 7).

- [ ] **Step 4: Commit**

```bash
git add packages/runtime/ui-runtime/src/client/entry.tsx
git commit -m "feat(ui-runtime): add ModuleSpec.bootContract field"
```

---

### Task 7: Wrap boot loop with try/catch and identity-aware fallback

**Files:**
- Modify: `packages/runtime/ui-runtime/src/client/entry.tsx:124-141`

- [ ] **Step 1: Read the current loop**

```bash
sed -n '124,141p' packages/runtime/ui-runtime/src/client/entry.tsx
```

- [ ] **Step 2: Replace with the resilient version**

Replace lines 124-141 with:

```tsx
  type BootError = { moduleName: string; cause: unknown };
  const bootErrors: BootError[] = [];

  for (const m of opts.modules ?? []) {
    if (!m.boot) continue;
    const ctx = createModuleBootContext({
      moduleName: m.name,
      config: publicConfig[m.name] ?? {},
      store,
      bus,
      chain,
      registry: operationRegistry,
    });
    const ms = m.bootTimeoutMs ?? 10_000;
    try {
      await Promise.race([
        Promise.resolve(m.boot(ctx)),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error(`boot timeout: ${m.name}`)), ms),
        ),
      ]);
    } catch (cause) {
      bootErrors.push({ moduleName: m.name, cause });
      if (m.bootContract === 'identity' && store.get('/auth/status') === undefined) {
        store.set('/auth/status', 'anon');
        store.set('/auth/user', null);
      }
      console.error(`[rntme] module boot failed: ${m.name}`, cause);
    }
  }

  store.set('/runtime/bootErrors', bootErrors);
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm -F @rntme/ui-runtime typecheck`
Expected: green.

- [ ] **Step 4: Run existing tests to confirm no regression**

Run: `pnpm -F @rntme/ui-runtime test`
Expected: existing tests still green (new test file added in Task 8).

- [ ] **Step 5: Commit**

```bash
git add packages/runtime/ui-runtime/src/client/entry.tsx
git commit -m "feat(ui-runtime): isolate module boot failures with identity-aware fallback

mountUiRuntime no longer aborts on boot() throwing. Each module's boot is
caught individually; the error is recorded into /runtime/bootErrors and
logged. If a module declares bootContract: 'identity' and crashed before
setting /auth/status, the runtime sets /auth/status = 'anon' on its behalf.
Other modules just log."
```

---

### Task 8: Five-case boot resilience test suite

**Files:**
- Create: `packages/runtime/ui-runtime/test/unit/entry.boot.test.tsx`

- [ ] **Step 1: Discover existing test setup**

```bash
ls packages/runtime/ui-runtime/test/unit/
head -40 packages/runtime/ui-runtime/test/unit/entry.test.tsx 2>/dev/null || \
  grep -l "mountUiRuntime\|jsdom" packages/runtime/ui-runtime/test/ -r
```

Expected: see existing test infrastructure (likely jsdom + happy-dom). Note the import paths and harness pattern.

- [ ] **Step 2: Write the failing test file**

Create `packages/runtime/ui-runtime/test/unit/entry.boot.test.tsx`. Adapt imports and DOM-target setup to match the existing harness; reference `entry.test.tsx` for patterns. Skeleton:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountUiRuntime, type ModuleSpec } from '../../src/client/entry.js';

function makeTarget(): HTMLElement {
  document.body.innerHTML = '<div id="root"></div>';
  return document.getElementById('root')!;
}

function manifestStub() {
  // Minimal valid CompiledManifest. Adapt fields to the real type.
  return {
    routes: { '/': { layout: 'main', screen: 'home' } },
    layouts: { main: { spec: { root: 'r', elements: { r: { type: 'fragment' } } } } },
    screens: { home: { spec: { root: 's', elements: { s: { type: 'fragment' } } } } },
  };
}

function makeFetch(manifest: unknown, configJson: unknown = {}): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : (input as Request).url ?? String(input);
    if (url.endsWith('/manifest.json') || url.includes('manifest')) {
      return new Response(JSON.stringify(manifest), { status: 200 });
    }
    if (url.endsWith('/config.json')) {
      return new Response(JSON.stringify(configJson), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  }) as unknown as typeof fetch;
}

describe('mountUiRuntime boot resilience', () => {
  let target: HTMLElement;

  beforeEach(() => {
    target = makeTarget();
  });

  it('still calls createRoot when a module boot throws', async () => {
    const failingModule: ModuleSpec = {
      name: 'failing',
      boot: async () => {
        throw new Error('boot exploded');
      },
    };
    await mountUiRuntime({
      manifestUrl: '/manifest.json',
      target,
      transport: makeFetch(manifestStub()),
      modules: [failingModule],
    });
    // Render proceeds: target gets a React root mounted (data-reactroot-ish; jsdom shows children).
    expect(target.children.length).toBeGreaterThan(0);
  });

  it('sets /auth/status to anon when an identity module fails before setting it', async () => {
    let observedStatus: unknown;
    const identityModule: ModuleSpec = {
      name: 'identity',
      bootContract: 'identity',
      boot: async (ctx) => {
        // Capture store via a probe op that the test triggers post-boot.
        ctx.state.set('/test/probe', 'identity-started');
        throw new Error('auth failed');
      },
    };
    const probeModule: ModuleSpec = {
      name: 'probe',
      boot: async (ctx) => {
        observedStatus = ctx.state.get('/auth/status');
      },
    };
    await mountUiRuntime({
      manifestUrl: '/manifest.json',
      target,
      transport: makeFetch(manifestStub()),
      modules: [identityModule, probeModule],
    });
    expect(observedStatus).toBe('anon');
  });

  it('does not overwrite /auth/status when identity module set it before throwing', async () => {
    let observedStatus: unknown;
    const identityModule: ModuleSpec = {
      name: 'identity',
      bootContract: 'identity',
      boot: async (ctx) => {
        ctx.state.set('/auth/status', 'authed');
        throw new Error('crashed after auth');
      },
    };
    const probeModule: ModuleSpec = {
      name: 'probe',
      boot: async (ctx) => {
        observedStatus = ctx.state.get('/auth/status');
      },
    };
    await mountUiRuntime({
      manifestUrl: '/manifest.json',
      target,
      transport: makeFetch(manifestStub()),
      modules: [identityModule, probeModule],
    });
    expect(observedStatus).toBe('authed');
  });

  it('does not touch /auth/status when a non-identity module fails', async () => {
    let observedStatus: unknown;
    const non: ModuleSpec = {
      name: 'non-identity',
      boot: async () => {
        throw new Error('any');
      },
    };
    const probeModule: ModuleSpec = {
      name: 'probe',
      boot: async (ctx) => {
        observedStatus = ctx.state.get('/auth/status');
      },
    };
    await mountUiRuntime({
      manifestUrl: '/manifest.json',
      target,
      transport: makeFetch(manifestStub()),
      modules: [non, probeModule],
    });
    expect(observedStatus).toBeUndefined();
  });

  it('continues to boot remaining modules when one times out', async () => {
    let secondBooted = false;
    const slow: ModuleSpec = {
      name: 'slow',
      bootTimeoutMs: 50,
      boot: () => new Promise(() => { /* never resolves */ }),
    };
    const fast: ModuleSpec = {
      name: 'fast',
      boot: async () => { secondBooted = true; },
    };
    await mountUiRuntime({
      manifestUrl: '/manifest.json',
      target,
      transport: makeFetch(manifestStub()),
      modules: [slow, fast],
    });
    expect(secondBooted).toBe(true);
  });
});
```

> **Note:** the harness adapter (`makeFetch`, `manifestStub`) may need tweaks once you read `entry.test.tsx` for the real CompiledManifest shape and asset registry. Match what the existing test does.

- [ ] **Step 3: Run the suite**

Run: `pnpm -F @rntme/ui-runtime test entry.boot`
Expected: 5 cases pass. If a fixture mismatch surfaces (manifest schema), align with `entry.test.tsx` and re-run.

- [ ] **Step 4: Commit**

```bash
git add packages/runtime/ui-runtime/test/unit/entry.boot.test.tsx
git commit -m "test(ui-runtime): boot resilience and identity-contract fallback suite"
```

---

### Task 9: Add `client.contract` to identity-auth0 manifest

**Files:**
- Modify: `modules/identity/auth0/module.json`

- [ ] **Step 1: Read current manifest**

```bash
grep -n '"client"' modules/identity/auth0/module.json
```

- [ ] **Step 2: Insert `contract` field**

In `modules/identity/auth0/module.json`, locate the `"client": { ... }` block. Add `"contract": "identity"` as the second field after `"entry"`:

```json
"client": {
  "entry": "./dist/client/index.js",
  "contract": "identity",
  "boot": true,
  ...
}
```

- [ ] **Step 3: Verify the manifest still parses**

Run: `pnpm -F @rntme/identity-auth0 test 2>/dev/null || true`
Then run the manifest schema check directly:

```bash
node -e "
import('./packages/tooling/module-skeleton/dist/manifest-shape.js').then(m => {
  const fs = require('fs');
  const raw = JSON.parse(fs.readFileSync('modules/identity/auth0/module.json','utf8'));
  const r = m.ModuleManifestSchema.safeParse(raw);
  if (!r.success) { console.error(r.error); process.exit(1); }
  console.log('manifest ok; contract=', raw.client?.contract);
});
"
```

Expected: `manifest ok; contract= identity`.

- [ ] **Step 4: Run vendor:sync (PR1 must be merged or in-progress) to propagate to demo**

Run: `pnpm vendor:sync`
Expected: vendored copy in `demo/notes-blueprint/node_modules/rntme_identity_auth0/module.json` updated with the new field.

> **Note:** If PR1 is not yet merged, this step is deferred to the merge ordering — PR2 lists PR1 as soft prereq. If you're running PR2 first locally, copy the manifest by hand.

- [ ] **Step 5: Commit**

```bash
git add modules/identity/auth0/module.json demo/notes-blueprint/node_modules/rntme_identity_auth0/module.json
git commit -m "feat(identity-auth0): declare client.contract = identity"
```

---

### Task 10: Module conformance test for identity contract

**Files:**
- Locate: an existing module-conformance test in the repo (`grep -rn "category.*identity\|identity-vendor" packages/ apps/`).
- Create or modify: a single conformance test file.

- [ ] **Step 1: Find conformance suite**

```bash
find packages -name "conformance*.test.ts" -o -name "*identity*conformance*" 2>/dev/null | head -5
grep -rn "category === 'identity'\|category: 'identity'" packages/ 2>/dev/null | head -10
```

Pick the most appropriate existing test file (likely under `packages/tooling/conformance-identity/test/` or `packages/artifacts/blueprint/test/`). If no clean home exists, create `packages/artifacts/blueprint/test/unit/identity-contract.test.ts`.

- [ ] **Step 2: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

describe('identity modules declare client.contract = "identity"', () => {
  const identityDir = join(process.cwd(), '..', '..', '..', 'modules', 'identity');

  it('every modules/identity/<vendor>/module.json with category=identity has client.contract=identity', async () => {
    let vendors: string[];
    try {
      vendors = await readdir(identityDir);
    } catch {
      // identity dir absent (e.g., partial checkout) — skip, not fail.
      return;
    }
    for (const vendor of vendors) {
      const manifestPath = join(identityDir, vendor, 'module.json');
      let raw: string;
      try {
        raw = await readFile(manifestPath, 'utf8');
      } catch {
        continue;
      }
      const m = JSON.parse(raw) as { category?: string; client?: { contract?: string } };
      if (m.category !== 'identity') continue;
      expect(m.client?.contract, `${vendor}/module.json client.contract`).toBe('identity');
    }
  });
});
```

> **Note:** path traversal `..` count depends on the test file's location; adjust to point at workspace `modules/identity/`.

- [ ] **Step 3: Run the test**

Run: `pnpm -F <pkg-where-test-lives> test`
Expected: green (auth0 has contract from Task 9). If it fails for workos/clerk modules that exist but lack contract, that's the next step.

- [ ] **Step 4: If workos/clerk exist and fail — add contract to them**

For each failing identity vendor manifest:

```json
"client": { "entry": "./dist/client/index.js", "contract": "identity", ... }
```

Re-run the test; expect green.

- [ ] **Step 5: Commit**

```bash
git add packages/<pkg>/test/ modules/identity/
git commit -m "test(identity): enforce client.contract = identity on every identity vendor"
```

---

### Task 11: README update

**Files:**
- Modify: `packages/runtime/ui-runtime/README.md`

- [ ] **Step 1: Locate the right section**

```bash
grep -n "^##" packages/runtime/ui-runtime/README.md | head -10
```

- [ ] **Step 2: Add a new "Boot lifecycle" section**

Insert (typically after a `## API` or `## Quick start` section):

```markdown
## Boot lifecycle and resilience

`mountUiRuntime` runs each module's `boot()` in sequence. **A boot failure does not abort the runtime** — the error is recorded and rendering proceeds.

### State slots

- `/runtime/bootErrors`: `Array<{ moduleName: string; cause: unknown }>`. Empty if every boot succeeded.
- `/auth/status`: `'anon' | 'authed' | undefined`. See identity contract below.

### Identity contract

A module may declare `module.json#client.contract: "identity"`. The blueprint surfaces this as `bootContract: 'identity'` on the runtime `ModuleSpec`. The contract is:

- The module **must** set `/auth/status` itself on success or failure.
- If the module crashed before setting `/auth/status`, the runtime sets `/auth/status = 'anon'` and `/auth/user = null` on its behalf so the layout renders the anon state instead of staying empty.
- The runtime **never** overwrites an already-set `/auth/status`. A module that authed successfully and then crashed in `registerOperation` keeps `'authed'` — no surprise logout.

### Failure semantics for non-identity modules

A non-identity module's failure is recorded in `/runtime/bootErrors` and logged via `console.error`. The runtime takes no automatic compensating action.

### Boot timeout

Default 10s; override per module via `module.json#client.bootTimeoutMs`. A timeout is treated identically to a thrown error.
```

- [ ] **Step 3: Commit**

```bash
git add packages/runtime/ui-runtime/README.md
git commit -m "docs(ui-runtime): document boot lifecycle, identity contract, and bootErrors slot"
```

---

### Task 12: Open the PR

- [ ] **Step 1: Push and open**

```bash
git push -u origin <branch>
gh pr create --title "feat(ui-runtime): module boot resilience + identity contract (PR2/4)" --body "$(cat <<'EOF'
## Summary

- `mountUiRuntime` no longer aborts when any module's `boot()` throws or times out.
- New `module.json#client.contract: "identity"` enum, surfaced as `bootContract` on runtime `ModuleSpec`.
- Identity modules get an automatic `/auth/status: 'anon'` fallback **only** when they crashed before setting it themselves; an already-set status (e.g., 'authed') is never overwritten.
- All boot errors recorded in `/runtime/bootErrors`.
- Conformance test enforces `client.contract: "identity"` on every `category: identity` vendor.

PR2 of 4 implementing `docs/history/specs/historical/2026-05-04-notes-demo-fresh-tenant-deployable-design.md`. Independent of PR1 and PR3 — can land in any order.

## Test plan

- [ ] Vitest green across `@rntme/module-skeleton`, `@rntme/blueprint`, `@rntme/ui-runtime`.
- [ ] Identity-conformance test green.
- [ ] Manual: stage a failing Auth0 config (wrong domain) on a local notes-demo build; confirm LoginScreen renders and `/runtime/bootErrors` has one entry.
- [ ] CI green.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Note PR URL**

Done.
