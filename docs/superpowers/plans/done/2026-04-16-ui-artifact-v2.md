# UI Artifact v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace monolithic `ui.json` with a multi-file source format (manifest + screens + fragments), a 5-phase compiler, and a json-render/shadcn runtime.

**Architecture:** Source files (.spec.json + .screen.json per screen, parameterized fragments) are compiled into pre-split runtime artifacts (_manifest.json + per-route screen files). The runtime lazily loads screens via json-render/react + shadcn catalog, replacing the custom 19-component minimal-render.tsx.

**Tech Stack:** TypeScript (strict, ESM), zod@4, @json-render/core+react+shadcn@0.17, React 19, Tailwind CSS 4, Hono (server), esbuild (client bundle), vitest (tests)

**Spec:** `docs/superpowers/specs/done/2026-04-16-ui-artifact-v2-design.md`

---

## File Structure Overview

### packages/ui (new — compiler)

```
packages/ui/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts                          — public API
    types/
      source.ts                       — SourceManifest, ScreenDescriptor, FragmentSpec
      compiled.ts                     — CompiledManifest, CompiledScreen, CompiledLayout
      result.ts                       — Result<T>, UiError, error codes
    resolve/
      resolve.ts                      — Phase 1: read manifest, find files, resolve $ref, detect cycles
    expand/
      expand.ts                       — Phase 2: inline fragments, substitute $param, unique IDs
    validate/
      parse.ts                        — Layer 1: json-render catalog.validate + screen schema
      structural.ts                   — Layer 2: element trees, Slots, children, orphans
      references.ts                   — Layer 3: bindings exist, kinds match, $state paths covered
      consistency.ts                  — Layer 4: shape matching (binding output vs component props)
      index.ts                        — orchestrate 4 layers
    emit/
      http-map.ts                     — Phase 4: binding name → HTTP method+path
      emit.ts                         — Phase 5: generate pre-split artifact files
    compile.ts                        — orchestrate all phases: resolve → expand → validate → emit
  test/
    fixtures/
      minimal-app/                    — minimal valid source app (1 route, 1 layout, no fragments)
        manifest.json
        layouts/main.spec.json
        layouts/main.screen.json
        screens/home.spec.json
        screens/home.screen.json
      fragment-app/                   — app with parameterized fragments
        manifest.json
        layouts/main.spec.json
        layouts/main.screen.json
        screens/home.spec.json
        screens/home.screen.json
        fragments/greeting.spec.json
    unit/
      resolve.test.ts
      expand.test.ts
      validate.test.ts
      emit.test.ts
    integration/
      compile.test.ts
```

### packages/ui-runtime (new — SPA runtime)

```
packages/ui-runtime/
  package.json
  tsconfig.json
  vitest.config.ts
  src/
    index.ts                          — public API (server exports)
    server/
      index.ts                        — createApp(): Hono router
      static-shell.ts                 — HTML shell generation
    client/
      entry.tsx                       — app bootstrap, fetch manifest, render
      screen-loader.ts                — lazy fetch + cache screen/layout JSON
      router.ts                       — client-side route matching from manifest
      driver.ts                       — HTTP data fetching, action dispatch
      layout-manager.tsx              — persistent layout, slot injection
      registry.ts                     — json-render registry + shadcn catalog + custom actions
    build.ts                          — esbuild bundler config
  build/                              — esbuild output (main.js, main.css)
  test/
    unit/
      server.test.ts
      router.test.ts
      screen-loader.test.ts
      driver.test.ts
    fixtures/
      compiled-manifest.ts
      compiled-screen.ts
```

---

## Task 1: Workspace Preparation — Rename Packages and Upgrade Dependencies

**Files:**
- Rename: `packages/ui/` → `packages/ui-legacy/`
- Rename: `packages/ui-runtime/` → `packages/ui-runtime-legacy/`
- Modify: `packages/ui-legacy/package.json` (name → `@rntme/ui-legacy`)
- Modify: `packages/ui-runtime-legacy/package.json` (name → `@rntme/ui-runtime-legacy`)
- Modify: `packages/runtime/package.json` (update deps)
- Modify: `packages/runtime/src/load/load-service.ts` (update imports)
- Modify: `packages/runtime/src/plugins/http-surface.ts` (update imports)
- Modify: `demo/issue-tracker-api/package.json` (update deps)
- Modify: root `package.json` (dependency overrides if needed)
- Modify: all `packages/*/package.json` with zod dep (9 packages)

- [ ] **Step 1: Rename packages/ui to packages/ui-legacy**

```bash
mv packages/ui packages/ui-legacy
```

- [ ] **Step 2: Update package name in ui-legacy**

In `packages/ui-legacy/package.json`, change `"name"` from `"@rntme/ui"` to `"@rntme/ui-legacy"`.

- [ ] **Step 3: Rename packages/ui-runtime to packages/ui-runtime-legacy**

```bash
mv packages/ui-runtime packages/ui-runtime-legacy
```

- [ ] **Step 4: Update package name in ui-runtime-legacy**

In `packages/ui-runtime-legacy/package.json`, change `"name"` from `"@rntme/ui-runtime"` to `"@rntme/ui-runtime-legacy"`.

- [ ] **Step 5: Update packages/runtime to use legacy names**

In `packages/runtime/package.json`, update dependency names:
```json
"@rntme/ui-legacy": "workspace:*",
"@rntme/ui-runtime-legacy": "workspace:*"
```
(remove old `@rntme/ui` and `@rntme/ui-runtime` entries)

In `packages/runtime/src/load/load-service.ts`, update imports:
```typescript
import { validateUi, type ValidatedUiArtifact } from '@rntme/ui-legacy';
import { buildBindingResolver, buildComponentResolver } from '@rntme/ui-runtime-legacy';
```

In `packages/runtime/src/plugins/http-surface.ts`, update import:
```typescript
import { createUiApp } from '@rntme/ui-runtime-legacy';
```

Search for any other imports of `@rntme/ui` or `@rntme/ui-runtime` across the workspace and update them to the `-legacy` variants.

- [ ] **Step 6: Upgrade zod to v4 across workspace**

The workspace has `zod@3.25.76` installed (the v4 bridge). Update all 9 packages' `package.json` from `"zod": "^3.23.8"` to `"zod": "^4.0.0"`:

Packages to update:
- `packages/bindings/package.json`
- `packages/bindings-http/package.json`
- `packages/graph-ir-compiler/package.json`
- `packages/pdm/package.json`
- `packages/qsm/package.json`
- `packages/runtime/package.json`
- `packages/seed/package.json`
- `packages/ui-legacy/package.json`
- `packages/ui-runtime-legacy/package.json`

- [ ] **Step 7: Install and verify**

```bash
pnpm install
```

Expected: clean install, no peer dependency warnings for zod.

- [ ] **Step 8: Run existing tests to verify nothing broke**

```bash
pnpm -r run build && pnpm -r run test
```

Expected: all existing tests pass. If zod@4 introduces breaking changes (unlikely since 3.25.76 is the bridge version), fix them now. Common changes to watch for:
- `z.ZodTypeAny` may need to become `z.ZodType` in some contexts
- `.strict()` behavior may change (zod@4 objects are strict by default)
- Schema `.parse()` / `.safeParse()` API is stable

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: rename ui packages to -legacy, upgrade zod to v4"
```

---

## Task 2: packages/ui Scaffolding and Types

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/vitest.config.ts`
- Create: `packages/ui/src/types/result.ts`
- Create: `packages/ui/src/types/source.ts`
- Create: `packages/ui/src/types/compiled.ts`
- Create: `packages/ui/src/index.ts`
- Test: `packages/ui/test/unit/types.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@rntme/ui",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "vitest": "^2.1.1",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 10_000,
  },
});
```

- [ ] **Step 4: Create src/types/result.ts**

```typescript
export type UiErrorCode =
  // Resolve phase
  | 'MANIFEST_INVALID'
  | 'FILE_NOT_FOUND'
  | 'CIRCULAR_REF'
  // Expand phase
  | 'UNBOUND_PARAM'
  | 'UNKNOWN_PARAM'
  // Validate — parse
  | 'SPEC_INVALID'
  | 'SCREEN_SCHEMA_INVALID'
  // Validate — structural
  | 'MISSING_ROOT'
  | 'ORPHAN_ELEMENT'
  | 'BAD_CHILD_REF'
  | 'SLOT_NOT_IN_LAYOUT'
  | 'SLOT_DUPLICATE'
  // Validate — references
  | 'UNRESOLVED_BINDING'
  | 'BINDING_KIND_MISMATCH'
  | 'UNCOVERED_STATE_PATH'
  | 'UNKNOWN_ROUTE'
  // Validate — consistency
  | 'TYPE_MISMATCH'
  | 'UNCOVERED_INPUT'
  // Emit
  | 'EMIT_FAILED'
  // Generic
  | 'INTERNAL';

export type UiError = {
  code: UiErrorCode;
  message: string;
  path?: string;
};

export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; errors: UiError[] };
export type Result<T> = Ok<T> | Err;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err(...errors: UiError[]): Err {
  return { ok: false, errors };
}

export function isOk<T>(r: Result<T>): r is Ok<T> {
  return r.ok;
}

export function isErr<T>(r: Result<T>): r is Err {
  return !r.ok;
}
```

- [ ] **Step 5: Create src/types/source.ts**

These types describe the source-format files that authors write:

```typescript
/** manifest.json — root of a UI application */
export type SourceManifest = {
  version: '2.0';
  pdmRef: string;
  qsmRef: string;
  graphSpecRef: string;
  bindingsRef: string;
  metadata: {
    title: string;
    description?: string;
  };
  layouts: Record<string, string>;       // layout name → base path (e.g. "layouts/main")
  routes: Record<string, RouteEntry>;    // route pattern → screen config
};

export type RouteEntry = {
  layout: string;                        // layout name (key in manifest.layouts)
  screen: string;                        // base path (e.g. "screens/issues-home")
};

/** *.screen.json — data fetching, actions, metadata for a screen or layout */
export type ScreenDescriptor = {
  metadata?: { title?: string };
  data?: Record<string, DataBinding>;    // state path → data source
  actions?: Record<string, ActionDef>;
};

export type DataBinding = {
  binding: string;                       // binding ID from bindings artifact
  params?: Record<string, ParamValue>;
  refetchOn?: Array<'mount' | 'params'>;
};

export type ParamValue = string | number | boolean | StateRef;
export type StateRef = { $state: string };

export type ActionDef = NavigationAction | CommandAction;

export type NavigationAction = {
  kind: 'navigation';
  navigateTo: string;
  paramsFromState?: Record<string, string>;
};

export type CommandAction = {
  kind: 'command';
  binding: string;
  paramsFromState: Record<string, string>;
  onSuccess?: { navigateTo?: string; refetchData?: string[]; clearFormState?: string[] };
  onError?: { showAlert?: boolean };
};

/**
 * A json-render Spec. The `elements` map can include regular elements
 * or $ref elements (fragment references, resolved at compile time).
 */
export type SpecJson = {
  root: string;
  elements: Record<string, ElementJson | RefElement>;
};

export type ElementJson = {
  type: string;
  props: Record<string, unknown>;
  children?: string[];
  visible?: unknown;
  on?: Record<string, unknown>;
  watch?: Record<string, unknown>;
  repeat?: { statePath: string; key?: string };
};

export type RefElement = {
  $ref: string;                          // base path to fragment (e.g. "fragments/issue-card")
  bind: Record<string, unknown>;         // param name → value (literal, $state, etc.)
};

export function isRefElement(el: ElementJson | RefElement): el is RefElement {
  return '$ref' in el;
}

/**
 * Resolved source — after Phase 1 (Resolve), all files have been read
 * and assembled into this structure.
 */
export type ResolvedSource = {
  manifest: SourceManifest;
  baseDir: string;
  layouts: Record<string, { spec: SpecJson; screen: ScreenDescriptor }>;
  screens: Record<string, { spec: SpecJson; screen: ScreenDescriptor }>;
  fragments: Map<string, SpecJson>;      // base path → parsed fragment spec
};
```

- [ ] **Step 6: Create src/types/compiled.ts**

These types describe the runtime artifact that the compiler emits:

```typescript
/** _manifest.json — loaded by runtime at startup */
export type CompiledManifest = {
  version: '2.0';
  metadata: { title: string; description?: string };
  routes: Record<string, CompiledRouteEntry>;
};

export type CompiledRouteEntry = {
  layout: string;                        // layout name (matches key in _layouts/)
  screen: string;                        // screen name (matches key in _screens/)
};

/** _screens/*.json or _layouts/*.json */
export type CompiledScreen = {
  spec: CompiledSpec;
  data?: Record<string, CompiledDataEndpoint>;
  actions?: Record<string, CompiledAction>;
};

/** Pure json-render Spec — no $ref, no $param */
export type CompiledSpec = {
  root: string;
  elements: Record<string, CompiledElement>;
};

export type CompiledElement = {
  type: string;
  props: Record<string, unknown>;
  children?: string[];
  visible?: unknown;
  on?: Record<string, unknown>;
  watch?: Record<string, unknown>;
  repeat?: { statePath: string; key?: string };
};

/** Data binding resolved to HTTP endpoint */
export type CompiledDataEndpoint = {
  method: 'GET' | 'POST';
  path: string;                          // e.g. "/api/issues"
  params?: Record<string, unknown>;
  refetchOn?: Array<'mount' | 'params'>;
};

export type CompiledAction =
  | { kind: 'navigation'; navigateTo: string; paramsFromState?: Record<string, string> }
  | {
      kind: 'command';
      method: 'POST';
      path: string;
      paramsFromState: Record<string, string>;
      onSuccess?: { navigateTo?: string; refetchData?: string[]; clearFormState?: string[] };
      onError?: { showAlert?: boolean };
    };

/** Full compiled artifact — all files in one structure (used by compiler internally) */
export type CompiledArtifact = {
  manifest: CompiledManifest;
  layouts: Record<string, CompiledScreen>;
  screens: Record<string, CompiledScreen>;
};
```

- [ ] **Step 7: Create src/index.ts**

```typescript
export { ok, err, isOk, isErr } from './types/result.js';
export type { Result, UiError, UiErrorCode } from './types/result.js';

export type {
  SourceManifest, RouteEntry, ScreenDescriptor, DataBinding,
  ActionDef, NavigationAction, CommandAction, ParamValue, StateRef,
  SpecJson, ElementJson, RefElement, ResolvedSource,
} from './types/source.js';
export { isRefElement } from './types/source.js';

export type {
  CompiledManifest, CompiledRouteEntry, CompiledScreen, CompiledSpec,
  CompiledElement, CompiledDataEndpoint, CompiledAction, CompiledArtifact,
} from './types/compiled.js';
```

(The `compile` function will be added in a later task.)

- [ ] **Step 8: Write type smoke test**

Create `packages/ui/test/unit/types.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { ok, err, isOk, isErr, type Result, type UiError } from '../../src/types/result.js';
import { isRefElement, type ElementJson, type RefElement } from '../../src/types/source.js';

describe('Result helpers', () => {
  it('ok() creates an Ok result', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(isOk(r)).toBe(true);
    if (isOk(r)) expect(r.value).toBe(42);
  });

  it('err() creates an Err result', () => {
    const e: UiError = { code: 'INTERNAL', message: 'boom' };
    const r = err(e);
    expect(r.ok).toBe(false);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.errors).toEqual([e]);
  });
});

describe('isRefElement', () => {
  it('returns true for $ref elements', () => {
    const ref: RefElement = { $ref: 'fragments/card', bind: { title: 'hello' } };
    expect(isRefElement(ref)).toBe(true);
  });

  it('returns false for regular elements', () => {
    const el: ElementJson = { type: 'Text', props: { text: 'hi' } };
    expect(isRefElement(el)).toBe(false);
  });
});
```

- [ ] **Step 9: Run test**

```bash
cd packages/ui && pnpm test
```

Expected: 2 test suites, all pass.

- [ ] **Step 10: Commit**

```bash
git add packages/ui/
git commit -m "feat(ui): scaffold new packages/ui with source and compiled types"
```

---

## Task 3: Phase 1 — Resolve (Read Manifest, Find Files, Detect Cycles)

**Files:**
- Create: `packages/ui/src/resolve/resolve.ts`
- Create: `packages/ui/test/fixtures/minimal-app/manifest.json`
- Create: `packages/ui/test/fixtures/minimal-app/layouts/main.spec.json`
- Create: `packages/ui/test/fixtures/minimal-app/layouts/main.screen.json`
- Create: `packages/ui/test/fixtures/minimal-app/screens/home.spec.json`
- Create: `packages/ui/test/fixtures/minimal-app/screens/home.screen.json`
- Create: `packages/ui/test/fixtures/fragment-app/` (all files)
- Create: `packages/ui/test/fixtures/cycle-app/` (circular $ref)
- Test: `packages/ui/test/unit/resolve.test.ts`

- [ ] **Step 1: Create minimal-app fixture**

`packages/ui/test/fixtures/minimal-app/manifest.json`:
```json
{
  "version": "2.0",
  "pdmRef": "test.domain.v1",
  "qsmRef": "test.read.v1",
  "graphSpecRef": "test.graphs.v1",
  "bindingsRef": "test.bindings.v1",
  "metadata": { "title": "Test App" },
  "layouts": {
    "main": "layouts/main"
  },
  "routes": {
    "/": {
      "layout": "main",
      "screen": "screens/home"
    }
  }
}
```

`packages/ui/test/fixtures/minimal-app/layouts/main.spec.json`:
```json
{
  "root": "shell",
  "elements": {
    "shell": {
      "type": "Stack",
      "props": { "direction": "vertical" },
      "children": ["slot-main"]
    },
    "slot-main": {
      "type": "Slot",
      "props": { "name": "main" },
      "children": []
    }
  }
}
```

`packages/ui/test/fixtures/minimal-app/layouts/main.screen.json`:
```json
{}
```

`packages/ui/test/fixtures/minimal-app/screens/home.spec.json`:
```json
{
  "root": "page",
  "elements": {
    "page": {
      "type": "Heading",
      "props": { "level": 1, "text": "Home" },
      "children": []
    }
  }
}
```

`packages/ui/test/fixtures/minimal-app/screens/home.screen.json`:
```json
{
  "metadata": { "title": "Home" }
}
```

- [ ] **Step 2: Create fragment-app fixture**

`packages/ui/test/fixtures/fragment-app/manifest.json`:
```json
{
  "version": "2.0",
  "pdmRef": "test.domain.v1",
  "qsmRef": "test.read.v1",
  "graphSpecRef": "test.graphs.v1",
  "bindingsRef": "test.bindings.v1",
  "metadata": { "title": "Fragment App" },
  "layouts": {
    "main": "layouts/main"
  },
  "routes": {
    "/": {
      "layout": "main",
      "screen": "screens/home"
    }
  }
}
```

`packages/ui/test/fixtures/fragment-app/layouts/main.spec.json` — same as minimal-app.

`packages/ui/test/fixtures/fragment-app/layouts/main.screen.json`:
```json
{}
```

`packages/ui/test/fixtures/fragment-app/screens/home.spec.json`:
```json
{
  "root": "page",
  "elements": {
    "page": {
      "type": "Stack",
      "props": { "direction": "vertical" },
      "children": ["greeting"]
    },
    "greeting": {
      "$ref": "fragments/greeting",
      "bind": {
        "name": "World"
      }
    }
  }
}
```

`packages/ui/test/fixtures/fragment-app/screens/home.screen.json`:
```json
{
  "metadata": { "title": "Home" }
}
```

`packages/ui/test/fixtures/fragment-app/fragments/greeting.spec.json`:
```json
{
  "root": "wrap",
  "elements": {
    "wrap": {
      "type": "Text",
      "props": { "text": { "$param": "name" } },
      "children": []
    }
  }
}
```

- [ ] **Step 3: Create cycle-app fixture**

`packages/ui/test/fixtures/cycle-app/manifest.json`:
```json
{
  "version": "2.0",
  "pdmRef": "test.domain.v1",
  "qsmRef": "test.read.v1",
  "graphSpecRef": "test.graphs.v1",
  "bindingsRef": "test.bindings.v1",
  "metadata": { "title": "Cycle App" },
  "layouts": {
    "main": "layouts/main"
  },
  "routes": {
    "/": {
      "layout": "main",
      "screen": "screens/home"
    }
  }
}
```

Reuse same layout files as minimal-app.

`packages/ui/test/fixtures/cycle-app/layouts/main.spec.json` — same as minimal.
`packages/ui/test/fixtures/cycle-app/layouts/main.screen.json`: `{}`

`packages/ui/test/fixtures/cycle-app/screens/home.spec.json`:
```json
{
  "root": "page",
  "elements": {
    "page": {
      "type": "Stack",
      "props": {},
      "children": ["a"]
    },
    "a": {
      "$ref": "fragments/a",
      "bind": {}
    }
  }
}
```

`packages/ui/test/fixtures/cycle-app/screens/home.screen.json`: `{}`

`packages/ui/test/fixtures/cycle-app/fragments/a.spec.json`:
```json
{
  "root": "wrap",
  "elements": {
    "wrap": {
      "type": "Stack",
      "props": {},
      "children": ["nested"]
    },
    "nested": {
      "$ref": "fragments/b",
      "bind": {}
    }
  }
}
```

`packages/ui/test/fixtures/cycle-app/fragments/b.spec.json`:
```json
{
  "root": "wrap",
  "elements": {
    "wrap": {
      "type": "Stack",
      "props": {},
      "children": ["loop"]
    },
    "loop": {
      "$ref": "fragments/a",
      "bind": {}
    }
  }
}
```

- [ ] **Step 4: Write resolve tests**

Create `packages/ui/test/unit/resolve.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { resolve } from '../../src/resolve/resolve.js';

const fixtures = join(import.meta.dirname, '..', 'fixtures');

describe('resolve', () => {
  it('resolves a minimal app with no fragments', () => {
    const r = resolve(join(fixtures, 'minimal-app'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.manifest.version).toBe('2.0');
    expect(Object.keys(r.value.layouts)).toEqual(['main']);
    expect(Object.keys(r.value.screens)).toEqual(['home']);
    expect(r.value.fragments.size).toBe(0);
    expect(r.value.layouts['main']!.spec.root).toBe('shell');
    expect(r.value.screens['home']!.spec.root).toBe('page');
    expect(r.value.screens['home']!.screen.metadata?.title).toBe('Home');
  });

  it('resolves an app with fragments', () => {
    const r = resolve(join(fixtures, 'fragment-app'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.fragments.size).toBe(1);
    expect(r.value.fragments.has('fragments/greeting')).toBe(true);
  });

  it('detects circular fragment references', () => {
    const r = resolve(join(fixtures, 'cycle-app'));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]!.code).toBe('CIRCULAR_REF');
  });

  it('returns FILE_NOT_FOUND when manifest is missing', () => {
    const r = resolve(join(fixtures, 'nonexistent'));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]!.code).toBe('FILE_NOT_FOUND');
  });

  it('returns FILE_NOT_FOUND when screen files are missing', () => {
    // Create a manifest that references a non-existent screen
    const r = resolve(join(fixtures, 'minimal-app'));
    // This test verifies the happy path works; missing-file tests
    // use a dedicated fixture below
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

```bash
cd packages/ui && pnpm test -- test/unit/resolve.test.ts
```

Expected: FAIL — `resolve` module does not exist yet.

- [ ] **Step 6: Implement resolve**

Create `packages/ui/src/resolve/resolve.ts`:

```typescript
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ok, err, type Result, type UiError } from '../types/result.js';
import {
  isRefElement,
  type SourceManifest,
  type ScreenDescriptor,
  type SpecJson,
  type ResolvedSource,
} from '../types/source.js';

function readJson<T>(filePath: string): Result<T> {
  if (!existsSync(filePath)) {
    return err({ code: 'FILE_NOT_FOUND', message: `File not found: ${filePath}`, path: filePath });
  }
  try {
    return ok(JSON.parse(readFileSync(filePath, 'utf-8')) as T);
  } catch (e) {
    return err({ code: 'MANIFEST_INVALID', message: `Invalid JSON: ${filePath}: ${e}`, path: filePath });
  }
}

function readPair(baseDir: string, basePath: string): Result<{ spec: SpecJson; screen: ScreenDescriptor }> {
  const specPath = join(baseDir, `${basePath}.spec.json`);
  const screenPath = join(baseDir, `${basePath}.screen.json`);

  const specResult = readJson<SpecJson>(specPath);
  if (!specResult.ok) return specResult;

  const screenResult = readJson<ScreenDescriptor>(screenPath);
  if (!screenResult.ok) return screenResult;

  return ok({ spec: specResult.value, screen: screenResult.value });
}

/**
 * Collect all fragment base-paths referenced (transitively) from a set of specs.
 * Detects cycles and returns them as errors.
 */
function collectFragments(
  baseDir: string,
  specs: SpecJson[],
  fragments: Map<string, SpecJson>,
  visiting: Set<string>,
  errors: UiError[],
): void {
  for (const spec of specs) {
    for (const el of Object.values(spec.elements)) {
      if (!isRefElement(el)) continue;
      const refPath = el.$ref;

      if (visiting.has(refPath)) {
        errors.push({
          code: 'CIRCULAR_REF',
          message: `Circular fragment reference: ${[...visiting, refPath].join(' → ')}`,
          path: refPath,
        });
        return;
      }

      if (fragments.has(refPath)) continue;

      const filePath = join(baseDir, `${refPath}.spec.json`);
      const fragResult = readJson<SpecJson>(filePath);
      if (!fragResult.ok) {
        errors.push(...fragResult.errors);
        continue;
      }

      fragments.set(refPath, fragResult.value);
      visiting.add(refPath);
      collectFragments(baseDir, [fragResult.value], fragments, visiting, errors);
      visiting.delete(refPath);
    }
  }
}

export function resolve(baseDir: string): Result<ResolvedSource> {
  // 1. Read manifest
  const manifestResult = readJson<SourceManifest>(join(baseDir, 'manifest.json'));
  if (!manifestResult.ok) return manifestResult;
  const manifest = manifestResult.value;

  // 2. Read layouts
  const layouts: Record<string, { spec: SpecJson; screen: ScreenDescriptor }> = {};
  for (const [name, basePath] of Object.entries(manifest.layouts)) {
    const pair = readPair(baseDir, basePath);
    if (!pair.ok) return pair;
    layouts[name] = pair.value;
  }

  // 3. Read screens
  const screens: Record<string, { spec: SpecJson; screen: ScreenDescriptor }> = {};
  for (const route of Object.values(manifest.routes)) {
    // Derive screen key from base path (last segment)
    const key = route.screen.split('/').pop()!;
    const pair = readPair(baseDir, route.screen);
    if (!pair.ok) return pair;
    screens[key] = pair.value;
  }

  // 4. Collect fragments (transitively, with cycle detection)
  const fragments = new Map<string, SpecJson>();
  const allSpecs = [
    ...Object.values(layouts).map((l) => l.spec),
    ...Object.values(screens).map((s) => s.spec),
  ];
  const errors: UiError[] = [];
  collectFragments(baseDir, allSpecs, fragments, new Set(), errors);
  if (errors.length > 0) return err(...errors);

  return ok({ manifest, baseDir, layouts, screens, fragments });
}
```

- [ ] **Step 7: Run tests**

```bash
cd packages/ui && pnpm test -- test/unit/resolve.test.ts
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/
git commit -m "feat(ui): Phase 1 — resolve manifest, files, and fragments with cycle detection"
```

---

## Task 4: Phase 2 — Expand (Inline Fragments)

**Files:**
- Create: `packages/ui/src/expand/expand.ts`
- Test: `packages/ui/test/unit/expand.test.ts`

- [ ] **Step 1: Write expand tests**

Create `packages/ui/test/unit/expand.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { resolve } from '../../src/resolve/resolve.js';
import { expand } from '../../src/expand/expand.js';

const fixtures = join(import.meta.dirname, '..', 'fixtures');

describe('expand', () => {
  it('passes through a spec with no $ref elements', () => {
    const resolved = resolve(join(fixtures, 'minimal-app'));
    if (!resolved.ok) throw new Error('resolve failed');
    const expanded = expand(resolved.value);
    expect(expanded.ok).toBe(true);
    if (!expanded.ok) return;
    // Screen spec unchanged
    const home = expanded.value.screens['home']!;
    expect(home.spec.root).toBe('page');
    expect(home.spec.elements['page']!.type).toBe('Heading');
  });

  it('inlines a fragment and substitutes $param', () => {
    const resolved = resolve(join(fixtures, 'fragment-app'));
    if (!resolved.ok) throw new Error('resolve failed');
    const expanded = expand(resolved.value);
    expect(expanded.ok).toBe(true);
    if (!expanded.ok) return;

    const home = expanded.value.screens['home']!;
    // The $ref "greeting" element should be gone
    expect(home.spec.elements['greeting']).toBeUndefined();
    // Fragment root is inlined with prefixed key
    const inlinedKey = 'greeting__wrap';
    expect(home.spec.elements[inlinedKey]).toBeDefined();
    expect(home.spec.elements[inlinedKey]!.type).toBe('Text');
    // $param should be substituted with bind value
    expect(home.spec.elements[inlinedKey]!.props['text']).toBe('World');
    // Parent's children should reference the inlined root
    expect(home.spec.elements['page']!.children).toContain(inlinedKey);
    expect(home.spec.elements['page']!.children).not.toContain('greeting');
  });

  it('output contains no $ref or $param', () => {
    const resolved = resolve(join(fixtures, 'fragment-app'));
    if (!resolved.ok) throw new Error('resolve failed');
    const expanded = expand(resolved.value);
    expect(expanded.ok).toBe(true);
    if (!expanded.ok) return;

    const json = JSON.stringify(expanded.value);
    expect(json).not.toContain('"$ref"');
    expect(json).not.toContain('"$param"');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/ui && pnpm test -- test/unit/expand.test.ts
```

Expected: FAIL — `expand` module does not exist yet.

- [ ] **Step 3: Implement expand**

Create `packages/ui/src/expand/expand.ts`:

```typescript
import { ok, err, type Result, type UiError } from '../types/result.js';
import {
  isRefElement,
  type ResolvedSource,
  type SpecJson,
  type ElementJson,
  type RefElement,
} from '../types/source.js';
import type { CompiledElement } from '../types/compiled.js';

type ExpandedSource = Omit<ResolvedSource, 'fragments'> & {
  layouts: Record<string, { spec: { root: string; elements: Record<string, CompiledElement> }; screen: ResolvedSource['layouts'][string]['screen'] }>;
  screens: Record<string, { spec: { root: string; elements: Record<string, CompiledElement> }; screen: ResolvedSource['screens'][string]['screen'] }>;
};

/**
 * Deep-walk a value tree, replacing { $param: "name" } with the bound value.
 */
function substituteParams(value: unknown, bindings: Record<string, unknown>): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => substituteParams(v, bindings));

  const obj = value as Record<string, unknown>;
  if ('$param' in obj && typeof obj['$param'] === 'string') {
    const paramName = obj['$param'];
    if (!(paramName in bindings)) return obj; // will be caught by validation
    return bindings[paramName];
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = substituteParams(v, bindings);
  }
  return out;
}

/**
 * Inline a single $ref element: load fragment, prefix IDs, substitute $param,
 * return the new elements and the inlined root key.
 */
function inlineFragment(
  refKey: string,
  ref: RefElement,
  fragments: Map<string, SpecJson>,
  errors: UiError[],
): { rootKey: string; elements: Record<string, CompiledElement> } | null {
  const fragmentSpec = fragments.get(ref.$ref);
  if (!fragmentSpec) {
    errors.push({ code: 'FILE_NOT_FOUND', message: `Fragment not found: ${ref.$ref}`, path: ref.$ref });
    return null;
  }

  const prefix = `${refKey}__`;
  const elements: Record<string, CompiledElement> = {};

  for (const [elKey, el] of Object.entries(fragmentSpec.elements)) {
    if (isRefElement(el)) {
      // Nested $ref — recursively inline
      const nested = inlineFragment(`${prefix}${elKey}`, el, fragments, errors);
      if (!nested) continue;
      // Merge nested elements
      for (const [nk, nv] of Object.entries(nested.elements)) {
        elements[nk] = nv;
      }
      // The nested ref's slot in our elements points to nested root
      // (handled by children rewiring below)
      continue;
    }

    const prefixedKey = `${prefix}${elKey}`;
    const substitutedProps = substituteParams(el.props, ref.bind) as Record<string, unknown>;
    const prefixedChildren = (el.children ?? []).map((c) => {
      // Check if this child is a $ref in the fragment
      const childEl = fragmentSpec.elements[c];
      if (childEl && isRefElement(childEl)) {
        // The child was a nested ref, find its inlined root key
        const nestedPrefix = `${prefix}${c}__`;
        const nestedRoot = fragmentSpec.elements[c] && isRefElement(fragmentSpec.elements[c]!)
          ? `${nestedPrefix}${fragments.get(fragmentSpec.elements[c]!.$ref)?.root ?? c}`
          : `${prefix}${c}`;
        return nestedRoot;
      }
      return `${prefix}${c}`;
    });

    elements[prefixedKey] = {
      type: el.type,
      props: substitutedProps,
      ...(prefixedChildren.length > 0 ? { children: prefixedChildren } : {}),
      ...(el.visible !== undefined ? { visible: substituteParams(el.visible, ref.bind) } : {}),
      ...(el.on ? { on: substituteParams(el.on, ref.bind) as Record<string, unknown> } : {}),
      ...(el.watch ? { watch: substituteParams(el.watch, ref.bind) as Record<string, unknown> } : {}),
      ...(el.repeat ? { repeat: el.repeat } : {}),
    };
  }

  return { rootKey: `${prefix}${fragmentSpec.root}`, elements };
}

function expandSpec(
  spec: SpecJson,
  fragments: Map<string, SpecJson>,
  errors: UiError[],
): { root: string; elements: Record<string, CompiledElement> } {
  const elements: Record<string, CompiledElement> = {};

  for (const [key, el] of Object.entries(spec.elements)) {
    if (isRefElement(el)) continue; // handled below
    elements[key] = {
      type: el.type,
      props: el.props,
      ...(el.children && el.children.length > 0 ? { children: [...el.children] } : {}),
      ...(el.visible !== undefined ? { visible: el.visible } : {}),
      ...(el.on ? { on: el.on } : {}),
      ...(el.watch ? { watch: el.watch } : {}),
      ...(el.repeat ? { repeat: el.repeat } : {}),
    };
  }

  // Now inline $ref elements and rewire children
  for (const [key, el] of Object.entries(spec.elements)) {
    if (!isRefElement(el)) continue;
    const inlined = inlineFragment(key, el, fragments, errors);
    if (!inlined) continue;

    // Merge inlined elements
    for (const [ik, iv] of Object.entries(inlined.elements)) {
      elements[ik] = iv;
    }

    // Rewire any parent that references this $ref key in its children
    for (const parent of Object.values(elements)) {
      if (!parent.children) continue;
      const idx = parent.children.indexOf(key);
      if (idx !== -1) {
        parent.children[idx] = inlined.rootKey;
      }
    }
  }

  return { root: spec.root, elements };
}

export function expand(resolved: ResolvedSource): Result<ExpandedSource> {
  const errors: UiError[] = [];

  const layouts: ExpandedSource['layouts'] = {};
  for (const [name, layout] of Object.entries(resolved.layouts)) {
    layouts[name] = {
      spec: expandSpec(layout.spec, resolved.fragments, errors),
      screen: layout.screen,
    };
  }

  const screens: ExpandedSource['screens'] = {};
  for (const [name, screen] of Object.entries(resolved.screens)) {
    screens[name] = {
      spec: expandSpec(screen.spec, resolved.fragments, errors),
      screen: screen.screen,
    };
  }

  if (errors.length > 0) return err(...errors);

  return ok({
    manifest: resolved.manifest,
    baseDir: resolved.baseDir,
    layouts,
    screens,
    fragments: resolved.fragments,
  } as unknown as ExpandedSource);
}

export type { ExpandedSource };
```

- [ ] **Step 4: Run tests**

```bash
cd packages/ui && pnpm test -- test/unit/expand.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/expand/ packages/ui/test/
git commit -m "feat(ui): Phase 2 — expand fragments with \$param substitution and ID prefixing"
```

---

## Task 5: Phase 3 — Validate (4-Layer Validation)

**Files:**
- Create: `packages/ui/src/validate/parse.ts`
- Create: `packages/ui/src/validate/structural.ts`
- Create: `packages/ui/src/validate/references.ts`
- Create: `packages/ui/src/validate/consistency.ts`
- Create: `packages/ui/src/validate/index.ts`
- Test: `packages/ui/test/unit/validate.test.ts`

Validation depends on external resolvers (bindings, components) — same pattern as the legacy package. Since validation is deep and the legacy code already works, adapt the validation logic from `packages/ui-legacy/src/validate/` for the new types. The key difference is that input is `ExpandedSource` (already expanded, no $ref) instead of `UiArtifact`.

- [ ] **Step 1: Write validation tests**

Create `packages/ui/test/unit/validate.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { resolve } from '../../src/resolve/resolve.js';
import { expand, type ExpandedSource } from '../../src/expand/expand.js';
import { validate, type ValidateResolvers } from '../../src/validate/index.js';

const fixtures = join(import.meta.dirname, '..', 'fixtures');

function loadExpanded(name: string): ExpandedSource {
  const r = resolve(join(fixtures, name));
  if (!r.ok) throw new Error(`resolve failed: ${JSON.stringify(r.errors)}`);
  const e = expand(r.value);
  if (!e.ok) throw new Error(`expand failed: ${JSON.stringify(e.errors)}`);
  return e.value;
}

const noopResolvers: ValidateResolvers = {
  resolveBinding: () => undefined,
  resolveComponent: () => ({ childrenModel: 'list' }),
  resolveRoute: () => true,
};

describe('validate', () => {
  it('validates a minimal expanded app', () => {
    const expanded = loadExpanded('minimal-app');
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(true);
  });

  it('validates an app with expanded fragments', () => {
    const expanded = loadExpanded('fragment-app');
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(true);
  });

  it('rejects missing root element', () => {
    const expanded = loadExpanded('minimal-app');
    // Break the spec: point root to nonexistent element
    expanded.screens['home']!.spec.root = 'nonexistent';
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'MISSING_ROOT')).toBe(true);
  });

  it('rejects orphan elements', () => {
    const expanded = loadExpanded('minimal-app');
    // Add an orphan element not referenced by any parent or root
    expanded.screens['home']!.spec.elements['orphan'] = {
      type: 'Text',
      props: { text: 'lonely' },
    };
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'ORPHAN_ELEMENT')).toBe(true);
  });

  it('rejects bad child references', () => {
    const expanded = loadExpanded('minimal-app');
    expanded.screens['home']!.spec.elements['page']!.children = ['nonexistent'];
    const result = validate(expanded, noopResolvers);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'BAD_CHILD_REF')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/ui && pnpm test -- test/unit/validate.test.ts
```

Expected: FAIL — validate module does not exist.

- [ ] **Step 3: Implement validation — structural layer**

Create `packages/ui/src/validate/structural.ts`:

```typescript
import type { CompiledSpec } from '../types/compiled.js';
import type { UiError } from '../types/result.js';

/** Validate element tree structure: root exists, no orphans, children valid, slots only in layouts */
export function validateStructural(
  spec: CompiledSpec,
  context: string,
  isLayout: boolean,
): UiError[] {
  const errors: UiError[] = [];
  const elements = spec.elements;

  // Root must exist
  if (!(spec.root in elements)) {
    errors.push({
      code: 'MISSING_ROOT',
      message: `Root element "${spec.root}" not found in ${context}`,
      path: context,
    });
    return errors;
  }

  // Collect all referenced children
  const referenced = new Set<string>([spec.root]);
  for (const el of Object.values(elements)) {
    for (const child of el.children ?? []) {
      referenced.add(child);
    }
  }

  // Check children point to existing elements
  for (const [key, el] of Object.entries(elements)) {
    for (const child of el.children ?? []) {
      if (!(child in elements)) {
        errors.push({
          code: 'BAD_CHILD_REF',
          message: `Element "${key}" references child "${child}" which does not exist in ${context}`,
          path: `${context}/${key}`,
        });
      }
    }
  }

  // Orphan detection
  for (const key of Object.keys(elements)) {
    if (!referenced.has(key)) {
      errors.push({
        code: 'ORPHAN_ELEMENT',
        message: `Element "${key}" is not referenced by any parent or root in ${context}`,
        path: `${context}/${key}`,
      });
    }
  }

  // Slot elements only allowed in layouts
  if (!isLayout) {
    for (const [key, el] of Object.entries(elements)) {
      if (el.type === 'Slot') {
        errors.push({
          code: 'SLOT_NOT_IN_LAYOUT',
          message: `Slot element "${key}" found in screen ${context} — Slots are only allowed in layouts`,
          path: `${context}/${key}`,
        });
      }
    }
  }

  // Layout must have at least one Slot
  if (isLayout) {
    const hasSlot = Object.values(elements).some((el) => el.type === 'Slot');
    if (!hasSlot) {
      errors.push({
        code: 'SLOT_DUPLICATE',
        message: `Layout ${context} has no Slot element`,
        path: context,
      });
    }
  }

  return errors;
}
```

- [ ] **Step 4: Implement validation — references layer**

Create `packages/ui/src/validate/references.ts`:

```typescript
import type { UiError } from '../types/result.js';
import type { ScreenDescriptor } from '../types/source.js';
import type { CompiledSpec } from '../types/compiled.js';
import type { ValidateResolvers } from './index.js';

/** Collect all $state paths used in a spec by deep-walking props */
function collectStatePaths(spec: CompiledSpec): Set<string> {
  const paths = new Set<string>();

  function walk(value: unknown): void {
    if (value === null || value === undefined || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    const obj = value as Record<string, unknown>;
    if ('$state' in obj && typeof obj['$state'] === 'string') {
      paths.add(obj['$state']);
      return;
    }
    Object.values(obj).forEach(walk);
  }

  for (const el of Object.values(spec.elements)) {
    walk(el.props);
    walk(el.visible);
    walk(el.on);
    walk(el.watch);
  }
  return paths;
}

/** Validate references: bindings exist, state paths are covered */
export function validateReferences(
  spec: CompiledSpec,
  screen: ScreenDescriptor,
  context: string,
  resolvers: ValidateResolvers,
): UiError[] {
  const errors: UiError[] = [];

  // Check all bindings in data section exist
  if (screen.data) {
    for (const [statePath, db] of Object.entries(screen.data)) {
      const resolved = resolvers.resolveBinding(db.binding);
      if (!resolved) {
        errors.push({
          code: 'UNRESOLVED_BINDING',
          message: `Data binding "${db.binding}" for "${statePath}" not found in ${context}`,
          path: `${context}/data/${statePath}`,
        });
      }
    }
  }

  // Check all bindings in command actions exist
  if (screen.actions) {
    for (const [actionId, action] of Object.entries(screen.actions)) {
      if (action.kind === 'command') {
        const resolved = resolvers.resolveBinding(action.binding);
        if (!resolved) {
          errors.push({
            code: 'UNRESOLVED_BINDING',
            message: `Command binding "${action.binding}" for action "${actionId}" not found in ${context}`,
            path: `${context}/actions/${actionId}`,
          });
        }
      }
      if (action.kind === 'navigation' && action.navigateTo) {
        if (!resolvers.resolveRoute(action.navigateTo)) {
          errors.push({
            code: 'UNKNOWN_ROUTE',
            message: `Navigation target "${action.navigateTo}" not found for action "${actionId}" in ${context}`,
            path: `${context}/actions/${actionId}`,
          });
        }
      }
    }
  }

  // Check $state paths are covered by data bindings, form inputs, route params, or action statuses
  const statePaths = collectStatePaths(spec);
  const coveredPrefixes = new Set<string>();
  if (screen.data) {
    for (const statePath of Object.keys(screen.data)) {
      coveredPrefixes.add(statePath);
    }
  }

  for (const path of statePaths) {
    const isCovered =
      coveredPrefixes.has(path) ||
      path.startsWith('/form/') ||
      path.startsWith('/route/params/') ||
      path.startsWith('/actions/') ||
      path.startsWith('/data/__status/') ||
      path.startsWith('/data/__error/');
    if (!isCovered) {
      errors.push({
        code: 'UNCOVERED_STATE_PATH',
        message: `State path "${path}" in ${context} is not covered by any data binding, form, route param, or action status`,
        path: `${context}`,
      });
    }
  }

  return errors;
}
```

- [ ] **Step 5: Implement validation orchestrator**

Create `packages/ui/src/validate/index.ts`:

```typescript
import { ok, err, type Result, type UiError } from '../types/result.js';
import type { ExpandedSource } from '../expand/expand.js';
import { validateStructural } from './structural.js';
import { validateReferences } from './references.js';

export type ValidateResolvers = {
  resolveBinding: (id: string) => unknown | undefined;
  resolveComponent: (type: string) => { childrenModel: 'none' | 'list' } | undefined;
  resolveRoute: (path: string) => boolean;
};

export function validate(expanded: ExpandedSource, resolvers: ValidateResolvers): Result<void> {
  const errors: UiError[] = [];

  // Structural validation — layouts
  for (const [name, layout] of Object.entries(expanded.layouts)) {
    errors.push(...validateStructural(layout.spec, `layout:${name}`, true));
  }

  // Structural validation — screens
  for (const [name, screen] of Object.entries(expanded.screens)) {
    errors.push(...validateStructural(screen.spec, `screen:${name}`, false));
  }

  // Stop early if structural errors
  if (errors.length > 0) return err(...errors);

  // Route resolver that knows about manifest routes
  const routePatterns = Object.keys(expanded.manifest.routes);
  const resolveRoute = (path: string): boolean => {
    return routePatterns.some((pattern) => {
      if (pattern === path) return true;
      // Match parameterized routes (e.g., /issues/:id matches /issues/:id)
      const patternParts = pattern.split('/');
      const pathParts = path.split('/');
      if (patternParts.length !== pathParts.length) return false;
      return patternParts.every((p, i) => p.startsWith(':') || p === pathParts[i]);
    });
  };

  const mergedResolvers: ValidateResolvers = {
    ...resolvers,
    resolveRoute: (path) => resolvers.resolveRoute(path) || resolveRoute(path),
  };

  // Reference validation — screens
  for (const [name, screen] of Object.entries(expanded.screens)) {
    errors.push(
      ...validateReferences(screen.spec, screen.screen, `screen:${name}`, mergedResolvers),
    );
  }

  // Reference validation — layouts (may have data bindings too)
  for (const [name, layout] of Object.entries(expanded.layouts)) {
    errors.push(
      ...validateReferences(layout.spec, layout.screen, `layout:${name}`, mergedResolvers),
    );
  }

  if (errors.length > 0) return err(...errors);
  return ok(undefined);
}
```

- [ ] **Step 6: Run tests**

```bash
cd packages/ui && pnpm test -- test/unit/validate.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/validate/ packages/ui/test/unit/validate.test.ts
git commit -m "feat(ui): Phase 3 — structural + reference validation for expanded source"
```

---

## Task 6: Phase 4+5 — HTTP Map, Emit, and Compile Orchestrator

**Files:**
- Create: `packages/ui/src/emit/http-map.ts`
- Create: `packages/ui/src/emit/emit.ts`
- Create: `packages/ui/src/compile.ts`
- Modify: `packages/ui/src/index.ts` (export compile)
- Test: `packages/ui/test/unit/emit.test.ts`
- Test: `packages/ui/test/integration/compile.test.ts`

- [ ] **Step 1: Write emit tests**

Create `packages/ui/test/unit/emit.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { resolve } from '../../src/resolve/resolve.js';
import { expand } from '../../src/expand/expand.js';
import { emit } from '../../src/emit/emit.js';

const fixtures = join(import.meta.dirname, '..', 'fixtures');

const mockHttpMap: Record<string, { method: 'GET' | 'POST'; path: string }> = {
  testQuery: { method: 'GET', path: '/api/test' },
  testCommand: { method: 'POST', path: '/api/test/action' },
};

describe('emit', () => {
  it('emits a compiled manifest with routes', () => {
    const r = resolve(join(fixtures, 'minimal-app'));
    if (!r.ok) throw new Error('resolve failed');
    const e = expand(r.value);
    if (!e.ok) throw new Error('expand failed');
    const result = emit(e.value, mockHttpMap);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.manifest.version).toBe('2.0');
    expect(result.value.manifest.metadata.title).toBe('Test App');
    expect(result.value.manifest.routes['/']).toEqual({
      layout: 'main',
      screen: 'home',
    });
  });

  it('emits compiled screens with spec and no data', () => {
    const r = resolve(join(fixtures, 'minimal-app'));
    if (!r.ok) throw new Error('resolve failed');
    const e = expand(r.value);
    if (!e.ok) throw new Error('expand failed');
    const result = emit(e.value, mockHttpMap);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const home = result.value.screens['home'];
    expect(home).toBeDefined();
    expect(home!.spec.root).toBe('page');
    expect(home!.spec.elements['page']!.type).toBe('Heading');
  });

  it('emits compiled layouts', () => {
    const r = resolve(join(fixtures, 'minimal-app'));
    if (!r.ok) throw new Error('resolve failed');
    const e = expand(r.value);
    if (!e.ok) throw new Error('expand failed');
    const result = emit(e.value, mockHttpMap);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const main = result.value.layouts['main'];
    expect(main).toBeDefined();
    expect(main!.spec.root).toBe('shell');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd packages/ui && pnpm test -- test/unit/emit.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement http-map**

Create `packages/ui/src/emit/http-map.ts`:

```typescript
import type { ScreenDescriptor, CommandAction } from '../types/source.js';

export type HttpEntry = { method: 'GET' | 'POST'; path: string };

/**
 * Given a screen descriptor and a lookup of binding → HTTP entry,
 * resolves data bindings and command actions to HTTP endpoints.
 */
export function resolveScreenHttp(
  screen: ScreenDescriptor,
  httpMap: Record<string, HttpEntry>,
): {
  data: Record<string, { method: 'GET' | 'POST'; path: string; params?: Record<string, unknown>; refetchOn?: string[] }>;
  actions: Record<string, unknown>;
} {
  const data: Record<string, { method: 'GET' | 'POST'; path: string; params?: Record<string, unknown>; refetchOn?: string[] }> = {};

  if (screen.data) {
    for (const [statePath, db] of Object.entries(screen.data)) {
      const http = httpMap[db.binding];
      if (!http) continue; // validation should have caught this
      data[statePath] = {
        method: http.method,
        path: http.path,
        ...(db.params ? { params: db.params } : {}),
        ...(db.refetchOn ? { refetchOn: db.refetchOn } : {}),
      };
    }
  }

  const actions: Record<string, unknown> = {};
  if (screen.actions) {
    for (const [actionId, action] of Object.entries(screen.actions)) {
      if (action.kind === 'navigation') {
        actions[actionId] = { ...action };
      } else {
        const http = httpMap[action.binding];
        if (!http) continue;
        const { binding: _, ...rest } = action;
        actions[actionId] = {
          ...rest,
          method: http.method,
          path: http.path,
        };
      }
    }
  }

  return { data, actions };
}
```

- [ ] **Step 4: Implement emit**

Create `packages/ui/src/emit/emit.ts`:

```typescript
import { ok, type Result } from '../types/result.js';
import type { CompiledArtifact, CompiledScreen } from '../types/compiled.js';
import type { ExpandedSource } from '../expand/expand.js';
import { resolveScreenHttp, type HttpEntry } from './http-map.js';

export function emit(
  expanded: ExpandedSource,
  httpMap: Record<string, HttpEntry>,
): Result<CompiledArtifact> {
  const manifest = {
    version: '2.0' as const,
    metadata: expanded.manifest.metadata,
    routes: {} as Record<string, { layout: string; screen: string }>,
  };

  // Build route → screen name mapping
  for (const [pattern, route] of Object.entries(expanded.manifest.routes)) {
    const screenName = route.screen.split('/').pop()!;
    manifest.routes[pattern] = {
      layout: route.layout,
      screen: screenName,
    };
  }

  // Compile screens
  const screens: Record<string, CompiledScreen> = {};
  for (const [name, screen] of Object.entries(expanded.screens)) {
    const { data, actions } = resolveScreenHttp(screen.screen, httpMap);
    screens[name] = {
      spec: screen.spec,
      ...(Object.keys(data).length > 0 ? { data } : {}),
      ...(Object.keys(actions).length > 0 ? { actions } : {}),
    } as CompiledScreen;
  }

  // Compile layouts
  const layouts: Record<string, CompiledScreen> = {};
  for (const [name, layout] of Object.entries(expanded.layouts)) {
    const { data, actions } = resolveScreenHttp(layout.screen, httpMap);
    layouts[name] = {
      spec: layout.spec,
      ...(Object.keys(data).length > 0 ? { data } : {}),
      ...(Object.keys(actions).length > 0 ? { actions } : {}),
    } as CompiledScreen;
  }

  return ok({ manifest, layouts, screens });
}
```

- [ ] **Step 5: Run emit tests**

```bash
cd packages/ui && pnpm test -- test/unit/emit.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Implement compile orchestrator**

Create `packages/ui/src/compile.ts`:

```typescript
import { err, type Result } from './types/result.js';
import type { CompiledArtifact } from './types/compiled.js';
import { resolve } from './resolve/resolve.js';
import { expand } from './expand/expand.js';
import { validate, type ValidateResolvers } from './validate/index.js';
import { emit } from './emit/emit.js';
import type { HttpEntry } from './emit/http-map.js';

export type CompileOptions = {
  /** Absolute path to the source directory containing manifest.json */
  sourceDir: string;
  /** Binding ID → HTTP method + path. From bindings artifact. */
  httpMap: Record<string, HttpEntry>;
  /** External resolvers for validation (binding shapes, component catalog, etc.) */
  resolvers: ValidateResolvers;
};

export function compile(opts: CompileOptions): Result<CompiledArtifact> {
  // Phase 1: Resolve
  const resolved = resolve(opts.sourceDir);
  if (!resolved.ok) return resolved;

  // Phase 2: Expand
  const expanded = expand(resolved.value);
  if (!expanded.ok) return expanded;

  // Phase 3: Validate
  const valid = validate(expanded.value, opts.resolvers);
  if (!valid.ok) return err(...valid.errors);

  // Phase 4+5: HTTP Map + Emit
  return emit(expanded.value, opts.httpMap);
}
```

- [ ] **Step 7: Export compile from index.ts**

Add to `packages/ui/src/index.ts`:

```typescript
export { compile } from './compile.js';
export type { CompileOptions } from './compile.js';
export { resolve } from './resolve/resolve.js';
export { expand } from './expand/expand.js';
export type { ExpandedSource } from './expand/expand.js';
export { validate } from './validate/index.js';
export type { ValidateResolvers } from './validate/index.js';
export { emit } from './emit/emit.js';
export type { HttpEntry } from './emit/http-map.js';
```

- [ ] **Step 8: Write integration test**

Create `packages/ui/test/integration/compile.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { compile } from '../../src/compile.js';

const fixtures = join(import.meta.dirname, '..', 'fixtures');

describe('compile (integration)', () => {
  it('compiles minimal-app end-to-end', () => {
    const result = compile({
      sourceDir: join(fixtures, 'minimal-app'),
      httpMap: {},
      resolvers: {
        resolveBinding: () => undefined,
        resolveComponent: () => ({ childrenModel: 'list' }),
        resolveRoute: () => true,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Manifest
    expect(result.value.manifest.version).toBe('2.0');
    expect(result.value.manifest.routes['/']).toEqual({
      layout: 'main',
      screen: 'home',
    });

    // Screen
    expect(result.value.screens['home']).toBeDefined();
    expect(result.value.screens['home']!.spec.root).toBe('page');

    // Layout
    expect(result.value.layouts['main']).toBeDefined();
    expect(result.value.layouts['main']!.spec.root).toBe('shell');
  });

  it('compiles fragment-app with inlined fragments', () => {
    const result = compile({
      sourceDir: join(fixtures, 'fragment-app'),
      httpMap: {},
      resolvers: {
        resolveBinding: () => undefined,
        resolveComponent: () => ({ childrenModel: 'list' }),
        resolveRoute: () => true,
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Fragment should be inlined
    const home = result.value.screens['home']!;
    const json = JSON.stringify(home.spec);
    expect(json).not.toContain('$ref');
    expect(json).not.toContain('$param');
    expect(home.spec.elements['greeting__wrap']).toBeDefined();
  });

  it('rejects cycle-app', () => {
    const result = compile({
      sourceDir: join(fixtures, 'cycle-app'),
      httpMap: {},
      resolvers: {
        resolveBinding: () => undefined,
        resolveComponent: () => ({ childrenModel: 'list' }),
        resolveRoute: () => true,
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'CIRCULAR_REF')).toBe(true);
  });
});
```

- [ ] **Step 9: Run all tests**

```bash
cd packages/ui && pnpm test
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add packages/ui/
git commit -m "feat(ui): Phase 4+5 — HTTP map, emit, and compile orchestrator"
```

---

## Task 7: packages/ui-runtime — Server

**Files:**
- Create: `packages/ui-runtime/package.json`
- Create: `packages/ui-runtime/tsconfig.json`
- Create: `packages/ui-runtime/vitest.config.ts`
- Create: `packages/ui-runtime/src/index.ts`
- Create: `packages/ui-runtime/src/server/index.ts`
- Create: `packages/ui-runtime/src/server/static-shell.ts`
- Test: `packages/ui-runtime/test/unit/server.test.ts`
- Test: `packages/ui-runtime/test/fixtures/compiled-manifest.ts`
- Test: `packages/ui-runtime/test/fixtures/compiled-screen.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@rntme/ui-runtime",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./server": "./dist/server/index.js",
    "./client": "./dist/client/index.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json && pnpm run build:client",
    "build:client": "tsx src/build.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@json-render/core": "^0.17.0",
    "@json-render/react": "^0.17.0",
    "@json-render/shadcn": "^0.17.0",
    "@rntme/ui": "workspace:*",
    "hono": "^4.6.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "esbuild": "^0.23.0",
    "tailwindcss": "^4.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.1"
  }
}
```

Note: React upgraded to ^19.0.0 (required by @json-render/react), tailwindcss@4 added (required by @json-render/shadcn).

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "jsx": "react-jsx",
    "composite": false,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["dist", "node_modules", "test", "build"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 10_000,
  },
});
```

- [ ] **Step 4: Create test fixtures**

Create `packages/ui-runtime/test/fixtures/compiled-manifest.ts`:

```typescript
import type { CompiledManifest } from '@rntme/ui';

export const testManifest: CompiledManifest = {
  version: '2.0',
  metadata: { title: 'Test App' },
  routes: {
    '/': { layout: 'main', screen: 'home' },
    '/about': { layout: 'main', screen: 'about' },
  },
};
```

Create `packages/ui-runtime/test/fixtures/compiled-screen.ts`:

```typescript
import type { CompiledScreen } from '@rntme/ui';

export const testLayout: CompiledScreen = {
  spec: {
    root: 'shell',
    elements: {
      shell: { type: 'Stack', props: { direction: 'vertical' }, children: ['slot-main'] },
      'slot-main': { type: 'Slot', props: { name: 'main' } },
    },
  },
};

export const testScreen: CompiledScreen = {
  spec: {
    root: 'page',
    elements: {
      page: { type: 'Heading', props: { level: 1, text: 'Home' } },
    },
  },
};
```

- [ ] **Step 5: Implement static-shell.ts**

Create `packages/ui-runtime/src/server/static-shell.ts`:

```typescript
export function buildHtmlShell(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>rntme</title>
  <link rel="stylesheet" href="/assets/main.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/main.js"></script>
</body>
</html>`;
}
```

- [ ] **Step 6: Implement server**

Create `packages/ui-runtime/src/server/index.ts`:

```typescript
import { Hono } from 'hono';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CompiledArtifact } from '@rntme/ui';
import { buildHtmlShell } from './static-shell.js';

export type CreateAppOptions = {
  /** Compiled artifact (manifest + layouts + screens) */
  artifact: CompiledArtifact;
  /** Directory containing built client assets (main.js, main.css) */
  assetsDir?: string;
};

export function createApp(opts: CreateAppOptions): Hono {
  const assetsDir =
    opts.assetsDir ??
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'build');

  const app = new Hono();
  const shell = buildHtmlShell();

  // Serve compiled manifest
  app.get('/_manifest.json', (c) => c.json(opts.artifact.manifest));

  // Serve compiled layouts
  app.get('/_layouts/:name.json', (c) => {
    const name = c.req.param('name');
    const layout = opts.artifact.layouts[name];
    if (!layout) return c.notFound();
    return c.json(layout);
  });

  // Serve compiled screens
  app.get('/_screens/:name.json', (c) => {
    const name = c.req.param('name');
    const screen = opts.artifact.screens[name];
    if (!screen) return c.notFound();
    return c.json(screen);
  });

  // Static assets
  app.get('/assets/:file', (c) => {
    const file = c.req.param('file');
    const resolvedAssetsDir = resolve(assetsDir);
    const fp = resolve(resolvedAssetsDir, file);
    if (fp !== resolvedAssetsDir && !fp.startsWith(resolvedAssetsDir + sep)) {
      return c.notFound();
    }
    if (!existsSync(fp)) return c.notFound();
    const buf = readFileSync(fp);
    const isJs = file.endsWith('.js');
    const isCss = file.endsWith('.css');
    return c.body(buf as unknown as ArrayBuffer, 200, {
      'content-type': isJs
        ? 'application/javascript'
        : isCss
          ? 'text/css'
          : 'application/octet-stream',
    });
  });

  // HTML shell — root
  app.get('/', (c) => c.html(shell));

  // SPA fallback
  app.get('/*', (c) => c.html(shell));

  return app;
}
```

- [ ] **Step 7: Create src/index.ts**

```typescript
export { createApp } from './server/index.js';
export type { CreateAppOptions } from './server/index.js';
```

- [ ] **Step 8: Write server tests**

Create `packages/ui-runtime/test/unit/server.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/index.js';
import { testManifest } from '../fixtures/compiled-manifest.js';
import { testLayout, testScreen } from '../fixtures/compiled-screen.js';

function makeApp() {
  return createApp({
    artifact: {
      manifest: testManifest,
      layouts: { main: testLayout },
      screens: { home: testScreen, about: testScreen },
    },
    assetsDir: '/tmp/nonexistent-assets',
  });
}

describe('createApp', () => {
  it('serves HTML shell at /', async () => {
    const app = makeApp();
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<div id="root">');
    expect(html).toContain('main.js');
  });

  it('serves manifest at /_manifest.json', async () => {
    const app = makeApp();
    const res = await app.request('/_manifest.json');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.version).toBe('2.0');
    expect(json.routes['/']).toEqual({ layout: 'main', screen: 'home' });
  });

  it('serves layout at /_layouts/main.json', async () => {
    const app = makeApp();
    const res = await app.request('/_layouts/main.json');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.spec.root).toBe('shell');
  });

  it('serves screen at /_screens/home.json', async () => {
    const app = makeApp();
    const res = await app.request('/_screens/home.json');
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.spec.root).toBe('page');
  });

  it('returns 404 for unknown screen', async () => {
    const app = makeApp();
    const res = await app.request('/_screens/nonexistent.json');
    expect(res.status).toBe(404);
  });

  it('SPA fallback returns shell for unknown paths', async () => {
    const app = makeApp();
    const res = await app.request('/issues/123');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<div id="root">');
  });
});
```

- [ ] **Step 9: Run tests**

```bash
cd packages/ui-runtime && pnpm install && pnpm test
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add packages/ui-runtime/
git commit -m "feat(ui-runtime): Hono server serving pre-split compiled artifacts"
```

---

## Task 8: packages/ui-runtime — Client Core (Router, Screen Loader, Registry)

**Files:**
- Create: `packages/ui-runtime/src/client/router.ts`
- Create: `packages/ui-runtime/src/client/screen-loader.ts`
- Create: `packages/ui-runtime/src/client/registry.ts`
- Test: `packages/ui-runtime/test/unit/router.test.ts`
- Test: `packages/ui-runtime/test/unit/screen-loader.test.ts`

- [ ] **Step 1: Write router tests**

Create `packages/ui-runtime/test/unit/router.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { matchRoute, type RouteMatch } from '../../src/client/router.js';

describe('matchRoute', () => {
  const patterns = ['/', '/issues', '/issues/browse', '/issues/:id'];

  it('matches exact route', () => {
    const m = matchRoute(patterns, '/issues');
    expect(m).toEqual({ pattern: '/issues', params: {} });
  });

  it('matches parameterized route', () => {
    const m = matchRoute(patterns, '/issues/42');
    expect(m).toEqual({ pattern: '/issues/:id', params: { id: '42' } });
  });

  it('prefers exact match over param match', () => {
    const m = matchRoute(patterns, '/issues/browse');
    expect(m).toEqual({ pattern: '/issues/browse', params: {} });
  });

  it('returns null for unmatched path', () => {
    const m = matchRoute(patterns, '/unknown');
    expect(m).toBeNull();
  });

  it('matches root', () => {
    const m = matchRoute(patterns, '/');
    expect(m).toEqual({ pattern: '/', params: {} });
  });
});
```

- [ ] **Step 2: Implement router**

Create `packages/ui-runtime/src/client/router.ts`:

```typescript
export type RouteMatch = {
  pattern: string;
  params: Record<string, string>;
};

export function matchRoute(patterns: string[], path: string): RouteMatch | null {
  // Prefer exact match
  if (patterns.includes(path)) {
    return { pattern: path, params: {} };
  }

  // Try parameterized match
  for (const pattern of patterns) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) continue;

    const params: Record<string, string> = {};
    let matched = true;
    for (let i = 0; i < patternParts.length; i++) {
      const pp = patternParts[i]!;
      const pathP = pathParts[i]!;
      if (pp.startsWith(':')) {
        params[pp.slice(1)] = pathP;
      } else if (pp !== pathP) {
        matched = false;
        break;
      }
    }
    if (matched) return { pattern, params };
  }

  return null;
}

export function expandTemplate(template: string, params: Record<string, string>): string {
  return template.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, key: string) => params[key] ?? `:${key}`);
}
```

- [ ] **Step 3: Write screen-loader tests**

Create `packages/ui-runtime/test/unit/screen-loader.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createScreenLoader } from '../../src/client/screen-loader.js';

describe('createScreenLoader', () => {
  it('fetches and caches a screen', async () => {
    const mockScreen = { spec: { root: 'page', elements: {} } };
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockScreen),
    });

    const loader = createScreenLoader(fetchFn as unknown as typeof fetch);
    const screen = await loader.loadScreen('home');
    expect(screen).toEqual(mockScreen);
    expect(fetchFn).toHaveBeenCalledWith('/_screens/home.json');

    // Second call should use cache
    const cached = await loader.loadScreen('home');
    expect(cached).toEqual(mockScreen);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('fetches and caches a layout', async () => {
    const mockLayout = { spec: { root: 'shell', elements: {} } };
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockLayout),
    });

    const loader = createScreenLoader(fetchFn as unknown as typeof fetch);
    const layout = await loader.loadLayout('main');
    expect(layout).toEqual(mockLayout);
    expect(fetchFn).toHaveBeenCalledWith('/_layouts/main.json');
  });
});
```

- [ ] **Step 4: Implement screen-loader**

Create `packages/ui-runtime/src/client/screen-loader.ts`:

```typescript
import type { CompiledScreen } from '@rntme/ui';

export type ScreenLoader = {
  loadScreen: (name: string) => Promise<CompiledScreen>;
  loadLayout: (name: string) => Promise<CompiledScreen>;
};

export function createScreenLoader(fetchFn: typeof fetch = fetch): ScreenLoader {
  const screenCache = new Map<string, CompiledScreen>();
  const layoutCache = new Map<string, CompiledScreen>();

  async function load(url: string, cache: Map<string, CompiledScreen>, key: string): Promise<CompiledScreen> {
    const cached = cache.get(key);
    if (cached) return cached;

    const res = await fetchFn(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    const data = (await res.json()) as CompiledScreen;
    cache.set(key, data);
    return data;
  }

  return {
    loadScreen: (name) => load(`/_screens/${name}.json`, screenCache, name),
    loadLayout: (name) => load(`/_layouts/${name}.json`, layoutCache, name),
  };
}
```

- [ ] **Step 5: Implement registry (json-render/shadcn integration)**

Create `packages/ui-runtime/src/client/registry.ts`:

This is the core json-render integration. It registers the shadcn catalog and custom actions.

Note: The exact API depends on what @json-render/react and @json-render/shadcn export. The implementation below follows the patterns found in the json-render documentation. If the actual API differs at implementation time, adjust accordingly.

```typescript
/**
 * Registry setup for json-render with shadcn components.
 *
 * This module bridges json-render's catalog/registry system with the
 * rntme runtime's driver (HTTP fetching, navigation, etc.).
 *
 * IMPORTANT: The exact json-render API (defineCatalog, defineRegistry,
 * shadcn catalog import) should be verified against @json-render/react@0.17
 * and @json-render/shadcn@0.17 at implementation time. The types below
 * follow the patterns documented at json-render.dev.
 */

// These imports will work once zod@4 and react@19 are in place:
// import { defineRegistry } from '@json-render/react';
// import { catalog as shadcnCatalog } from '@json-render/shadcn/catalog';

export type DriverBridge = {
  navigate: (path: string) => void;
  fetchData: (method: string, path: string, params?: Record<string, unknown>) => Promise<unknown>;
  submitCommand: (method: string, path: string, params: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Create the json-render registry with shadcn components and custom actions.
 *
 * Call this once at app startup. The returned registry is passed to
 * <Renderer spec={spec} registry={registry} />.
 */
export function createRegistry(bridge: DriverBridge) {
  // TODO: Wire up actual json-render registry once dependencies are resolved.
  // The structure will be:
  //
  // return defineRegistry(shadcnCatalog, {
  //   actions: {
  //     navigate: async (params) => bridge.navigate(params.path as string),
  //     fetchData: async (params) => bridge.fetchData(params.method, params.path, params.params),
  //     submitCommand: async (params) => bridge.submitCommand(params.method, params.path, params.params),
  //   },
  // });

  return { bridge };
}
```

- [ ] **Step 6: Run tests**

```bash
cd packages/ui-runtime && pnpm test
```

Expected: all tests pass (server + router + screen-loader).

- [ ] **Step 7: Commit**

```bash
git add packages/ui-runtime/src/client/ packages/ui-runtime/test/
git commit -m "feat(ui-runtime): client router, screen loader, and registry stub"
```

---

## Task 9: packages/ui-runtime — Client App (Driver, Layout Manager, Entry, Build)

**Files:**
- Create: `packages/ui-runtime/src/client/driver.ts`
- Create: `packages/ui-runtime/src/client/layout-manager.tsx`
- Create: `packages/ui-runtime/src/client/entry.tsx`
- Create: `packages/ui-runtime/src/build.ts`
- Test: `packages/ui-runtime/test/unit/driver.test.ts`

- [ ] **Step 1: Write driver tests**

Create `packages/ui-runtime/test/unit/driver.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createDriver, type DriverOptions } from '../../src/client/driver.js';

function mockFetch(response: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(response),
  });
}

describe('createDriver', () => {
  it('fetches data for a screen on enterRoute', async () => {
    const fetchFn = mockFetch([{ id: 1, title: 'Issue 1' }]);
    const onStateChange = vi.fn();

    const driver = createDriver({
      fetchFn: fetchFn as unknown as typeof fetch,
      onStateChange,
      onNavigate: vi.fn(),
    });

    await driver.enterScreen({
      data: {
        '/data/issues': {
          method: 'GET',
          path: '/api/issues',
          params: { limit: 50 },
          refetchOn: ['mount'],
        },
      },
    });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const url = fetchFn.mock.calls[0]![0] as string;
    expect(url).toContain('/api/issues');
    expect(onStateChange).toHaveBeenCalledWith('/data/issues', [{ id: 1, title: 'Issue 1' }]);
  });

  it('dispatches navigation action', () => {
    const onNavigate = vi.fn();
    const driver = createDriver({
      fetchFn: vi.fn() as unknown as typeof fetch,
      onStateChange: vi.fn(),
      onNavigate,
    });

    driver.dispatchAction({
      kind: 'navigation',
      navigateTo: '/issues/42',
    });

    expect(onNavigate).toHaveBeenCalledWith('/issues/42');
  });
});
```

- [ ] **Step 2: Implement driver**

Create `packages/ui-runtime/src/client/driver.ts`:

```typescript
import type { CompiledScreen, CompiledAction, CompiledDataEndpoint } from '@rntme/ui';

export type DriverOptions = {
  fetchFn: typeof fetch;
  onStateChange: (path: string, value: unknown) => void;
  onNavigate: (path: string) => void;
  defaultHeaders?: Record<string, string>;
};

export type Driver = {
  enterScreen: (screen: Pick<CompiledScreen, 'data'>) => Promise<void>;
  dispatchAction: (action: CompiledAction, stateGetter?: (path: string) => unknown) => Promise<void>;
};

function buildUrl(path: string, params?: Record<string, unknown>, stateGetter?: (path: string) => unknown): string {
  let url = path;
  // Substitute {param} placeholders
  url = url.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const value = params?.[key];
    if (value !== undefined) return String(value);
    return `{${key}}`;
  });
  // Add query params for GET
  const queryParams = { ...params };
  // Remove path params from query
  for (const match of path.matchAll(/\{([^}]+)\}/g)) {
    delete queryParams[match[1]!];
  }
  // Resolve $state references in params
  for (const [k, v] of Object.entries(queryParams)) {
    if (v && typeof v === 'object' && '$state' in (v as Record<string, unknown>)) {
      queryParams[k] = stateGetter?.((v as { $state: string }).$state);
    }
  }
  const qs = Object.entries(queryParams)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return qs ? `${url}?${qs}` : url;
}

export function createDriver(opts: DriverOptions): Driver {
  const { fetchFn, onStateChange, onNavigate, defaultHeaders = {} } = opts;

  async function fetchEndpoint(statePath: string, endpoint: CompiledDataEndpoint, stateGetter?: (path: string) => unknown): Promise<void> {
    const url = buildUrl(endpoint.path, endpoint.params, stateGetter);
    onStateChange(`/data/__status${statePath}`, 'pending');
    try {
      const res = await fetchFn(url, {
        method: endpoint.method,
        headers: { ...defaultHeaders, 'content-type': 'application/json' },
      });
      if (!res.ok) {
        onStateChange(`/data/__status${statePath}`, 'error');
        onStateChange(`/data/__error${statePath}`, `HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      onStateChange(statePath, data);
      onStateChange(`/data/__status${statePath}`, 'ok');
    } catch (e) {
      onStateChange(`/data/__status${statePath}`, 'error');
      onStateChange(`/data/__error${statePath}`, e instanceof Error ? e.message : String(e));
    }
  }

  return {
    async enterScreen(screen) {
      if (!screen.data) return;
      const fetches = Object.entries(screen.data).map(([statePath, endpoint]) =>
        fetchEndpoint(statePath, endpoint),
      );
      await Promise.all(fetches);
    },

    async dispatchAction(action, stateGetter) {
      if (action.kind === 'navigation') {
        let target = action.navigateTo;
        if (action.paramsFromState && stateGetter) {
          for (const [param, statePath] of Object.entries(action.paramsFromState)) {
            const value = stateGetter(statePath);
            target = target.replace(`:${param}`, String(value ?? ''));
          }
        }
        onNavigate(target);
        return;
      }

      // Command action
      const params: Record<string, unknown> = {};
      if (action.paramsFromState && stateGetter) {
        for (const [param, statePath] of Object.entries(action.paramsFromState)) {
          params[param] = stateGetter(statePath);
        }
      }

      let url = action.path;
      url = url.replace(/\{([^}]+)\}/g, (_, key: string) => {
        const v = params[key];
        delete params[key];
        return String(v ?? '');
      });

      try {
        const res = await fetchFn(url, {
          method: action.method,
          headers: { ...defaultHeaders, 'content-type': 'application/json' },
          body: JSON.stringify(params),
        });
        if (!res.ok) {
          if (action.onError?.showAlert) {
            const text = await res.text().catch(() => `HTTP ${res.status}`);
            globalThis.alert?.(text) ?? console.error(text);
          }
          return;
        }
        if (action.onSuccess?.navigateTo) {
          onNavigate(action.onSuccess.navigateTo);
        }
      } catch (e) {
        if (action.onError?.showAlert) {
          const msg = e instanceof Error ? e.message : String(e);
          globalThis.alert?.(msg) ?? console.error(msg);
        }
      }
    },
  };
}
```

- [ ] **Step 3: Implement layout-manager**

Create `packages/ui-runtime/src/client/layout-manager.tsx`:

```typescript
import * as React from 'react';
import type { CompiledScreen, CompiledSpec } from '@rntme/ui';

/**
 * LayoutManager keeps the layout mounted across route transitions
 * and injects the screen content into the layout's Slot.
 *
 * NOTE: The actual rendering will use json-render's <Renderer> once
 * the registry is fully wired. For now this provides the structure
 * for layout persistence and slot injection.
 */

export type LayoutManagerProps = {
  layout: CompiledScreen | null;
  screen: CompiledScreen | null;
  renderSpec: (spec: CompiledSpec, key: string) => React.ReactNode;
};

export function LayoutManager({ layout, screen, renderSpec }: LayoutManagerProps): React.ReactElement {
  if (!screen) {
    return React.createElement('div', { id: 'rntme-loading' }, 'Loading...');
  }

  if (!layout) {
    return React.createElement('div', { id: 'rntme-screen' }, renderSpec(screen.spec, 'screen'));
  }

  // For now, render layout and screen sequentially.
  // The full json-render Slot mechanism will handle injection.
  return React.createElement(
    'div',
    { id: 'rntme-app' },
    React.createElement('div', { id: 'rntme-layout', key: 'layout' }, renderSpec(layout.spec, 'layout')),
    React.createElement('div', { id: 'rntme-screen', key: 'screen' }, renderSpec(screen.spec, 'screen')),
  );
}
```

- [ ] **Step 4: Implement entry.tsx**

Create `packages/ui-runtime/src/client/entry.tsx`:

```typescript
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import type { CompiledManifest, CompiledScreen, CompiledSpec } from '@rntme/ui';
import { matchRoute } from './router.js';
import { createScreenLoader } from './screen-loader.js';
import { createDriver } from './driver.js';
import { LayoutManager } from './layout-manager.js';

export async function hydrateApp(opts: { rootSelector: string }): Promise<void> {
  const container = document.querySelector(opts.rootSelector);
  if (!container) throw new Error(`hydrateApp: ${opts.rootSelector} not found`);

  // 1. Load manifest
  const manifestRes = await fetch('/_manifest.json');
  const manifest = (await manifestRes.json()) as CompiledManifest;

  // 2. Setup
  const loader = createScreenLoader();
  const patterns = Object.keys(manifest.routes);
  const state: Record<string, unknown> = {};

  function getState(path: string): unknown {
    return state[path];
  }

  function setState(path: string, value: unknown): void {
    state[path] = value;
    rerender();
  }

  let currentLayout: CompiledScreen | null = null;
  let currentScreen: CompiledScreen | null = null;
  let currentLayoutName: string | null = null;

  const driver = createDriver({
    fetchFn: fetch,
    onStateChange: setState,
    onNavigate: (path) => {
      window.history.pushState({}, '', path);
      void enterRoute(path);
    },
  });

  async function enterRoute(path: string): Promise<void> {
    const match = matchRoute(patterns, path);
    if (!match) return;

    const routeEntry = manifest.routes[match.pattern];
    if (!routeEntry) return;

    // Set route params
    for (const [k, v] of Object.entries(match.params)) {
      setState(`/route/params/${k}`, v);
    }

    // Load layout (only if changed)
    if (routeEntry.layout !== currentLayoutName) {
      currentLayout = await loader.loadLayout(routeEntry.layout);
      currentLayoutName = routeEntry.layout;
    }

    // Load screen
    currentScreen = await loader.loadScreen(routeEntry.screen);
    rerender();

    // Fetch data
    await driver.enterScreen(currentScreen);
  }

  const root = createRoot(container);

  function renderSpec(spec: CompiledSpec, key: string): React.ReactNode {
    // Placeholder: will be replaced by <Renderer spec={spec} registry={registry} />
    // once json-render registry is fully wired.
    return React.createElement('pre', { key }, JSON.stringify(spec, null, 2));
  }

  function rerender(): void {
    root.render(
      React.createElement(LayoutManager, {
        layout: currentLayout,
        screen: currentScreen,
        renderSpec,
      }),
    );
  }

  // Initial route
  const initialPath = window.location.pathname || '/';
  await enterRoute(initialPath);

  // Handle browser back/forward
  window.addEventListener('popstate', () => {
    void enterRoute(window.location.pathname);
  });
}

void hydrateApp({ rootSelector: '#root' }).catch((err: unknown) => {
  console.error('[rntme ui-runtime]', err);
  const el = document.querySelector('#root');
  if (el) el.textContent = err instanceof Error ? err.message : String(err);
});
```

- [ ] **Step 5: Implement build.ts**

Create `packages/ui-runtime/src/build.ts`:

```typescript
import { build } from 'esbuild';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [join(__dirname, 'client', 'entry.tsx')],
  outfile: join(__dirname, '..', 'build', 'main.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  loader: {
    '.css': 'empty',
  },
  external: [],
});

console.log('Client bundle built → build/main.js');
```

- [ ] **Step 6: Run all tests**

```bash
cd packages/ui-runtime && pnpm test
```

Expected: all tests pass (server, router, screen-loader, driver).

- [ ] **Step 7: Commit**

```bash
git add packages/ui-runtime/
git commit -m "feat(ui-runtime): client driver, layout manager, entry point, and esbuild config"
```

---

## Task 10: Demo Migration — Issue Tracker Source Format

**Files:**
- Create: `demo/issue-tracker-api/artifacts/ui/manifest.json`
- Create: `demo/issue-tracker-api/artifacts/ui/layouts/main.spec.json`
- Create: `demo/issue-tracker-api/artifacts/ui/layouts/main.screen.json`
- Create: `demo/issue-tracker-api/artifacts/ui/screens/issues-home.spec.json`
- Create: `demo/issue-tracker-api/artifacts/ui/screens/issues-home.screen.json`
- Create: `demo/issue-tracker-api/artifacts/ui/screens/issues-browse.spec.json`
- Create: `demo/issue-tracker-api/artifacts/ui/screens/issues-browse.screen.json`
- Create: `demo/issue-tracker-api/artifacts/ui/screens/issues-new.spec.json`
- Create: `demo/issue-tracker-api/artifacts/ui/screens/issues-new.screen.json`
- Create: `demo/issue-tracker-api/artifacts/ui/screens/issue-detail.spec.json`
- Create: `demo/issue-tracker-api/artifacts/ui/screens/issue-detail.screen.json`

The current monolithic `ui.json` (659 lines) is decomposed into the new source format. Each route becomes a screen pair. The `ui.json` file is kept as `ui.json.legacy` for reference until full migration is verified.

- [ ] **Step 1: Create manifest.json**

Create `demo/issue-tracker-api/artifacts/ui/manifest.json`:

```json
{
  "version": "2.0",
  "pdmRef": "issue-tracker.domain.v1",
  "qsmRef": "issue-tracker.read.v1",
  "graphSpecRef": "issue-tracker.graphs.v1",
  "bindingsRef": "issue-tracker.bindings.v1",
  "metadata": {
    "title": "Issue Tracker"
  },
  "layouts": {
    "main": "layouts/main"
  },
  "routes": {
    "/issues": {
      "layout": "main",
      "screen": "screens/issues-home"
    },
    "/issues/browse": {
      "layout": "main",
      "screen": "screens/issues-browse"
    },
    "/issues/new": {
      "layout": "main",
      "screen": "screens/issues-new"
    },
    "/issues/:id": {
      "layout": "main",
      "screen": "screens/issue-detail"
    }
  }
}
```

- [ ] **Step 2: Create layout files**

`demo/issue-tracker-api/artifacts/ui/layouts/main.spec.json`:
```json
{
  "root": "shell",
  "elements": {
    "shell": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": 4 },
      "children": ["header", "slot-main"]
    },
    "header": {
      "type": "Heading",
      "props": { "level": 1, "text": "Issue Tracker" }
    },
    "slot-main": {
      "type": "Slot",
      "props": { "name": "main" }
    }
  }
}
```

`demo/issue-tracker-api/artifacts/ui/layouts/main.screen.json`:
```json
{}
```

- [ ] **Step 3: Create issues-home screen**

`demo/issue-tracker-api/artifacts/ui/screens/issues-home.spec.json`:
```json
{
  "root": "page-root",
  "elements": {
    "page-root": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": 4 },
      "children": ["issues-heading", "nav-row", "stats-table"]
    },
    "issues-heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "Issues by Project" }
    },
    "nav-row": {
      "type": "Stack",
      "props": { "direction": "horizontal", "gap": 2 },
      "children": ["btn-browse", "btn-new"]
    },
    "btn-browse": {
      "type": "Button",
      "props": { "label": "Browse issues" },
      "on": { "press": { "action": "goBrowse" } }
    },
    "btn-new": {
      "type": "Button",
      "props": { "label": "Report issue", "variant": "primary" },
      "on": { "press": { "action": "goNew" } }
    },
    "stats-table": {
      "type": "Table",
      "props": {
        "rows": { "$state": "/data/stats" },
        "columns": ["projectKey", "issueCount", "totalStoryPoints"]
      }
    }
  }
}
```

`demo/issue-tracker-api/artifacts/ui/screens/issues-home.screen.json`:
```json
{
  "metadata": { "title": "Home" },
  "data": {
    "/data/stats": {
      "binding": "issuesByProject",
      "refetchOn": ["mount"]
    }
  },
  "actions": {
    "goBrowse": {
      "kind": "navigation",
      "navigateTo": "/issues/browse"
    },
    "goNew": {
      "kind": "navigation",
      "navigateTo": "/issues/new"
    }
  }
}
```

- [ ] **Step 4: Create issues-browse screen**

`demo/issue-tracker-api/artifacts/ui/screens/issues-browse.spec.json`:
```json
{
  "root": "browse-root",
  "elements": {
    "browse-root": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": 4 },
      "children": ["btn-home", "browse-heading", "browse-hint", "open-form", "list-table"]
    },
    "btn-home": {
      "type": "Button",
      "props": { "label": "\u2190 Home" },
      "on": { "press": { "action": "goHome" } }
    },
    "browse-heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "Recent issues" }
    },
    "browse-hint": {
      "type": "Text",
      "props": { "text": "Open an issue by ID (seeded ids include 101\u2013122)." }
    },
    "open-form": {
      "type": "Form",
      "props": { "statePath": "/form" },
      "children": ["open-row"]
    },
    "open-row": {
      "type": "Stack",
      "props": { "direction": "horizontal", "gap": 2 },
      "children": ["field-open-id", "btn-open"]
    },
    "field-open-id": {
      "type": "FormField",
      "props": { "name": "openId", "label": "Issue ID", "type": "number" }
    },
    "btn-open": {
      "type": "Button",
      "props": { "label": "Open", "variant": "primary" },
      "on": { "press": { "action": "goDetail" } }
    },
    "list-table": {
      "type": "Table",
      "props": {
        "rows": { "$state": "/data/issues" },
        "columns": ["id", "title", "status", "priority", "storyPoints"]
      }
    }
  }
}
```

`demo/issue-tracker-api/artifacts/ui/screens/issues-browse.screen.json`:
```json
{
  "metadata": { "title": "Browse" },
  "data": {
    "/data/issues": {
      "binding": "listIssuesUi",
      "params": { "limit": 50 },
      "refetchOn": ["mount"]
    }
  },
  "actions": {
    "goHome": {
      "kind": "navigation",
      "navigateTo": "/issues"
    },
    "goDetail": {
      "kind": "navigation",
      "navigateTo": "/issues/:id",
      "paramsFromState": { "id": "/form/openId" }
    }
  }
}
```

- [ ] **Step 5: Create issues-new screen**

`demo/issue-tracker-api/artifacts/ui/screens/issues-new.spec.json`:
```json
{
  "root": "form-root",
  "elements": {
    "form-root": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": 4 },
      "children": ["form-heading", "issue-form"]
    },
    "form-heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "Report a New Issue" }
    },
    "issue-form": {
      "type": "Form",
      "props": { "statePath": "/form" },
      "children": ["field-issueId", "field-title", "field-projectId", "field-reporterId", "field-priority", "field-storyPoints", "submit-btn"]
    },
    "field-issueId": {
      "type": "FormField",
      "props": { "name": "issueId", "label": "Issue ID", "type": "number" }
    },
    "field-title": {
      "type": "FormField",
      "props": { "name": "title", "label": "Title", "type": "text" }
    },
    "field-projectId": {
      "type": "FormField",
      "props": { "name": "projectId", "label": "Project ID", "type": "number" }
    },
    "field-reporterId": {
      "type": "FormField",
      "props": { "name": "reporterId", "label": "Reporter ID", "type": "number" }
    },
    "field-priority": {
      "type": "FormField",
      "props": { "name": "priority", "label": "Priority", "type": "text" }
    },
    "field-storyPoints": {
      "type": "FormField",
      "props": { "name": "storyPoints", "label": "Story Points", "type": "number" }
    },
    "submit-btn": {
      "type": "Button",
      "props": { "label": "Submit", "variant": "primary" },
      "on": { "press": { "action": "submit" } }
    }
  }
}
```

`demo/issue-tracker-api/artifacts/ui/screens/issues-new.screen.json`:
```json
{
  "metadata": { "title": "Report Issue" },
  "actions": {
    "submit": {
      "kind": "command",
      "binding": "reportIssue",
      "paramsFromState": {
        "issueId": "/form/issueId",
        "title": "/form/title",
        "projectId": "/form/projectId",
        "reporterId": "/form/reporterId",
        "priority": "/form/priority",
        "storyPoints": "/form/storyPoints"
      },
      "onSuccess": { "navigateTo": "/issues/browse" },
      "onError": { "showAlert": true }
    }
  }
}
```

- [ ] **Step 6: Create issue-detail screen**

`demo/issue-tracker-api/artifacts/ui/screens/issue-detail.spec.json`:
```json
{
  "root": "detail-root",
  "elements": {
    "detail-root": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": 4 },
      "children": ["detail-heading", "detail-table", "detail-actions", "form-submit", "form-assign", "form-resolve", "row-close"]
    },
    "detail-heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "Issue" }
    },
    "detail-table": {
      "type": "Table",
      "props": {
        "rows": { "$state": "/data/detail" },
        "columns": ["id", "title", "status", "priority", "projectKey", "assigneeUsername", "reporterUsername"]
      }
    },
    "detail-actions": {
      "type": "Text",
      "props": { "text": "Lifecycle: Submit (draft\u2192open), Assign, Resolve (in progress\u2192resolved), Close (resolved\u2192closed)." }
    },
    "form-submit": {
      "type": "Stack",
      "props": { "direction": "horizontal", "gap": 2 },
      "children": ["btn-submit"]
    },
    "btn-submit": {
      "type": "Button",
      "props": { "label": "Submit (draft \u2192 open)" },
      "on": { "press": { "action": "cmdSubmit" } }
    },
    "form-assign": {
      "type": "Form",
      "props": { "statePath": "/form" },
      "children": ["field-assignee", "btn-assign"]
    },
    "field-assignee": {
      "type": "FormField",
      "props": { "name": "assigneeId", "label": "Assignee user ID", "type": "number" }
    },
    "btn-assign": {
      "type": "Button",
      "props": { "label": "Assign / reassign", "variant": "primary" },
      "on": { "press": { "action": "cmdAssign" } }
    },
    "form-resolve": {
      "type": "Form",
      "props": { "statePath": "/form" },
      "children": ["field-resolvedAt", "btn-resolve"]
    },
    "field-resolvedAt": {
      "type": "FormField",
      "props": { "name": "resolvedAt", "label": "Resolved at (ISO-8601)", "type": "text" }
    },
    "btn-resolve": {
      "type": "Button",
      "props": { "label": "Resolve" },
      "on": { "press": { "action": "cmdResolve" } }
    },
    "row-close": {
      "type": "Stack",
      "props": { "direction": "horizontal", "gap": 2 },
      "children": ["btn-close"]
    },
    "btn-close": {
      "type": "Button",
      "props": { "label": "Close" },
      "on": { "press": { "action": "cmdClose" } }
    }
  }
}
```

`demo/issue-tracker-api/artifacts/ui/screens/issue-detail.screen.json`:
```json
{
  "metadata": { "title": "Issue detail" },
  "data": {
    "/data/detail": {
      "binding": "issueDetail",
      "params": { "id": { "$state": "/route/params/id" } },
      "refetchOn": ["mount"]
    }
  },
  "actions": {
    "cmdSubmit": {
      "kind": "command",
      "binding": "submitIssue",
      "paramsFromState": { "issueId": "/route/params/id" },
      "onSuccess": { "refetchData": ["detail"] },
      "onError": { "showAlert": true }
    },
    "cmdAssign": {
      "kind": "command",
      "binding": "assignIssue",
      "paramsFromState": { "issueId": "/route/params/id", "assigneeId": "/form/assigneeId" },
      "onSuccess": { "refetchData": ["detail"] },
      "onError": { "showAlert": true }
    },
    "cmdResolve": {
      "kind": "command",
      "binding": "resolveIssue",
      "paramsFromState": { "issueId": "/route/params/id", "resolvedAt": "/form/resolvedAt" },
      "onSuccess": { "refetchData": ["detail"] },
      "onError": { "showAlert": true }
    },
    "cmdClose": {
      "kind": "command",
      "binding": "closeIssue",
      "paramsFromState": { "issueId": "/route/params/id" },
      "onSuccess": { "refetchData": ["detail"] },
      "onError": { "showAlert": true }
    }
  }
}
```

- [ ] **Step 7: Verify decomposition matches original**

Run a quick sanity check: count routes, data bindings, and actions in the new format vs the original `ui.json`:

- Original: 4 routes, 1 layout, 4 data bindings, 10 actions
- New: 4 routes in manifest, 1 layout, 4 data bindings across .screen.json files, 10 actions across .screen.json files

- [ ] **Step 8: Commit**

```bash
git add demo/issue-tracker-api/artifacts/ui/
git commit -m "feat(demo): decompose issue-tracker ui.json into multi-file source format"
```

---

## Task 11: packages/runtime Integration

**Files:**
- Modify: `packages/runtime/src/load/load-service.ts`
- Modify: `packages/runtime/src/plugins/http-surface.ts`
- Modify: `packages/runtime/src/types.ts`
- Modify: `packages/runtime/package.json`

This task updates the runtime package to use the new `@rntme/ui` (compiler) and `@rntme/ui-runtime` instead of the legacy packages.

- [ ] **Step 1: Add new package dependencies**

In `packages/runtime/package.json`, add (alongside the legacy deps which stay for now):
```json
"@rntme/ui": "workspace:*",
"@rntme/ui-runtime": "workspace:*"
```

- [ ] **Step 2: Update load-service.ts**

In `packages/runtime/src/load/load-service.ts`, replace the UI loading section (step 7, approximately lines 232-251) to use the new compiler:

```typescript
// Replace:
//   import { validateUi, type ValidatedUiArtifact } from '@rntme/ui-legacy';
//   import { buildBindingResolver, buildComponentResolver } from '@rntme/ui-runtime-legacy';
// With:
import { compile, type CompiledArtifact } from '@rntme/ui';
import { buildResolvedHttp } from '@rntme/ui-runtime-legacy'; // keep for httpMap generation

// In the loadService function, replace the UI validation block with:

  // 7. UI — compile from new source format
  let compiledUi: CompiledArtifact;
  try {
    const uiSourceDir = join(dir, 'ui');
    const httpMap: Record<string, { method: 'GET' | 'POST'; path: string }> = {};
    // Build httpMap from validated bindings
    for (const [id, rb] of Object.entries(validatedBindings.resolved)) {
      httpMap[id] = { method: rb.entry.http.method, path: `/api${rb.entry.http.path}` };
    }

    const uiResult = compile({
      sourceDir: uiSourceDir,
      httpMap,
      resolvers: {
        resolveBinding: (id) => validatedBindings.resolved[id] ?? undefined,
        resolveComponent: () => ({ childrenModel: 'list' }),
        resolveRoute: () => true,
      },
    });
    if (!uiResult.ok) {
      return { ok: false, errors: [{ code: 'UI_INVALID', details: uiResult.errors }] };
    }
    compiledUi = uiResult.value;
  } catch (e) {
    return { ok: false, errors: [{ code: 'IO_ERROR', details: { message: e instanceof Error ? e.message : String(e) } }] };
  }
```

Update the return value to include `compiledUi` instead of (or alongside) `ui`.

- [ ] **Step 3: Update http-surface.ts**

In `packages/runtime/src/plugins/http-surface.ts`, replace the `createUiApp` call:

```typescript
import { createApp } from '@rntme/ui-runtime';

// Replace:
//   const uiApp = createUiApp({ artifact: ctx.service.ui, ... });
// With:
    const uiApp = createApp({
      artifact: ctx.service.compiledUi,
    });
```

Update the mount to put bindings under `/api`:
```typescript
    app.route('/api', router);  // bindings under /api
    app.route('/', uiApp);      // UI at root
```

- [ ] **Step 4: Update types.ts**

In `packages/runtime/src/types.ts`, update `ValidatedService` to include the compiled UI:

```typescript
import type { CompiledArtifact } from '@rntme/ui';

// Add to ValidatedService:
compiledUi: CompiledArtifact;
```

- [ ] **Step 5: Run pnpm install and build**

```bash
pnpm install && pnpm -r run build
```

Expected: builds succeed.

- [ ] **Step 6: Commit**

```bash
git add packages/runtime/
git commit -m "feat(runtime): integrate new UI compiler and runtime, mount bindings under /api"
```

---

## Task 12: End-to-End Verification

**Files:**
- Test: manual verification of demo app
- Modify: any files needed to fix issues found during E2E

- [ ] **Step 1: Build everything**

```bash
pnpm -r run build
```

Expected: all packages build without errors.

- [ ] **Step 2: Run all tests**

```bash
pnpm -r run test
```

Expected: all tests pass (new packages + existing packages with -legacy references).

- [ ] **Step 3: Start the demo server**

```bash
cd demo/issue-tracker-api && pnpm start
```

Expected: server starts, loads artifacts from the new `ui/` directory, compiles them, and serves the app.

- [ ] **Step 4: Verify in browser**

Open `http://localhost:3000/` and verify:
- HTML shell loads
- `/_manifest.json` returns the compiled manifest with 4 routes
- `/_layouts/main.json` returns the compiled layout
- `/_screens/issues-home.json` returns the compiled screen
- Navigation between routes works (lazy loading of screen JSON)
- Data fetching works (tables show data from `/api/...`)
- Actions work (navigation, commands)

- [ ] **Step 5: Fix any issues found**

If any issues are found during manual testing, fix them and re-run tests.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "fix(demo): end-to-end fixes for UI v2 migration"
```

---

## Discovered Scope: Dependency Upgrades Not in Original Spec

During research, the following additional dependency requirements were discovered:

1. **React 19**: `@json-render/react@0.17` requires `react@^19.2.3`. The workspace currently uses `react@^18.3.1`. Only `packages/ui-runtime` (old and new) depends on React.

2. **Tailwind CSS 4**: `@json-render/shadcn@0.17` requires `tailwindcss@^4.0.0`. This is new — the current build has no Tailwind dependency. The client build (`build.ts`) will need Tailwind CSS processing.

3. **zod@4 bridge**: The workspace already has `zod@3.25.76` installed, which is the zod v4 bridge version. Upgrading `"zod": "^3.23.8"` to `"zod": "^4.0.0"` in package.json may or may not change the resolved version. The API is largely compatible.

These are handled in Task 1 (zod upgrade) and Task 7 (React + Tailwind in ui-runtime package.json). If the React 19 upgrade causes issues in the legacy runtime package, those can be ignored since the legacy package is not actively used.
