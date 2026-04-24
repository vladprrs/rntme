# Track B — Project Composition Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add project-aware service composition so services validate against the shared project `PDM`, `QSM` may mirror foreign owned entities, project routes and middleware mounts are semantically checked, and UI compiles against project-routed HTTP surfaces instead of same-service bindings only.

**Architecture:** Build Track B on top of Track A's `@rntme/blueprint` loader. `loadBlueprint` remains the filesystem/model foundation; a new composition layer discovers service artifact presence, validates project routing/middleware semantics, loads each service as a project member, and compiles UI using a routed binding registry keyed by project-qualified refs. UI binding refs stay strings: bare ids remain local shorthand, while cross-service calls use `service.bindingId`.

**Tech Stack:** TypeScript 5, Node 20 filesystem APIs, Zod 4, Vitest 2, existing `@rntme/pdm`, `@rntme/qsm`, `@rntme/bindings`, `@rntme/ui`, and `@rntme/seed` validation pipelines.

---

## Scope guard

- **Prerequisite:** Track A (`docs/superpowers/plans/2026-04-23-project-first-blueprint-track-a.md`) is implemented first. This plan assumes `@rntme/blueprint`, `loadBlueprint`, project-level `PDM`, and multi-file service-level `QSM` already exist.
- **In scope:** project route/middleware semantic validation, service artifact discovery, shared-`PDM` service validation, cross-service `QSM` inputs, service-scoped seed validation, project-qualified UI binding resolution, directory-backed `graphs/`, `bindings/`, and `seed/` conventions, end-to-end composed blueprint loading.
- **Out of scope:** runtime boot, Hono router mounting, middleware execution, multi-service process lifecycle, Kafka/Zeebe wiring, OpenAPI serving, projection DDL/apply-plan wiring, and project runtime boot order. Do not edit `packages/runtime/src/*` in Track B.
- **Directory-backed service conventions for this track:** `graphs/shapes.json` + `graphs/*.json`, `bindings/bindings.json`, `seed/seed.json`. This keeps package validators single-file internally while matching the project-first folder layout from the spec.

## File map

```text
packages/blueprint/
  src/
    index.ts
    compose/
      discover-service-artifacts.ts
      service-graphs.ts
      binding-resolvers.ts
      seed-scope.ts
      load-service-member.ts
      binding-registry.ts
      compile-service-ui.ts
      load-composed-blueprint.ts
    validate/
      composition.ts
    types/
      artifact.ts
      result.ts
  test/
    fixtures/
      product-catalog-project/
        project.json
        pdm/
          pdm.json
          entities/
            Product.json
            Publication.json
            PriceEntry.json
            InventoryPosition.json
        services/
          catalog/
            service.json
            qsm/
              qsm.json
              projections/
                PublicationView.json
            graphs/
              shapes.json
              listProducts.json
            bindings/
              bindings.json
          pricing/
            service.json
            graphs/
              shapes.json
              listPrices.json
            bindings/
              bindings.json
            seed/
              seed.json
          inventory/
            service.json
            graphs/
              shapes.json
              listInventory.json
            bindings/
              bindings.json
          app/
            service.json
            qsm/
              qsm.json
              projections/
                PriceEntryView.json
            ui/
              manifest.json
              layouts/
                main.spec.json
                main.screen.json
              screens/
                home.spec.json
                home.screen.json
          mod-workos/
            service.json
    smoke-composed.test.ts
    unit/
      validate-composition.test.ts
      discover-service-artifacts.test.ts
      service-graphs.test.ts
      load-service-member.test.ts
      binding-registry.test.ts
      load-composed-blueprint.test.ts

packages/blueprint/README.md
packages/ui/README.md
packages/qsm/README.md
```

`@rntme/ui`, `@rntme/qsm`, and `@rntme/bindings` keep their core validators unchanged in Track B. The new project-aware behavior lives in `@rntme/blueprint`, with docs updates in `@rntme/ui` and `@rntme/qsm` so the package contracts match the approved spec.

---

### Task 1: Add project composition validation for routes and middleware

**Files:**
- Modify: `packages/blueprint/src/types/artifact.ts`
- Modify: `packages/blueprint/src/types/result.ts`
- Create: `packages/blueprint/src/validate/composition.ts`
- Modify: `packages/blueprint/src/index.ts`
- Test: `packages/blueprint/test/unit/validate-composition.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `packages/blueprint/test/unit/validate-composition.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { validateBlueprintComposition } from '../../src/validate/composition.js';

  const svc = (
    slug: string,
    kind: 'domain' | 'integration',
    artifacts: Partial<{
      hasGraphs: boolean;
      hasBindings: boolean;
      hasUi: boolean;
      hasSeed: boolean;
      hasQsm: boolean;
    }> = {},
  ) => ({
    slug,
    kind,
    qsm: null,
    artifacts: {
      hasGraphs: false,
      hasBindings: false,
      hasUi: false,
      hasSeed: false,
      hasQsm: false,
      ...artifacts,
    },
  });

  describe('validateBlueprintComposition', () => {
    it('builds routing context for valid project routes + middleware mounts', () => {
      const r = validateBlueprintComposition({
        project: {
          name: 'product-catalog',
          services: ['catalog', 'app', 'mod-workos'],
          routes: {
            ui: { '/': 'app' },
            http: { '/api/catalog': 'catalog' },
          },
          middleware: {
            requestContext: { kind: 'request-context' },
            auth: { kind: 'auth', provider: 'mod-workos' },
          },
          mounts: [{ target: 'ui:/', use: ['requestContext', 'auth'] }],
        },
        services: {
          catalog: svc('catalog', 'domain', { hasBindings: true }),
          app: svc('app', 'domain', { hasUi: true }),
          'mod-workos': svc('mod-workos', 'integration'),
        },
      });

      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.httpBaseByService.catalog).toBe('/api/catalog');
        expect(r.value.uiPathsByService.app).toEqual(['/']);
      }
    });

    it('rejects a ui route targeting a service without ui/', () => {
      const r = validateBlueprintComposition({
        project: {
          name: 'bad-ui',
          services: ['app'],
          routes: { ui: { '/': 'app' } },
        },
        services: {
          app: svc('app', 'domain'),
        },
      });

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors.some((e) => e.code === 'BLUEPRINT_COMPOSE_UI_ROUTE_TARGET_MISSING_UI')).toBe(true);
      }
    });

    it('rejects a second http mount for the same service', () => {
      const r = validateBlueprintComposition({
        project: {
          name: 'bad-http',
          services: ['catalog'],
          routes: {
            http: {
              '/api/catalog': 'catalog',
              '/api/catalog-alt': 'catalog',
            },
          },
        },
        services: {
          catalog: svc('catalog', 'domain', { hasBindings: true }),
        },
      });

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors.some((e) => e.code === 'BLUEPRINT_COMPOSE_HTTP_ROUTE_DUPLICATE_SERVICE')).toBe(true);
      }
    });

    it('rejects a middleware provider that is not integration', () => {
      const r = validateBlueprintComposition({
        project: {
          name: 'bad-middleware',
          services: ['catalog'],
          middleware: {
            auth: { kind: 'auth', provider: 'catalog' },
          },
        },
        services: {
          catalog: svc('catalog', 'domain', { hasBindings: true }),
        },
      });

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors.some((e) => e.code === 'BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_NOT_INTEGRATION')).toBe(true);
      }
    });
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run:

  ```bash
  pnpm -F @rntme/blueprint test -- test/unit/validate-composition.test.ts
  ```

  Expected: FAIL because `validateBlueprintComposition`, `ProjectRoutingContext`, and the new composition error codes do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

  In `packages/blueprint/src/types/artifact.ts`, append the composition-only types:

  ```ts
  import type { ValidatedBindings } from '@rntme/bindings';
  import type { ValidatedPdm, EventTypeSpec } from '@rntme/pdm';
  import type { ValidatedQsm, QsmArtifact } from '@rntme/qsm';
  import type { ValidatedSeed } from '@rntme/seed';
  import type { CompiledArtifact } from '@rntme/ui';
  import type { InputMode } from '@rntme/bindings';

  export type ServiceArtifactPresence = {
    hasGraphs: boolean;
    hasBindings: boolean;
    hasUi: boolean;
    hasSeed: boolean;
    hasQsm: boolean;
  };

  export type CompositionService = ServiceDescriptor & {
    qsm: QsmArtifact | null;
    artifacts: ServiceArtifactPresence;
  };

  export type ProjectRoutingContext = {
    httpBaseByService: Record<string, string>;
    uiPathsByService: Record<string, string[]>;
  };

  export type GraphJson = {
    id: string;
    signature: {
      inputs: Record<string, { type: string; mode: InputMode; default?: unknown }>;
      output: { type: string; from: string };
    };
    nodes: unknown[];
  };

  export type ServiceGraphSpec = {
    version: '1.0-rc7';
    shapes: Record<string, { fields: Record<string, { type: string; nullable: boolean }> }>;
    graphs: Record<string, GraphJson>;
  };

  export type ValidatedServiceMember = CompositionService & {
    graphSpec: ServiceGraphSpec | null;
    qsmValidated: ValidatedQsm | null;
    bindings: ValidatedBindings | null;
    seed: ValidatedSeed | null;
    compiledUi: CompiledArtifact | null;
    eventTypes: readonly EventTypeSpec[];
  };

  export type RoutedBindingEntry = {
    service: string;
    bindingId: string;
    qualifiedId: string;
    method: 'GET' | 'POST';
    path: string;
  };

  export type ComposedBlueprint = {
    project: ProjectBlueprint;
    pdm: ValidatedPdm;
    routing: ProjectRoutingContext;
    bindingRegistry: Record<string, RoutedBindingEntry>;
    services: Record<string, ValidatedServiceMember>;
  };
  ```

  In `packages/blueprint/src/types/result.ts`, extend the layer union and append the new codes:

  ```ts
  export const ERROR_CODES = {
    BLUEPRINT_IO_ERROR: 'BLUEPRINT_IO_ERROR',
    BLUEPRINT_PARSE_SCHEMA_VIOLATION: 'BLUEPRINT_PARSE_SCHEMA_VIOLATION',
    BLUEPRINT_STRUCT_DECLARED_SERVICE_DIR_MISSING: 'BLUEPRINT_STRUCT_DECLARED_SERVICE_DIR_MISSING',
    BLUEPRINT_STRUCT_UNDECLARED_SERVICE_DIR: 'BLUEPRINT_STRUCT_UNDECLARED_SERVICE_DIR',
    BLUEPRINT_STRUCT_SERVICE_JSON_MISSING: 'BLUEPRINT_STRUCT_SERVICE_JSON_MISSING',
    BLUEPRINT_STRUCT_MOD_KIND_MISMATCH: 'BLUEPRINT_STRUCT_MOD_KIND_MISMATCH',
    BLUEPRINT_COMPOSE_ROUTE_UNKNOWN_SERVICE: 'BLUEPRINT_COMPOSE_ROUTE_UNKNOWN_SERVICE',
    BLUEPRINT_COMPOSE_HTTP_ROUTE_TARGET_MISSING_BINDINGS: 'BLUEPRINT_COMPOSE_HTTP_ROUTE_TARGET_MISSING_BINDINGS',
    BLUEPRINT_COMPOSE_HTTP_ROUTE_DUPLICATE_SERVICE: 'BLUEPRINT_COMPOSE_HTTP_ROUTE_DUPLICATE_SERVICE',
    BLUEPRINT_COMPOSE_UI_ROUTE_TARGET_NOT_DOMAIN: 'BLUEPRINT_COMPOSE_UI_ROUTE_TARGET_NOT_DOMAIN',
    BLUEPRINT_COMPOSE_UI_ROUTE_TARGET_MISSING_UI: 'BLUEPRINT_COMPOSE_UI_ROUTE_TARGET_MISSING_UI',
    BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_UNKNOWN_SERVICE: 'BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_UNKNOWN_SERVICE',
    BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_NOT_INTEGRATION: 'BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_NOT_INTEGRATION',
    BLUEPRINT_COMPOSE_MOUNT_UNKNOWN_TARGET: 'BLUEPRINT_COMPOSE_MOUNT_UNKNOWN_TARGET',
    BLUEPRINT_COMPOSE_MOUNT_UNKNOWN_MIDDLEWARE: 'BLUEPRINT_COMPOSE_MOUNT_UNKNOWN_MIDDLEWARE',
    BLUEPRINT_SERVICE_GRAPHS_INVALID: 'BLUEPRINT_SERVICE_GRAPHS_INVALID',
    BLUEPRINT_SERVICE_QSM_INVALID: 'BLUEPRINT_SERVICE_QSM_INVALID',
    BLUEPRINT_SERVICE_BINDINGS_INVALID: 'BLUEPRINT_SERVICE_BINDINGS_INVALID',
    BLUEPRINT_SERVICE_SEED_INVALID: 'BLUEPRINT_SERVICE_SEED_INVALID',
    BLUEPRINT_SERVICE_UI_INVALID: 'BLUEPRINT_SERVICE_UI_INVALID',
  } as const;

  export type BlueprintError = Readonly<{
    layer: 'load' | 'parse' | 'structural' | 'composition' | 'service';
    code: BlueprintErrorCode;
    message: string;
    path?: string;
    cause?: unknown[];
  }>;
  ```

  Create `packages/blueprint/src/validate/composition.ts`:

  ```ts
  import type { CompositionService, ProjectBlueprint, ProjectRoutingContext } from '../types/artifact.js';
  import { err, ok, ERROR_CODES, type Result } from '../types/result.js';

  export function validateBlueprintComposition(input: {
    project: ProjectBlueprint;
    services: Record<string, CompositionService>;
  }): Result<ProjectRoutingContext> {
    const errors = [];
    const httpBaseByService: Record<string, string> = {};
    const uiPathsByService: Record<string, string[]> = {};

    for (const [path, slug] of Object.entries(input.project.routes?.http ?? {})) {
      const service = input.services[slug];
      if (!service) {
        errors.push({
          layer: 'composition' as const,
          code: ERROR_CODES.BLUEPRINT_COMPOSE_ROUTE_UNKNOWN_SERVICE,
          message: `http route "${path}" targets unknown service "${slug}"`,
          path: `project.routes.http.${path}`,
        });
        continue;
      }
      if (!service.artifacts.hasBindings) {
        errors.push({
          layer: 'composition' as const,
          code: ERROR_CODES.BLUEPRINT_COMPOSE_HTTP_ROUTE_TARGET_MISSING_BINDINGS,
          message: `http route "${path}" targets service "${slug}" without bindings/`,
          path: `project.routes.http.${path}`,
        });
      }
      if (httpBaseByService[slug] !== undefined) {
        errors.push({
          layer: 'composition' as const,
          code: ERROR_CODES.BLUEPRINT_COMPOSE_HTTP_ROUTE_DUPLICATE_SERVICE,
          message: `service "${slug}" is mounted more than once in project.routes.http`,
          path: `project.routes.http.${path}`,
        });
      } else {
        httpBaseByService[slug] = path;
      }
    }

    for (const [path, slug] of Object.entries(input.project.routes?.ui ?? {})) {
      const service = input.services[slug];
      if (!service) {
        errors.push({
          layer: 'composition' as const,
          code: ERROR_CODES.BLUEPRINT_COMPOSE_ROUTE_UNKNOWN_SERVICE,
          message: `ui route "${path}" targets unknown service "${slug}"`,
          path: `project.routes.ui.${path}`,
        });
        continue;
      }
      if (service.kind !== 'domain') {
        errors.push({
          layer: 'composition' as const,
          code: ERROR_CODES.BLUEPRINT_COMPOSE_UI_ROUTE_TARGET_NOT_DOMAIN,
          message: `ui route "${path}" must target a domain service; got "${slug}"`,
          path: `project.routes.ui.${path}`,
        });
      }
      if (!service.artifacts.hasUi) {
        errors.push({
          layer: 'composition' as const,
          code: ERROR_CODES.BLUEPRINT_COMPOSE_UI_ROUTE_TARGET_MISSING_UI,
          message: `ui route "${path}" targets service "${slug}" without ui/`,
          path: `project.routes.ui.${path}`,
        });
      }
      (uiPathsByService[slug] ??= []).push(path);
    }

    for (const [id, decl] of Object.entries(input.project.middleware ?? {})) {
      if (!decl.provider) continue;
      const service = input.services[decl.provider];
      if (!service) {
        errors.push({
          layer: 'composition' as const,
          code: ERROR_CODES.BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_UNKNOWN_SERVICE,
          message: `middleware "${id}" references unknown provider "${decl.provider}"`,
          path: `project.middleware.${id}.provider`,
        });
        continue;
      }
      if (service.kind !== 'integration') {
        errors.push({
          layer: 'composition' as const,
          code: ERROR_CODES.BLUEPRINT_COMPOSE_MIDDLEWARE_PROVIDER_NOT_INTEGRATION,
          message: `middleware "${id}" provider "${decl.provider}" must be an integration service`,
          path: `project.middleware.${id}.provider`,
        });
      }
    }

    const knownTargets = new Set<string>([
      ...Object.keys(input.project.routes?.ui ?? {}).map((p) => `ui:${p}`),
      ...Object.keys(input.project.routes?.http ?? {}).map((p) => `http:${p}`),
    ]);

    for (const [index, mount] of (input.project.mounts ?? []).entries()) {
      if (!knownTargets.has(mount.target)) {
        errors.push({
          layer: 'composition' as const,
          code: ERROR_CODES.BLUEPRINT_COMPOSE_MOUNT_UNKNOWN_TARGET,
          message: `mount target "${mount.target}" is not declared in project routes`,
          path: `project.mounts.${index}.target`,
        });
      }
      for (const mw of mount.use) {
        if (!input.project.middleware || !(mw in input.project.middleware)) {
          errors.push({
            layer: 'composition' as const,
            code: ERROR_CODES.BLUEPRINT_COMPOSE_MOUNT_UNKNOWN_MIDDLEWARE,
            message: `mount "${mount.target}" references unknown middleware "${mw}"`,
            path: `project.mounts.${index}.use`,
          });
        }
      }
    }

    if (errors.length > 0) return err(errors);
    return ok({ httpBaseByService, uiPathsByService });
  }
  ```

  Update `packages/blueprint/src/index.ts`:

  ```ts
  export { validateBlueprintComposition } from './validate/composition.js';
  export type {
    CompositionService,
    ComposedBlueprint,
    ProjectRoutingContext,
    RoutedBindingEntry,
    ServiceArtifactPresence,
    ServiceGraphSpec,
    ValidatedServiceMember,
  } from './types/artifact.js';
  ```

- [ ] **Step 4: Run tests to verify they pass**

  Run:

  ```bash
  pnpm -F @rntme/blueprint test -- test/unit/validate-composition.test.ts
  pnpm -F @rntme/blueprint typecheck
  ```

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/blueprint/src packages/blueprint/test/unit/validate-composition.test.ts
  git commit -m "feat(blueprint): validate project composition routes and middleware"
  ```

---

### Task 2: Discover directory-backed service artifacts and read graph specs

**Files:**
- Create: `packages/blueprint/src/compose/discover-service-artifacts.ts`
- Create: `packages/blueprint/src/compose/service-graphs.ts`
- Modify: `packages/blueprint/src/index.ts`
- Test: `packages/blueprint/test/unit/discover-service-artifacts.test.ts`
- Test: `packages/blueprint/test/unit/service-graphs.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `packages/blueprint/test/unit/discover-service-artifacts.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
  import { dirname, join } from 'node:path';
  import { tmpdir } from 'node:os';
  import { discoverServiceArtifacts } from '../../src/compose/discover-service-artifacts.js';

  function writeJson(root: string, rel: string, value: unknown): void {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value, null, 2));
  }

  describe('discoverServiceArtifacts', () => {
    it('detects qsm/, graphs/, bindings/, ui/, and seed/ conventions', () => {
      const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
      writeJson(root, 'services/catalog/qsm/qsm.json', { version: '1' });
      writeJson(root, 'services/catalog/graphs/shapes.json', {});
      writeJson(root, 'services/catalog/bindings/bindings.json', { bindings: {} });
      writeJson(root, 'services/catalog/seed/seed.json', { seedVersion: 1, events: [] });
      writeJson(root, 'services/catalog/ui/manifest.json', { version: '2.0' });

      expect(discoverServiceArtifacts(root, 'catalog')).toEqual({
        hasGraphs: true,
        hasBindings: true,
        hasUi: true,
        hasSeed: true,
        hasQsm: true,
      });
    });
  });
  ```

  Create `packages/blueprint/test/unit/service-graphs.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
  import { dirname, join } from 'node:path';
  import { tmpdir } from 'node:os';
  import { readServiceGraphSpec } from '../../src/compose/service-graphs.js';

  function writeJson(root: string, rel: string, value: unknown): void {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value, null, 2));
  }

  describe('readServiceGraphSpec', () => {
    it('loads graphs/shapes.json and graph documents from a service directory', () => {
      const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
      writeJson(root, 'services/catalog/graphs/shapes.json', {
        ProductRow: {
          fields: {
            productId: { type: 'integer', nullable: false },
          },
        },
      });
      writeJson(root, 'services/catalog/graphs/listProducts.json', {
        id: 'listProducts',
        signature: {
          inputs: {},
          output: { type: 'rowset<ProductRow>', from: 'items' },
        },
        nodes: [],
      });

      const r = readServiceGraphSpec(root, 'catalog');
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(Object.keys(r.value.graphs)).toEqual(['listProducts']);
        expect(r.value.shapes.ProductRow?.fields.productId?.type).toBe('integer');
      }
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  Run:

  ```bash
  pnpm -F @rntme/blueprint test -- test/unit/discover-service-artifacts.test.ts test/unit/service-graphs.test.ts
  ```

  Expected: FAIL because the discovery and graph-reader helpers do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

  Create `packages/blueprint/src/compose/discover-service-artifacts.ts`:

  ```ts
  import { existsSync } from 'node:fs';
  import { join } from 'node:path';
  import type { ServiceArtifactPresence } from '../types/artifact.js';

  export function discoverServiceArtifacts(rootDir: string, slug: string): ServiceArtifactPresence {
    const serviceDir = join(rootDir, 'services', slug);
    return {
      hasGraphs: existsSync(join(serviceDir, 'graphs', 'shapes.json')),
      hasBindings: existsSync(join(serviceDir, 'bindings', 'bindings.json')),
      hasUi: existsSync(join(serviceDir, 'ui', 'manifest.json')),
      hasSeed: existsSync(join(serviceDir, 'seed', 'seed.json')),
      hasQsm: existsSync(join(serviceDir, 'qsm', 'qsm.json')),
    };
  }
  ```

  Create `packages/blueprint/src/compose/service-graphs.ts`:

  ```ts
  import { existsSync, readdirSync, readFileSync } from 'node:fs';
  import { basename, join } from 'node:path';
  import { err, ok, ERROR_CODES, type Result } from '../types/result.js';
  import type { GraphJson, ServiceGraphSpec } from '../types/artifact.js';

  export function readServiceGraphSpec(rootDir: string, slug: string): Result<ServiceGraphSpec> {
    const graphsDir = join(rootDir, 'services', slug, 'graphs');
    const shapesPath = join(graphsDir, 'shapes.json');

    try {
      if (!existsSync(shapesPath)) {
        return err([{
          layer: 'service',
          code: ERROR_CODES.BLUEPRINT_SERVICE_GRAPHS_INVALID,
          message: `service "${slug}" is missing graphs/shapes.json`,
          path: `services/${slug}/graphs/shapes.json`,
        }]);
      }

      const shapes = JSON.parse(readFileSync(shapesPath, 'utf8')) as ServiceGraphSpec['shapes'];
      const graphs: Record<string, GraphJson> = {};

      for (const name of readdirSync(graphsDir)) {
        if (!name.endsWith('.json') || name === 'shapes.json') continue;
        const raw = JSON.parse(readFileSync(join(graphsDir, name), 'utf8')) as GraphJson;
        graphs[basename(name, '.json')] = raw;
      }

      return ok({ version: '1.0-rc7', shapes, graphs });
    } catch (error) {
      return err([{
        layer: 'service',
        code: ERROR_CODES.BLUEPRINT_SERVICE_GRAPHS_INVALID,
        message: error instanceof Error ? error.message : String(error),
        path: `services/${slug}/graphs`,
      }]);
    }
  }
  ```

  Update `packages/blueprint/src/index.ts`:

  ```ts
  export { discoverServiceArtifacts } from './compose/discover-service-artifacts.js';
  export { readServiceGraphSpec } from './compose/service-graphs.js';
  ```

- [ ] **Step 4: Run tests to verify they pass**

  Run:

  ```bash
  pnpm -F @rntme/blueprint test -- test/unit/discover-service-artifacts.test.ts test/unit/service-graphs.test.ts
  pnpm -F @rntme/blueprint typecheck
  ```

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/blueprint/src packages/blueprint/test/unit/discover-service-artifacts.test.ts packages/blueprint/test/unit/service-graphs.test.ts
  git commit -m "feat(blueprint): discover service artifacts and load graph specs"
  ```

---

### Task 3: Validate service members against the shared project `PDM`

**Files:**
- Create: `packages/blueprint/src/compose/binding-resolvers.ts`
- Create: `packages/blueprint/src/compose/seed-scope.ts`
- Create: `packages/blueprint/src/compose/load-service-member.ts`
- Modify: `packages/blueprint/src/index.ts`
- Test: `packages/blueprint/test/unit/load-service-member.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `packages/blueprint/test/unit/load-service-member.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
  import { dirname, join } from 'node:path';
  import { tmpdir } from 'node:os';
  import { createPdmResolver, deriveEventTypes, validatePdm } from '@rntme/pdm';
  import { eventTypesForService } from '../../src/compose/seed-scope.js';
  import { loadServiceMember } from '../../src/compose/load-service-member.js';

  function writeJson(root: string, rel: string, value: unknown): void {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value, null, 2));
  }

  function projectPdm() {
    const parsed = validatePdm({
      entities: {
        Product: {
          ownerService: 'catalog',
          kind: 'root',
          table: 'products',
          fields: {
            productId: { type: 'integer', nullable: false, column: 'product_id' },
          },
          keys: ['productId'],
        },
        Publication: {
          ownerService: 'catalog',
          kind: 'owned',
          table: 'publications',
          fields: {
            id: { type: 'integer', nullable: false, column: 'id' },
            productId: { type: 'integer', nullable: false, column: 'product_id' },
            status: { type: 'string', nullable: false, column: 'status' },
          },
          keys: ['id'],
          stateMachine: {
            stateField: 'status',
            initial: null,
            states: ['draft', 'published'],
            transitions: {
              publish: { from: null, to: 'draft', affects: ['productId'] },
              activate: { from: 'draft', to: 'published' },
            },
          },
        },
        PriceEntry: {
          ownerService: 'pricing',
          kind: 'owned',
          table: 'price_entries',
          fields: {
            id: { type: 'integer', nullable: false, column: 'id' },
            productId: { type: 'integer', nullable: false, column: 'product_id' },
            status: { type: 'string', nullable: false, column: 'status' },
            amount: { type: 'decimal', nullable: false, column: 'amount' },
            currency: { type: 'string', nullable: false, column: 'currency' },
          },
          keys: ['id'],
          stateMachine: {
            stateField: 'status',
            initial: null,
            states: ['draft', 'active'],
            transitions: {
              quote: { from: null, to: 'draft', affects: ['productId', 'amount', 'currency'] },
              activate: { from: 'draft', to: 'active' },
            },
          },
        },
      },
    });
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
    return parsed.value;
  }

  describe('loadServiceMember', () => {
    it('filters derived events down to the service owner scope', () => {
      const pdm = projectPdm();
      const resolver = createPdmResolver(pdm);
      const pricingEvents = eventTypesForService('pricing', resolver, deriveEventTypes(pdm));

      expect(pricingEvents.map((e) => e.eventType)).toEqual(['PriceEntryQuote', 'PriceEntryActivate']);
    });

    it('validates a service qsm against the shared project pdm', () => {
      const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
      const pdm = projectPdm();
      const resolver = createPdmResolver(pdm);

      const r = loadServiceMember({
        rootDir: root,
        service: {
          slug: 'app',
          kind: 'domain',
          qsm: {
            projections: {
              PriceEntryView: {
                backing: 'entity-mirror',
                source: { entity: 'PriceEntry' },
                keys: ['id'],
                grain: ['id'],
                exposed: ['productId', 'status', 'amount', 'currency'],
              },
            },
            relations: {},
          },
          artifacts: {
            hasGraphs: false,
            hasBindings: false,
            hasUi: false,
            hasSeed: false,
            hasQsm: true,
          },
        },
        pdm,
        pdmResolver: resolver,
        allEventTypes: deriveEventTypes(pdm),
      });

      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.value.qsmValidated).not.toBeNull();
      }
    });

    it('rejects seed events for aggregates owned by a different service', () => {
      const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
      const pdm = projectPdm();
      const resolver = createPdmResolver(pdm);

      writeJson(root, 'services/pricing/seed/seed.json', {
        seedVersion: 1,
        events: [
          {
            stream: 'Publication-1',
            aggregateType: 'Publication',
            aggregateId: '1',
            version: 1,
            eventType: 'PublicationPublish',
            payload: { productId: 1 },
            occurredAt: '2026-04-23T00:00:00.000Z',
          },
        ],
      });

      const r = loadServiceMember({
        rootDir: root,
        service: {
          slug: 'pricing',
          kind: 'domain',
          qsm: null,
          artifacts: {
            hasGraphs: false,
            hasBindings: false,
            hasUi: false,
            hasSeed: true,
            hasQsm: false,
          },
        },
        pdm,
        pdmResolver: resolver,
        allEventTypes: deriveEventTypes(pdm),
      });

      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors.some((e) => e.code === 'BLUEPRINT_SERVICE_SEED_INVALID')).toBe(true);
      }
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  Run:

  ```bash
  pnpm -F @rntme/blueprint test -- test/unit/load-service-member.test.ts
  ```

  Expected: FAIL because `eventTypesForService` and `loadServiceMember` do not exist.

- [ ] **Step 3: Write the minimal implementation**

  Create `packages/blueprint/src/compose/seed-scope.ts`:

  ```ts
  import type { EventTypeSpec, PdmResolver } from '@rntme/pdm';

  export function eventTypesForService(
    serviceSlug: string,
    pdmResolver: PdmResolver,
    events: readonly EventTypeSpec[],
  ): readonly EventTypeSpec[] {
    return events.filter((event) => pdmResolver.resolveEntity(event.aggregateType)?.ownerService === serviceSlug);
  }
  ```

  Create `packages/blueprint/src/compose/binding-resolvers.ts`:

  ```ts
  import type {
    BindingResolvers,
    GraphSignature,
    InputType,
    OutputType,
    ResolvedShape,
    ScalarPrimitive,
  } from '@rntme/bindings';
  import type { PdmResolver } from '@rntme/pdm';
  import { err, ok, ERROR_CODES, type Result } from '../types/result.js';
  import type { GraphJson, ServiceGraphSpec } from '../types/artifact.js';

  function parseInputType(raw: string): InputType {
    if (raw === 'integer' || raw === 'decimal' || raw === 'string' || raw === 'boolean' || raw === 'date' || raw === 'datetime') {
      return { kind: 'scalar', primitive: raw };
    }
    throw new Error(`unsupported input type: "${raw}"`);
  }

  function parseOutputType(raw: string): OutputType {
    const m = /^(rowset|row)<([A-Za-z_][A-Za-z0-9_]*)>$/.exec(raw);
    if (!m) throw new Error(`unsupported output type: "${raw}"`);
    return { kind: m[1] as 'rowset' | 'row', shape: m[2] };
  }

  function toGraphSignature(g: GraphJson): GraphSignature {
    const inputs: GraphSignature['inputs'] = {};
    for (const [name, decl] of Object.entries(g.signature.inputs)) {
      const base = { type: parseInputType(decl.type), mode: decl.mode };
      inputs[name] = decl.default !== undefined ? { ...base, default: decl.default } : base;
    }
    return {
      id: g.id,
      inputs,
      output: { type: parseOutputType(g.signature.output.type), from: g.signature.output.from },
    };
  }

  export function createServiceBindingResolvers(input: {
    serviceSlug: string;
    graphSpec: ServiceGraphSpec;
    pdmResolver: PdmResolver;
  }): Result<BindingResolvers> {
    try {
      const signatures: Record<string, GraphSignature> = {};
      for (const graph of Object.values(input.graphSpec.graphs)) {
        signatures[graph.id] = toGraphSignature(graph);
      }

      return ok({
        resolveGraphSignature: (id) => signatures[id] ?? null,
        resolveShape: (name) => {
          const custom = input.graphSpec.shapes[name];
          if (custom) {
            const fields: ResolvedShape['fields'] = {};
            for (const [fieldName, field] of Object.entries(custom.fields)) {
              fields[fieldName] = {
                type: { kind: 'scalar', primitive: field.type as ScalarPrimitive },
                nullable: field.nullable,
              };
            }
            return { name, origin: 'custom', fields };
          }

          const entity = input.pdmResolver.resolveEntity(name);
          if (!entity) return null;

          const fields: ResolvedShape['fields'] = {};
          for (const field of entity.fields) {
            fields[field.name] = {
              type: { kind: 'scalar', primitive: field.type as ScalarPrimitive },
              nullable: field.nullable,
            };
          }
          return { name, origin: 'pdm', fields };
        },
      });
    } catch (error) {
      return err([{
        layer: 'service',
        code: ERROR_CODES.BLUEPRINT_SERVICE_GRAPHS_INVALID,
        message: error instanceof Error ? error.message : String(error),
        path: `services/${input.serviceSlug}/graphs`,
      }]);
    }
  }
  ```

  Create `packages/blueprint/src/compose/load-service-member.ts`:

  ```ts
  import { existsSync, readFileSync } from 'node:fs';
  import { join } from 'node:path';
  import { parseBindingArtifact, validateBindings } from '@rntme/bindings';
  import type { EventTypeSpec, PdmResolver, ValidatedPdm } from '@rntme/pdm';
  import { validateQsm } from '@rntme/qsm';
  import { loadSeed } from '@rntme/seed';
  import { readServiceGraphSpec } from './service-graphs.js';
  import { createServiceBindingResolvers } from './binding-resolvers.js';
  import { eventTypesForService } from './seed-scope.js';
  import { err, ok, ERROR_CODES, type Result } from '../types/result.js';
  import type { CompositionService, ValidatedServiceMember } from '../types/artifact.js';

  export function loadServiceMember(input: {
    rootDir: string;
    service: CompositionService;
    pdm: ValidatedPdm;
    pdmResolver: PdmResolver;
    allEventTypes: readonly EventTypeSpec[];
  }): Result<ValidatedServiceMember> {
    let qsmValidated = null;
    if (input.service.qsm) {
      const qsm = validateQsm(input.service.qsm, input.pdmResolver);
      if (!qsm.ok) {
        return err([{
          layer: 'service',
          code: ERROR_CODES.BLUEPRINT_SERVICE_QSM_INVALID,
          message: `service "${input.service.slug}" qsm failed validation`,
          path: `services/${input.service.slug}/qsm`,
          cause: qsm.errors,
        }]);
      }
      qsmValidated = qsm.value;
    }

    let graphSpec = null;
    let bindings = null;
    if (input.service.artifacts.hasBindings) {
      const graphs = readServiceGraphSpec(input.rootDir, input.service.slug);
      if (!graphs.ok) return graphs;
      graphSpec = graphs.value;

      const resolverResult = createServiceBindingResolvers({
        serviceSlug: input.service.slug,
        graphSpec,
        pdmResolver: input.pdmResolver,
      });
      if (!resolverResult.ok) return resolverResult;

      let rawBindings: unknown;
      try {
        rawBindings = JSON.parse(
          readFileSync(join(input.rootDir, 'services', input.service.slug, 'bindings', 'bindings.json'), 'utf8'),
        );
      } catch (error) {
        return err([{
          layer: 'service',
          code: ERROR_CODES.BLUEPRINT_SERVICE_BINDINGS_INVALID,
          message: error instanceof Error ? error.message : String(error),
          path: `services/${input.service.slug}/bindings/bindings.json`,
        }]);
      }
      const parsedBindings = parseBindingArtifact(rawBindings);
      if (!parsedBindings.ok) {
        return err([{
          layer: 'service',
          code: ERROR_CODES.BLUEPRINT_SERVICE_BINDINGS_INVALID,
          message: `service "${input.service.slug}" bindings failed parse`,
          path: `services/${input.service.slug}/bindings/bindings.json`,
          cause: parsedBindings.errors,
        }]);
      }

      const validatedBindings = validateBindings(parsedBindings.value, resolverResult.value);
      if (!validatedBindings.ok) {
        return err([{
          layer: 'service',
          code: ERROR_CODES.BLUEPRINT_SERVICE_BINDINGS_INVALID,
          message: `service "${input.service.slug}" bindings failed validation`,
          path: `services/${input.service.slug}/bindings/bindings.json`,
          cause: validatedBindings.errors,
        }]);
      }
      bindings = validatedBindings.value;
    }

    let seed = null;
    const seedPath = join(input.rootDir, 'services', input.service.slug, 'seed', 'seed.json');
    if (existsSync(seedPath)) {
      const filteredEvents = eventTypesForService(input.service.slug, input.pdmResolver, input.allEventTypes);
      let rawSeed: unknown;
      try {
        rawSeed = JSON.parse(readFileSync(seedPath, 'utf8'));
      } catch (error) {
        return err([{
          layer: 'service',
          code: ERROR_CODES.BLUEPRINT_SERVICE_SEED_INVALID,
          message: error instanceof Error ? error.message : String(error),
          path: `services/${input.service.slug}/seed/seed.json`,
        }]);
      }
      const seedResult = loadSeed(rawSeed, {
        pdm: input.pdmResolver,
        events: filteredEvents,
        serviceName: input.service.slug,
      });
      if (!seedResult.ok) {
        return err([{
          layer: 'service',
          code: ERROR_CODES.BLUEPRINT_SERVICE_SEED_INVALID,
          message: `service "${input.service.slug}" seed failed validation`,
          path: `services/${input.service.slug}/seed/seed.json`,
          cause: seedResult.errors,
        }]);
      }
      seed = seedResult.value;
    }

    return ok({
      ...input.service,
      graphSpec,
      qsmValidated,
      bindings,
      seed,
      compiledUi: null,
      eventTypes: eventTypesForService(input.service.slug, input.pdmResolver, input.allEventTypes),
    });
  }
  ```

  Update `packages/blueprint/src/index.ts`:

  ```ts
  export { createServiceBindingResolvers } from './compose/binding-resolvers.js';
  export { eventTypesForService } from './compose/seed-scope.js';
  export { loadServiceMember } from './compose/load-service-member.js';
  ```

- [ ] **Step 4: Run tests to verify they pass**

  Run:

  ```bash
  pnpm -F @rntme/blueprint test -- test/unit/load-service-member.test.ts
  pnpm -F @rntme/blueprint typecheck
  ```

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/blueprint/src packages/blueprint/test/unit/load-service-member.test.ts
  git commit -m "feat(blueprint): validate service members against shared project pdm"
  ```

---

### Task 4: Compile UI against project-routed bindings and wire the composed blueprint loader

**Files:**
- Create: `packages/blueprint/src/compose/binding-registry.ts`
- Create: `packages/blueprint/src/compose/compile-service-ui.ts`
- Create: `packages/blueprint/src/compose/load-composed-blueprint.ts`
- Modify: `packages/blueprint/src/index.ts`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/catalog/graphs/shapes.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/catalog/graphs/listProducts.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/catalog/bindings/bindings.json`
- Delete: `packages/blueprint/test/fixtures/product-catalog-project/services/catalog/qsm/projections/ProductCard.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/catalog/qsm/projections/PublicationView.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/pricing/graphs/shapes.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/pricing/graphs/listPrices.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/pricing/bindings/bindings.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/pricing/seed/seed.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/inventory/graphs/shapes.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/inventory/graphs/listInventory.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/inventory/bindings/bindings.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/app/qsm/qsm.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/app/qsm/projections/PriceEntryView.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/app/ui/manifest.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/app/ui/layouts/main.spec.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/app/ui/layouts/main.screen.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/app/ui/screens/home.spec.json`
- Create: `packages/blueprint/test/fixtures/product-catalog-project/services/app/ui/screens/home.screen.json`
- Modify: `packages/blueprint/test/fixtures/product-catalog-project/pdm/entities/Publication.json`
- Modify: `packages/blueprint/test/fixtures/product-catalog-project/pdm/entities/PriceEntry.json`
- Modify: `packages/blueprint/test/fixtures/product-catalog-project/pdm/entities/InventoryPosition.json`
- Test: `packages/blueprint/test/unit/binding-registry.test.ts`
- Test: `packages/blueprint/test/unit/load-composed-blueprint.test.ts`
- Test: `packages/blueprint/test/smoke-composed.test.ts`

- [ ] **Step 1: Write the failing tests**

  Create `packages/blueprint/test/unit/binding-registry.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { buildBindingRegistry, buildUiHttpMap, resolveProjectBindingRef } from '../../src/compose/binding-registry.js';

  describe('binding registry', () => {
    it('routes service bindings through project http prefixes and supports qualified refs', () => {
      const registry = buildBindingRegistry({
        httpBaseByService: {
          catalog: '/api/catalog',
          pricing: '/api/pricing',
        },
        bindingsByService: {
          catalog: [{ bindingId: 'listProducts', method: 'GET', path: '/products' }],
          pricing: [{ bindingId: 'listPrices', method: 'GET', path: '/prices' }],
        },
      });

      expect(registry['catalog.listProducts']?.path).toBe('/api/catalog/products');
      expect(resolveProjectBindingRef(registry, 'catalog', 'listProducts')?.qualifiedId).toBe('catalog.listProducts');
      expect(resolveProjectBindingRef(registry, 'app', 'pricing.listPrices')?.path).toBe('/api/pricing/prices');
      expect(buildUiHttpMap(registry, 'catalog').listProducts?.path).toBe('/api/catalog/products');
    });
  });
  ```

  Create `packages/blueprint/test/unit/load-composed-blueprint.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
  import { dirname, join } from 'node:path';
  import { tmpdir } from 'node:os';
  import { fileURLToPath } from 'node:url';
  import { loadComposedBlueprint } from '../../src/compose/load-composed-blueprint.js';

  const here = dirname(fileURLToPath(import.meta.url));
  const fixtureDir = join(here, '..', 'fixtures', 'product-catalog-project');

  describe('loadComposedBlueprint', () => {
    it('compiles app ui against project-routed foreign bindings', () => {
      const r = loadComposedBlueprint(fixtureDir);
      expect(r.ok).toBe(true);
      if (!r.ok) return;

      expect(r.value.bindingRegistry['pricing.listPrices']?.path).toBe('/api/pricing/prices');
      expect(r.value.services.app.compiledUi?.screens.home?.data?.['/data/prices']?.path).toBe('/api/pricing/prices');
      expect(r.value.services.app.qsmValidated).not.toBeNull();
      expect(r.value.services.pricing.seed).not.toBeNull();
    });

    it('fails when app ui references a service that is not published through project.routes.http', () => {
      const temp = mkdtempSync(join(tmpdir(), 'rntme-blueprint-'));
      const copied = join(temp, 'product-catalog-project');
      cpSync(fixtureDir, copied, { recursive: true });

      const projectPath = join(copied, 'project.json');
      const raw = JSON.parse(readFileSync(projectPath, 'utf8'));
      delete raw.routes.http['/api/pricing'];
      writeFileSync(projectPath, JSON.stringify(raw, null, 2));

      const r = loadComposedBlueprint(copied);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.errors.some((e) => e.code === 'BLUEPRINT_SERVICE_UI_INVALID')).toBe(true);
      }
    });
  });
  ```

  Create `packages/blueprint/test/smoke-composed.test.ts`:

  ```ts
  import { describe, expect, it } from 'vitest';
  import { dirname, join } from 'node:path';
  import { fileURLToPath } from 'node:url';
  import { loadComposedBlueprint } from '../src/compose/load-composed-blueprint.js';

  const here = dirname(fileURLToPath(import.meta.url));
  const fixtureDir = join(here, 'fixtures', 'product-catalog-project');

  describe('loadComposedBlueprint (smoke)', () => {
    it('loads the canonical composed project fixture', () => {
      const r = loadComposedBlueprint(fixtureDir);
      expect(r.ok).toBe(true);
      if (!r.ok) return;

      expect(r.value.project.services).toEqual(['catalog', 'pricing', 'inventory', 'app', 'mod-workos']);
      expect(r.value.routing.httpBaseByService.catalog).toBe('/api/catalog');
      expect(r.value.bindingRegistry['catalog.listProducts']?.path).toBe('/api/catalog/products');
      expect(r.value.services.app.compiledUi?.screens.home).toBeDefined();
    });
  });
  ```

- [ ] **Step 2: Run tests to verify they fail**

  Run:

  ```bash
  pnpm -F @rntme/blueprint test -- test/unit/binding-registry.test.ts test/unit/load-composed-blueprint.test.ts test/smoke-composed.test.ts
  ```

  Expected: FAIL because the binding registry, UI compiler bridge, composed loader, and canonical fixture files do not exist yet.

- [ ] **Step 3: Write the minimal implementation**

  Create `packages/blueprint/src/compose/binding-registry.ts`:

  ```ts
  import type { RoutedBindingEntry } from '../types/artifact.js';

  export function buildBindingRegistry(input: {
    httpBaseByService: Record<string, string>;
    bindingsByService: Record<string, readonly Array<{ bindingId: string; method: 'GET' | 'POST'; path: string }>>;
  }): Record<string, RoutedBindingEntry> {
    const out: Record<string, RoutedBindingEntry> = {};
    for (const [service, base] of Object.entries(input.httpBaseByService)) {
      for (const binding of input.bindingsByService[service] ?? []) {
        const qualifiedId = `${service}.${binding.bindingId}`;
        out[qualifiedId] = {
          service,
          bindingId: binding.bindingId,
          qualifiedId,
          method: binding.method,
          path: `${base}${binding.path}`,
        };
      }
    }
    return out;
  }

  export function resolveProjectBindingRef(
    registry: Record<string, RoutedBindingEntry>,
    currentService: string,
    ref: string,
  ): RoutedBindingEntry | undefined {
    if (ref.includes('.')) return registry[ref];
    return registry[`${currentService}.${ref}`];
  }

  export function buildUiHttpMap(
    registry: Record<string, RoutedBindingEntry>,
    currentService: string,
  ): Record<string, { method: 'GET' | 'POST'; path: string }> {
    const map: Record<string, { method: 'GET' | 'POST'; path: string }> = {};
    for (const entry of Object.values(registry)) {
      map[entry.qualifiedId] = { method: entry.method, path: entry.path };
      if (entry.service === currentService) {
        map[entry.bindingId] = { method: entry.method, path: entry.path };
      }
    }
    return map;
  }
  ```

  Create `packages/blueprint/src/compose/compile-service-ui.ts`:

  ```ts
  import { existsSync } from 'node:fs';
  import { join } from 'node:path';
  import { compile } from '@rntme/ui';
  import { err, ok, ERROR_CODES, type Result } from '../types/result.js';
  import type { RoutedBindingEntry } from '../types/artifact.js';
  import { buildUiHttpMap, resolveProjectBindingRef } from './binding-registry.js';

  export function compileServiceUi(input: {
    rootDir: string;
    serviceSlug: string;
    bindingRegistry: Record<string, RoutedBindingEntry>;
  }): Result<import('@rntme/ui').CompiledArtifact | null> {
    const uiDir = join(input.rootDir, 'services', input.serviceSlug, 'ui');
    if (!existsSync(join(uiDir, 'manifest.json'))) return ok(null);

    const result = compile({
      sourceDir: uiDir,
      httpMap: buildUiHttpMap(input.bindingRegistry, input.serviceSlug),
      resolvers: {
        resolveBinding: (ref) => resolveProjectBindingRef(input.bindingRegistry, input.serviceSlug, ref),
        resolveComponent: () => ({ childrenModel: 'list' as const }),
        resolveRoute: () => true,
      },
    });

    if (!result.ok) {
      return err([{
        layer: 'service',
        code: ERROR_CODES.BLUEPRINT_SERVICE_UI_INVALID,
        message: `service "${input.serviceSlug}" ui failed validation`,
        path: `services/${input.serviceSlug}/ui`,
        cause: result.errors,
      }]);
    }
    return ok(result.value);
  }
  ```

  Create `packages/blueprint/src/compose/load-composed-blueprint.ts`:

  ```ts
  import { createPdmResolver, deriveEventTypes } from '@rntme/pdm';
  import { discoverServiceArtifacts } from './discover-service-artifacts.js';
  import { loadServiceMember } from './load-service-member.js';
  import { buildBindingRegistry } from './binding-registry.js';
  import { compileServiceUi } from './compile-service-ui.js';
  import { validateBlueprintComposition } from '../validate/composition.js';
  import { loadBlueprint } from '../load/load-blueprint.js';
  import { ok, type Result } from '../types/result.js';
  import type { ComposedBlueprint, CompositionService } from '../types/artifact.js';

  export function loadComposedBlueprint(dir: string): Result<ComposedBlueprint> {
    const loaded = loadBlueprint(dir);
    if (!loaded.ok) return loaded;

    const services: Record<string, CompositionService> = {};
    for (const [slug, service] of Object.entries(loaded.value.services)) {
      services[slug] = {
        ...service,
        artifacts: discoverServiceArtifacts(dir, slug),
      };
    }

    const composition = validateBlueprintComposition({
      project: loaded.value.project,
      services,
    });
    if (!composition.ok) return composition;

    const pdmResolver = createPdmResolver(loaded.value.pdm);
    const allEventTypes = deriveEventTypes(loaded.value.pdm);

    const validatedServices: Record<string, import('../types/artifact.js').ValidatedServiceMember> = {};
    for (const [slug, service] of Object.entries(services)) {
      const member = loadServiceMember({
        rootDir: dir,
        service,
        pdm: loaded.value.pdm,
        pdmResolver,
        allEventTypes,
      });
      if (!member.ok) return member;
      validatedServices[slug] = member.value;
    }

    const bindingRegistry = buildBindingRegistry({
      httpBaseByService: composition.value.httpBaseByService,
      bindingsByService: Object.fromEntries(
        Object.entries(validatedServices).map(([slug, svc]) => [
          slug,
          Object.entries(svc.bindings?.resolved ?? {}).map(([bindingId, binding]) => ({
            bindingId,
            method: binding.entry.http.method,
            path: binding.entry.http.path,
          })),
        ]),
      ),
    });

    for (const [slug, service] of Object.entries(validatedServices)) {
      const compiledUi = compileServiceUi({
        rootDir: dir,
        serviceSlug: slug,
        bindingRegistry,
      });
      if (!compiledUi.ok) return compiledUi;
      validatedServices[slug] = {
        ...service,
        compiledUi: compiledUi.value,
      };
    }

    return ok({
      project: loaded.value.project,
      pdm: loaded.value.pdm,
      routing: composition.value,
      bindingRegistry,
      services: validatedServices,
    });
  }
  ```

  Update `packages/blueprint/src/index.ts`:

  ```ts
  export { buildBindingRegistry, buildUiHttpMap, resolveProjectBindingRef } from './compose/binding-registry.js';
  export { compileServiceUi } from './compose/compile-service-ui.js';
  export { loadComposedBlueprint } from './compose/load-composed-blueprint.js';
  ```

  Extend the canonical fixture with these exact additions:

  `packages/blueprint/test/fixtures/product-catalog-project/pdm/entities/Publication.json`

  ```json
  {
    "ownerService": "catalog",
    "kind": "owned",
    "table": "publications",
    "fields": {
      "id": { "type": "integer", "nullable": false, "column": "id" },
      "productId": { "type": "integer", "nullable": false, "column": "product_id" },
      "status": { "type": "string", "nullable": false, "column": "status" }
    },
    "keys": ["id"],
    "stateMachine": {
      "stateField": "status",
      "initial": null,
      "states": ["draft", "published"],
      "transitions": {
        "publish": { "from": null, "to": "draft", "affects": ["productId"] },
        "activate": { "from": "draft", "to": "published" }
      }
    }
  }
  ```

  `.../pdm/entities/PriceEntry.json`

  ```json
  {
    "ownerService": "pricing",
    "kind": "owned",
    "table": "price_entries",
    "fields": {
      "id": { "type": "integer", "nullable": false, "column": "id" },
      "productId": { "type": "integer", "nullable": false, "column": "product_id" },
      "status": { "type": "string", "nullable": false, "column": "status" },
      "amount": { "type": "decimal", "nullable": false, "column": "amount" },
      "currency": { "type": "string", "nullable": false, "column": "currency" }
    },
    "keys": ["id"],
    "stateMachine": {
      "stateField": "status",
      "initial": null,
      "states": ["draft", "active"],
      "transitions": {
        "quote": { "from": null, "to": "draft", "affects": ["productId", "amount", "currency"] },
        "activate": { "from": "draft", "to": "active" }
      }
    }
  }
  ```

  `.../pdm/entities/InventoryPosition.json`

  ```json
  {
    "ownerService": "inventory",
    "kind": "owned",
    "table": "inventory_positions",
    "fields": {
      "id": { "type": "integer", "nullable": false, "column": "id" },
      "productId": { "type": "integer", "nullable": false, "column": "product_id" },
      "status": { "type": "string", "nullable": false, "column": "status" },
      "availableQuantity": { "type": "integer", "nullable": false, "column": "available_quantity" }
    },
    "keys": ["id"],
    "stateMachine": {
      "stateField": "status",
      "initial": null,
      "states": ["available", "reserved"],
      "transitions": {
        "stock": { "from": null, "to": "available", "affects": ["productId", "availableQuantity"] },
        "reserve": { "from": "available", "to": "reserved" }
      }
    }
  }
  ```

  `.../services/catalog/graphs/shapes.json`

  ```json
  {
    "ProductRow": {
      "fields": {
        "productId": { "type": "integer", "nullable": false }
      }
    }
  }
  ```

  `.../services/catalog/graphs/listProducts.json`

  ```json
  {
    "id": "listProducts",
    "signature": {
      "inputs": {},
      "output": { "type": "rowset<ProductRow>", "from": "items" }
    },
    "nodes": []
  }
  ```

  `.../services/catalog/bindings/bindings.json`

  ```json
  {
    "version": "1.0",
    "graphSpecRef": "catalog.graphs.v1",
    "pdmRef": "product-catalog.domain.v1",
    "qsmRef": "catalog.read.v1",
    "bindings": {
      "listProducts": {
        "graph": "listProducts",
        "target": { "engine": "sqlite", "dialect": "sqlite" },
        "http": {
          "method": "GET",
          "path": "/products",
          "parameters": []
        }
      }
    }
  }
  ```

  Remove the old Track A projection that mirrored the root `Product` entity:

  ```bash
  rm packages/blueprint/test/fixtures/product-catalog-project/services/catalog/qsm/projections/ProductCard.json
  ```

  `.../services/catalog/qsm/projections/PublicationView.json`

  ```json
  {
    "backing": "entity-mirror",
    "source": { "entity": "Publication" },
    "keys": ["id"],
    "grain": ["id"],
    "exposed": ["productId", "status"]
  }
  ```

  `.../services/pricing/graphs/shapes.json`

  ```json
  {
    "PriceRow": {
      "fields": {
        "id": { "type": "integer", "nullable": false },
        "productId": { "type": "integer", "nullable": false },
        "amount": { "type": "decimal", "nullable": false },
        "currency": { "type": "string", "nullable": false }
      }
    }
  }
  ```

  `.../services/pricing/graphs/listPrices.json`

  ```json
  {
    "id": "listPrices",
    "signature": {
      "inputs": {},
      "output": { "type": "rowset<PriceRow>", "from": "items" }
    },
    "nodes": []
  }
  ```

  `.../services/pricing/bindings/bindings.json`

  ```json
  {
    "version": "1.0",
    "graphSpecRef": "pricing.graphs.v1",
    "pdmRef": "product-catalog.domain.v1",
    "qsmRef": "pricing.read.v1",
    "bindings": {
      "listPrices": {
        "graph": "listPrices",
        "target": { "engine": "sqlite", "dialect": "sqlite" },
        "http": {
          "method": "GET",
          "path": "/prices",
          "parameters": []
        }
      }
    }
  }
  ```

  `.../services/pricing/seed/seed.json`

  ```json
  {
    "seedVersion": 1,
    "events": [
      {
        "stream": "PriceEntry-1",
        "aggregateType": "PriceEntry",
        "aggregateId": "1",
        "version": 1,
        "eventType": "PriceEntryQuote",
        "payload": {
          "productId": 1,
          "amount": 199.99,
          "currency": "USD"
        },
        "occurredAt": "2026-04-23T00:00:00.000Z"
      }
    ]
  }
  ```

  `.../services/inventory/graphs/shapes.json`

  ```json
  {
    "InventoryRow": {
      "fields": {
        "id": { "type": "integer", "nullable": false },
        "productId": { "type": "integer", "nullable": false },
        "availableQuantity": { "type": "integer", "nullable": false }
      }
    }
  }
  ```

  `.../services/inventory/graphs/listInventory.json`

  ```json
  {
    "id": "listInventory",
    "signature": {
      "inputs": {},
      "output": { "type": "rowset<InventoryRow>", "from": "items" }
    },
    "nodes": []
  }
  ```

  `.../services/inventory/bindings/bindings.json`

  ```json
  {
    "version": "1.0",
    "graphSpecRef": "inventory.graphs.v1",
    "pdmRef": "product-catalog.domain.v1",
    "qsmRef": "inventory.read.v1",
    "bindings": {
      "listInventory": {
        "graph": "listInventory",
        "target": { "engine": "sqlite", "dialect": "sqlite" },
        "http": {
          "method": "GET",
          "path": "/inventory",
          "parameters": []
        }
      }
    }
  }
  ```

  `.../services/app/qsm/qsm.json`

  ```json
  {
    "version": "1",
    "relations": {}
  }
  ```

  `.../services/app/qsm/projections/PriceEntryView.json`

  ```json
  {
    "backing": "entity-mirror",
    "source": { "entity": "PriceEntry" },
    "keys": ["id"],
    "grain": ["id"],
    "exposed": ["productId", "status", "amount", "currency"]
  }
  ```

  `.../services/app/ui/manifest.json`

  ```json
  {
    "version": "2.0",
    "pdmRef": "product-catalog.domain.v1",
    "qsmRef": "app.read.v1",
    "graphSpecRef": "app.graphs.v1",
    "bindingsRef": "project.bindings.v1",
    "metadata": { "title": "Product Catalog" },
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

  `.../services/app/ui/layouts/main.spec.json`

  ```json
  {
    "root": "shell",
    "elements": {
      "shell": {
        "type": "Stack",
        "props": { "direction": "vertical" },
        "children": ["title"]
      },
      "title": {
        "type": "Heading",
        "props": { "level": 1, "text": "Catalog" }
      }
    }
  }
  ```

  `.../services/app/ui/layouts/main.screen.json`

  ```json
  {}
  ```

  `.../services/app/ui/screens/home.spec.json`

  ```json
  {
    "root": "page",
    "elements": {
      "page": {
        "type": "Heading",
        "props": { "level": 2, "text": "Home" }
      }
    }
  }
  ```

  `.../services/app/ui/screens/home.screen.json`

  ```json
  {
    "metadata": { "title": "Home" },
    "data": {
      "/data/catalog": { "binding": "catalog.listProducts" },
      "/data/prices": { "binding": "pricing.listPrices" },
      "/data/inventory": { "binding": "inventory.listInventory" }
    }
  }
  ```

- [ ] **Step 4: Run tests to verify they pass**

  Run:

  ```bash
  pnpm -F @rntme/blueprint test -- test/unit/binding-registry.test.ts test/unit/load-composed-blueprint.test.ts test/smoke-composed.test.ts
  pnpm -F @rntme/blueprint typecheck
  ```

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/blueprint/src packages/blueprint/test
  git commit -m "feat(blueprint): compose project services and routed ui bindings"
  ```

---

### Task 5: Sync package docs with the project composition model

**Files:**
- Modify: `packages/blueprint/README.md`
- Modify: `packages/ui/README.md`
- Modify: `packages/qsm/README.md`

- [ ] **Step 1: Update the blueprint package README**

  In `packages/blueprint/README.md`, replace the Track A-only summary with:

  ```md
  # @rntme/blueprint

  Project-first blueprint parser/validator for rntme.

  ## Role in the system

  - Depends on: `@rntme/pdm`, `@rntme/qsm`, `@rntme/bindings`, `@rntme/ui`, `@rntme/seed`, `zod`
  - Consumed by: future runtime/tooling tracks
  - Position in pipeline:
    `project directory`
    -> `loadBlueprint` (Track A: structure + project `PDM` + raw service descriptors)
    -> `loadComposedBlueprint` (Track B: project routing/middleware semantics + validated service members + project-routed UI compilation)

  ## Directory conventions

  - `pdm/pdm.json` + `pdm/entities/*.json`
  - `services/<svc>/qsm/qsm.json` + `projections/*.json`
  - `services/<svc>/graphs/shapes.json` + `graphs/*.json`
  - `services/<svc>/bindings/bindings.json`
  - `services/<svc>/seed/seed.json`
  - `services/<svc>/ui/...`

  ## Where to look first

  - `src/load/load-blueprint.ts`
  - `src/validate/composition.ts`
  - `src/compose/load-service-member.ts`
  - `src/compose/load-composed-blueprint.ts`
  - `test/fixtures/product-catalog-project/`
  ```

- [ ] **Step 2: Update the UI package README for project-qualified binding refs**

  In `packages/ui/README.md`, add this invariant under **Invariants & gotchas**:

  ```md
  - **Binding IDs are opaque to `@rntme/ui`.** The compiler only checks that `resolveBinding(id)` succeeds and that `httpMap[id]` exists. Project-aware callers may therefore use qualified refs like `pricing.listPrices`, while bare ids such as `listIssues` remain valid as caller-defined local shorthands.
  ```

  Add this sentence near the top-level role description:

  ```md
  The package does not assume a same-service binding namespace; Track B project composition injects a routed binding map from `@rntme/blueprint`.
  ```

- [ ] **Step 3: Update the QSM package README for cross-service inputs**

  In `packages/qsm/README.md`, add this invariant under **Invariants & gotchas**:

  ```md
  - **Service ownership is external to `@rntme/qsm`.** When `@rntme/qsm` is used through `@rntme/blueprint`, a service may own a projection over a foreign service's owned entity as long as the shared project `PDM` exposes that entity and it has a state machine. `@rntme/qsm` still treats the supplied `PdmResolver` as canon and does not encode service boundaries itself.
  ```

  Add this sentence to the package role summary:

  ```md
  In the project-first model, service-level `QSM` remains service-owned but may consume events derived from foreign owned entities via the shared project `PDM`.
  ```

- [ ] **Step 4: Run verification**

  Run:

  ```bash
  pnpm -F @rntme/blueprint build
  pnpm -F @rntme/blueprint typecheck
  pnpm -F @rntme/blueprint test
  ```

  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add packages/blueprint/README.md packages/ui/README.md packages/qsm/README.md
  git commit -m "docs: describe project composition model contracts"
  ```

---

## Self-check matrix

| Spec requirement | Covered by |
|---|---|
| Service validation runs against project membership, not isolated bundle only | Tasks 1, 3, 4 |
| Project routes and middleware declarations are semantically checked | Task 1 |
| UI host must be a domain service selected by project routing | Task 1 |
| Cross-service `QSM` inputs are allowed through shared project `PDM` | Tasks 3, 4 |
| `QSM` stays service-level | Tasks 3, 4 |
| Middleware providers must refer to integration services | Task 1 |
| UI resolves bindings through project-routed HTTP surfaces | Task 4 |
| UI remains service-level, no project UI artifact | Task 4 + scope guard |
| Seed validation uses service-owned event scope | Task 3 |
| Runtime boot/middleware execution remains deferred | scope guard; no `packages/runtime/src/*` changes |

## Final verification command set

Run this exact bundle before closing Track B:

```bash
pnpm -F @rntme/blueprint build
pnpm -F @rntme/blueprint typecheck
pnpm -F @rntme/blueprint test
```
