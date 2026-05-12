# Module Client UI Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add module-owned browser assets and reusable UI fragments, then move the platform product design system out of `@rntme/ui-runtime` into `apps/platform/ui-module` consumed through `project.json#modules.platformUi`.

**Architecture:** Keep the existing module model: `module.json#client` is the single browser extension surface, with executable code still flowing through `client.entry` and the generated virtual entry. `@rntme/blueprint` validates and composes module assets/presets, `@rntme/ui` stays module-agnostic through a generic external-fragment resolver, deploy/bundle code materializes static files into `ui-build/`, and `@rntme/ui-runtime` only serves the compiled artifact plus an explicit asset manifest. The platform UI becomes a local workspace module named `@rntme/platform-ui`; runtime keeps only generic host/base catalog code.

**Tech Stack:** Bun 1.1+, TypeScript, Zod, React 19, Hono, `@json-render/*`, `@rntme/contracts-module-v1`, `@rntme/blueprint`, `@rntme/ui`, `@rntme/ui-runtime`, `@rntme/deploy-bundle-input`, `@rntme/deploy-core`, `@rntme/deploy-dokploy`, Bun test runner, ESLint, dependency-cruiser.

---

## Scope And Dependencies

This plan implements `docs/superpowers/specs/2026-05-12-module-client-ui-design-system-design.md`.

The spec is one coherent subsystem because every slice depends on the same composed module client surface:

- Manifest contract: parses `client.assets` and `client.presets`.
- Blueprint: validates module files, builds the composed asset manifest, and supplies the module preset resolver.
- UI compiler: resolves external fragment sources without importing blueprint/module packages.
- Runtime: serves only explicit assets and exposes inspection JSON.
- Deploy path: copies module static files into the runtime artifact directory.
- Platform migration: consumes those surfaces through `apps/platform/ui-module`.

Out of scope for this plan:

- Separate "UI module" kind.
- Runtime module discovery.
- JavaScript in `client.assets`.
- Screen/layout preset kinds.
- Full binary-safe runtime artifact refactor. V1 supports text/static web assets needed by the platform module: CSS, SVG, JSON, and text fixtures. Font manifest fields are validated and surfaced; real `.woff`/`.woff2` deployment is left for the richer asset-optimization follow-up because current deploy runtime file mounts are text-string based.

## File Structure

### Created

- `packages/artifacts/blueprint/src/compose/module-client-assets.ts` - validates module asset/preset declarations against package files and builds composed UI asset manifest/source records.
- `packages/artifacts/blueprint/src/compose/module-preset-resolver.ts` - resolves `module:<projectModuleKey>/<presetPath>` refs to exported module fragment specs.
- `packages/artifacts/blueprint/test/unit/module-client-assets.test.ts` - blueprint validation and manifest tests for assets/presets.
- `packages/artifacts/ui/test/unit/external-fragments.test.ts` - generic external `$ref` resolver tests.
- `apps/platform/ui-module/README.md` - package stub linking to the platform owner doc.
- `apps/platform/ui-module/package.json` - local workspace package `@rntme/platform-ui`.
- `apps/platform/ui-module/tsconfig.json` - build config.
- `apps/platform/ui-module/tsconfig.check.json` - typecheck config.
- `apps/platform/ui-module/eslint.config.mjs` - lint config matching existing module packages.
- `apps/platform/ui-module/module.json` - module manifest exporting `Platform*` components, assets, and fragment presets.
- `apps/platform/ui-module/src/client.ts` - browser entry exports for platform React components.
- `apps/platform/ui-module/src/components.tsx` - platform product components moved from `@rntme/ui-runtime`.
- `apps/platform/ui-module/src/index.ts` - package root export marker.
- `apps/platform/ui-module/assets/platform-ui.css` - platform design-system CSS moved from `ui-runtime`.
- `apps/platform/ui-module/assets/logo-monogram.svg` - copied from `.tmp/rntme Design System/assets/logo-monogram.svg`.
- `apps/platform/ui-module/assets/logo-wordmark.svg` - copied from `.tmp/rntme Design System/assets/logo-wordmark.svg`.
- `apps/platform/ui-module/fragments/service-card.spec.json` - exported platform fragment for repeated service-card usage.
- `apps/platform/ui-module/test/components.test.tsx` - static render coverage for representative platform components.

### Modified

- `package.json` - add `apps/platform/ui-module` to workspaces.
- `packages/contracts/module/v1/src/manifest-shape.ts` - add client asset/preset schemas and entry requirement refinement.
- `packages/contracts/module/v1/src/index.ts` - re-export new inferred types automatically from manifest-shape exports.
- `packages/contracts/module/v1/test/unit/manifest-shape.test.ts` - parser coverage for assets/presets.
- `packages/artifacts/blueprint/src/types/artifact.ts` - add `UiAssetManifest`, `UiAssetSource`, `UiPresetExport`, and composed blueprint fields.
- `packages/artifacts/blueprint/src/types/result.ts` - append blueprint error codes.
- `packages/artifacts/blueprint/src/compose/modules.ts` - allow `@rntme/platform-ui` workspace package resolution and preserve project keys.
- `packages/artifacts/blueprint/src/compose/catalog.ts` - include module asset/preset metadata where needed.
- `packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts` - build asset/preset surfaces before UI compile and pass the resolver to service UI compilation.
- `packages/artifacts/blueprint/src/compose/compile-service-ui.ts` - accept module preset resolver and forward it to `@rntme/ui`.
- `packages/artifacts/blueprint/src/compose/ui-core-components.ts` - remove platform product components and add generic `Table`.
- `packages/artifacts/blueprint/test/unit/load-composed-blueprint.test.ts` - module preset/ref validation errors.
- `packages/artifacts/blueprint/test/smoke-ui-modules.test.ts` - composed manifest coverage.
- `packages/artifacts/ui/src/compile.ts` - add external fragment resolver option.
- `packages/artifacts/ui/src/resolve/resolve.ts` - resolve local and external fragments with cycle detection.
- `packages/artifacts/ui/src/types/source.ts` - add external fragment resolver types.
- `packages/artifacts/ui/src/types/result.ts` - append external fragment error codes.
- `packages/artifacts/ui/test/integration/compile.test.ts` - assert external refs compile away.
- `packages/runtime/ui-runtime/src/server/index.ts` - accept `assetManifest`, serve `/_ui-assets.json`, and keep asset sandboxing.
- `packages/runtime/ui-runtime/src/server/static-shell.ts` - emit deterministic preload/stylesheet tags.
- `packages/runtime/ui-runtime/src/client/registry.ts` - remove platform product components/CSS coupling and add generic `Table`.
- `packages/runtime/ui-runtime/src/client/styles.css` - remove platform product CSS; keep Tailwind/shadcn host baseline only.
- `packages/runtime/ui-runtime/src/index.ts` - export asset manifest option types from server.
- `packages/runtime/ui-runtime/test/unit/server.test.ts` - shell tags, asset JSON, path traversal coverage.
- `packages/runtime/ui-runtime/test/unit/data-table.test.ts` - replace with generic `Table` test.
- `packages/runtime/runtime/src/types.ts` - carry optional `uiAssetManifest`.
- `packages/runtime/runtime/src/load/load-service.ts` - read optional `ui-assets.json`.
- `packages/runtime/runtime/src/plugins/http-surface.ts` - pass `assetManifest` to `createUiApp`.
- `packages/runtime/runtime/test/integration/load-service.test.ts` - optional asset manifest loading.
- `apps/cli/src/bundle/collect-assets.ts` - include declared module static assets from bundled module packages.
- `apps/cli/test/unit/bundle/collect-assets.test.ts` - static module asset collection tests.
- `packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts` - copy module static assets into domain-service runtime files and emit `ui-assets.json`.
- `packages/platform/deploy-bundle-input/test/to-deploy-core-input.test.ts` - platform UI module runtime files.
- `apps/cli/scripts/copy-platform-blueprint.cjs` - copy the platform UI module into the bundled platform blueprint `node_modules`.
- `apps/platform/blueprint/project.json` - add `modules.platformUi`.
- `apps/platform/blueprint/services/app/ui/**/*.spec.json` - rename platform component types to `Platform*`.
- `apps/platform/blueprint/test/platform-ui.test.ts` - assert platform module catalog/assets.
- Package READMEs and owner docs listed in "Docs Touch Evaluation".
- `AGENTS.md` - add `apps/platform/ui-module/README.md` to the apps row.
- `docs/decision-system.md` - add the locked-pending module client surface bet.

### Deleted

- No files are deleted. Product component code is moved out of `packages/runtime/ui-runtime/src/client/registry.ts`, but the file remains.

---

## Task 1: Extend The Module Manifest Contract

**Files:**
- Modify: `packages/contracts/module/v1/src/manifest-shape.ts`
- Modify: `packages/contracts/module/v1/test/unit/manifest-shape.test.ts`

- [ ] **Step 1: Write the failing parser tests**

Append these tests inside `packages/contracts/module/v1/test/unit/manifest-shape.test.ts`, after the existing "relaxed top-level + client block" describe block:

```ts
describe('ModuleManifestSchema - client assets and presets', () => {
  it('accepts non-executable client assets and fragment presets', () => {
    const parsed = parseModuleManifest({
      name: '@rntme/platform-ui',
      version: '0.0.0',
      client: {
        assets: {
          stylesheets: [
            {
              id: 'platform-ui',
              path: 'assets/platform-ui.css',
              order: 100,
              media: 'all',
              scope: 'document',
            },
          ],
          fonts: [
            {
              id: 'switzer-400',
              path: 'assets/fonts/switzer-400.woff2',
              family: 'Switzer',
              weight: '400',
              preload: true,
            },
          ],
          icons: [{ id: 'logo-monogram', path: 'assets/logo-monogram.svg' }],
          images: [],
          staticFiles: [{ id: 'brand-json', path: 'assets/brand.json' }],
          preloads: [{ path: 'assets/platform-ui.css', as: 'style' }],
        },
        presets: [
          {
            name: 'service-card',
            kind: 'fragment',
            path: 'fragments/service-card',
            description: 'Platform service summary card.',
            inputs: {
              name: { type: 'string', required: true },
              status: { type: 'string' },
            },
          },
        ],
      },
    });

    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.client?.assets?.stylesheets?.[0]?.id).toBe('platform-ui');
      expect(parsed.value.client?.presets?.[0]?.kind).toBe('fragment');
    }
  });

  it('requires client.entry only when executable client fields are declared', () => {
    const assetOnly = parseModuleManifest({
      name: '@rntme/assets-only',
      version: '0.0.0',
      client: {
        assets: {
          stylesheets: [{ id: 'theme', path: 'assets/theme.css' }],
        },
      },
    });
    expect(assetOnly.ok).toBe(true);

    const executableWithoutEntry = parseModuleManifest({
      name: '@rntme/broken-ui',
      version: '0.0.0',
      client: {
        components: [{ type: 'Broken', props: {} }],
      },
    });
    expect(executableWithoutEntry.ok).toBe(false);
    if (!executableWithoutEntry.ok) {
      expect(
        executableWithoutEntry.errors.some((e) =>
          e.message.includes('MODULE_MANIFEST_CLIENT_ENTRY_REQUIRED'),
        ),
      ).toBe(true);
    }
  });

  it('rejects scripts under client.assets', () => {
    const parsed = parseModuleManifest({
      name: '@rntme/script-asset',
      version: '0.0.0',
      client: {
        assets: {
          scripts: [{ id: 'bad', path: 'assets/bad.js' }],
        },
      },
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((e) => e.path.includes('client.assets'))).toBe(true);
    }
  });

  it('rejects unsafe asset and preset paths', () => {
    const parsed = parseModuleManifest({
      name: '@rntme/bad-paths',
      version: '0.0.0',
      client: {
        assets: {
          stylesheets: [{ id: 'escape', path: '../theme.css' }],
          icons: [{ id: 'absolute', path: '/assets/logo.svg' }],
        },
        presets: [
          {
            name: 'bad-fragment',
            kind: 'fragment',
            path: 'fragments/../private',
            inputs: {},
          },
        ],
      },
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(
        parsed.errors.filter((e) => e.message.includes('MODULE_MANIFEST_CLIENT_PATH_UNSAFE')).length,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('rejects duplicate client asset ids and preset names/paths', () => {
    const parsed = parseModuleManifest({
      name: '@rntme/duplicate-client-exports',
      version: '0.0.0',
      client: {
        assets: {
          stylesheets: [
            { id: 'platform-ui', path: 'assets/a.css' },
            { id: 'platform-ui', path: 'assets/b.css' },
          ],
        },
        presets: [
          { name: 'card', kind: 'fragment', path: 'fragments/card', inputs: {} },
          { name: 'card', kind: 'fragment', path: 'fragments/card-2', inputs: {} },
          { name: 'card-2', kind: 'fragment', path: 'fragments/card', inputs: {} },
        ],
      },
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.errors.some((e) => e.message.includes('MODULE_MANIFEST_DUPLICATE_CLIENT_ASSET'))).toBe(true);
      expect(parsed.errors.some((e) => e.message.includes('MODULE_MANIFEST_DUPLICATE_PRESET_NAME'))).toBe(true);
      expect(parsed.errors.some((e) => e.message.includes('MODULE_MANIFEST_DUPLICATE_PRESET_PATH'))).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
bun test --cwd packages/contracts/module/v1 test/unit/manifest-shape.test.ts
```

Expected: failures for unknown `client.assets`, unknown `client.presets`, and missing `client.entry` behavior.

- [ ] **Step 3: Implement the manifest schemas**

In `packages/contracts/module/v1/src/manifest-shape.ts`, replace the existing `ClientBlockSchema` area with these additions. Keep the existing schemas above and below intact.

```ts
const SAFE_CLIENT_PATH_SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

export const ClientRelativePathSchema = z.string().min(1).superRefine((value, ctx) => {
  if (
    value.startsWith('/') ||
    value.includes('\\') ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) ||
    value.split('/').some((segment) => segment === '' || segment === '.' || segment === '..' || !SAFE_CLIENT_PATH_SEGMENT_RE.test(segment))
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `MODULE_MANIFEST_CLIENT_PATH_UNSAFE: client asset/preset path "${value}" must be a relative path inside the module package`,
    });
  }
});

const ClientAssetIdSchema = z.string().min(1).regex(/^[A-Za-z0-9._-]+$/);

export const ClientStylesheetAssetSchema = z
  .object({
    id: ClientAssetIdSchema,
    path: ClientRelativePathSchema,
    order: z.number().int().optional(),
    media: z.string().min(1).optional(),
    scope: z.literal('document').optional(),
  })
  .strict();

export const ClientFontAssetSchema = z
  .object({
    id: ClientAssetIdSchema,
    path: ClientRelativePathSchema,
    family: z.string().min(1),
    weight: z.string().min(1).optional(),
    style: z.string().min(1).optional(),
    preload: z.boolean().optional(),
  })
  .strict();

export const ClientImageAssetSchema = z
  .object({
    id: ClientAssetIdSchema,
    path: ClientRelativePathSchema,
    alt: z.string().optional(),
  })
  .strict();

export const ClientStaticFileAssetSchema = z
  .object({
    id: ClientAssetIdSchema,
    path: ClientRelativePathSchema,
  })
  .strict();

export const ClientPreloadAssetSchema = z
  .object({
    path: ClientRelativePathSchema,
    as: z.enum(['style', 'font', 'image', 'fetch']),
    type: z.string().min(1).optional(),
    crossorigin: z.enum(['anonymous', 'use-credentials']).optional(),
  })
  .strict();

export const ClientAssetsSchema = z
  .object({
    stylesheets: z.array(ClientStylesheetAssetSchema).optional(),
    fonts: z.array(ClientFontAssetSchema).optional(),
    icons: z.array(ClientImageAssetSchema).optional(),
    images: z.array(ClientImageAssetSchema).optional(),
    staticFiles: z.array(ClientStaticFileAssetSchema).optional(),
    preloads: z.array(ClientPreloadAssetSchema).optional(),
  })
  .strict();

export const ClientPresetSchema = z
  .object({
    name: z.string().min(1).regex(/^[A-Za-z0-9._-]+$/),
    kind: z.literal('fragment'),
    path: ClientRelativePathSchema,
    description: z.string().min(1).optional(),
    inputs: z.record(PropSchemaSchema).default({}),
  })
  .strict();

export const ClientBlockSchema = z
  .object({
    entry: z.string().min(1).optional(),
    boot: z.boolean().optional(),
    bootTimeoutMs: z.number().int().positive().optional(),
    contract: z.enum(['identity', 'storage']).optional(),
    config: ClientConfigSchema.optional(),
    components: z.array(ComponentDeclarationSchema).optional(),
    operations: z.array(OperationDeclarationSchema).optional(),
    assets: ClientAssetsSchema.optional(),
    presets: z.array(ClientPresetSchema).optional(),
  })
  .strict();
```

Then update `ModuleManifestSchema.superRefine` with these checks after the existing operation checks:

```ts
    const hasExecutableClient =
      !!value.client &&
      (!!value.client.boot ||
        (value.client.components?.length ?? 0) > 0 ||
        (value.client.operations?.length ?? 0) > 0);
    if (hasExecutableClient && !value.client?.entry) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['client', 'entry'],
        message:
          'MODULE_MANIFEST_CLIENT_ENTRY_REQUIRED: client.entry is required when boot, components, or operations are declared',
      });
    }

    const assetIds = [
      ...(value.client?.assets?.stylesheets ?? []).map((a) => a.id),
      ...(value.client?.assets?.fonts ?? []).map((a) => a.id),
      ...(value.client?.assets?.icons ?? []).map((a) => a.id),
      ...(value.client?.assets?.images ?? []).map((a) => a.id),
      ...(value.client?.assets?.staticFiles ?? []).map((a) => a.id),
    ];
    const dupAssetIds = assetIds.filter((id, i) => assetIds.indexOf(id) !== i);
    if (dupAssetIds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['client', 'assets'],
        message: `MODULE_MANIFEST_DUPLICATE_CLIENT_ASSET: client asset ids must be unique (duplicates: ${[...new Set(dupAssetIds)].join(', ')})`,
      });
    }

    const presetNames = (value.client?.presets ?? []).map((p) => p.name);
    const dupPresetNames = presetNames.filter((name, i) => presetNames.indexOf(name) !== i);
    if (dupPresetNames.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['client', 'presets'],
        message: `MODULE_MANIFEST_DUPLICATE_PRESET_NAME: preset names must be unique (duplicates: ${[...new Set(dupPresetNames)].join(', ')})`,
      });
    }

    const presetPaths = (value.client?.presets ?? []).map((p) => p.path);
    const dupPresetPaths = presetPaths.filter((path, i) => presetPaths.indexOf(path) !== i);
    if (dupPresetPaths.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['client', 'presets'],
        message: `MODULE_MANIFEST_DUPLICATE_PRESET_PATH: preset paths must be unique (duplicates: ${[...new Set(dupPresetPaths)].join(', ')})`,
      });
    }
```

Update the `hasClient` definition near the top of the same `superRefine` to count assets/presets:

```ts
    const hasClient =
      !!value.client &&
      (!!value.client.boot ||
        (value.client.components?.length ?? 0) > 0 ||
        (value.client.operations?.length ?? 0) > 0 ||
        totalClientAssetCount(value.client.assets) > 0 ||
        (value.client.presets?.length ?? 0) > 0);
```

Add this helper before the exported types:

```ts
function totalClientAssetCount(assets: z.infer<typeof ClientAssetsSchema> | undefined): number {
  if (!assets) return 0;
  return (
    (assets.stylesheets?.length ?? 0) +
    (assets.fonts?.length ?? 0) +
    (assets.icons?.length ?? 0) +
    (assets.images?.length ?? 0) +
    (assets.staticFiles?.length ?? 0) +
    (assets.preloads?.length ?? 0)
  );
}
```

Add exported type aliases after `ClientBlock`:

```ts
export type ClientAssets = z.infer<typeof ClientAssetsSchema>;
export type ClientPreset = z.infer<typeof ClientPresetSchema>;
export type ClientStylesheetAsset = z.infer<typeof ClientStylesheetAssetSchema>;
export type ClientFontAsset = z.infer<typeof ClientFontAssetSchema>;
export type ClientImageAsset = z.infer<typeof ClientImageAssetSchema>;
export type ClientStaticFileAsset = z.infer<typeof ClientStaticFileAssetSchema>;
export type ClientPreloadAsset = z.infer<typeof ClientPreloadAssetSchema>;
```

- [ ] **Step 4: Run package tests**

Run:

```bash
bun test --cwd packages/contracts/module/v1 test/unit/manifest-shape.test.ts
```

Expected: all manifest-shape tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/module/v1/src/manifest-shape.ts packages/contracts/module/v1/test/unit/manifest-shape.test.ts
git commit -m "feat: extend module client manifest surface"
```

---

## Task 2: Compose Module Assets And Preset Exports In Blueprint

**Files:**
- Create: `packages/artifacts/blueprint/src/compose/module-client-assets.ts`
- Modify: `packages/artifacts/blueprint/src/types/artifact.ts`
- Modify: `packages/artifacts/blueprint/src/types/result.ts`
- Modify: `packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts`
- Modify: `packages/artifacts/blueprint/src/compose/modules.ts`
- Create: `packages/artifacts/blueprint/test/unit/module-client-assets.test.ts`

- [ ] **Step 1: Write failing blueprint tests**

Create `packages/artifacts/blueprint/test/unit/module-client-assets.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadComposedBlueprint } from '../../src/compose/load-composed-blueprint.js';

function write(root: string, rel: string, value: string): void {
  const full = join(root, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, value, 'utf8');
}

function minimalProject(moduleJson: object, extra: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'rntme-blueprint-client-assets-'));
  write(root, 'project.json', JSON.stringify({
    name: 'client-assets-demo',
    services: ['app'],
    modules: { platformUi: { package: '@rntme/platform-ui' } },
    routes: { ui: { '/': 'app' } },
  }));
  write(root, 'pdm/pdm.json', JSON.stringify({ version: '1.0', entities: {} }));
  write(root, 'services/app/service.json', JSON.stringify({ slug: 'app', kind: 'domain' }));
  write(root, 'services/app/ui/manifest.json', JSON.stringify({
    version: '2.0',
    pdmRef: 'demo.domain.v1',
    qsmRef: 'demo.read.v1',
    graphSpecRef: 'demo.graphs.v1',
    bindingsRef: 'demo.bindings.v1',
    metadata: { title: 'Demo' },
    layouts: { main: 'layouts/main' },
    routes: { '/': { layout: 'main', screen: 'screens/home' } },
  }));
  write(root, 'services/app/ui/layouts/main.spec.json', JSON.stringify({
    root: 'shell',
    elements: { shell: { type: 'Slot', props: {} } },
  }));
  write(root, 'services/app/ui/layouts/main.screen.json', '{}');
  write(root, 'services/app/ui/screens/home.spec.json', JSON.stringify({
    root: 'page',
    elements: { page: { type: 'Text', props: { text: 'Home' } } },
  }));
  write(root, 'services/app/ui/screens/home.screen.json', '{}');
  write(root, 'node_modules/@rntme/platform-ui/package.json', JSON.stringify({
    name: '@rntme/platform-ui',
    exports: { './module.json': './module.json' },
  }));
  write(root, 'node_modules/@rntme/platform-ui/module.json', JSON.stringify(moduleJson));
  for (const [rel, content] of Object.entries(extra)) {
    write(root, `node_modules/@rntme/platform-ui/${rel}`, content);
  }
  return root;
}

describe('module client assets and presets', () => {
  it('builds deterministic uiAssetManifest and uiPresetExports', async () => {
    const root = minimalProject(
      {
        name: '@rntme/platform-ui',
        version: '0.0.0',
        client: {
          assets: {
            stylesheets: [{ id: 'platform-ui', path: 'assets/platform-ui.css', order: 100 }],
            icons: [{ id: 'logo-monogram', path: 'assets/logo-monogram.svg' }],
            preloads: [{ path: 'assets/platform-ui.css', as: 'style' }],
          },
          presets: [
            { name: 'service-card', kind: 'fragment', path: 'fragments/service-card', inputs: { name: { type: 'string', required: true } } },
          ],
        },
      },
      {
        'assets/platform-ui.css': '.platform-ui { color: black; }',
        'assets/logo-monogram.svg': '<svg role="img"></svg>',
        'fragments/service-card.spec.json': JSON.stringify({
          root: 'card',
          elements: { card: { type: 'Text', props: { text: { $param: 'name' } } } },
        }),
      },
    );

    const result = await loadComposedBlueprint(root);

    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;
    expect(result.value.uiAssetManifest?.stylesheets).toEqual([
      {
        id: 'platform-ui',
        moduleKey: 'platformUi',
        moduleName: '@rntme/platform-ui',
        href: '/assets/modules/platformUi/stylesheets/platform-ui.css',
        order: 100,
        media: 'all',
        scope: 'document',
      },
    ]);
    expect(result.value.uiAssetManifest?.preloads).toEqual([
      {
        moduleKey: 'platformUi',
        moduleName: '@rntme/platform-ui',
        href: '/assets/modules/platformUi/stylesheets/platform-ui.css',
        as: 'style',
      },
    ]);
    expect(result.value.uiAssetSources?.[0]).toMatchObject({
      moduleKey: 'platformUi',
      moduleName: '@rntme/platform-ui',
      sourceRelativePath: 'assets/platform-ui.css',
      runtimePath: 'ui-build/modules/platformUi/stylesheets/platform-ui.css',
    });
    expect(result.value.uiPresetExports?.[0]).toMatchObject({
      moduleKey: 'platformUi',
      moduleName: '@rntme/platform-ui',
      name: 'service-card',
      kind: 'fragment',
      path: 'fragments/service-card',
    });
  });

  it('rejects missing asset and preset files with blueprint error codes', async () => {
    const root = minimalProject({
      name: '@rntme/platform-ui',
      version: '0.0.0',
      client: {
        assets: { stylesheets: [{ id: 'missing', path: 'assets/missing.css' }] },
        presets: [{ name: 'missing', kind: 'fragment', path: 'fragments/missing', inputs: {} }],
      },
    });

    const result = await loadComposedBlueprint(root);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'BLUEPRINT_MODULE_CLIENT_ASSET_MISSING')).toBe(true);
      expect(result.errors.some((e) => e.code === 'BLUEPRINT_MODULE_CLIENT_PRESET_MISSING')).toBe(true);
    }
  });

  it('rejects JavaScript static assets before they reach runtime', async () => {
    const root = minimalProject(
      {
        name: '@rntme/platform-ui',
        version: '0.0.0',
        client: {
          assets: { staticFiles: [{ id: 'bad-js', path: 'assets/bad.js' }] },
        },
      },
      { 'assets/bad.js': 'alert("no")' },
    );

    const result = await loadComposedBlueprint(root);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === 'BLUEPRINT_MODULE_CLIENT_ASSET_SCRIPT_REJECTED')).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
bun test --cwd packages/artifacts/blueprint test/unit/module-client-assets.test.ts
```

Expected: TypeScript/runtime failures because `uiAssetManifest`, `uiAssetSources`, and `uiPresetExports` do not exist.

- [ ] **Step 3: Add composed asset/preset types**

In `packages/artifacts/blueprint/src/types/artifact.ts`, add these types near `CatalogManifest`:

```ts
export type UiAssetManifest = {
  readonly stylesheets: readonly UiStylesheetAsset[];
  readonly fonts: readonly UiFontAsset[];
  readonly icons: readonly UiImageAsset[];
  readonly images: readonly UiImageAsset[];
  readonly staticFiles: readonly UiStaticAsset[];
  readonly preloads: readonly UiPreloadAsset[];
};

export type UiAssetBase = {
  readonly id: string;
  readonly moduleKey: string;
  readonly moduleName: string;
  readonly href: string;
};

export type UiStylesheetAsset = UiAssetBase & {
  readonly order: number;
  readonly media: string;
  readonly scope: 'document';
};

export type UiFontAsset = UiAssetBase & {
  readonly family: string;
  readonly weight?: string;
  readonly style?: string;
  readonly preload: boolean;
};

export type UiImageAsset = UiAssetBase & {
  readonly alt?: string;
};

export type UiStaticAsset = UiAssetBase;

export type UiPreloadAsset = {
  readonly moduleKey: string;
  readonly moduleName: string;
  readonly href: string;
  readonly as: 'style' | 'font' | 'image' | 'fetch';
  readonly type?: string;
  readonly crossorigin?: 'anonymous' | 'use-credentials';
};

export type UiAssetSource = {
  readonly moduleKey: string;
  readonly moduleName: string;
  readonly sourcePath: string;
  readonly sourceRelativePath: string;
  readonly runtimePath: string;
  readonly href: string;
};

export type UiPresetExport = {
  readonly moduleKey: string;
  readonly moduleName: string;
  readonly name: string;
  readonly kind: 'fragment';
  readonly path: string;
  readonly description?: string;
  readonly inputs: Readonly<Record<string, PropSchema>>;
  readonly sourcePath: string;
};
```

Then add fields to `ComposedBlueprint`:

```ts
  uiAssetManifest?: UiAssetManifest | null;
  uiAssetSources?: readonly UiAssetSource[] | null;
  uiPresetExports?: readonly UiPresetExport[] | null;
```

- [ ] **Step 4: Append blueprint error codes**

In `packages/artifacts/blueprint/src/types/result.ts`, append these to `ERROR_CODES` before storage codes:

```ts
  BLUEPRINT_MODULE_CLIENT_ASSET_BAD_PATH: 'BLUEPRINT_MODULE_CLIENT_ASSET_BAD_PATH',
  BLUEPRINT_MODULE_CLIENT_ASSET_MISSING: 'BLUEPRINT_MODULE_CLIENT_ASSET_MISSING',
  BLUEPRINT_MODULE_CLIENT_ASSET_SCRIPT_REJECTED: 'BLUEPRINT_MODULE_CLIENT_ASSET_SCRIPT_REJECTED',
  BLUEPRINT_MODULE_CLIENT_PRESET_BAD_PATH: 'BLUEPRINT_MODULE_CLIENT_PRESET_BAD_PATH',
  BLUEPRINT_MODULE_CLIENT_PRESET_MISSING: 'BLUEPRINT_MODULE_CLIENT_PRESET_MISSING',
  BLUEPRINT_MODULE_CLIENT_PRESET_DUPLICATE: 'BLUEPRINT_MODULE_CLIENT_PRESET_DUPLICATE',
```

- [ ] **Step 5: Implement module asset/preset composition**

Create `packages/artifacts/blueprint/src/compose/module-client-assets.ts`:

```ts
import { existsSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';
import type { ClientAssets, ClientPreset } from '@rntme/contracts-module-v1';
import type { UiAssetManifest, UiAssetSource, UiPresetExport } from '../types/artifact.js';
import { ERROR_CODES, err, ok, type BlueprintError, type PropSchema, type Result } from '../types/result.js';
import type { DiscoveredModule } from './modules.js';

const EMPTY_ASSET_MANIFEST: UiAssetManifest = {
  stylesheets: [],
  fonts: [],
  icons: [],
  images: [],
  staticFiles: [],
  preloads: [],
};

type BuildResult = {
  readonly manifest: UiAssetManifest;
  readonly sources: readonly UiAssetSource[];
  readonly presets: readonly UiPresetExport[];
};

export function buildModuleClientSurfaces(discovered: Record<string, DiscoveredModule>): Result<BuildResult> {
  const errors: BlueprintError[] = [];
  const stylesheets: UiAssetManifest['stylesheets'] = [];
  const fonts: UiAssetManifest['fonts'] = [];
  const icons: UiAssetManifest['icons'] = [];
  const images: UiAssetManifest['images'] = [];
  const staticFiles: UiAssetManifest['staticFiles'] = [];
  const preloads: UiAssetManifest['preloads'] = [];
  const sources: UiAssetSource[] = [];
  const presets: UiPresetExport[] = [];

  for (const [moduleName, mod] of Object.entries(discovered).sort(([a], [b]) => a.localeCompare(b))) {
    const moduleKey = mod.projectKey;
    const assets = mod.manifest.client?.assets;
    if (assets) {
      collectAssets({
        moduleName,
        moduleKey,
        packageDir: mod.packageDir,
        assets,
        errors,
        stylesheets,
        fonts,
        icons,
        images,
        staticFiles,
        preloads,
        sources,
      });
    }

    for (const preset of mod.manifest.client?.presets ?? []) {
      const sourcePath = safePackagePath(mod.packageDir, `${preset.path}.spec.json`);
      if (sourcePath === null) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_MODULE_CLIENT_PRESET_BAD_PATH,
          message: `module "${moduleName}" preset "${preset.name}" path "${preset.path}" must stay inside the package`,
          path: `${moduleName}/module.json:client.presets.${preset.name}`,
        });
        continue;
      }
      if (!isRegularFile(sourcePath)) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_MODULE_CLIENT_PRESET_MISSING,
          message: `module "${moduleName}" preset "${preset.name}" expects fragment file "${preset.path}.spec.json"`,
          path: `${moduleName}/module.json:client.presets.${preset.name}`,
        });
        continue;
      }
      presets.push({
        moduleKey,
        moduleName,
        name: preset.name,
        kind: preset.kind,
        path: preset.path,
        ...(preset.description === undefined ? {} : { description: preset.description }),
        inputs: preset.inputs as Record<string, PropSchema>,
        sourcePath,
      });
    }
  }

  const presetKeys = presets.map((preset) => `${preset.moduleKey}:${preset.path}`);
  const duplicatedPresetKeys = presetKeys.filter((key, index) => presetKeys.indexOf(key) !== index);
  if (duplicatedPresetKeys.length > 0) {
    errors.push({
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_MODULE_CLIENT_PRESET_DUPLICATE,
      message: `duplicate module preset exports: ${[...new Set(duplicatedPresetKeys)].join(', ')}`,
      path: 'project.json#modules',
    });
  }

  if (errors.length > 0) return err(errors);

  return ok({
    manifest: {
      stylesheets: [...stylesheets].sort(compareStylesheets),
      fonts: [...fonts].sort(compareByModuleAndId),
      icons: [...icons].sort(compareByModuleAndId),
      images: [...images].sort(compareByModuleAndId),
      staticFiles: [...staticFiles].sort(compareByModuleAndId),
      preloads: [...preloads].sort(comparePreloads),
    },
    sources: [...sources].sort((a, b) => a.runtimePath.localeCompare(b.runtimePath)),
    presets: [...presets].sort((a, b) => `${a.moduleKey}:${a.path}`.localeCompare(`${b.moduleKey}:${b.path}`)),
  });
}

export function emptyUiAssetManifest(): UiAssetManifest {
  return EMPTY_ASSET_MANIFEST;
}

function collectAssets(input: {
  moduleName: string;
  moduleKey: string;
  packageDir: string;
  assets: ClientAssets;
  errors: BlueprintError[];
  stylesheets: UiAssetManifest['stylesheets'];
  fonts: UiAssetManifest['fonts'];
  icons: UiAssetManifest['icons'];
  images: UiAssetManifest['images'];
  staticFiles: UiAssetManifest['staticFiles'];
  preloads: UiAssetManifest['preloads'];
  sources: UiAssetSource[];
}): void {
  for (const asset of input.assets.stylesheets ?? []) {
    const source = assetSource(input, 'stylesheets', asset.id, asset.path);
    if (!source) continue;
    input.sources.push(source);
    input.stylesheets.push({
      id: asset.id,
      moduleKey: input.moduleKey,
      moduleName: input.moduleName,
      href: source.href,
      order: asset.order ?? 0,
      media: asset.media ?? 'all',
      scope: asset.scope ?? 'document',
    });
  }

  for (const asset of input.assets.fonts ?? []) {
    const source = assetSource(input, 'fonts', asset.id, asset.path);
    if (!source) continue;
    input.sources.push(source);
    input.fonts.push({
      id: asset.id,
      moduleKey: input.moduleKey,
      moduleName: input.moduleName,
      href: source.href,
      family: asset.family,
      ...(asset.weight === undefined ? {} : { weight: asset.weight }),
      ...(asset.style === undefined ? {} : { style: asset.style }),
      preload: asset.preload === true,
    });
  }

  for (const asset of input.assets.icons ?? []) {
    const source = assetSource(input, 'icons', asset.id, asset.path);
    if (!source) continue;
    input.sources.push(source);
    input.icons.push({ id: asset.id, moduleKey: input.moduleKey, moduleName: input.moduleName, href: source.href, ...(asset.alt === undefined ? {} : { alt: asset.alt }) });
  }

  for (const asset of input.assets.images ?? []) {
    const source = assetSource(input, 'images', asset.id, asset.path);
    if (!source) continue;
    input.sources.push(source);
    input.images.push({ id: asset.id, moduleKey: input.moduleKey, moduleName: input.moduleName, href: source.href, ...(asset.alt === undefined ? {} : { alt: asset.alt }) });
  }

  for (const asset of input.assets.staticFiles ?? []) {
    const source = assetSource(input, 'staticFiles', asset.id, asset.path);
    if (!source) continue;
    input.sources.push(source);
    input.staticFiles.push({ id: asset.id, moduleKey: input.moduleKey, moduleName: input.moduleName, href: source.href });
  }

  const hrefBySourcePath = new Map(input.sources.map((source) => [source.sourceRelativePath, source.href]));
  for (const preload of input.assets.preloads ?? []) {
    const href = hrefBySourcePath.get(preload.path);
    if (href === undefined) {
      const source = assetSource(input, 'staticFiles', safeAssetIdFromPath(preload.path), preload.path);
      if (!source) continue;
      input.sources.push(source);
      input.preloads.push({ moduleKey: input.moduleKey, moduleName: input.moduleName, href: source.href, as: preload.as, ...(preload.type === undefined ? {} : { type: preload.type }), ...(preload.crossorigin === undefined ? {} : { crossorigin: preload.crossorigin }) });
      continue;
    }
    input.preloads.push({ moduleKey: input.moduleKey, moduleName: input.moduleName, href, as: preload.as, ...(preload.type === undefined ? {} : { type: preload.type }), ...(preload.crossorigin === undefined ? {} : { crossorigin: preload.crossorigin }) });
  }
}

function assetSource(
  input: Pick<Parameters<typeof collectAssets>[0], 'moduleName' | 'moduleKey' | 'packageDir' | 'errors'>,
  kind: 'stylesheets' | 'fonts' | 'icons' | 'images' | 'staticFiles',
  id: string,
  relPath: string,
): UiAssetSource | null {
  if (isJavaScriptAsset(relPath)) {
    input.errors.push({
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_MODULE_CLIENT_ASSET_SCRIPT_REJECTED,
      message: `module "${input.moduleName}" client asset "${relPath}" is executable JavaScript; use client.entry instead`,
      path: `${input.moduleName}/module.json:client.assets.${id}`,
    });
    return null;
  }
  const sourcePath = safePackagePath(input.packageDir, relPath);
  if (sourcePath === null) {
    input.errors.push({
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_MODULE_CLIENT_ASSET_BAD_PATH,
      message: `module "${input.moduleName}" client asset "${relPath}" must stay inside the package`,
      path: `${input.moduleName}/module.json:client.assets.${id}`,
    });
    return null;
  }
  if (!isRegularFile(sourcePath)) {
    input.errors.push({
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_MODULE_CLIENT_ASSET_MISSING,
      message: `module "${input.moduleName}" client asset "${relPath}" is missing on disk`,
      path: `${input.moduleName}/module.json:client.assets.${id}`,
    });
    return null;
  }
  const runtimePath = `ui-build/modules/${input.moduleKey}/${kind}/${safeAssetId(id)}${extname(relPath) || extname(basename(relPath))}`;
  return {
    moduleKey: input.moduleKey,
    moduleName: input.moduleName,
    sourcePath,
    sourceRelativePath: relPath,
    runtimePath,
    href: `/${runtimePath.replace(/^ui-build\//, 'assets/')}`,
  };
}

function safePackagePath(packageDir: string, relPath: string): string | null {
  const root = resolve(packageDir);
  const full = resolve(root, relPath);
  const back = relative(root, full);
  if (back === '' || back === '..' || back.startsWith(`..${sep}`)) return null;
  return full;
}

function isRegularFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

function isJavaScriptAsset(path: string): boolean {
  return /\.(?:mjs|cjs|js|jsx|ts|tsx)$/i.test(path);
}

function safeAssetId(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-');
}

function safeAssetIdFromPath(path: string): string {
  return safeAssetId(path.replace(/\.[^.]+$/, '').split('/').join('-'));
}

function compareStylesheets(a: UiAssetManifest['stylesheets'][number], b: UiAssetManifest['stylesheets'][number]): number {
  return a.order - b.order || compareByModuleAndId(a, b);
}

function compareByModuleAndId(a: { moduleKey: string; id: string }, b: { moduleKey: string; id: string }): number {
  return `${a.moduleKey}:${a.id}`.localeCompare(`${b.moduleKey}:${b.id}`);
}

function comparePreloads(a: UiAssetManifest['preloads'][number], b: UiAssetManifest['preloads'][number]): number {
  return `${a.moduleKey}:${a.href}:${a.as}`.localeCompare(`${b.moduleKey}:${b.href}:${b.as}`);
}
```

- [ ] **Step 6: Wire composition into `loadComposedBlueprint`**

In `packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts`, import:

```ts
import { buildModuleClientSurfaces, emptyUiAssetManifest } from './module-client-assets.js';
```

Add locals next to `catalogManifest`:

```ts
  let uiAssetManifest = emptyUiAssetManifest();
  let uiAssetSources: readonly UiAssetSource[] = [];
  let uiPresetExports: readonly UiPresetExport[] = [];
```

Add `UiAssetSource` and `UiPresetExport` to the type import from `../types/artifact.js`.

After `discoveredModulesValue = discovered.value;`, add:

```ts
    const clientSurfaces = buildModuleClientSurfaces(discovered.value);
    if (!clientSurfaces.ok) return clientSurfaces;
    uiAssetManifest = clientSurfaces.value.manifest;
    uiAssetSources = clientSurfaces.value.sources;
    uiPresetExports = clientSurfaces.value.presets;
```

In the final `ok({ ... })` payload, add:

```ts
    uiAssetManifest,
    uiAssetSources,
    uiPresetExports,
```

- [ ] **Step 7: Teach module discovery about `@rntme/platform-ui`**

In `packages/artifacts/blueprint/src/compose/modules.ts`, add this branch before the fallback return in `workspacePackagePathSegments`:

```ts
  if (packageName === '@rntme/platform-ui') {
    return ['apps', 'platform', 'ui-module'];
  }
```

- [ ] **Step 8: Run blueprint tests**

Run:

```bash
bun test --cwd packages/artifacts/blueprint test/unit/module-client-assets.test.ts
```

Expected: tests pass.

- [ ] **Step 9: Commit**

```bash
git add packages/artifacts/blueprint/src/types/artifact.ts \
  packages/artifacts/blueprint/src/types/result.ts \
  packages/artifacts/blueprint/src/compose/module-client-assets.ts \
  packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts \
  packages/artifacts/blueprint/src/compose/modules.ts \
  packages/artifacts/blueprint/test/unit/module-client-assets.test.ts
git commit -m "feat: compose module client assets"
```

---

## Task 3: Resolve Module-Qualified UI Fragments

**Files:**
- Modify: `packages/artifacts/ui/src/types/source.ts`
- Modify: `packages/artifacts/ui/src/types/result.ts`
- Modify: `packages/artifacts/ui/src/resolve/resolve.ts`
- Modify: `packages/artifacts/ui/src/compile.ts`
- Create: `packages/artifacts/ui/test/unit/external-fragments.test.ts`
- Create: `packages/artifacts/blueprint/src/compose/module-preset-resolver.ts`
- Modify: `packages/artifacts/blueprint/src/compose/compile-service-ui.ts`
- Modify: `packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts`
- Modify: `packages/artifacts/blueprint/test/unit/load-composed-blueprint.test.ts`

- [ ] **Step 1: Write failing `@rntme/ui` external-fragment tests**

Create `packages/artifacts/ui/test/unit/external-fragments.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile, type SpecJson } from '../../src/index.js';

function write(root: string, rel: string, value: unknown): void {
  const full = join(root, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
}

function appRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'rntme-ui-external-fragments-'));
  write(root, 'manifest.json', {
    version: '2.0',
    pdmRef: 'demo.domain.v1',
    qsmRef: 'demo.read.v1',
    graphSpecRef: 'demo.graphs.v1',
    bindingsRef: 'demo.bindings.v1',
    metadata: { title: 'External refs' },
    layouts: { main: 'layouts/main' },
    routes: { '/': { layout: 'main', screen: 'screens/home' } },
  });
  write(root, 'layouts/main.spec.json', {
    root: 'shell',
    elements: { shell: { type: 'Slot', props: {} } },
  });
  write(root, 'layouts/main.screen.json', {});
  write(root, 'screens/home.screen.json', {});
  return root;
}

describe('external fragment resolution', () => {
  it('inlines external refs and erases $ref/$param from compiled output', () => {
    const root = appRoot();
    write(root, 'screens/home.spec.json', {
      root: 'page',
      elements: {
        page: { type: 'Stack', props: {}, children: ['card'] },
        card: { $ref: 'module:platformUi/fragments/service-card', bind: { name: 'deployments' } },
      },
    });
    const external: Record<string, SpecJson> = {
      'module:platformUi/fragments/service-card': {
        root: 'card',
        elements: {
          card: { type: 'Text', props: { text: { $param: 'name' } } },
        },
      },
    };

    const result = compile({
      sourceDir: root,
      httpMap: {},
      externalFragmentResolver: (ref) => {
        const spec = external[ref];
        return spec === undefined ? { ok: true, value: null } : { ok: true, value: { ref, spec, source: 'external' } };
      },
      resolvers: {
        resolveBinding: () => undefined,
        resolveComponent: (type) => ({ childrenModel: type === 'Text' ? 'none' : 'list', props: {} }),
        resolveRoute: () => true,
        resolveOperation: () => undefined,
        resolveCategoryToModule: () => undefined,
      },
    });

    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;
    const compiled = JSON.stringify(result.value.screens.home.spec);
    expect(compiled).not.toContain('$ref');
    expect(compiled).not.toContain('$param');
    expect(result.value.screens.home.spec.elements.card__card?.props).toEqual({ text: 'deployments' });
  });

  it('detects cycles that cross local and external fragments', () => {
    const root = appRoot();
    write(root, 'screens/home.spec.json', {
      root: 'page',
      elements: {
        page: { type: 'Stack', props: {}, children: ['local'] },
        local: { $ref: 'fragments/local', bind: {} },
      },
    });
    write(root, 'fragments/local.spec.json', {
      root: 'local',
      elements: {
        local: { $ref: 'module:platformUi/fragments/external', bind: {} },
      },
    });

    const result = compile({
      sourceDir: root,
      httpMap: {},
      externalFragmentResolver: (ref) => {
        if (ref !== 'module:platformUi/fragments/external') return { ok: true, value: null };
        return {
          ok: true,
          value: {
            ref,
            source: 'external',
            spec: {
              root: 'external',
              elements: {
                external: { $ref: 'fragments/local', bind: {} },
              },
            },
          },
        };
      },
      resolvers: {
        resolveBinding: () => undefined,
        resolveComponent: () => ({ childrenModel: 'list', props: {} }),
        resolveRoute: () => true,
        resolveOperation: () => undefined,
        resolveCategoryToModule: () => undefined,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.code === 'CIRCULAR_REF')).toBe(true);
    }
  });

  it('fails when an external fragment resolver returns no spec', () => {
    const root = appRoot();
    write(root, 'screens/home.spec.json', {
      root: 'page',
      elements: {
        page: { type: 'Stack', props: {}, children: ['missing'] },
        missing: { $ref: 'module:platformUi/fragments/missing', bind: {} },
      },
    });

    const result = compile({
      sourceDir: root,
      httpMap: {},
      externalFragmentResolver: () => ({ ok: true, value: null }),
      resolvers: {
        resolveBinding: () => undefined,
        resolveComponent: () => ({ childrenModel: 'list', props: {} }),
        resolveRoute: () => true,
        resolveOperation: () => undefined,
        resolveCategoryToModule: () => undefined,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.code === 'EXTERNAL_REF_UNRESOLVED')).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run the UI tests to verify they fail**

Run:

```bash
bun test --cwd packages/artifacts/ui test/unit/external-fragments.test.ts
```

Expected: compile option/type failures for `externalFragmentResolver`.

- [ ] **Step 3: Add external fragment resolver types**

In `packages/artifacts/ui/src/types/source.ts`, add:

```ts
export type FragmentSourceKind = 'local' | 'external';

export type ExternalFragment = {
  readonly ref: string;
  readonly source: 'external';
  readonly spec: SpecJson;
};

export type ExternalFragmentResolverContext = {
  readonly referrer: string | null;
  readonly referrerSource: FragmentSourceKind;
};

export type ExternalFragmentResolver = (
  ref: string,
  context: ExternalFragmentResolverContext,
) => import('./result.js').Result<ExternalFragment | null>;
```

Add this field to `ResolvedSource`:

```ts
  fragmentSources: Map<string, FragmentSourceKind>;
```

- [ ] **Step 4: Append UI error codes**

In `packages/artifacts/ui/src/types/result.ts`, append these resolve-phase codes after `DUPLICATE_SCREEN_KEY`:

```ts
  | 'EXTERNAL_REF_UNRESOLVED'
  | 'EXTERNAL_REF_LOCAL_FORBIDDEN'
```

- [ ] **Step 5: Update `resolve` to use the resolver**

In `packages/artifacts/ui/src/resolve/resolve.ts`, change the signature:

```ts
export type ResolveOptions = {
  readonly externalFragmentResolver?: ExternalFragmentResolver;
};

export function resolve(baseDir: string, options: ResolveOptions = {}): Result<ResolvedSource> {
```

Import `ExternalFragmentResolver`, `ExternalFragmentResolverContext`, and `FragmentSourceKind` from `../types/source.js`.

Replace `collectFragments(...)` with a version that carries source context:

```ts
function collectFragments(
  baseDir: string,
  specs: SpecJson[],
  fragments: Map<string, SpecJson>,
  fragmentSources: Map<string, FragmentSourceKind>,
  visiting: Set<string>,
  errors: UiError[],
  options: ResolveOptions,
  context: ExternalFragmentResolverContext,
): void {
  for (const spec of specs) {
    for (const el of Object.values(spec.elements)) {
      if (!isRefElement(el)) continue;
      const requestedRef = el.$ref;
      const resolved = resolveFragmentRef(baseDir, requestedRef, fragments, fragmentSources, errors, options, context);
      if (resolved === null) continue;
      const { refPath, spec: fragmentSpec, source } = resolved;

      if (visiting.has(refPath)) {
        errors.push({
          code: 'CIRCULAR_REF',
          message: `Circular fragment reference: ${[...visiting, refPath].join(' -> ')}`,
          path: refPath,
        });
        return;
      }

      if (!fragments.has(refPath)) {
        fragments.set(refPath, fragmentSpec);
        fragmentSources.set(refPath, source);
      }

      visiting.add(refPath);
      collectFragments(
        baseDir,
        [fragmentSpec],
        fragments,
        fragmentSources,
        visiting,
        errors,
        options,
        { referrer: refPath, referrerSource: source },
      );
      visiting.delete(refPath);
    }
  }
}
```

Add this helper below it:

```ts
function resolveFragmentRef(
  baseDir: string,
  refPath: string,
  fragments: Map<string, SpecJson>,
  fragmentSources: Map<string, FragmentSourceKind>,
  errors: UiError[],
  options: ResolveOptions,
  context: ExternalFragmentResolverContext,
): { refPath: string; spec: SpecJson; source: FragmentSourceKind } | null {
  if (context.referrerSource === 'external' || refPath.startsWith('module:')) {
    if (!options.externalFragmentResolver) {
      errors.push({
        code: refPath.startsWith('module:') ? 'EXTERNAL_REF_UNRESOLVED' : 'EXTERNAL_REF_LOCAL_FORBIDDEN',
        message: `External fragment reference cannot be resolved: ${refPath}`,
        path: refPath,
      });
      return null;
    }
    const resolved = options.externalFragmentResolver(refPath, context);
    if (!resolved.ok) {
      errors.push(...resolved.errors);
      return null;
    }
    if (resolved.value === null) {
      errors.push({
        code: refPath.startsWith('module:') ? 'EXTERNAL_REF_UNRESOLVED' : 'EXTERNAL_REF_LOCAL_FORBIDDEN',
        message: `External fragment reference cannot be resolved: ${refPath}`,
        path: refPath,
      });
      return null;
    }
    return { refPath: resolved.value.ref, spec: resolved.value.spec, source: 'external' };
  }

  if (fragments.has(refPath)) {
    return { refPath, spec: fragments.get(refPath)!, source: fragmentSources.get(refPath) ?? 'local' };
  }

  const filePath = join(baseDir, `${refPath}.spec.json`);
  const fragResult = readJson<SpecJson>(filePath, SpecJsonSchema, 'SPEC_INVALID', 'spec file');
  if (!fragResult.ok) {
    errors.push(...fragResult.errors);
    return null;
  }
  return { refPath, spec: fragResult.value, source: 'local' };
}
```

Update the call site near the end of `resolve`:

```ts
  const fragments = new Map<string, SpecJson>();
  const fragmentSources = new Map<string, FragmentSourceKind>();
  const allSpecs = [
    ...Object.values(layouts).map((l) => l.spec),
    ...Object.values(screens).map((s) => s.spec),
  ];
  const errors: UiError[] = [];
  collectFragments(
    baseDir,
    allSpecs,
    fragments,
    fragmentSources,
    new Set(),
    errors,
    options,
    { referrer: null, referrerSource: 'local' },
  );
  if (errors.length > 0) return err(errors);

  return ok({ manifest, baseDir, layouts, screens, fragments, fragmentSources });
```

- [ ] **Step 6: Pass resolver through compile**

In `packages/artifacts/ui/src/compile.ts`, update imports and options:

```ts
import type { ExternalFragmentResolver } from './types/source.js';

export type CompileOptions = {
  sourceDir: string;
  httpMap: Record<string, HttpEntry>;
  resolvers: ValidateResolvers;
  externalFragmentResolver?: ExternalFragmentResolver;
};
```

Update the resolve call:

```ts
  const resolved = resolve(opts.sourceDir, {
    ...(opts.externalFragmentResolver === undefined ? {} : { externalFragmentResolver: opts.externalFragmentResolver }),
  });
```

- [ ] **Step 7: Run the UI tests**

Run:

```bash
bun test --cwd packages/artifacts/ui test/unit/external-fragments.test.ts test/integration/compile.test.ts
```

Expected: all selected UI tests pass.

- [ ] **Step 8: Implement blueprint's module preset resolver**

Create `packages/artifacts/blueprint/src/compose/module-preset-resolver.ts`:

```ts
import { readFileSync } from 'node:fs';
import type { ExternalFragmentResolver, ExternalFragmentResolverContext, SpecJson } from '@rntme/ui';
import { SpecJsonSchema } from '@rntme/ui/parse/schema';
import type { UiPresetExport } from '../types/artifact.js';
import { ERROR_CODES, err, ok, type BlueprintError, type Result } from '../types/result.js';

type ResolverBuildInput = {
  readonly presets: readonly UiPresetExport[];
};

export function createModulePresetExternalResolver(input: ResolverBuildInput): ExternalFragmentResolver {
  const byModuleAndPath = new Map<string, UiPresetExport>();
  for (const preset of input.presets) {
    byModuleAndPath.set(`${preset.moduleKey}/${preset.path}`, preset);
  }

  return (requestedRef: string, context: ExternalFragmentResolverContext) => {
    const normalized = normalizeModuleRef(requestedRef, context);
    if (normalized === null) return ok(null);
    const preset = byModuleAndPath.get(normalized.lookupKey);
    if (preset === undefined) return ok(null);
    const parsed = readPresetSpec(preset);
    if (!parsed.ok) {
      return err(parsed.errors.map((error) => ({
        code: 'EXTERNAL_REF_UNRESOLVED',
        message: error.message,
        path: normalized.canonicalRef,
      })));
    }
    return ok({ ref: normalized.canonicalRef, source: 'external', spec: parsed.value });
  };
}

function normalizeModuleRef(
  requestedRef: string,
  context: ExternalFragmentResolverContext,
): { lookupKey: string; canonicalRef: string } | null {
  if (requestedRef.startsWith('module:')) {
    const body = requestedRef.slice('module:'.length);
    return { lookupKey: body, canonicalRef: `module:${body}` };
  }
  if (context.referrerSource === 'external' && context.referrer?.startsWith('module:')) {
    const referrerBody = context.referrer.slice('module:'.length);
    const moduleKey = referrerBody.split('/')[0];
    if (!moduleKey) return null;
    const body = `${moduleKey}/${requestedRef}`;
    return { lookupKey: body, canonicalRef: `module:${body}` };
  }
  return null;
}

function readPresetSpec(preset: UiPresetExport): Result<SpecJson> {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(preset.sourcePath, 'utf8'));
  } catch (cause) {
    return err([{
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_MODULE_CLIENT_PRESET_MISSING,
      message: `cannot read module preset "${preset.moduleKey}/${preset.path}": ${cause instanceof Error ? cause.message : String(cause)}`,
      path: preset.sourcePath,
    } satisfies BlueprintError]);
  }
  const parsed = SpecJsonSchema.safeParse(raw);
  if (!parsed.success) {
    return err([{
      layer: 'composition',
      code: ERROR_CODES.BLUEPRINT_MODULE_CLIENT_PRESET_MISSING,
      message: `module preset "${preset.moduleKey}/${preset.path}" is not a valid SpecJson`,
      path: preset.sourcePath,
      cause: parsed.error.issues,
    } satisfies BlueprintError]);
  }
  return ok(parsed.data as SpecJson);
}
```

If `SpecJsonSchema` is not exported from `@rntme/ui`, add this export to `packages/artifacts/ui/src/index.ts`:

```ts
export { SpecJsonSchema } from './parse/schema.js';
```

Then use `import { SpecJsonSchema } from '@rntme/ui';` in the resolver instead of the subpath import.

- [ ] **Step 9: Pass the resolver from blueprint to UI compile**

In `packages/artifacts/blueprint/src/compose/compile-service-ui.ts`, import `ExternalFragmentResolver` from `@rntme/ui` and extend input:

```ts
  externalFragmentResolver?: ExternalFragmentResolver;
```

Pass it into `compile`:

```ts
      ...(input.externalFragmentResolver === undefined ? {} : { externalFragmentResolver: input.externalFragmentResolver }),
```

In `packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts`, import:

```ts
import { createModulePresetExternalResolver } from './module-preset-resolver.js';
```

Create the resolver after module surfaces are built:

```ts
  const externalFragmentResolver =
    uiPresetExports.length === 0 ? undefined : createModulePresetExternalResolver({ presets: uiPresetExports });
```

Pass it to `compileServiceUi`:

```ts
      ...(externalFragmentResolver === undefined ? {} : { externalFragmentResolver }),
```

- [ ] **Step 10: Add blueprint module ref validation tests**

Append to `packages/artifacts/blueprint/test/unit/load-composed-blueprint.test.ts`:

```ts
  it('compiles module-qualified UI preset refs through project module keys', async () => {
    const copied = copyFixture();
    const projectPath = join(copied, 'project.json');
    const project = JSON.parse(readFileSync(projectPath, 'utf8'));
    project.modules = {
      ...(project.modules ?? {}),
      platformUi: { package: '@rntme/platform-ui' },
    };
    writeFileSync(projectPath, JSON.stringify(project, null, 2));

    mkdirSync(join(copied, 'node_modules', '@rntme', 'platform-ui', 'fragments'), { recursive: true });
    writeFileSync(join(copied, 'node_modules', '@rntme', 'platform-ui', 'package.json'), JSON.stringify({
      name: '@rntme/platform-ui',
      exports: { './module.json': './module.json' },
    }));
    writeFileSync(join(copied, 'node_modules', '@rntme', 'platform-ui', 'module.json'), JSON.stringify({
      name: '@rntme/platform-ui',
      version: '0.0.0',
      client: {
        presets: [
          { name: 'service-card', kind: 'fragment', path: 'fragments/service-card', inputs: { name: { type: 'string', required: true } } },
        ],
      },
    }));
    writeFileSync(join(copied, 'node_modules', '@rntme', 'platform-ui', 'fragments', 'service-card.spec.json'), JSON.stringify({
      root: 'card',
      elements: {
        card: { type: 'Text', props: { text: { $param: 'name' } } },
      },
    }));

    const specPath = join(copied, 'services', 'app', 'ui', 'screens', 'home.spec.json');
    const spec = JSON.parse(readFileSync(specPath, 'utf8'));
    spec.elements.moduleCard = { $ref: 'module:platformUi/fragments/service-card', bind: { name: 'pricing' } };
    spec.elements.page.children = [...spec.elements.page.children, 'moduleCard'];
    writeFileSync(specPath, JSON.stringify(spec, null, 2));

    const result = await loadComposedBlueprint(copied);

    expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
    if (!result.ok) return;
    const compiled = JSON.stringify(result.value.services.app?.compiledUi?.screens.home.spec);
    expect(compiled).not.toContain('$ref');
    expect(compiled).not.toContain('$param');
    expect(compiled).toContain('pricing');
  });

  it('fails when UI references an unexported module preset path', async () => {
    const copied = copyFixture();
    const projectPath = join(copied, 'project.json');
    const project = JSON.parse(readFileSync(projectPath, 'utf8'));
    project.modules = {
      ...(project.modules ?? {}),
      platformUi: { package: '@rntme/platform-ui' },
    };
    writeFileSync(projectPath, JSON.stringify(project, null, 2));
    mkdirSync(join(copied, 'node_modules', '@rntme', 'platform-ui'), { recursive: true });
    writeFileSync(join(copied, 'node_modules', '@rntme', 'platform-ui', 'package.json'), JSON.stringify({ name: '@rntme/platform-ui' }));
    writeFileSync(join(copied, 'node_modules', '@rntme', 'platform-ui', 'module.json'), JSON.stringify({
      name: '@rntme/platform-ui',
      version: '0.0.0',
      client: { presets: [] },
    }));

    const specPath = join(copied, 'services', 'app', 'ui', 'screens', 'home.spec.json');
    const spec = JSON.parse(readFileSync(specPath, 'utf8'));
    spec.elements.missing = { $ref: 'module:platformUi/fragments/missing', bind: {} };
    spec.elements.page.children = [...spec.elements.page.children, 'missing'];
    writeFileSync(specPath, JSON.stringify(spec, null, 2));

    const result = await loadComposedBlueprint(copied);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const uiError = result.errors.find((error) => error.code === 'BLUEPRINT_SERVICE_UI_INVALID');
      expect(uiError?.cause).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'EXTERNAL_REF_UNRESOLVED' })]));
    }
  });
```

- [ ] **Step 11: Run selected UI and blueprint tests**

Run:

```bash
bun test --cwd packages/artifacts/ui test/unit/external-fragments.test.ts test/integration/compile.test.ts
bun test --cwd packages/artifacts/blueprint test/unit/load-composed-blueprint.test.ts test/unit/module-client-assets.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 12: Commit**

```bash
git add packages/artifacts/ui/src/types/source.ts \
  packages/artifacts/ui/src/types/result.ts \
  packages/artifacts/ui/src/resolve/resolve.ts \
  packages/artifacts/ui/src/compile.ts \
  packages/artifacts/ui/src/index.ts \
  packages/artifacts/ui/test/unit/external-fragments.test.ts \
  packages/artifacts/ui/test/integration/compile.test.ts \
  packages/artifacts/blueprint/src/compose/module-preset-resolver.ts \
  packages/artifacts/blueprint/src/compose/compile-service-ui.ts \
  packages/artifacts/blueprint/src/compose/load-composed-blueprint.ts \
  packages/artifacts/blueprint/test/unit/load-composed-blueprint.test.ts
git commit -m "feat: resolve module ui presets"
```

---

## Task 4: Add Explicit Asset Manifest Support To UI Runtime

**Files:**
- Modify: `packages/runtime/ui-runtime/src/server/index.ts`
- Modify: `packages/runtime/ui-runtime/src/server/static-shell.ts`
- Modify: `packages/runtime/ui-runtime/src/index.ts`
- Modify: `packages/runtime/ui-runtime/test/unit/server.test.ts`

- [ ] **Step 1: Write failing runtime server tests**

Append to `packages/runtime/ui-runtime/test/unit/server.test.ts`:

```ts
  it('serves the explicit UI asset manifest for inspection', async () => {
    const app = createApp({
      artifact: {
        manifest: testManifest,
        layouts: { main: testLayout },
        screens: { home: testScreen },
      },
      assetsDir: '/tmp/nonexistent-assets',
      assetManifest: {
        stylesheets: [
          {
            id: 'platform-ui',
            moduleKey: 'platformUi',
            moduleName: '@rntme/platform-ui',
            href: '/assets/modules/platformUi/stylesheets/platform-ui.css',
            order: 100,
            media: 'all',
            scope: 'document',
          },
        ],
        fonts: [],
        icons: [],
        images: [],
        staticFiles: [],
        preloads: [
          {
            moduleKey: 'platformUi',
            moduleName: '@rntme/platform-ui',
            href: '/assets/modules/platformUi/stylesheets/platform-ui.css',
            as: 'style',
          },
        ],
      },
    });

    const res = await app.request('/_ui-assets.json');

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      stylesheets: [expect.objectContaining({ id: 'platform-ui' })],
      preloads: [expect.objectContaining({ as: 'style' })],
    });
  });

  it('emits deterministic preloads and stylesheets in the shell', async () => {
    const app = createApp({
      artifact: {
        manifest: testManifest,
        layouts: { main: testLayout },
        screens: { home: testScreen },
      },
      assetsDir: '/tmp/nonexistent-assets',
      assetManifest: {
        stylesheets: [
          {
            id: 'late',
            moduleKey: 'platformUi',
            moduleName: '@rntme/platform-ui',
            href: '/assets/modules/platformUi/stylesheets/late.css',
            order: 200,
            media: 'print',
            scope: 'document',
          },
          {
            id: 'early',
            moduleKey: 'platformUi',
            moduleName: '@rntme/platform-ui',
            href: '/assets/modules/platformUi/stylesheets/early.css',
            order: 10,
            media: 'all',
            scope: 'document',
          },
        ],
        fonts: [
          {
            id: 'display',
            moduleKey: 'platformUi',
            moduleName: '@rntme/platform-ui',
            href: '/assets/modules/platformUi/fonts/display.woff2',
            family: 'Display',
            preload: true,
          },
        ],
        icons: [],
        images: [],
        staticFiles: [],
        preloads: [
          { moduleKey: 'platformUi', moduleName: '@rntme/platform-ui', href: '/assets/modules/platformUi/stylesheets/late.css', as: 'style' },
        ],
      },
    });

    const html = await (await app.request('/')).text();

    expect(html.indexOf('href="/assets/modules/platformUi/stylesheets/late.css" rel="preload"')).toBeLessThan(
      html.indexOf('href="/assets/modules/platformUi/stylesheets/early.css" rel="stylesheet"'),
    );
    expect(html.indexOf('href="/assets/modules/platformUi/stylesheets/early.css" rel="stylesheet"')).toBeLessThan(
      html.indexOf('href="/assets/modules/platformUi/stylesheets/late.css" rel="stylesheet"'),
    );
    expect(html).toContain('href="/assets/modules/platformUi/fonts/display.woff2" rel="preload" as="font"');
    expect(html).toContain('<link rel="stylesheet" href="/assets/main.css">');
  });

  it('keeps asset serving sandboxed when module asset paths contain traversal attempts', async () => {
    const assetsDir = mkdtempSync(join(tmpdir(), 'rntme-ui-assets-'));
    try {
      writeFileSync(join(assetsDir, 'main.css'), 'body{}');
      const app = createApp({
        artifact: {
          manifest: testManifest,
          layouts: { main: testLayout },
          screens: { home: testScreen },
        },
        assetsDir,
        assetManifest: {
          stylesheets: [],
          fonts: [],
          icons: [],
          images: [],
          staticFiles: [],
          preloads: [],
        },
      });

      const res = await app.request('/assets/../server/index.ts');

      expect(res.status).toBe(404);
    } finally {
      rmSync(assetsDir, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 2: Run runtime tests to verify they fail**

Run:

```bash
bun test --cwd packages/runtime/ui-runtime test/unit/server.test.ts
```

Expected: TypeScript failures because `assetManifest` is not a `CreateAppOptions` field.

- [ ] **Step 3: Add runtime asset manifest types and route**

In `packages/runtime/ui-runtime/src/server/index.ts`, add:

```ts
export type UiRuntimeAssetManifest = {
  readonly stylesheets: readonly UiRuntimeStylesheetAsset[];
  readonly fonts: readonly UiRuntimeFontAsset[];
  readonly icons: readonly UiRuntimeImageAsset[];
  readonly images: readonly UiRuntimeImageAsset[];
  readonly staticFiles: readonly UiRuntimeStaticAsset[];
  readonly preloads: readonly UiRuntimePreloadAsset[];
};

export type UiRuntimeAssetBase = {
  readonly id: string;
  readonly moduleKey: string;
  readonly moduleName: string;
  readonly href: string;
};

export type UiRuntimeStylesheetAsset = UiRuntimeAssetBase & {
  readonly order: number;
  readonly media: string;
  readonly scope: 'document';
};

export type UiRuntimeFontAsset = UiRuntimeAssetBase & {
  readonly family: string;
  readonly weight?: string;
  readonly style?: string;
  readonly preload: boolean;
};

export type UiRuntimeImageAsset = UiRuntimeAssetBase & {
  readonly alt?: string;
};

export type UiRuntimeStaticAsset = UiRuntimeAssetBase;

export type UiRuntimePreloadAsset = {
  readonly moduleKey: string;
  readonly moduleName: string;
  readonly href: string;
  readonly as: 'style' | 'font' | 'image' | 'fetch';
  readonly type?: string;
  readonly crossorigin?: 'anonymous' | 'use-credentials';
};

const EMPTY_ASSET_MANIFEST: UiRuntimeAssetManifest = {
  stylesheets: [],
  fonts: [],
  icons: [],
  images: [],
  staticFiles: [],
  preloads: [],
};
```

Extend `CreateAppOptions`:

```ts
  assetManifest?: UiRuntimeAssetManifest;
```

Set the local manifest:

```ts
  const assetManifest = opts.assetManifest ?? EMPTY_ASSET_MANIFEST;
  const shell = buildHtmlShell(assetManifest);
```

Add route after manifest JSON:

```ts
  app.get('/_ui-assets.json', (c) => c.json(assetManifest));
```

- [ ] **Step 4: Emit deterministic tags in the shell**

Replace `packages/runtime/ui-runtime/src/server/static-shell.ts` with:

```ts
import type { UiRuntimeAssetManifest } from './index.js';

const EMPTY_ASSET_MANIFEST: UiRuntimeAssetManifest = {
  stylesheets: [],
  fonts: [],
  icons: [],
  images: [],
  staticFiles: [],
  preloads: [],
};

export function buildHtmlShell(assetManifest: UiRuntimeAssetManifest = EMPTY_ASSET_MANIFEST): string {
  const assetTags = renderAssetTags(assetManifest);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>rntme</title>
${assetTags}  <link rel="stylesheet" href="/assets/main.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/main.js"></script>
</body>
</html>`;
}

function renderAssetTags(assetManifest: UiRuntimeAssetManifest): string {
  const preloadTags = [
    ...assetManifest.preloads.map((preload) => renderPreload(preload.href, preload.as, preload.type, preload.crossorigin)),
    ...assetManifest.fonts
      .filter((font) => font.preload)
      .map((font) => renderPreload(font.href, 'font', font.href.endsWith('.woff2') ? 'font/woff2' : undefined, 'anonymous')),
  ].sort();

  const stylesheetTags = [...assetManifest.stylesheets]
    .sort((a, b) => a.order - b.order || `${a.moduleKey}:${a.id}`.localeCompare(`${b.moduleKey}:${b.id}`))
    .map((sheet) => `  <link href="${escapeAttr(sheet.href)}" rel="stylesheet" media="${escapeAttr(sheet.media)}">`);

  const tags = [...preloadTags, ...stylesheetTags];
  return tags.length === 0 ? '' : `${tags.join('\n')}\n`;
}

function renderPreload(
  href: string,
  as: string,
  type: string | undefined,
  crossorigin: 'anonymous' | 'use-credentials' | undefined,
): string {
  const attrs = [
    `href="${escapeAttr(href)}"`,
    'rel="preload"',
    `as="${escapeAttr(as)}"`,
    ...(type === undefined ? [] : [`type="${escapeAttr(type)}"`]),
    ...(crossorigin === undefined ? [] : [`crossorigin="${escapeAttr(crossorigin)}"`]),
  ];
  return `  <link ${attrs.join(' ')}>`;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
```

- [ ] **Step 5: Export the option types**

In `packages/runtime/ui-runtime/src/index.ts`, ensure it re-exports the server types:

```ts
export {
  createApp,
  type CreateAppOptions,
  type UiRuntimeAssetManifest,
  type UiRuntimeStylesheetAsset,
  type UiRuntimeFontAsset,
  type UiRuntimeImageAsset,
  type UiRuntimeStaticAsset,
  type UiRuntimePreloadAsset,
} from './server/index.js';
```

- [ ] **Step 6: Run runtime tests**

Run:

```bash
bun test --cwd packages/runtime/ui-runtime test/unit/server.test.ts
```

Expected: selected runtime tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/ui-runtime/src/server/index.ts \
  packages/runtime/ui-runtime/src/server/static-shell.ts \
  packages/runtime/ui-runtime/src/index.ts \
  packages/runtime/ui-runtime/test/unit/server.test.ts
git commit -m "feat: serve explicit ui asset manifest"
```

---

## Task 5: Materialize Module Static Assets Into Runtime Artifacts

**Files:**
- Modify: `apps/cli/src/bundle/collect-assets.ts`
- Modify: `apps/cli/test/unit/bundle/collect-assets.test.ts`
- Modify: `packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts`
- Modify: `packages/platform/deploy-bundle-input/test/to-deploy-core-input.test.ts`
- Modify: `packages/runtime/runtime/src/types.ts`
- Modify: `packages/runtime/runtime/src/load/load-service.ts`
- Modify: `packages/runtime/runtime/src/plugins/http-surface.ts`
- Modify: `packages/runtime/runtime/test/integration/load-service.test.ts`

- [ ] **Step 1: Write failing CLI bundle asset collection test**

Append to `apps/cli/test/unit/bundle/collect-assets.test.ts`:

```ts
  it('collects declared module client assets under their package-relative paths', () => {
    writeManifest('node_modules/@rntme/platform-ui/module.json', {
      name: '@rntme/platform-ui',
      version: '0.0.0',
      client: {
        assets: {
          stylesheets: [{ id: 'platform-ui', path: 'assets/platform-ui.css' }],
          icons: [{ id: 'logo-monogram', path: 'assets/logo-monogram.svg' }],
        },
      },
    });
    writeJs('node_modules/@rntme/platform-ui/assets/platform-ui.css', '.platform{}');
    writeJs('node_modules/@rntme/platform-ui/assets/logo-monogram.svg', '<svg></svg>');

    const result = collectBundleAssets(root, bundleFiles({
      'project.json': {
        name: 'demo',
        services: [],
        modules: { platformUi: { package: '@rntme/platform-ui' } },
      },
      'node_modules/@rntme/platform-ui/module.json': {
        name: '@rntme/platform-ui',
        version: '0.0.0',
        client: {
          assets: {
            stylesheets: [{ id: 'platform-ui', path: 'assets/platform-ui.css' }],
            icons: [{ id: 'logo-monogram', path: 'assets/logo-monogram.svg' }],
          },
        },
      },
    }), [
      'project.json',
      'node_modules/@rntme/platform-ui/module.json',
      'node_modules/@rntme/platform-ui/assets/platform-ui.css',
      'node_modules/@rntme/platform-ui/assets/logo-monogram.svg',
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value['node_modules/@rntme/platform-ui/assets/platform-ui.css']).toBe(
        Buffer.from('.platform{}').toString('base64'),
      );
      expect(result.value['node_modules/@rntme/platform-ui/assets/logo-monogram.svg']).toBe(
        Buffer.from('<svg></svg>').toString('base64'),
      );
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun test --cwd apps/cli test/unit/bundle/collect-assets.test.ts
```

Expected: the new asset keys are absent.

- [ ] **Step 3: Collect module client assets in CLI bundles**

In `apps/cli/src/bundle/collect-assets.ts`, extend `CollectAssetsError.code`:

```ts
    | 'BLUEPRINT_MODULE_CLIENT_ASSET_MISSING'
    | 'BLUEPRINT_MODULE_CLIENT_ASSET_SCRIPT_REJECTED'
```

Call a new collector in `collectBundleAssets` after provisioners:

```ts
  const moduleClientAssets = collectModuleClientAssetsInto(root, bundleFiles, out, budget);
  if (!moduleClientAssets.ok) return moduleClientAssets;
```

Add:

```ts
type ClientAssetDecl = { id?: unknown; path?: unknown };
type ClientAssetsBlock = {
  stylesheets?: unknown;
  fonts?: unknown;
  icons?: unknown;
  images?: unknown;
  staticFiles?: unknown;
  preloads?: unknown;
};
type ClientBlockShape = { assets?: unknown };
type ClientAssetManifestShape = ManifestShape & { client?: ClientBlockShape };

function collectModuleClientAssetsInto(
  root: string,
  bundleFiles: Readonly<Record<string, unknown>>,
  out: Record<string, string>,
  budget: { totalBytes: number },
): CollectAssetsResult {
  for (const relPath of Object.keys(bundleFiles).sort()) {
    if (!relPath.startsWith('node_modules/') || !relPath.endsWith('/module.json')) continue;
    const manifest = bundleFiles[relPath] as ClientAssetManifestShape;
    const assets = manifest.client?.assets as ClientAssetsBlock | undefined;
    if (assets === undefined) continue;
    const moduleDir = dirname(relPath);
    const assetPaths = declaredClientAssetPaths(assets);
    for (const assetPath of [...assetPaths].sort()) {
      if (isJavaScriptAsset(assetPath)) {
        return {
          ok: false,
          errors: [{
            code: 'BLUEPRINT_MODULE_CLIENT_ASSET_SCRIPT_REJECTED',
            message: `module client asset "${moduleDir}/${assetPath}" is executable JavaScript`,
          }],
        };
      }
      const bundleAssetPath = `${moduleDir}/${assetPath}`;
      const absPath = resolve(root, bundleAssetPath);
      let bytes: Buffer;
      try {
        const st = statSync(absPath);
        if (!st.isFile()) {
          return {
            ok: false,
            errors: [{
              code: 'BLUEPRINT_MODULE_CLIENT_ASSET_MISSING',
              message: `module client asset "${bundleAssetPath}" is not a regular file`,
            }],
          };
        }
        bytes = readFileSync(absPath);
      } catch (cause) {
        return {
          ok: false,
          errors: [{
            code: 'BLUEPRINT_MODULE_CLIENT_ASSET_MISSING',
            message: `module client asset "${bundleAssetPath}" is missing on disk (${(cause as Error).message})`,
          }],
        };
      }
      const added = addAsset(out, bundleAssetPath, bytes, budget);
      if (!added.ok) return added;
    }
  }
  return { ok: true, value: out };
}

function declaredClientAssetPaths(assets: ClientAssetsBlock): Set<string> {
  const paths = new Set<string>();
  for (const key of ['stylesheets', 'fonts', 'icons', 'images', 'staticFiles'] as const) {
    const list = assets[key];
    if (!Array.isArray(list)) continue;
    for (const item of list as ClientAssetDecl[]) {
      if (typeof item.path === 'string' && item.path.length > 0) paths.add(item.path);
    }
  }
  const preloads = assets.preloads;
  if (Array.isArray(preloads)) {
    for (const item of preloads as ClientAssetDecl[]) {
      if (typeof item.path === 'string' && item.path.length > 0) paths.add(item.path);
    }
  }
  return paths;
}

function isJavaScriptAsset(path: string): boolean {
  return /\.(?:mjs|cjs|js|jsx|ts|tsx)$/i.test(path);
}
```

- [ ] **Step 4: Run CLI bundle tests**

Run:

```bash
bun test --cwd apps/cli test/unit/bundle/collect-assets.test.ts test/unit/bundle/build.test.ts
```

Expected: selected CLI bundle tests pass.

- [ ] **Step 5: Write failing deploy-bundle-input tests**

Append to `packages/platform/deploy-bundle-input/test/to-deploy-core-input.test.ts` inside the existing `describe`:

```ts
  it('copies composed UI module assets into the UI host runtime files', async () => {
    const platformDir = join(repoRoot, 'apps', 'platform', 'blueprint');
    const composed = await loadComposedBlueprint(platformDir);
    expect(composed.ok, composed.ok ? '' : JSON.stringify(composed.errors, null, 2)).toBe(true);
    if (!composed.ok) return;

    const withAsset = {
      ...composed.value,
      uiAssetManifest: {
        stylesheets: [
          {
            id: 'platform-ui',
            moduleKey: 'platformUi',
            moduleName: '@rntme/platform-ui',
            href: '/assets/modules/platformUi/stylesheets/platform-ui.css',
            order: 100,
            media: 'all',
            scope: 'document',
          },
        ],
        fonts: [],
        icons: [],
        images: [],
        staticFiles: [],
        preloads: [],
      },
      uiAssetSources: [
        {
          moduleKey: 'platformUi',
          moduleName: '@rntme/platform-ui',
          sourcePath: join(platformDir, '..', 'ui-module', 'assets', 'platform-ui.css'),
          sourceRelativePath: 'assets/platform-ui.css',
          runtimePath: 'ui-build/modules/platformUi/stylesheets/platform-ui.css',
          href: '/assets/modules/platformUi/stylesheets/platform-ui.css',
        },
      ],
    };

    const result = await toDeployCoreInput(withAsset, platformDir);
    const app = result.services.app;

    expect(app?.runtimeFiles?.['ui-assets.json']).toContain('"platform-ui"');
    expect(app?.runtimeFiles?.['ui-build/modules/platformUi/stylesheets/platform-ui.css']).toContain(':root');
  });
```

- [ ] **Step 6: Run deploy-bundle-input test to verify it fails**

Run:

```bash
bun test --cwd packages/platform/deploy-bundle-input test/to-deploy-core-input.test.ts
```

Expected: `ui-assets.json` and module asset runtime file assertions fail.

- [ ] **Step 7: Copy UI module assets into runtime files**

In `packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts`, import `readFileSync` is already available. Add helper:

```ts
async function addUiModuleAssetFiles(
  files: Record<string, string>,
  project: ComposedBlueprint,
): Promise<void> {
  if (project.uiAssetManifest !== null && project.uiAssetManifest !== undefined) {
    addJsonFile(files, 'ui-assets.json', project.uiAssetManifest);
  }
  for (const source of project.uiAssetSources ?? []) {
    files[source.runtimePath] = readFileSync(source.sourcePath, 'utf8');
  }
}
```

Call it in both `buildRuntimeArtifactFiles` and `buildUiHostRuntimeArtifactFiles` immediately after `Object.assign(files, uiBuildFiles);`:

```ts
  await addUiModuleAssetFiles(files, project);
```

- [ ] **Step 8: Load `ui-assets.json` in runtime**

In `packages/runtime/runtime/src/types.ts`, add:

```ts
import type { UiRuntimeAssetManifest } from '@rntme/ui-runtime';
```

Add to `ValidatedService`:

```ts
  uiAssetManifest: UiRuntimeAssetManifest | null;
```

In `packages/runtime/runtime/src/load/load-service.ts`, import `UiRuntimeAssetManifest` and add near UI loading:

```ts
  let uiAssetManifest: UiRuntimeAssetManifest | null = null;
  try {
    uiAssetManifest = readJsonFile(dir, 'ui-assets.json') as UiRuntimeAssetManifest;
  } catch (cause) {
    if ((cause as { code?: string }).code !== 'ENOENT') {
      return { ok: false, errors: [{ code: 'UI_INVALID', details: [{ message: cause instanceof Error ? cause.message : String(cause) }] }] };
    }
  }
```

Add `uiAssetManifest` to the returned service value.

In `packages/runtime/runtime/src/plugins/http-surface.ts`, pass it:

```ts
      ...(ctx.service.uiAssetManifest === null ? {} : { assetManifest: ctx.service.uiAssetManifest }),
```

- [ ] **Step 9: Add runtime load-service coverage**

In `packages/runtime/runtime/test/integration/load-service.test.ts`, add a focused assertion to the existing fixture setup that writes `ui-build`. If no helper exists, add this test:

```ts
  it('loads optional ui-assets.json next to runtime artifacts', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rntme-runtime-load-assets-'));
    try {
      writeMinimalRuntimeService(tmp);
      writeFileSync(join(tmp, 'ui-assets.json'), JSON.stringify({
        stylesheets: [
          {
            id: 'platform-ui',
            moduleKey: 'platformUi',
            moduleName: '@rntme/platform-ui',
            href: '/assets/modules/platformUi/stylesheets/platform-ui.css',
            order: 100,
            media: 'all',
            scope: 'document',
          },
        ],
        fonts: [],
        icons: [],
        images: [],
        staticFiles: [],
        preloads: [],
      }));

      const result = loadService(tmp);

      expect(result.ok, result.ok ? '' : JSON.stringify(result.errors, null, 2)).toBe(true);
      if (result.ok) {
        expect(result.value.uiAssetManifest?.stylesheets[0]?.id).toBe('platform-ui');
      }
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
```

If `writeMinimalRuntimeService` does not exist, create it inside the test file by copying the smallest complete fixture already used by the existing load-service tests; keep the helper local to the test file.

- [ ] **Step 10: Run selected deploy/runtime tests**

Run:

```bash
bun test --cwd apps/cli test/unit/bundle/collect-assets.test.ts test/unit/bundle/build.test.ts
bun test --cwd packages/platform/deploy-bundle-input test/to-deploy-core-input.test.ts
bun test --cwd packages/runtime/runtime test/integration/load-service.test.ts
```

Expected: selected tests pass.

- [ ] **Step 11: Commit**

```bash
git add apps/cli/src/bundle/collect-assets.ts \
  apps/cli/test/unit/bundle/collect-assets.test.ts \
  packages/platform/deploy-bundle-input/src/to-deploy-core-input.ts \
  packages/platform/deploy-bundle-input/test/to-deploy-core-input.test.ts \
  packages/runtime/runtime/src/types.ts \
  packages/runtime/runtime/src/load/load-service.ts \
  packages/runtime/runtime/src/plugins/http-surface.ts \
  packages/runtime/runtime/test/integration/load-service.test.ts
git commit -m "feat: materialize ui module assets"
```

---

## Task 6: Create `apps/platform/ui-module`

**Files:**
- Modify: `package.json`
- Create: `apps/platform/ui-module/README.md`
- Create: `apps/platform/ui-module/package.json`
- Create: `apps/platform/ui-module/tsconfig.json`
- Create: `apps/platform/ui-module/tsconfig.check.json`
- Create: `apps/platform/ui-module/eslint.config.mjs`
- Create: `apps/platform/ui-module/module.json`
- Create: `apps/platform/ui-module/src/client.ts`
- Create: `apps/platform/ui-module/src/components.tsx`
- Create: `apps/platform/ui-module/src/index.ts`
- Create: `apps/platform/ui-module/assets/platform-ui.css`
- Create: `apps/platform/ui-module/assets/logo-monogram.svg`
- Create: `apps/platform/ui-module/assets/logo-wordmark.svg`
- Create: `apps/platform/ui-module/fragments/service-card.spec.json`
- Create: `apps/platform/ui-module/test/components.test.tsx`
- Modify: `apps/cli/scripts/copy-platform-blueprint.cjs`

- [ ] **Step 1: Add workspace package entry**

In root `package.json`, add the exact workspace:

```json
"apps/platform/ui-module",
```

Place it after `"apps/*"` so the relevant workspaces block becomes:

```json
  "workspaces": [
    "packages/artifacts/*",
    "packages/runtime/*",
    "packages/platform/*",
    "packages/deploy/*",
    "packages/tooling/*",
    "packages/contracts/*/v*",
    "apps/*",
    "apps/platform/ui-module",
    "modules/*/*",
    "demo/*"
  ],
```

- [ ] **Step 2: Create package metadata**

Create `apps/platform/ui-module/package.json`:

```json
{
  "name": "@rntme/platform-ui",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Platform-specific UI module for the rntme control plane.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./client": {
      "types": "./dist/client.d.ts",
      "import": "./dist/client.js"
    },
    "./module.json": "./module.json"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": [
    "dist",
    "assets",
    "fragments",
    "module.json",
    "README.md"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "bun run build && bun test",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.{ts,tsx}\" \"test/**/*.{ts,tsx}\""
  },
  "peerDependencies": {
    "react": "^19.2.5"
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@types/bun": "^1.2.14",
    "@types/node": "^20.14.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "react": "^19.2.5",
    "react-dom": "^19.2.5",
    "typescript": "^5.5.4"
  }
}
```

Create `apps/platform/ui-module/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

Create `apps/platform/ui-module/tsconfig.check.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "test/**/*.ts", "test/**/*.tsx"]
}
```

Create `apps/platform/ui-module/eslint.config.mjs` by copying `modules/presentation/md-mermaid/eslint.config.mjs` and changing no rule behavior.

Create `apps/platform/ui-module/README.md`:

```md
# @rntme/platform-ui

Platform-specific UI module for the rntme control plane.

Current documentation: [docs/current/owners/apps/platform.md](../../../docs/current/owners/apps/platform.md)

Local commands:
- `bun test`
- `bun run typecheck`
- `bun run build`
- `bun run lint`

Notes:
- Product components, platform tokens, CSS, logos, and exported UI fragments live here.
- Browser code imports only React and contract packages. Do not import `@rntme/ui-runtime`.
```

- [ ] **Step 3: Create module manifest**

Create `apps/platform/ui-module/module.json`:

```json
{
  "name": "@rntme/platform-ui",
  "version": "0.0.0",
  "description": "rntme platform product UI module.",
  "client": {
    "entry": "./dist/client.js",
    "components": [
      { "type": "PlatformPage", "props": {} },
      { "type": "PlatformPageHeader", "props": { "eyebrow": { "type": "string" }, "title": { "type": "string" }, "meta": { "type": "array" }, "actions": { "type": "array" } } },
      { "type": "PlatformPanel", "props": { "title": { "type": "string" }, "subtitle": { "type": "string" }, "flush": { "type": "boolean" } } },
      { "type": "PlatformSidebar", "props": { "brand": { "type": "string" }, "version": { "type": "string" }, "contextLabel": { "type": "string" }, "contextName": { "type": "string" }, "contextMeta": { "type": "string" }, "items": { "type": "array" }, "cliVersion": { "type": "string" } } },
      { "type": "PlatformTopbar", "props": { "crumbs": { "type": "array" }, "actions": { "type": "array" } } },
      { "type": "PlatformSummaryGrid", "props": { "items": { "type": "array" } } },
      { "type": "PlatformServicesPanel", "props": { "title": { "type": "string" }, "subtitle": { "type": "string" }, "statePath": { "type": "string" }, "services": { "type": "array" } } },
      { "type": "PlatformTimeline", "props": { "steps": { "type": "array" }, "currentStep": { "type": "number" }, "errored": { "type": "boolean" } } },
      { "type": "PlatformAlertList", "props": { "variant": { "type": "string" }, "items": { "type": "array" } } },
      { "type": "PlatformBanner", "props": { "variant": { "type": "string" }, "title": { "type": "string" }, "message": { "type": "string" }, "artifact": { "type": "string" }, "jsonPath": { "type": "string" }, "suggestedAction": { "type": "string" } } },
      { "type": "PlatformEmptyState", "props": { "eyebrow": { "type": "string" }, "title": { "type": "string" }, "body": { "type": "string" }, "command": { "type": "string" }, "docsLabel": { "type": "string" }, "docsHref": { "type": "string" } } },
      { "type": "PlatformDataTable", "props": { "statePath": { "type": "string" }, "columns": { "type": "array" } } },
      { "type": "PlatformBox", "props": { "className": { "type": "string" }, "as": { "type": "string" } } }
    ],
    "assets": {
      "stylesheets": [
        {
          "id": "platform-ui",
          "path": "assets/platform-ui.css",
          "order": 100,
          "media": "all",
          "scope": "document"
        }
      ],
      "icons": [
        { "id": "logo-monogram", "path": "assets/logo-monogram.svg" },
        { "id": "logo-wordmark", "path": "assets/logo-wordmark.svg" }
      ],
      "images": [],
      "staticFiles": [],
      "preloads": [
        { "path": "assets/platform-ui.css", "as": "style" }
      ]
    },
    "presets": [
      {
        "name": "service-card",
        "kind": "fragment",
        "path": "fragments/service-card",
        "description": "Platform service summary card.",
        "inputs": {
          "name": { "type": "string", "required": true },
          "status": { "type": "string" },
          "description": { "type": "string" }
        }
      }
    ]
  }
}
```

- [ ] **Step 4: Move platform components**

Create `apps/platform/ui-module/src/client.ts`:

```ts
export {
  PlatformAlertList,
  PlatformBanner,
  PlatformBox,
  PlatformDataTable,
  PlatformEmptyState,
  PlatformPage,
  PlatformPageHeader,
  PlatformPanel,
  PlatformServicesPanel,
  PlatformSidebar,
  PlatformSummaryGrid,
  PlatformTimeline,
  PlatformTopbar,
} from './components.js';
```

Create `apps/platform/ui-module/src/index.ts`:

```ts
export const VERSION = '0.0.0';
```

Create `apps/platform/ui-module/src/components.tsx` by moving the current product component implementations from `packages/runtime/ui-runtime/src/client/registry.ts` and renaming them:

| Current function | New export |
| --- | --- |
| `PageContainer` | `PlatformPage` |
| `PageHeader` | `PlatformPageHeader` |
| `Panel` | `PlatformPanel` |
| `Sidebar` | `PlatformSidebar` |
| `Topbar` | `PlatformTopbar` |
| `SummaryGrid` | `PlatformSummaryGrid` |
| `ServicesPanel` | `PlatformServicesPanel` |
| `Timeline` | `PlatformTimeline` |
| `AlertList` | `PlatformAlertList` |
| `Banner` | `PlatformBanner` |
| `EmptyState` | `PlatformEmptyState` |
| `DataTable` | `PlatformDataTable` |
| `Box` | `PlatformBox` |

Use this file header and keep the implementation pure React:

```tsx
import * as React from 'react';

type StatusVariant = 'ready' | 'building' | 'warn' | 'error' | 'queued' | 'canceled';

const STATUS_GLYPH: Record<StatusVariant, string> = {
  ready: '✓',
  building: '◐',
  warn: '!',
  error: '×',
  queued: '·',
  canceled: '–',
};
```

Keep every CSS class name unchanged (`rntme-*`) so `assets/platform-ui.css` carries the visual behavior without changing the blueprint specs beyond component type names.

- [ ] **Step 5: Move platform CSS and assets**

Create `apps/platform/ui-module/assets/platform-ui.css` by moving every platform product rule from `packages/runtime/ui-runtime/src/client/styles.css`:

- The Google font import.
- The OKLCH token `:root` block.
- Base platform body/focus styles.
- `.rntme-app`, `.rntme-sidebar`, `.rntme-main`, `.rntme-topbar`, `.rntme-page`, `.rntme-status`, `.rntme-summary`, `.rntme-panel`, `.rntme-dash-grid`, `.rntme-services-*`, `.rntme-timeline`, `.rntme-alert*`, `.rntme-banner*`, `.rntme-btn`, `.rntme-empty`, `.rntme-cmd`, `.rntme-sk`, `[data-rntme-component="DataTable"]`, and heading rhythm.

Copy the logo assets:

```bash
cp ".tmp/rntme Design System/assets/logo-monogram.svg" apps/platform/ui-module/assets/logo-monogram.svg
cp ".tmp/rntme Design System/assets/logo-wordmark.svg" apps/platform/ui-module/assets/logo-wordmark.svg
```

The copy command is used only for file creation from seed assets; if editing the copied files, use `apply_patch`.

- [ ] **Step 6: Add exported fragment**

Create `apps/platform/ui-module/fragments/service-card.spec.json`:

```json
{
  "root": "serviceCard",
  "elements": {
    "serviceCard": {
      "type": "PlatformPanel",
      "props": {
        "title": { "$param": "name" },
        "subtitle": { "$param": "status" }
      },
      "children": ["body"]
    },
    "body": {
      "type": "Text",
      "props": {
        "text": { "$param": "description" }
      }
    }
  }
}
```

- [ ] **Step 7: Add component smoke tests**

Create `apps/platform/ui-module/test/components.test.tsx`:

```tsx
import { describe, expect, it } from 'bun:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  PlatformDataTable,
  PlatformPageHeader,
  PlatformPanel,
  PlatformSidebar,
} from '../src/client.js';

describe('@rntme/platform-ui components', () => {
  it('renders the page header with platform class names', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlatformPageHeader, { eyebrow: 'Project', title: 'Deployments' }),
    );

    expect(html).toContain('rntme-page-head');
    expect(html).toContain('Deployments');
  });

  it('renders panel children through React', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlatformPanel, { title: 'Panel' }, React.createElement('span', null, 'inside')),
    );

    expect(html).toContain('rntme-panel');
    expect(html).toContain('inside');
  });

  it('renders the platform sidebar brand', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlatformSidebar, { brand: 'rntme', items: [{ label: 'Projects', href: '/' }] }),
    );

    expect(html).toContain('rntme-sidebar');
    expect(html).toContain('Projects');
  });

  it('renders the product data table marker', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlatformDataTable, { statePath: '/data/projects' }),
    );

    expect(html).toContain('data-rntme-component="DataTable"');
    expect(html).toContain('/data/projects');
  });
});
```

- [ ] **Step 8: Update platform blueprint copy script**

In `apps/cli/scripts/copy-platform-blueprint.cjs`, add `apps` to package discovery:

```js
  for (const parent of ['packages', 'modules', 'apps']) {
```

Add this after `copyProvisionerEntries();`:

```js
copyPlatformUiModule();
```

Add:

```js
function copyPlatformUiModule() {
  const packageDirs = discoverWorkspacePackageDirs(repoRoot);
  const source = packageDirs.get('@rntme/platform-ui');
  if (source === undefined) {
    throw new Error('workspace package not found for @rntme/platform-ui');
  }
  const target = join(dest, 'node_modules', '@rntme', 'platform-ui');
  mkdirSync(join(dest, 'node_modules', '@rntme'), { recursive: true });
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, {
    recursive: true,
    filter: (entry) => {
      const rel = entry.slice(source.length + 1);
      if (rel === 'node_modules' || rel.startsWith('node_modules/')) return false;
      if (rel === 'test' || rel.startsWith('test/')) return false;
      return true;
    },
  });
}
```

- [ ] **Step 9: Run platform UI module tests**

Run:

```bash
bun test --cwd apps/platform/ui-module
bun run --cwd apps/platform/ui-module typecheck
```

Expected: package build/test/typecheck pass.

- [ ] **Step 10: Commit**

```bash
git add package.json \
  apps/platform/ui-module \
  apps/cli/scripts/copy-platform-blueprint.cjs
git commit -m "feat: add platform ui module"
```

---

## Task 7: Remove Product Components From `ui-runtime` And Rename Platform UI Specs

**Files:**
- Modify: `packages/runtime/ui-runtime/src/client/registry.ts`
- Modify: `packages/runtime/ui-runtime/src/client/styles.css`
- Modify: `packages/runtime/ui-runtime/test/unit/data-table.test.ts`
- Modify: `packages/artifacts/blueprint/src/compose/ui-core-components.ts`
- Modify: `packages/artifacts/blueprint/test/unit/data-table-core.test.ts`
- Modify: `apps/platform/blueprint/project.json`
- Modify: `apps/platform/blueprint/services/app/ui/layouts/main.spec.json`
- Modify: `apps/platform/blueprint/services/app/ui/screens/*.spec.json`
- Modify: `apps/platform/blueprint/test/platform-ui.test.ts`

- [ ] **Step 1: Write failing core/runtime tests for generic Table**

Replace `packages/runtime/ui-runtime/test/unit/data-table.test.ts` with:

```ts
import './dom-setup';
import { describe, expect, it } from 'bun:test';

const { createRegistry } = await import('../../src/client/registry.js');

describe('Table runtime primitive', () => {
  it('registers Table in the runtime catalog without platform DataTable', () => {
    const bridge = {
      onNavigate: () => undefined,
      getScreen: () => null,
      store: { get: () => undefined, set: () => undefined, subscribe: () => () => undefined },
      fetchEndpoint: async () => undefined,
      fetchFn: fetch,
    };
    const { catalog } = createRegistry(bridge as never);
    expect(catalog.data.components.Table).toBeDefined();
    expect(catalog.data.components.DataTable).toBeUndefined();
    expect(catalog.data.components.PlatformDataTable).toBeUndefined();
  });
});
```

Replace `packages/artifacts/blueprint/test/unit/data-table-core.test.ts` with:

```ts
import { describe, expect, it } from 'bun:test';
import { resolveCoreComponent } from '../../src/compose/ui-core-components.js';

describe('generic Table core component', () => {
  it('is registered as a compose-time base primitive', () => {
    const info = resolveCoreComponent('Table');
    expect(info).toBeDefined();
    expect(info?.childrenModel).toBe('none');
  });

  it('does not treat platform product components as core components', () => {
    expect(resolveCoreComponent('DataTable')).toBeUndefined();
    expect(resolveCoreComponent('PageHeader')).toBeUndefined();
    expect(resolveCoreComponent('PlatformDataTable')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun test --cwd packages/runtime/ui-runtime test/unit/data-table.test.ts
bun test --cwd packages/artifacts/blueprint test/unit/data-table-core.test.ts
```

Expected: `DataTable` still exists and `Table` is not registered yet.

- [ ] **Step 3: Remove platform product registry code and add generic Table**

In `packages/runtime/ui-runtime/src/client/registry.ts`:

- Delete the current `DataTable` function.
- Delete all product component functions from `StatusBadge` through `Box`.
- Delete product entries from `coreDefs` and `coreReact`.
- Add this generic primitive near the top:

```tsx
function Table(props: {
  columns?: ReadonlyArray<{ key: string; label: string }>;
  rows?: ReadonlyArray<Record<string, unknown>>;
}) {
  const columns = props.columns ?? [];
  const rows = props.rows ?? [];
  return React.createElement(
    'table',
    { 'data-rntme-component': 'Table' },
    React.createElement(
      'thead',
      null,
      React.createElement(
        'tr',
        null,
        ...columns.map((column) => React.createElement('th', { key: column.key }, column.label)),
      ),
    ),
    React.createElement(
      'tbody',
      null,
      ...rows.map((row, rowIndex) =>
        React.createElement(
          'tr',
          { key: rowIndex },
          ...columns.map((column) =>
            React.createElement('td', { key: column.key }, String(row[column.key] ?? '')),
          ),
        ),
      ),
    ),
  );
}
```

Use these definitions:

```ts
const coreDefs = {
  Table: {
    props: z.object({
      columns: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
      rows: z.array(z.record(z.string(), z.unknown())).optional(),
    }),
  },
} as const;

const coreReact = {
  Table,
} as const;
```

- [ ] **Step 4: Remove product CSS from runtime styles**

In `packages/runtime/ui-runtime/src/client/styles.css`, keep only:

```css
@import "tailwindcss";
@source "../../build/main.js";

@theme inline {
  --color-background: hsl(0 0% 100%);
  --color-foreground: hsl(222.2 84% 4.9%);
  --color-card: hsl(0 0% 100%);
  --color-card-foreground: hsl(222.2 84% 4.9%);
  --color-popover: hsl(0 0% 100%);
  --color-popover-foreground: hsl(222.2 84% 4.9%);
  --color-primary: hsl(222.2 47.4% 11.2%);
  --color-primary-foreground: hsl(210 40% 98%);
  --color-secondary: hsl(210 40% 96.1%);
  --color-secondary-foreground: hsl(222.2 47.4% 11.2%);
  --color-muted: hsl(210 40% 96.1%);
  --color-muted-foreground: hsl(215.4 16.3% 46.9%);
  --color-accent: hsl(210 40% 96.1%);
  --color-accent-foreground: hsl(222.2 47.4% 11.2%);
  --color-destructive: hsl(0 84.2% 60.2%);
  --color-destructive-foreground: hsl(210 40% 98%);
  --color-border: hsl(214.3 31.8% 91.4%);
  --color-input: hsl(214.3 31.8% 91.4%);
  --color-ring: hsl(222.2 84% 4.9%);
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
}

html {
  -webkit-text-size-adjust: 100%;
}

body {
  margin: 0;
  min-height: 100vh;
  background: var(--color-background);
  color: var(--color-foreground);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}

:focus-visible {
  outline: 2px solid var(--color-ring);
  outline-offset: 2px;
}

[data-rntme-component="Table"] {
  width: 100%;
  border-collapse: collapse;
}

[data-rntme-component="Table"] th,
[data-rntme-component="Table"] td {
  border-bottom: 1px solid var(--color-border);
  padding: 8px 10px;
  text-align: left;
}
```

- [ ] **Step 5: Update compose-time core components**

In `packages/artifacts/blueprint/src/compose/ui-core-components.ts`, replace the map with:

```ts
const CORE_COMPONENTS: Readonly<Record<string, ComponentInfo>> = {
  Badge: { childrenModel: 'none', props: {} },
  Button: { childrenModel: 'none', props: {} },
  Card: { childrenModel: 'list', props: {} },
  DataList: { childrenModel: 'none', props: {} },
  Heading: { childrenModel: 'none', props: {} },
  Input: { childrenModel: 'none', props: {} },
  Slot: { childrenModel: 'none', props: {} },
  Stack: { childrenModel: 'list', props: {} },
  Table: { childrenModel: 'none', props: {} },
  Text: { childrenModel: 'none', props: {} },
};
```

- [ ] **Step 6: Update platform project modules**

In `apps/platform/blueprint/project.json`, add the `platformUi` module without changing the existing `identity` module:

```json
    "platformUi": {
      "package": "@rntme/platform-ui"
    }
```

The `modules` object should contain both `identity` and `platformUi`.

- [ ] **Step 7: Rename platform UI component types**

Apply these replacements across `apps/platform/blueprint/services/app/ui/**/*.spec.json`:

| From | To |
| --- | --- |
| `"PageContainer"` | `"PlatformPage"` |
| `"PageHeader"` | `"PlatformPageHeader"` |
| `"Panel"` | `"PlatformPanel"` |
| `"Sidebar"` | `"PlatformSidebar"` |
| `"Topbar"` | `"PlatformTopbar"` |
| `"SummaryGrid"` | `"PlatformSummaryGrid"` |
| `"ServicesPanel"` | `"PlatformServicesPanel"` |
| `"Timeline"` | `"PlatformTimeline"` |
| `"AlertList"` | `"PlatformAlertList"` |
| `"Banner"` | `"PlatformBanner"` |
| `"EmptyState"` | `"PlatformEmptyState"` |
| `"DataTable"` | `"PlatformDataTable"` |
| `"DashGrid"` | `"PlatformPage"` if it is only wrapping page content; otherwise `"PlatformBox"` with `className: "rntme-dash-grid"` |
| `"Box"` | `"PlatformBox"` |

For the current layout, `apps/platform/blueprint/services/app/ui/layouts/main.spec.json` should begin:

```json
{
  "root": "shell",
  "elements": {
    "shell": {
      "type": "PlatformBox",
      "props": { "className": "rntme-app" },
      "children": ["sidebar", "main"]
    },
    "sidebar": {
      "type": "PlatformSidebar",
      "props": {
```

- [ ] **Step 8: Update platform UI test expectations**

In `apps/platform/blueprint/test/platform-ui.test.ts`, add assertions after existing virtual entry assertions:

```ts
    expect(result.value.catalogManifest?.components.map((c) => c.type)).toEqual(
      expect.arrayContaining(['PlatformPageHeader', 'PlatformDataTable', 'PlatformSidebar']),
    );
    expect(result.value.uiAssetManifest?.stylesheets[0]).toMatchObject({
      id: 'platform-ui',
      moduleKey: 'platformUi',
      href: '/assets/modules/platformUi/stylesheets/platform-ui.css',
    });
    expect(result.value.virtualEntrySource).toContain("import('@rntme/platform-ui/client')");
```

- [ ] **Step 9: Run selected tests**

Run:

```bash
bun test --cwd packages/runtime/ui-runtime test/unit/data-table.test.ts test/unit/registry.test.ts
bun test --cwd packages/artifacts/blueprint test/unit/data-table-core.test.ts
bun run -F @rntme/blueprint test -- ../../../apps/platform/blueprint/test/platform-ui.test.ts
```

Expected: selected tests pass and platform UI composes with `Platform*` component names.

- [ ] **Step 10: Commit**

```bash
git add packages/runtime/ui-runtime/src/client/registry.ts \
  packages/runtime/ui-runtime/src/client/styles.css \
  packages/runtime/ui-runtime/test/unit/data-table.test.ts \
  packages/artifacts/blueprint/src/compose/ui-core-components.ts \
  packages/artifacts/blueprint/test/unit/data-table-core.test.ts \
  apps/platform/blueprint/project.json \
  apps/platform/blueprint/services/app/ui \
  apps/platform/blueprint/test/platform-ui.test.ts
git commit -m "refactor: move platform ui out of runtime"
```

---

## Task 8: Documentation, Decision Bet, And Navigation

**Files:**
- Modify: `docs/decision-system.md`
- Modify: `packages/contracts/module/v1/README.md`
- Modify: `docs/current/owners/packages/contracts/module/v1.md`
- Modify: `packages/artifacts/blueprint/README.md`
- Modify: `docs/current/owners/packages/artifacts/blueprint.md`
- Modify: `packages/artifacts/ui/README.md`
- Modify: `docs/current/owners/packages/artifacts/ui.md`
- Modify: `packages/runtime/ui-runtime/README.md`
- Modify: `docs/current/owners/packages/runtime/ui-runtime.md`
- Modify: `packages/runtime/runtime/README.md`
- Modify: `docs/current/owners/packages/runtime/runtime.md`
- Modify: `packages/platform/deploy-bundle-input/README.md`
- Create or modify: `docs/current/owners/packages/platform/deploy-bundle-input.md`
- Modify: `apps/platform/README.md`
- Modify: `docs/current/owners/apps/platform.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update the decision system bet**

In `docs/decision-system.md`, under `### 3.5 Modules & Integrations`, append:

```md
- **Module client surface owns product UI extension** - Product UI components, static browser assets, and reusable authoring fragments are contributed by module packages through `module.json#client.*`. `@rntme/ui-runtime` remains a generic host plus base catalog, and must not accumulate product-specific design systems. · G4, G5, F1, F2, F5, F6 · `locked-pending` · spec `docs/superpowers/specs/2026-05-12-module-client-ui-design-system-design.md`
```

- [ ] **Step 2: Update module contract docs**

In `docs/current/owners/packages/contracts/module/v1.md`, add to API types:

```md
Client asset/preset types: `ClientAssets`, `ClientPreset`, `ClientStylesheetAsset`, `ClientFontAsset`, `ClientImageAsset`, `ClientStaticFileAsset`, `ClientPreloadAsset`.
```

Add to invariants:

```md
- `client.assets` is non-executable. JavaScript belongs in `client.entry`; asset declarations are stylesheets, fonts, icons, images, static files, and preload metadata.
- `client.presets` is the public reusable authoring export list. V1 supports only `kind: "fragment"`.
- `client.entry` is required when a client declares executable fields (`boot`, `components`, or `operations`). Asset-only and preset-only client surfaces may omit it.
```

In `packages/contracts/module/v1/README.md`, add one note:

```md
- `client.assets` and `client.presets` are parsed here; file existence and module-qualified UI ref validation happen in `@rntme/blueprint`.
```

- [ ] **Step 3: Update blueprint docs**

In `docs/current/owners/packages/artifacts/blueprint.md`, update Public API `loadComposedBlueprint` paragraph to mention:

```md
It also validates `module.json#client.assets` and `module.json#client.presets`, builds `uiAssetManifest`, records `uiAssetSources` for deploy materialization, and passes a module-preset resolver into service UI compilation for refs like `module:platformUi/fragments/service-card`.
```

Add to Where to look first:

```md
- "Change module client assets/presets" -> `src/compose/module-client-assets.ts` and `src/compose/module-preset-resolver.ts`.
```

In `packages/artifacts/blueprint/README.md`, add:

```md
- Module client assets and presets are documented in the owner doc.
```

- [ ] **Step 4: Update UI compiler docs**

In `docs/current/owners/packages/artifacts/ui.md`, add to API table:

```md
| `externalFragmentResolver` | `CompileOptions` | Optional caller-supplied resolver for non-local fragment refs. `@rntme/ui` does not know module semantics; blueprint supplies the resolver for `module:<projectModuleKey>/<presetPath>`. |
```

Add to invariants:

```md
- External fragments are still compiled away. After `expand`, output contains no `$ref` or `$param` regardless of whether the source ref was local or external.
- `@rntme/ui` remains module-agnostic. It only calls `externalFragmentResolver`; module key validation and exported preset checks live in `@rntme/blueprint`.
```

- [ ] **Step 5: Update runtime docs**

In `docs/current/owners/packages/runtime/ui-runtime.md`, update `CreateAppOptions`:

```md
| `CreateAppOptions` | `{ artifact: CompiledArtifact; assetsDir?: string; assetManifest?: UiRuntimeAssetManifest }` | `assetManifest` is explicit composed metadata for module static assets. Runtime does not discover modules. |
```

Add route:

```md
| GET | `/_ui-assets.json` | The `assetManifest` passed to `createApp` (empty lists when omitted). |
```

Add invariant:

```md
- Runtime serves module static assets only because the host passes `assetManifest` and `assetsDir`. It does not read `project.json`, `module.json`, or `node_modules`.
```

In `docs/current/owners/packages/runtime/runtime.md`, note that `loadService` reads optional `ui-assets.json` and `HttpSurface` passes it to `@rntme/ui-runtime`.

- [ ] **Step 6: Update deploy-bundle-input docs**

Create `docs/current/owners/packages/platform/deploy-bundle-input.md` if missing:

```md
# @rntme/deploy-bundle-input

Lifts a composed blueprint into the `@rntme/deploy-core` `ComposedProjectInput` shape.

## Role

Used by CLI direct deploy and the platform BPMN compose handler. It reads runtime files from the materialized bundle directory, bundles the virtual UI entry, copies composed module static UI assets into `ui-build/`, and emits `ui-assets.json` when `@rntme/blueprint` produced a UI asset manifest.

## Where to look first

- `src/to-deploy-core-input.ts` - conversion, UI bundling, workflow file reads, module static asset copying.

## Local commands

- `bun test`
- `bun run typecheck`
- `bun run build`
- `bun run lint`
```

Update `packages/platform/deploy-bundle-input/README.md` to link to it:

```md
Owner doc: [docs/current/owners/packages/platform/deploy-bundle-input.md](../../../docs/current/owners/packages/platform/deploy-bundle-input.md)
```

- [ ] **Step 7: Update platform docs and AGENTS navigation**

In `docs/current/owners/apps/platform.md`, add under UI:

```md
Platform product components, CSS tokens, logos, and exported reusable UI fragments live in `apps/platform/ui-module` as the `@rntme/platform-ui` module. `apps/platform/blueprint/project.json#modules.platformUi` wires that package into composition, and platform UI specs use `Platform*` component type names.
```

In `apps/platform/README.md`, add local commands:

```md
- `bun test --cwd ui-module`
- `bun run --cwd ui-module build`
```

In `AGENTS.md`, update the apps README row to include:

```md
`apps/platform/ui-module/README.md`
```

- [ ] **Step 8: Run documentation grep checks**

Run:

```bash
rg -n "PageHeader|DataTable|ServicesPanel|rntme-sidebar|client.assets|client.presets|_ui-assets|platformUi" docs/current packages/*/*/README.md packages/*/*/*/README.md apps/platform/README.md AGENTS.md
```

Expected: hits are either current docs for new surfaces or no stale claim that platform product components live in `@rntme/ui-runtime`.

- [ ] **Step 9: Commit**

```bash
git add docs/decision-system.md \
  packages/contracts/module/v1/README.md \
  docs/current/owners/packages/contracts/module/v1.md \
  packages/artifacts/blueprint/README.md \
  docs/current/owners/packages/artifacts/blueprint.md \
  packages/artifacts/ui/README.md \
  docs/current/owners/packages/artifacts/ui.md \
  packages/runtime/ui-runtime/README.md \
  docs/current/owners/packages/runtime/ui-runtime.md \
  packages/runtime/runtime/README.md \
  docs/current/owners/packages/runtime/runtime.md \
  packages/platform/deploy-bundle-input/README.md \
  docs/current/owners/packages/platform/deploy-bundle-input.md \
  apps/platform/README.md \
  docs/current/owners/apps/platform.md \
  AGENTS.md
git commit -m "docs: document module client ui surfaces"
```

---

## Task 9: Final Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
bun test --cwd packages/contracts/module/v1
bun test --cwd packages/artifacts/ui
bun test --cwd packages/artifacts/blueprint
bun test --cwd packages/runtime/ui-runtime
bun test --cwd packages/runtime/runtime
bun test --cwd packages/platform/deploy-bundle-input
bun test --cwd apps/platform/ui-module
bun run -F @rntme/blueprint test -- ../../../apps/platform/blueprint/test
```

Expected: all focused tests pass.

- [ ] **Step 2: Run repo gates**

Run from the workspace root:

```bash
bun run build
bun run typecheck
bun run test
bun run lint
bun run depcruise
bun run vendor:check
```

Expected: all repo gates pass.

- [ ] **Step 3: Inspect for runtime product-style leakage**

Run:

```bash
rg -n "PlatformPage|PlatformDataTable|rntme-sidebar|rntme-panel|platform-ui|PageHeader|ServicesPanel|SummaryGrid" packages/runtime/ui-runtime packages/artifacts/blueprint/src/compose/ui-core-components.ts
```

Expected:

- No hits in `packages/runtime/ui-runtime` for `Platform*`, `rntme-sidebar`, `rntme-panel`, `platform-ui`, `PageHeader`, `ServicesPanel`, or `SummaryGrid`.
- No hits in `ui-core-components.ts` for product component names.
- A hit for generic `Table` is acceptable.

- [ ] **Step 4: Inspect compiled platform composition**

Run:

```bash
bun run -F @rntme/blueprint test -- ../../../apps/platform/blueprint/test/platform-ui.test.ts
```

Expected:

- The test passes.
- The platform catalog includes `PlatformPageHeader`, `PlatformDataTable`, and `PlatformSidebar`.
- `virtualEntrySource` imports `@rntme/platform-ui/client`.
- `uiAssetManifest.stylesheets[0].href` is `/assets/modules/platformUi/stylesheets/platform-ui.css`.

- [ ] **Step 5: Commit any verification-only fixes**

If a verification command required a small fix, commit it with:

```bash
git add <changed-files>
git commit -m "fix: stabilize module client ui verification"
```

If no fixes were needed, do not create an empty commit.

---

## Docs Touch Evaluation

- `docs/decision-system.md`: update required. Adds the locked-pending module client surface bet from the spec.
- Local README stubs: update required for `apps/platform/README.md`, `apps/platform/ui-module/README.md`, and package README stubs where public API/navigation changed.
- `docs/current/owners/**`: update required for module contract, blueprint, UI compiler, UI runtime, runtime, deploy-bundle-input, and platform owner docs.
- `docs/current/guides/**`: no update required; this plan changes compiler/runtime surfaces, not authoring guide examples beyond owner docs.
- `docs/README.md`: no update required; documentation navigation structure does not change.
- `AGENTS.md`: update required because `apps/platform/ui-module/README.md` becomes a new common lookup path.
- Root `README.md`: no update required; public positioning and quick start do not change.
- `CLAUDE.md`: no update required; bootstrap instructions and command list do not change.

## Self-Review

Spec coverage:

- One module model: Task 1 extends `client` rather than adding a module kind.
- Non-executable browser assets: Tasks 1, 2, 4, and 5 validate, compose, serve, and materialize them.
- Reusable authoring fragments: Tasks 1, 2, and 3 implement `client.presets` and module-qualified `$ref`.
- Move platform components/CSS out of runtime: Tasks 6 and 7.
- Platform consumes through `project.json#modules`: Task 7.
- `@rntme/ui` remains module-agnostic: Task 3 uses a generic resolver.
- `@rntme/ui-runtime` remains generic: Tasks 4 and 7.
- Compiled UI artifacts free of `$ref`/`$param`: Task 3 tests this.
- Validation requirements: Tasks 1, 2, 3, and 4 add manifest, blueprint, UI compiler, and runtime validation tests.
- Docs touch: Task 8 covers every required surface from the spec.

Placeholder scan:

- No `TBD`.
- No `TODO`.
- No "implement later".
- No "add appropriate error handling".
- No "write tests for the above" without code.

Type consistency:

- `uiAssetManifest`, `uiAssetSources`, and `uiPresetExports` are introduced in `ComposedBlueprint` and reused by deploy-bundle-input.
- Runtime type name is `UiRuntimeAssetManifest`; blueprint type name is `UiAssetManifest`.
- `externalFragmentResolver` is the `@rntme/ui` compile option and the same field forwarded by blueprint.
- Platform component names consistently use `Platform*`.
