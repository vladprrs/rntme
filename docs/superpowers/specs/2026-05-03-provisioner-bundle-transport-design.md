# Provisioner Bundle Transport — design

**Status:** brainstorming approved, awaiting user review of this spec
**Author:** brainstorm 2026-05-03
**Related:**
- `docs/superpowers/specs/done/2026-05-03-module-provisioner-contract-design.md` — original provisioner contract; this spec refines its §6 resolver detail and transport.
- `docs/superpowers/specs/2026-05-03-project-update-delete-operations-design.md` — delete-flow tearDown re-uses the same resolver and therefore the same bundle re-materialization.

**Implementation locations:**
- Bundle format / digest — `apps/cli/src/bundle/build.ts`
- CLI publish-side asset collection — `apps/cli/src/bundle/`
- Platform-side bundle restoration — `apps/platform-http/src/deploy/executor.ts` (`materializeBundle`)
- Platform-side provisioner resolver — `apps/platform-http/src/app.ts`
- Provisioner contract type — `packages/deploy/deploy-core/src/provision.ts`
- Auth0 reference module — `modules/identity/auth0/`

## 1. Problem

PR #134 ("module provisioner contract") added a `resolveProvisioner` hook on `apps/platform-http/src/app.ts:109`:

```ts
resolveProvisioner: async (packageName: string, entry: string) => {
  const pkg = await import(`${packageName}/${entry.replace(/^\.\//, '')}`);
  return { provision: pkg.provision, tearDown: pkg.tearDown };
}
```

This dynamic `import()` resolves against the platform-http process's own `node_modules`. But:

- The platform-http `package.json` does not depend on any module package (`@rntme/identity-auth0` etc.), and the runtime image is built via `pnpm --filter '@rntme/platform-http...' build`, which only installs declared deps and their transitive closure.
- The canonical project bundle (`apps/cli/src/bundle/build.ts`) only collects `.json` files: provisioner JS code cannot travel inside the bundle either.

Result: every deploy with a provisioner-declaring module fails at the provision stage with `DEPLOY_PROVISION_ENTRY_LOAD_FAILED: Cannot find package '@rntme/identity-auth0' imported from /app/apps/platform-http/dist/app.js`. The provisioner contract feature is shipped but unreachable.

## 2. Goals

Make the platform a generic execution engine for any module's provisioner, regardless of which modules are installed in the platform image:

- Each provisioner-declaring module ships a self-contained ESM bundle of its provisioner code.
- The CLI bundles that file into the canonical project bundle at publish time.
- The platform restores the file to a temp directory at deploy time and `import()`s it from a `file://` URL.
- The contract is symmetric across `provision` and `tearDown` (delete operations re-materialize the relevant deployment's bundle).

## 3. Non-goals

- Sourcemap support for provisioner entries.
- Sandboxing / permission model for arbitrary provisioner JS — same trust boundary as the rest of the deploy bundle (CLI publisher = full project author).
- Updating non-Auth0 identity modules (workos, clerk) in this iteration. They get the new build convention only when their provisioner blocks land.
- Fixing the vars-vs-provisioner architectural mismatch in `demo/notes-blueprint/project.json` (separate spec).
- Fixing the orphan-detect `queued`-sweep gap (separate spec).
- Multi-file provisioner entries (workers, dynamic imports). The contract is one self-contained file.

## 4. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Where is the provisioner's runtime JS produced? | Module side. Each provisioner-declaring module's `pnpm build` runs `esbuild` after `tsc` and produces a self-contained `dist/<name>.entry.js`. |
| D2 | Bundle inclusion | CLI reads the file at `module.json#provisioner.entry` and embeds it in the canonical bundle as base64. |
| D3 | Bundle format | Add a top-level `assets: Record<path, base64>` map. Bump bundle version `1 → 2`. Old `version: 1` bundles remain readable (read as `assets: {}`). |
| D4 | Asset path inside bundle | Synthetic, by convention from `manifest.name`: `assets/provisioners/${safeName(name)}.entry.js`, where `safeName` drops `@` and replaces `/` with `__`. No index map; CLI and platform compute the same path independently. |
| D5 | Platform import resolution | Compute the absolute path inside the materialized `tmpDir` and `import(pathToFileURL(absPath))`. Ignore the original `provisioner.entry` value at runtime; the convention from `manifest.name` is the only source of truth. |
| D6 | Resolver signature | `resolveProvisioner(packageName, entry, projectDir)`. The third arg is the materialized bundle root. `entry` stays in the signature for diagnostics but is unused at runtime. |
| D7 | esbuild externals contract | `--external:node:*` only. All non-built-in imports are inlined. `@rntme/deploy-core` stays as a type-only import in source, gets removed by TSC, never reaches esbuild. |
| D8 | Bundle size cap | 10 MiB total `assets` size, enforced at CLI publish. |
| D9 | Tear-down resolver | The delete executor re-materializes the bundle of the last successful deployment, then uses the same resolver. |
| D10 | Backwards compat | `version: 1` bundles published before this change remain redeployable: their old manifests have no `provisioner` block (the auth0 module copy in those bundles predates PR #134), so provision discovery returns an empty set. |

## 5. Architecture

```
[module]                    [CLI publish]                     [bundle on wire]                [platform deploy]
─────────                   ─────────────                    ──────────────                  ──────────────────
tsc + esbuild               walk discovered modules,         { version: 2,                   materializeBundle:
  → dist/X.entry.js         read provisioner.entry           files: {...},                    – files → JSON tree
                            from local fs,                   assets: {                        – assets → tmpDir bytes
module.json#provisioner     base64 encode,                     "assets/provisioners/
  .entry =                  store under                         <safe>.entry.js": <b64>      resolveProvisioner:
  "./dist/X.entry.js"       assets/provisioners/             } }                              compute path from
                            <safe>.entry.js                                                   manifest.name,
                                                                                              import(pathToFileURL).
```

Convention `<safe>` from `manifest.name`: drop leading `@`, replace `/` with `__`. Example: `@rntme/identity-auth0` → `rntme__identity-auth0`. The function `safeProvisionerName` is exported from `@rntme/blueprint` so CLI and platform share one definition.

## 6. Bundle format

`apps/cli/src/bundle/build.ts`:

```ts
export type CanonicalBundle = {
  readonly version: 2;
  readonly files: Readonly<Record<string, unknown>>;     // JSON, as today
  readonly assets: Readonly<Record<string, string>>;     // base64-encoded bytes
};
```

Canonicalization order: `assets` keys are sorted alphabetically (same as `files`). base64 is a stable string encoding so `canonicalJson(bundle)` remains deterministic. Digest covers both `files` and `assets`.

`version: 1` bundles read at the platform side parse cleanly when `assets` is absent: the platform code defaults to `bundle.assets ?? {}`. CLI never emits `version: 1` after this change.

## 7. CLI publish-side

`buildProjectBundle(folder)` gets a new step after JSON collection:

```ts
const provisionerAssets = collectProvisionerAssets(root, bundleFiles);
if (!provisionerAssets.ok) return provisionerAssets;
const bundle: CanonicalBundle = { version: 2, files: bundleFiles, assets: provisionerAssets.value };
```

`collectProvisionerAssets`:

1. Iterates `bundleFiles` for paths matching `node_modules/<module-dir>/module.json`.
2. Parses each manifest. Skips manifests without a `provisioner` block.
3. For each provisioner block, resolves the entry path: `<root>/<module-dir>/<provisioner.entry>`.
4. If the file does not exist or is not a regular file: returns `BLUEPRINT_PROVISIONER_ENTRY_MISSING` with `{ moduleName, expectedPath }`.
5. Reads bytes, base64-encodes, stores under `assets/provisioners/${safeProvisionerName(manifest.name)}.entry.js`.
6. After all assets collected, sums byte sizes; if > 10 MiB returns `BUNDLE_ASSETS_TOO_LARGE`.

`safeProvisionerName(name)` is moved into `@rntme/blueprint` (or wherever `discoverModules` lives) and re-exported by `@rntme/cli` for use here. Platform imports the same function.

## 8. Platform-side

### 8.1 `materializeBundle`

`apps/platform-http/src/deploy/executor.ts`:

```ts
async function materializeBundle(bundle: CanonicalBundle): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'rntme-deploy-'));
  for (const [relPath, value] of Object.entries(bundle.files)) {
    const path = join(dir, relPath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(value));
  }
  for (const [relPath, base64] of Object.entries(bundle.assets ?? {})) {
    const path = join(dir, relPath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(base64, 'base64'));
  }
  return dir;
}
```

If `bundle.version > 2`, the executor short-circuits with `BUNDLE_VERSION_UNSUPPORTED` before materialization.

### 8.2 `resolveProvisioner`

`apps/platform-http/src/app.ts`:

```ts
resolveProvisioner: async (packageName: string, _entry: string, projectDir: string) => {
  const safeName = safeProvisionerName(packageName);
  const absPath = join(projectDir, 'assets', 'provisioners', `${safeName}.entry.js`);
  if (!existsSync(absPath)) {
    throw provisionError('DEPLOY_PROVISION_BUNDLE_ASSET_MISSING', {
      module: packageName,
      expectedPath: `assets/provisioners/${safeName}.entry.js`,
    });
  }
  const url = pathToFileURL(absPath).href;
  let pkg: { provision?: unknown; tearDown?: unknown };
  try {
    pkg = await import(url);
  } catch (cause) {
    throw provisionError('DEPLOY_PROVISION_ENTRY_LOAD_FAILED', { module: packageName, cause });
  }
  return { provision: pkg.provision as ProvisionFn, tearDown: pkg.tearDown as TearDownFn };
}
```

### 8.3 Resolver signature change in `deploy-core`

`packages/deploy/deploy-core/src/provision.ts`:

```ts
export type RunProvisionersInput = {
  // ... existing fields
  readonly projectDir: string;                       // NEW
  readonly resolveProvisioner: (
    packageName: string,
    entry: string,
    projectDir: string,                              // NEW arg
  ) => Promise<ProvisionerContract>;
};
```

`runProvisioners` passes `input.projectDir` through to `resolveProvisioner`. The deploy executor passes `tmpDir` as `projectDir`.

### 8.4 Tear-down

`runProjectDeleteOperation` in the executor:

1. For each module with `provisionResult` on the last successful deployment, fetch that deployment's bundle blob.
2. Call `materializeBundle(bundle)` to get a per-deployment `tmpDir`.
3. Call `resolveProvisioner(packageName, entry, tmpDir)` and invoke `tearDown(input)`.
4. Clean up `tmpDir` after the call.

The delete-flow tmpDirs are scoped per-call and removed before the operation finalizes, so concurrent delete operations across deployments don't race on directory state.

## 9. Module build convention

A module's `package.json` adds a `build:provisioner` step; the top-level `build` calls it last:

```json
{
  "scripts": {
    "build": "pnpm run build:deps && tsc -p tsconfig.json && pnpm run build:provisioner",
    "build:provisioner": "esbuild dist/provisioner.js --bundle --platform=node --format=esm --target=node20 --external:node:* --outfile=dist/provisioner.entry.js"
  }
}
```

esbuild contract:

- `--platform=node --format=esm --target=node20`: matches the platform's runtime.
- `--external:node:*`: the only allowed externals; built-ins are not inlined.
- `--bundle`: every relative or workspace import is inlined into the entry.
- The provisioner source must keep `@rntme/deploy-core` as a `import type { ... }` only. TSC strips type-only imports during emit, so esbuild never tries to resolve `@rntme/deploy-core` at bundle time.
- A module that imports a runtime workspace package gets that package inlined too. If a future module needs a deliberately external package (e.g. a native add-on), it negotiates a separate spec.

`module.json#provisioner.entry` points to the bundled file: `./dist/provisioner.entry.js`.

`esbuild` is already a workspace devDependency (used by `ui-runtime`); no new top-level dependency is added.

## 10. Auth0 reference implementation

In `modules/identity/auth0/`:

- `package.json`:
  - Add `build:provisioner` script (text above).
  - `build` chains it after `tsc`.
  - `exports`: add `"./provisioner.entry": { "import": "./dist/provisioner.entry.js" }` for symmetry, even though external consumers won't import it directly.
- `module.json`:
  - `provisioner.entry`: `./dist/provisioner.js` → `./dist/provisioner.entry.js`.
- `src/provisioner.ts`:
  - No source change — already correct shape (`import type` from `@rntme/deploy-core`, runtime-only relative imports `./mgmt-client.js`, `./result-shim.js`).

After build, `dist/provisioner.entry.js` is one self-contained file: inlined `mgmt-client` + `result-shim`, only `node:https`/`node:crypto` left as imports.

## 11. Validation and error codes

| Code | Where | When |
|---|---|---|
| `BLUEPRINT_PROVISIONER_ENTRY_MISSING` | CLI publish | `module.json#provisioner.entry` points at a file not on disk. Message includes `manifest.name` and the expected path. |
| `BUNDLE_ASSETS_TOO_LARGE` | CLI publish | Sum of asset bytes exceeds 10 MiB. |
| `DEPLOY_PROVISION_BUNDLE_ASSET_MISSING` | Platform executor | Discovery sees a `provisioner` block, but `assets/provisioners/<safe>.entry.js` is absent in the materialized tmpDir. Message includes `module` and `expectedPath`. Replaces the now-misleading `DEPLOY_PROVISION_ENTRY_LOAD_FAILED` for this specific case. |
| `DEPLOY_PROVISION_ENTRY_LOAD_FAILED` | Platform executor | The asset file exists but `import()` throws (syntax error, missing export). Message wraps `cause.message`. |
| `BUNDLE_VERSION_UNSUPPORTED` | Platform executor | `bundle.version > 2`. v1 is read with `assets = {}`. |

CLI codes register in `apps/cli/src/errors/codes.ts` and map to exit code 2. Platform codes register in `packages/deploy/deploy-core/src/errors.ts` and surface through the existing deployment error pipeline.

## 12. Testing

**CLI unit (`apps/cli/test/unit/bundle/build.test.ts`):**

- bundle with one provisioner module: `assets` contains `assets/provisioners/rntme__identity-auth0.entry.js`; base64 matches `Buffer.from(file).toString('base64')`.
- digest stable across two builds on the same input.
- two modules with provisioners: both assets included, both keys sorted in canonical output.
- module without provisioner block: `assets = {}`.
- entry file missing on disk: `BLUEPRINT_PROVISIONER_ENTRY_MISSING`.
- combined assets > 10 MiB: `BUNDLE_ASSETS_TOO_LARGE`.

**Platform unit (`apps/platform-http/test/unit/deploy/materialize-bundle.test.ts` — new):**

- `materializeBundle` writes asset bytes 1:1 (binary identity).
- old bundle (`version: 1`, no assets): only `files` written.

**Platform unit (`apps/platform-http/test/unit/deploy/resolve-provisioner.test.ts` — new):**

- a tmpDir with `assets/provisioners/test__example.entry.js` containing a minimal ESM `export const provision = () => {}; export const tearDown = () => {};`. `resolveProvisioner('@test/example', './ignored.js', tmpDir)` returns both handlers.
- missing file: `DEPLOY_PROVISION_BUNDLE_ASSET_MISSING`.
- syntactically broken JS: `DEPLOY_PROVISION_ENTRY_LOAD_FAILED` with `cause` populated.

**Auth0 module unit (`modules/identity/auth0/test/unit/provisioner-entry.test.ts` — new):**

- After `pnpm build`, `dist/provisioner.entry.js` exists, exports `provision` and `tearDown` as functions, file size < 500 KB.
- Bundle contains no `import '@rntme/...'` and no `require('@rntme/...')` — verified by grepping the output.

**E2E gated (`apps/platform-http/test/e2e/provisioner-bundle.test.ts` — new, runs with `RNTME_AUTH0_E2E=1`):**

- Publish demo blueprint → fetch the version blob, parse, assert `assets[...]` contains the auth0 entry.
- Run a deployment against a target with the auth0Mgmt secret → `provisionResult.modules['identity'].publicOutputs.spaClient.id` is populated and matches a real Auth0 client retrievable via the management API.
- Run a project delete → tearDown invoked, Auth0 SPA client deleted (verified by `GET /api/v2/clients/{id}` returning 404).

## 13. Documentation touches

The implementation plan must update, in the same PR:

- `apps/cli/README.md` — bundle format v2, new asset section, what gets bundled.
- `apps/platform-http/README.md` — provision stage now resolves from bundle assets, not platform `node_modules`.
- `packages/deploy/deploy-core/README.md` — `resolveProvisioner` signature and the `projectDir` contract.
- `modules/identity/auth0/README.md` — module shipping now requires the `build:provisioner` step.
- `AGENTS.md §6` — add a "How to ship a module with a provisioner" how-to (5–10 lines: declare provisioner block, add `build:provisioner` script, only `node:*` externals, point manifest entry to bundled file).
- Cross-reference from this spec into `docs/superpowers/specs/done/2026-05-03-module-provisioner-contract-design.md`'s §6 ("resolver detail superseded by `2026-05-03-provisioner-bundle-transport-design.md`").
- `docs/superpowers/specs/2026-05-03-project-update-delete-operations-design.md` — add a sentence in §8 noting that delete-flow tearDown re-materializes the bundle.

## 14. Migration

- Pre-existing published bundles (`version: 1`): redeployable. Their copies of the auth0 module manifest predate the provisioner block, so discovery returns no provisioner modules and the provision stage is a no-op.
- New publishes always emit `version: 2`.
- Rollback path: revert the PR. v1 bundles keep working; v2 bundles fail at restore with `BUNDLE_VERSION_UNSUPPORTED` if a v1 platform image picks them up — acceptable because v2 bundles are only emitted after platform-http carries the new code.
- After this lands, the broken state on `notes-demo-v2` (target `dokploy-demos-prov`, project `notes-demo-v2`, Auth0 SPA `oqTqqNchzIDbnhtppvSlZqb2ni7KITnA`) becomes redeployable end-to-end.

## 15. Out-of-scope follow-ups (tracked separately)

- Sourcemap inclusion for provisioner entries.
- Sandboxing / capability model for provisioner code execution.
- `vars`-vs-provisioner architectural mismatch (blueprint vars resolved before provisioner runs; see `rntme_blueprint_vars_vs_provisioner.md` finding).
- `findStaleRunning` extension to sweep stale `queued` deployments (see `rntme_orphan_detect_queued_gap.md` finding).
- Updating `modules/identity/workos/` and `modules/identity/clerk/` to ship provisioner entries when their provisioner blocks land.
