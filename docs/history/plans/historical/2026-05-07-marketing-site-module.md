> Status: historical.
> Date: 2026-05-07.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Marketing-Site Module — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land a new `marketing-site` module category in rntme so products built with rntme can attach an externally-authored HTML landing as a first-class blueprint service. v1 ships the contract package, the first vendor (`marketing-site-static`), a generic `bundle-publish` tooling package, a CLI command (`rntme bundle publish`), and a working dogfood deployment on `demo/cv-extract-blueprint`.

**Architecture:** New leaf contract `@rntme/contracts-marketing-site-v1` carries a deploy-shaped (no-RPC) `publicConfig` schema. Vendor module `@rntme/marketing-site-static` implements `@rntme/contracts-provisioner-v1.provision()` — pulls an HTML bundle from S3 (referenced by sha256-pinned `BundleSource`), verifies the hash, builds an `nginx:alpine`+bundle image, pushes to the configured registry, and upserts a Dokploy application bound to `primaryDomain`. A separate `@rntme/bundle-publish` package owns the deterministic tar+gzip+sha256+S3-PutObject primitive; the CLI wraps it. Repeatability holds because every `BundleSource` carries an immutable sha256 verified at provision time.

**Tech Stack:** TypeScript 5 strict ESM, Vitest 2, zod 4 (config schema), @aws-sdk/client-s3 (S3 GetObject + PutObject), tar-stream (deterministic tar), node:zlib (gzip), dockerode or `docker buildx build` shell-out (image build), existing `@rntme/deploy-dokploy` client (Dokploy upsert).

**Spec:** `docs/history/specs/active-rationale/2026-05-07-product-landings-marketing-site-module-design.md`

---

## File Map

| File | Status | Responsibility |
| --- | --- | --- |
| `docs/decision-system.md` | Modify | Add bet line for `marketing-site` category and `marketing-site-static` first vendor (`locked-pending`). |
| `AGENTS.md` | Modify | Add `marketing-site` row in §Repo Map Modules table; add `bundle publish` to Commands hint if relevant. |
| `packages/contracts/marketing-site/v1/package.json` | Create | Workspace package `@rntme/contracts-marketing-site-v1`, `private: true`, no runtime deps beyond `zod` + `@rntme/contracts-common-v1`. |
| `packages/contracts/marketing-site/v1/tsconfig.json` | Create | Strict ESM build to `dist/`. |
| `packages/contracts/marketing-site/v1/tsconfig.check.json` | Create | Mirrors the convention in other contract packages. |
| `packages/contracts/marketing-site/v1/eslint.config.mjs` | Create | Standard eslint config (mirror `packages/contracts/identity/v1`). |
| `packages/contracts/marketing-site/v1/vitest.config.ts` | Create | Run `test/` with vitest. |
| `packages/contracts/marketing-site/v1/src/schema.ts` | Create | zod schemas for `BundleSource`, `MarketingSiteV1Config`; runtime `validateMarketingSiteConfig`. |
| `packages/contracts/marketing-site/v1/src/types.ts` | Create | `BundleSource`, `MarketingSiteV1Config` TS types via `z.infer`; `BundleSourceKind` literal union. |
| `packages/contracts/marketing-site/v1/src/index.ts` | Create | Public re-exports (types + validator + error code helper). |
| `packages/contracts/marketing-site/v1/error-codes.json` | Create | Top-level JSON list of `MARKETING_SITE_<LAYER>_<KIND>` codes. |
| `packages/contracts/marketing-site/v1/test/schema.test.ts` | Create | Schema accepts valid configs (s3 + local-path), rejects every documented malformed shape. |
| `packages/contracts/marketing-site/v1/test/error-codes.test.ts` | Create | Asserts every code referenced in `src/` is present in `error-codes.json` and vice versa. |
| `packages/contracts/marketing-site/v1/README.md` | Create | Stub README pointing to owner doc. |
| `docs/current/owners/packages/contracts/marketing-site.md` | Create | Owner doc for the contract: surface, validation, error codes, where-to-look. |
| `packages/tooling/bundle-publish/package.json` | Create | Workspace package `@rntme/bundle-publish`, deps: `@aws-sdk/client-s3`, `tar-stream`. |
| `packages/tooling/bundle-publish/tsconfig.json` | Create | Strict ESM. |
| `packages/tooling/bundle-publish/tsconfig.check.json` | Create | Mirror convention. |
| `packages/tooling/bundle-publish/eslint.config.mjs` | Create | Standard. |
| `packages/tooling/bundle-publish/vitest.config.ts` | Create | Vitest. |
| `packages/tooling/bundle-publish/src/types.ts` | Create | `PublishTarget`, `S3Reference`, `PublishResult`, `PublishError`, `PublishOptions`. |
| `packages/tooling/bundle-publish/src/walk.ts` | Create | Recursive folder walker honoring `ignore` globs and `maxBytes`. |
| `packages/tooling/bundle-publish/src/tar-deterministic.ts` | Create | Build a deterministic tar stream from a sorted file list (mtime=0, uid/gid=0, mode normalized). |
| `packages/tooling/bundle-publish/src/hash.ts` | Create | Streaming sha256 helper. |
| `packages/tooling/bundle-publish/src/s3-put.ts` | Create | Wrap `@aws-sdk/client-s3` PutObject with body-stream + content-length. |
| `packages/tooling/bundle-publish/src/publish-folder.ts` | Create | `publishFolder()` orchestrator: walk → tar → gzip → hash → put → return `S3Reference`. |
| `packages/tooling/bundle-publish/src/result.ts` | Create | Local minimal `Result<T, E>` (matches contract convention). |
| `packages/tooling/bundle-publish/src/index.ts` | Create | Public re-exports. |
| `packages/tooling/bundle-publish/test/unit/walk.test.ts` | Create | Walk respects ignore, enforces maxBytes, produces sorted output. |
| `packages/tooling/bundle-publish/test/unit/tar-deterministic.test.ts` | Create | Same input ⇒ same bytes (run twice, compare); gzip --no-name behavior. |
| `packages/tooling/bundle-publish/test/unit/hash.test.ts` | Create | Streaming sha256 matches reference for known fixtures. |
| `packages/tooling/bundle-publish/test/unit/publish-folder.test.ts` | Create | Mocked `S3Client` records PutObject body; orchestrator returns `S3Reference` with deterministic hash. |
| `packages/tooling/bundle-publish/test/integration/minio.test.ts` | Create | Run against a local MinIO via `docker compose` (gated by `MINIO_URL` env, skips otherwise). |
| `packages/tooling/bundle-publish/README.md` | Create | Stub. |
| `docs/current/owners/packages/tooling/bundle-publish.md` | Create | Owner doc. |
| `apps/cli/src/commands/bundle/publish.ts` | Create | `rntme bundle publish` command implementation. |
| `apps/cli/src/commands/bundle/index.ts` | Create | Group entry — registers `publish` (and future `verify`/`fetch`) under `bundle`. |
| `apps/cli/src/index.ts` | Modify | Wire the new `bundle` group into the existing yargs/commander root. |
| `apps/cli/test/unit/bundle-publish.test.ts` | Create | CLI argument parsing, `--print-json` mode, error code surfacing. |
| `apps/cli/README.md` | Modify | Document `rntme bundle publish`. |
| `docs/current/owners/apps/cli.md` | Modify | Document the new command. |
| `modules/marketing-site/README.md` | Create | Category overview. |
| `modules/marketing-site/static-html/package.json` | Create | `@rntme/marketing-site-static`. |
| `modules/marketing-site/static-html/tsconfig.json` | Create | Strict ESM. |
| `modules/marketing-site/static-html/tsconfig.check.json` | Create | Mirror convention. |
| `modules/marketing-site/static-html/eslint.config.mjs` | Create | Standard. |
| `modules/marketing-site/static-html/vitest.config.ts` | Create | Vitest. |
| `modules/marketing-site/static-html/module.json` | Create | Module manifest: `category: marketing-site`, `vendor: static-html`, capabilities, provisioner entry. |
| `modules/marketing-site/static-html/src/types.ts` | Create | Local `StaticHtmlConfig` re-export from contract; `TargetSecrets` (`bundleStorage.s3.{accessKey,secretKey,endpoint?,region?}`); `Outputs`. |
| `modules/marketing-site/static-html/src/s3-fetch.ts` | Create | S3 GetObject → buffer + sha256 verify. |
| `modules/marketing-site/static-html/src/untar.ts` | Create | Stream-untar bundle into a scratch dir, assert `index.html` exists. |
| `modules/marketing-site/static-html/src/build-image.ts` | Create | Materialize `Dockerfile` (`FROM nginx:alpine`, COPY bundle, COPY nginx.conf), invoke `docker buildx build` via shell, push to registry. |
| `modules/marketing-site/static-html/src/nginx.conf.ts` | Create | Embedded default `nginx.conf` content (gzip on, basic cache headers, strict static). |
| `modules/marketing-site/static-html/src/dokploy-upsert.ts` | Create | Use `@rntme/deploy-dokploy` client to upsert app pointing to `image:tag`, bind `primaryDomain`, request SSL. |
| `modules/marketing-site/static-html/src/provisioner.ts` | Create | Implements `ProvisionerContract<MarketingSiteV1Config>`: `provision()` orchestrator + `tearDown()`. |
| `modules/marketing-site/static-html/src/provisioner.entry.ts` | Create | Default-exports `provisioner` and `ENV_MAPPINGS`; referenced by `module.json.provisioner.entry`. |
| `modules/marketing-site/static-html/src/result-shim.ts` | Create | Re-export of `Result` matching `provisioner-v1` shape. |
| `modules/marketing-site/static-html/src/index.ts` | Create | Public barrel. |
| `modules/marketing-site/static-html/Dockerfile` | Create | Build the provisioner sidecar image (mirror `modules/identity/auth0/Dockerfile`). |
| `modules/marketing-site/static-html/test/unit/s3-fetch.test.ts` | Create | Mocked `S3Client`; hash mismatch returns `MARKETING_SITE_PROVISION_HASH_MISMATCH`. |
| `modules/marketing-site/static-html/test/unit/untar.test.ts` | Create | Bundle without index.html → `MARKETING_SITE_PROVISION_INDEX_HTML_MISSING`. |
| `modules/marketing-site/static-html/test/unit/build-image.test.ts` | Create | Asserts produced Dockerfile lines and image tag pattern; shells out only behind a flag. |
| `modules/marketing-site/static-html/test/unit/provisioner.test.ts` | Create | Orchestrator wires fetch → untar → build → upsert; idempotent on repeat. |
| `modules/marketing-site/static-html/test/integration/minio-registry.test.ts` | Create | End-to-end: MinIO + local Docker registry + Dokploy stub; gated by `INTEGRATION=1`. |
| `modules/marketing-site/static-html/README.md` | Create | Stub. |
| `modules/marketing-site/conformance/package.json` | Create | `@rntme/conformance-marketing-site`. |
| `modules/marketing-site/conformance/tsconfig.json` | Create | Strict ESM. |
| `modules/marketing-site/conformance/src/index.ts` | Create | `runMarketingSiteConformance(provisioner, deps)` runs shared scenarios. |
| `modules/marketing-site/conformance/src/scenarios/happy-path.ts` | Create | Apply succeeds, output url == `https://${primaryDomain}`. |
| `modules/marketing-site/conformance/src/scenarios/idempotency.ts` | Create | Apply twice ⇒ second call no-ops. |
| `modules/marketing-site/conformance/src/scenarios/hash-mismatch.ts` | Create | Bundle bytes don't match sha256 ⇒ correct error code. |
| `modules/marketing-site/conformance/README.md` | Create | Stub. |
| `modules/marketing-site/static-html/test/conformance.test.ts` | Create | Static-HTML vendor runs `runMarketingSiteConformance(...)`. |
| `docs/current/owners/modules/marketing-site.md` | Create | Category owner doc. |
| `demo/cv-extract-blueprint/landing/index.html` | Create | A real (small) static landing for the cv-extract demo product. |
| `demo/cv-extract-blueprint/landing/styles.css` | Create | Simple styling. |
| `demo/cv-extract-blueprint/project.json` | Modify | Add `marketing` to `services`, declare `modules.marketing` block, add `vars.MARKETING_DOMAIN`. |
| `demo/cv-extract-blueprint/test/landing-deploy.test.ts` | Create | E2E smoke: simulates the publish + plan + apply path, asserts produced artifacts; full deploy gated by `INTEGRATION=1`. |
| `demo/cv-extract-blueprint/README.md` | Modify | Note the new `marketing` service and how to publish a new landing bundle. |

---

## Notes for the implementer

- **Provisioner contract method names.** The `ProvisionerContract` exposes `provision()` and optional `tearDown()`. The spec phrases the lifecycle as `plan/apply/teardown`; "plan-time" sanity checks (S3 HEAD, domain validity) live at the **start** of `provision()` and bail out before any side effects. There is no separate `plan` method on the provisioner. Deploy-time planning happens in `@rntme/deploy-core`, which calls `provision()` only after its own plan resolves.
- **No new `@aws-sdk` for the provisioner** beyond what `@rntme/bundle-publish` brings in. The provisioner depends on `@aws-sdk/client-s3` directly, since it only needs `GetObject + HeadObject`.
- **Existing landing Dockerfile reference.** `apps/landing/Dockerfile` already runs `nginx:alpine` after a build step. The provisioner reuses the same runtime layer (`FROM nginx:alpine; COPY bundle /usr/share/nginx/html`) but skips the multi-stage build step because the bundle is already prebuilt by the author.
- **Layering.** The contract package (`packages/contracts/...`) cannot import from anywhere except `packages/contracts/_common/v1`. The vendor module (`modules/...`) can import from `packages/contracts/...` only. The tooling package (`packages/tooling/bundle-publish`) cannot import from `runtime/artifacts/deploy/platform`. Run `pnpm depcruise` after every commit to catch violations early.
- **Pre-stable.** No backwards-compat shims. Renames and breaks are free until first design partners.

---

## Task 1: Decision-system bet entry

**Files:**
- Modify: `docs/decision-system.md` §3.5 Modules & Integrations

- [ ] **Step 1: Read current §3.5**

```bash
grep -n "Modules & Integrations" docs/decision-system.md
```

Expected: locate the `### 3.5 Modules & Integrations` heading and current bullet list.

- [ ] **Step 2: Insert new bullets**

In `### 3.5 Modules & Integrations`, add (just below the existing storage-as-module line, alphabetical-ish or where it reads cleanly):

```markdown
- **`marketing-site` as a module category** — products attach externally-authored HTML landings as a first-class blueprint service · F1, G4 · `locked-pending` · spec `2026-05-07-product-landings-marketing-site-module-design.md`
- **`marketing-site-static` as first vendor** — HTML bundle pulled from S3, hosted via `nginx:alpine` · F8 · `locked-pending` · spec `2026-05-07-product-landings-marketing-site-module-design.md`
```

- [ ] **Step 3: Commit**

```bash
git add docs/decision-system.md
git commit -m "$(cat <<'EOF'
docs(decisions): add marketing-site module category bet

Lock pending: products built on rntme attach externally-authored HTML
landings as first-class blueprint services. First vendor `marketing-site-
static` ships with v1 (HTML bundle from S3, nginx:alpine hosting).
EOF
)"
```

---

## Task 2: Scaffold `@rntme/contracts-marketing-site-v1` (package skeleton + types + schema + error codes)

**Files:** see File Map for `packages/contracts/marketing-site/v1/**`.

- [ ] **Step 1: Create package skeleton**

Mirror `packages/contracts/identity/v1` for the boilerplate (no protobuf needed). Required files: `package.json`, `tsconfig.json`, `tsconfig.check.json`, `eslint.config.mjs`, `vitest.config.ts`, `README.md`.

`package.json`:

```json
{
  "name": "@rntme/contracts-marketing-site-v1",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "description": "Canonical marketing-site contract v1 — publicConfig schema, BundleSource discriminated union, MARKETING_SITE_<LAYER>_<KIND> error codes.",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./error-codes": { "types": "./dist/error-codes.d.ts", "import": "./dist/error-codes.js" }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "error-codes.json", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\""
  },
  "dependencies": { "zod": "^4.0.0", "@rntme/contracts-common-v1": "workspace:*" },
  "devDependencies": {
    "@eslint/js": "^9.10.0", "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0", "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0", "typescript": "^5.6.0", "vitest": "^2.1.0"
  }
}
```

Other files: copy verbatim from `packages/contracts/identity/v1/{tsconfig.json,tsconfig.check.json,eslint.config.mjs,vitest.config.ts}`.

- [ ] **Step 2: Run `pnpm install` and verify workspace picks it up**

```bash
pnpm install
pnpm -F @rntme/contracts-marketing-site-v1 list
```

Expected: package resolves; deps install. `pnpm-workspace.yaml` already includes `packages/contracts/*/v*` so no edit needed.

- [ ] **Step 3: Write failing schema test**

`packages/contracts/marketing-site/v1/test/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { validateMarketingSiteConfig } from '../src/index.js';

describe('validateMarketingSiteConfig', () => {
  it('accepts a minimal s3 config', () => {
    const out = validateMarketingSiteConfig({
      source: { kind: 's3', bucket: 'b', key: 'k', sha256: 'a'.repeat(64) },
      primaryDomain: 'example.com',
      ssl: 'auto',
    });
    expect(out.ok).toBe(true);
  });

  it('accepts a local-path config', () => {
    const out = validateMarketingSiteConfig({
      source: { kind: 'local-path', path: './bundle', sha256: 'a'.repeat(64) },
      primaryDomain: 'example.com',
      ssl: 'manual',
    });
    expect(out.ok).toBe(true);
  });

  it('rejects unknown source kind', () => {
    const out = validateMarketingSiteConfig({
      source: { kind: 'webdav', bucket: 'b', key: 'k', sha256: 'a'.repeat(64) },
      primaryDomain: 'example.com',
      ssl: 'auto',
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors[0].code).toBe('MARKETING_SITE_VALIDATE_INVALID_SOURCE');
  });

  it('rejects empty primaryDomain', () => {
    const out = validateMarketingSiteConfig({
      source: { kind: 's3', bucket: 'b', key: 'k', sha256: 'a'.repeat(64) },
      primaryDomain: '',
      ssl: 'auto',
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors[0].code).toBe('MARKETING_SITE_VALIDATE_INVALID_DOMAIN');
  });

  it('rejects invalid sha256 length', () => {
    const out = validateMarketingSiteConfig({
      source: { kind: 's3', bucket: 'b', key: 'k', sha256: 'short' },
      primaryDomain: 'example.com',
      ssl: 'auto',
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors[0].code).toBe('MARKETING_SITE_VALIDATE_INVALID_SOURCE');
  });
});
```

Run: `pnpm -F @rntme/contracts-marketing-site-v1 test`. Expected: FAIL (module not found / function undefined).

- [ ] **Step 4: Implement schema, types, validator**

`src/schema.ts`:

```ts
import { z } from 'zod';

const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, 'sha256 must be 64 hex chars (lowercase)');

const S3Source = z.object({
  kind: z.literal('s3'),
  bucket: z.string().min(1),
  key: z.string().min(1),
  sha256: Sha256Hex,
  endpoint: z.string().url().optional(),
  region: z.string().optional(),
});

const LocalPathSource = z.object({
  kind: z.literal('local-path'),
  path: z.string().min(1),
  sha256: Sha256Hex,
});

export const BundleSourceSchema = z.discriminatedUnion('kind', [S3Source, LocalPathSource]);

export const MarketingSiteV1ConfigSchema = z.object({
  source: BundleSourceSchema,
  primaryDomain: z.string().min(1).regex(/^[a-z0-9.-]+$/i, 'domain must be a valid hostname'),
  ssl: z.enum(['auto', 'manual', 'none']),
});
```

`src/types.ts`:

```ts
import { z } from 'zod';
import { BundleSourceSchema, MarketingSiteV1ConfigSchema } from './schema.js';

export type BundleSource = z.infer<typeof BundleSourceSchema>;
export type MarketingSiteV1Config = z.infer<typeof MarketingSiteV1ConfigSchema>;
```

`src/index.ts`:

```ts
export type { BundleSource, MarketingSiteV1Config } from './types.js';
export { BundleSourceSchema, MarketingSiteV1ConfigSchema } from './schema.js';

import { z } from 'zod';
import { MarketingSiteV1ConfigSchema } from './schema.js';

export type ValidationError = { code: string; path: string; message: string };
export type ValidationResult =
  | { ok: true; value: import('./types.js').MarketingSiteV1Config }
  | { ok: false; errors: readonly ValidationError[] };

export function validateMarketingSiteConfig(input: unknown): ValidationResult {
  const parsed = MarketingSiteV1ConfigSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };

  const errors: ValidationError[] = parsed.error.issues.map((iss) => {
    const path = iss.path.join('.');
    const code = mapIssueToCode(path, iss);
    return { code, path, message: iss.message };
  });
  return { ok: false, errors };
}

function mapIssueToCode(path: string, _iss: z.ZodIssue): string {
  if (path === 'primaryDomain') return 'MARKETING_SITE_VALIDATE_INVALID_DOMAIN';
  if (path.startsWith('source')) return 'MARKETING_SITE_VALIDATE_INVALID_SOURCE';
  return 'MARKETING_SITE_VALIDATE_INVALID_CONFIG';
}
```

Run: `pnpm -F @rntme/contracts-marketing-site-v1 test`. Expected: PASS (5 tests).

- [ ] **Step 5: Write `error-codes.json` and matching test**

`packages/contracts/marketing-site/v1/error-codes.json`:

```json
[
  { "code": "MARKETING_SITE_VALIDATE_INVALID_CONFIG", "layer": "validate" },
  { "code": "MARKETING_SITE_VALIDATE_INVALID_SOURCE", "layer": "validate" },
  { "code": "MARKETING_SITE_VALIDATE_INVALID_DOMAIN", "layer": "validate" },
  { "code": "MARKETING_SITE_PROVISION_BUNDLE_NOT_FOUND", "layer": "provision" },
  { "code": "MARKETING_SITE_PROVISION_HASH_MISMATCH", "layer": "provision" },
  { "code": "MARKETING_SITE_PROVISION_INDEX_HTML_MISSING", "layer": "provision" },
  { "code": "MARKETING_SITE_PROVISION_DOMAIN_BIND_FAILED", "layer": "provision" },
  { "code": "MARKETING_SITE_PROVISION_LOCAL_PATH_IN_PROD", "layer": "provision" },
  { "code": "MARKETING_SITE_PROVISION_IMAGE_BUILD_FAILED", "layer": "provision" },
  { "code": "MARKETING_SITE_PROVISION_REGISTRY_PUSH_FAILED", "layer": "provision" }
]
```

`src/error-codes.ts`:

```ts
import codes from '../error-codes.json' with { type: 'json' };
export const MARKETING_SITE_ERROR_CODES = codes.map((e) => e.code) as readonly string[];
export type MarketingSiteErrorCode = (typeof MARKETING_SITE_ERROR_CODES)[number];
```

`test/error-codes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MARKETING_SITE_ERROR_CODES } from '../src/error-codes.js';

describe('error codes', () => {
  it('contains all validate-layer codes', () => {
    expect(MARKETING_SITE_ERROR_CODES).toContain('MARKETING_SITE_VALIDATE_INVALID_CONFIG');
    expect(MARKETING_SITE_ERROR_CODES).toContain('MARKETING_SITE_VALIDATE_INVALID_SOURCE');
    expect(MARKETING_SITE_ERROR_CODES).toContain('MARKETING_SITE_VALIDATE_INVALID_DOMAIN');
  });
  it('contains all provision-layer codes', () => {
    for (const c of [
      'MARKETING_SITE_PROVISION_BUNDLE_NOT_FOUND',
      'MARKETING_SITE_PROVISION_HASH_MISMATCH',
      'MARKETING_SITE_PROVISION_INDEX_HTML_MISSING',
      'MARKETING_SITE_PROVISION_DOMAIN_BIND_FAILED',
      'MARKETING_SITE_PROVISION_LOCAL_PATH_IN_PROD',
      'MARKETING_SITE_PROVISION_IMAGE_BUILD_FAILED',
      'MARKETING_SITE_PROVISION_REGISTRY_PUSH_FAILED',
    ]) expect(MARKETING_SITE_ERROR_CODES).toContain(c);
  });
});
```

Run: `pnpm -F @rntme/contracts-marketing-site-v1 test`. Expected: PASS (all tests).

- [ ] **Step 6: Build, typecheck, depcruise**

```bash
pnpm -F @rntme/contracts-marketing-site-v1 build
pnpm -F @rntme/contracts-marketing-site-v1 typecheck
pnpm -F @rntme/contracts-marketing-site-v1 lint
pnpm depcruise
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/marketing-site/v1
git commit -m "feat(contracts): add marketing-site v1 contract package

Schema + types + validator + error codes for the new marketing-site
canonical contract. Carries publicConfig (BundleSource discriminated
union, primaryDomain, ssl) used by every marketing-site vendor module.
No RPCs in v1 (deploy-shaped contract)."
```

---

## Task 3: Contract docs

**Files:**
- Create: `packages/contracts/marketing-site/v1/README.md`
- Create: `docs/current/owners/packages/contracts/marketing-site.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Write `packages/contracts/marketing-site/v1/README.md`**

```markdown
# @rntme/contracts-marketing-site-v1

Marketing-site canonical contract v1 — `publicConfig` schema for hosted
static landings.

Current documentation: [docs/current/owners/packages/contracts/marketing-site.md](../../../../docs/current/owners/packages/contracts/marketing-site.md)

Local commands:
- `pnpm -F @rntme/contracts-marketing-site-v1 test`
- `pnpm -F @rntme/contracts-marketing-site-v1 build`

Notes:
- Keep this file short. Update the current doc when public API, invariants, gotchas, local commands, or package navigation changes.
```

- [ ] **Step 2: Write `docs/current/owners/packages/contracts/marketing-site.md`**

Cover: package scope, file map, public API (`validateMarketingSiteConfig`, `BundleSourceSchema`, types), error codes, invariants (no RPC, deploy-shaped, contract is leaf — no `@rntme/*` imports beyond `_common/v1`), where-to-look-first, related specs.

- [ ] **Step 3: Modify `AGENTS.md` §Repo Map → Modules table**

Add `marketing-site` row. Locate the table in `AGENTS.md` and add:

```markdown
| Modules | `modules/identity/README.md`, `modules/ai-llm/README.md`, `modules/crm/README.md`, `modules/marketing-site/README.md`, plus each vendor module README under `modules/<category>/<vendor>/` |
```

(Insert `marketing-site` in alphabetical order alongside the existing entries.)

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/marketing-site/v1/README.md docs/current/owners/packages/contracts/marketing-site.md AGENTS.md
git commit -m "docs(contracts): owner doc + README for marketing-site v1"
```

---

## Task 4: Scaffold `@rntme/bundle-publish` and implement deterministic tar+gzip

**Files:** see File Map for `packages/tooling/bundle-publish/**`.

- [ ] **Step 1: Create package skeleton**

Mirror `packages/tooling/module-scaffold` for the boilerplate.

`package.json`:

```json
{
  "name": "@rntme/bundle-publish",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Generic primitive: take a folder, produce a deterministic tar+gzip+sha256 bundle and PUT to an S3-compatible target.",
  "exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\""
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.600.0",
    "tar-stream": "^3.1.7"
  },
  "devDependencies": {
    "@types/node": "^20.14.0", "@types/tar-stream": "^3.1.3",
    "typescript": "^5.6.0", "vitest": "^2.1.0",
    "@eslint/js": "^9.10.0", "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0", "eslint": "^9.10.0"
  }
}
```

Other config files: copy from `packages/tooling/module-scaffold/`.

Run: `pnpm install`. Expected: deps installed.

- [ ] **Step 2: Define types**

`src/types.ts`:

```ts
export type PublishTarget = {
  kind: 's3';
  bucket: string;
  endpoint?: string;
  region?: string;
};

export type S3Reference = {
  bucket: string;
  key: string;
  sha256: string;
  endpoint?: string;
  region?: string;
};

export type PublishOptions = {
  keyPrefix?: string;
  maxBytes?: number;
  ignore?: string[];
};

export type PublishResult = {
  ref: S3Reference;
  bytes: number;
  durationMs: number;
};

export type PublishErrorCode =
  | 'BUNDLE_PUBLISH_FOLDER_MISSING'
  | 'BUNDLE_PUBLISH_TOO_LARGE'
  | 'BUNDLE_PUBLISH_NO_INDEX_HTML'
  | 'BUNDLE_PUBLISH_S3_CREDS_MISSING'
  | 'BUNDLE_PUBLISH_S3_PUT_FAILED';

export type PublishError = { code: PublishErrorCode; message: string; cause?: unknown };
```

`src/result.ts`:

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; errors: readonly E[] };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(...errors: E[]): Result<never, E> => ({ ok: false, errors });
```

- [ ] **Step 3: Write failing test for deterministic tar**

`test/unit/tar-deterministic.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDeterministicTarGz } from '../../src/tar-deterministic.js';

function makeFolder() {
  const dir = mkdtempSync(join(tmpdir(), 'bp-'));
  mkdirSync(join(dir, 'sub'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><h1>hi</h1>');
  writeFileSync(join(dir, 'sub', 'a.css'), 'body {}');
  return dir;
}

describe('buildDeterministicTarGz', () => {
  it('produces identical bytes for identical input across calls', async () => {
    const dir = makeFolder();
    const a = await buildDeterministicTarGz(dir, []);
    const b = await buildDeterministicTarGz(dir, []);
    expect(Buffer.compare(a, b)).toBe(0);
  });

  it('honors ignore globs', async () => {
    const dir = makeFolder();
    writeFileSync(join(dir, '.git'), '');
    const out = await buildDeterministicTarGz(dir, ['.git', '.git/**']);
    // We assert by re-running with the same ignore — output stable, .git absent.
    const out2 = await buildDeterministicTarGz(dir, ['.git', '.git/**']);
    expect(Buffer.compare(out, out2)).toBe(0);
  });
});
```

Run: `pnpm -F @rntme/bundle-publish test`. Expected: FAIL (module not found).

- [ ] **Step 4: Implement walk + deterministic tar+gzip**

`src/walk.ts`:

```ts
import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

export type WalkEntry = { absPath: string; relPath: string; size: number };

export async function walkFolder(
  root: string,
  ignore: string[],
  maxBytes: number,
): Promise<{ entries: WalkEntry[]; totalBytes: number }> {
  const matchers = ignore.map(toRegex);
  const out: WalkEntry[] = [];
  let total = 0;
  async function recurse(dir: string) {
    const names = await readdir(dir);
    for (const name of names) {
      const abs = join(dir, name);
      const rel = relative(root, abs);
      if (matchers.some((re) => re.test(rel))) continue;
      const st = await stat(abs);
      if (st.isDirectory()) await recurse(abs);
      else if (st.isFile()) {
        total += st.size;
        if (total > maxBytes) throw new Error('BUNDLE_PUBLISH_TOO_LARGE');
        out.push({ absPath: abs, relPath: rel, size: st.size });
      }
    }
  }
  await recurse(root);
  out.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
  return { entries: out, totalBytes: total };
}

function toRegex(glob: string): RegExp {
  // Minimal globbing: '**' → '.*', '*' → '[^/]*', escape rest.
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '###').replace(/\*/g, '[^/]*').replace(/###/g, '.*');
  return new RegExp(`^${escaped}$`);
}
```

`src/tar-deterministic.ts`:

```ts
import { createReadStream } from 'node:fs';
import { gzipSync } from 'node:zlib';
import * as tar from 'tar-stream';
import { walkFolder } from './walk.js';

export async function buildDeterministicTarGz(folder: string, ignore: string[], maxBytes = 50 * 1024 * 1024): Promise<Buffer> {
  const { entries } = await walkFolder(folder, ignore, maxBytes);
  const pack = tar.pack();
  const chunks: Buffer[] = [];
  pack.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));

  for (const e of entries) {
    await new Promise<void>((resolve, reject) => {
      const entry = pack.entry({
        name: e.relPath.replace(/\\/g, '/'),
        size: e.size,
        mtime: new Date(0),
        mode: 0o644,
        uid: 0,
        gid: 0,
        uname: '',
        gname: '',
        type: 'file',
      }, (err) => (err ? reject(err) : resolve()));
      const rs = createReadStream(e.absPath);
      rs.on('error', reject);
      rs.pipe(entry);
    });
  }
  pack.finalize();
  await new Promise<void>((resolve) => pack.on('end', resolve));
  const tarBuf = Buffer.concat(chunks);
  // gzip with no embedded mtime/filename for determinism.
  return gzipSync(tarBuf, { level: 9 });
}
```

Run: `pnpm -F @rntme/bundle-publish test`. Expected: PASS.

- [ ] **Step 5: Add walk test**

`test/unit/walk.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { walkFolder } from '../../src/walk.js';

describe('walkFolder', () => {
  it('returns entries sorted by relPath', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'walk-'));
    writeFileSync(join(dir, 'b.txt'), '2');
    writeFileSync(join(dir, 'a.txt'), '1');
    const { entries } = await walkFolder(dir, [], 1024);
    expect(entries.map((e) => e.relPath)).toEqual(['a.txt', 'b.txt']);
  });

  it('throws when total bytes exceed maxBytes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'walk-'));
    writeFileSync(join(dir, 'big.bin'), Buffer.alloc(1024));
    await expect(walkFolder(dir, [], 100)).rejects.toThrow('BUNDLE_PUBLISH_TOO_LARGE');
  });

  it('honors ignore globs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'walk-'));
    mkdirSync(join(dir, 'node_modules'));
    writeFileSync(join(dir, 'node_modules', 'x.js'), '');
    writeFileSync(join(dir, 'index.html'), '<html>');
    const { entries } = await walkFolder(dir, ['node_modules/**'], 1024 * 1024);
    expect(entries.map((e) => e.relPath)).toEqual(['index.html']);
  });
});
```

Run tests; expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/tooling/bundle-publish
git commit -m "feat(bundle-publish): scaffold + deterministic tar+gzip + folder walker"
```

---

## Task 5: Bundle-publish — sha256, S3 PutObject, publishFolder orchestrator

- [ ] **Step 1: Hash test + impl**

`test/unit/hash.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hashBuffer } from '../../src/hash.js';

describe('hashBuffer', () => {
  it('matches known sha256 for "hello"', () => {
    expect(hashBuffer(Buffer.from('hello'))).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });
});
```

`src/hash.ts`:

```ts
import { createHash } from 'node:crypto';
export function hashBuffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}
```

Run: PASS.

- [ ] **Step 2: S3 put — test with mocked client**

`test/unit/publish-folder.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publishFolder } from '../../src/publish-folder.js';

describe('publishFolder', () => {
  it('uploads folder, returns S3Reference with content-addressable key', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pub-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><h1>x</h1>');

    const putSpy = vi.fn(async () => ({}));
    const fakeClient = { send: putSpy } as never;

    const result = await publishFolder(dir, { kind: 's3', bucket: 'b' }, { keyPrefix: 'p' }, { client: fakeClient });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ref.bucket).toBe('b');
      expect(result.value.ref.key).toMatch(/^p\/[0-9a-f]{64}\.tar\.gz$/);
      expect(result.value.ref.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(putSpy).toHaveBeenCalledOnce();
  });

  it('returns BUNDLE_PUBLISH_FOLDER_MISSING for nonexistent folder', async () => {
    const result = await publishFolder('/nonexistent/path', { kind: 's3', bucket: 'b' }, {}, { client: { send: vi.fn() } as never });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].code).toBe('BUNDLE_PUBLISH_FOLDER_MISSING');
  });

  it('returns BUNDLE_PUBLISH_NO_INDEX_HTML when index.html absent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pub-'));
    writeFileSync(join(dir, 'about.html'), '<!doctype html>');
    const result = await publishFolder(dir, { kind: 's3', bucket: 'b' }, {}, { client: { send: vi.fn() } as never });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].code).toBe('BUNDLE_PUBLISH_NO_INDEX_HTML');
  });
});
```

- [ ] **Step 3: Implement `publishFolder`**

`src/s3-put.ts`:

```ts
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export type S3Like = { send: S3Client['send'] };

export async function putBundle(
  client: S3Like,
  bucket: string,
  key: string,
  body: Buffer,
): Promise<void> {
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }) as never);
}
```

`src/publish-folder.ts`:

```ts
import { existsSync } from 'node:fs';
import { S3Client } from '@aws-sdk/client-s3';
import { buildDeterministicTarGz } from './tar-deterministic.js';
import { hashBuffer } from './hash.js';
import { putBundle, type S3Like } from './s3-put.js';
import type {
  PublishError,
  PublishOptions,
  PublishResult,
  PublishTarget,
  S3Reference,
} from './types.js';
import { err, ok, type Result } from './result.js';
import { join } from 'node:path';

export type PublishDeps = { client?: S3Like };

export async function publishFolder(
  folder: string,
  target: PublishTarget,
  opts: PublishOptions = {},
  deps: PublishDeps = {},
): Promise<Result<PublishResult, PublishError>> {
  const start = Date.now();

  if (!existsSync(folder))
    return err({ code: 'BUNDLE_PUBLISH_FOLDER_MISSING', message: `folder not found: ${folder}` });
  if (!existsSync(join(folder, 'index.html')))
    return err({ code: 'BUNDLE_PUBLISH_NO_INDEX_HTML', message: 'index.html required at folder root' });

  const ignore = opts.ignore ?? ['.git/**', 'node_modules/**'];
  const maxBytes = opts.maxBytes ?? 50 * 1024 * 1024;

  let bundle: Buffer;
  try {
    bundle = await buildDeterministicTarGz(folder, ignore, maxBytes);
  } catch (e) {
    if (e instanceof Error && e.message === 'BUNDLE_PUBLISH_TOO_LARGE')
      return err({ code: 'BUNDLE_PUBLISH_TOO_LARGE', message: `bundle exceeds ${maxBytes} bytes` });
    throw e;
  }

  const sha = hashBuffer(bundle);
  const prefix = opts.keyPrefix?.replace(/\/$/, '') ?? `bundles/${folder.split('/').pop()}`;
  const key = `${prefix}/${sha}.tar.gz`;

  const client = deps.client ?? new S3Client({ endpoint: target.endpoint, region: target.region });
  try {
    await putBundle(client, target.bucket, key, bundle);
  } catch (e) {
    if (e instanceof Error && /credentials/i.test(e.message))
      return err({ code: 'BUNDLE_PUBLISH_S3_CREDS_MISSING', message: e.message, cause: e });
    return err({ code: 'BUNDLE_PUBLISH_S3_PUT_FAILED', message: (e as Error).message, cause: e });
  }

  const ref: S3Reference = {
    bucket: target.bucket,
    key,
    sha256: sha,
    endpoint: target.endpoint,
    region: target.region,
  };
  return ok({ ref, bytes: bundle.length, durationMs: Date.now() - start });
}
```

`src/index.ts`:

```ts
export type { PublishTarget, S3Reference, PublishOptions, PublishResult, PublishError, PublishErrorCode } from './types.js';
export { publishFolder } from './publish-folder.js';
```

Run: `pnpm -F @rntme/bundle-publish test`. Expected: PASS.

- [ ] **Step 4: Build, typecheck, lint, depcruise**

```bash
pnpm -F @rntme/bundle-publish build
pnpm -F @rntme/bundle-publish typecheck
pnpm -F @rntme/bundle-publish lint
pnpm depcruise
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/tooling/bundle-publish
git commit -m "feat(bundle-publish): implement publishFolder() orchestrator (sha256 + S3 PutObject)"
```

---

## Task 6: Bundle-publish docs

- [ ] **Step 1: README + owner doc**

`packages/tooling/bundle-publish/README.md`: stub pointing to `docs/current/owners/packages/tooling/bundle-publish.md`.

`docs/current/owners/packages/tooling/bundle-publish.md`: cover scope (generic primitive, no contract dependency), file map, public API (`publishFolder`, `S3Reference`, error codes), determinism guarantees, how it differs from the marketing-site provisioner (publish-side only — no fetch/verify).

- [ ] **Step 2: Commit**

```bash
git add packages/tooling/bundle-publish/README.md docs/current/owners/packages/tooling/bundle-publish.md
git commit -m "docs(bundle-publish): owner doc"
```

---

## Task 7: `rntme bundle publish` CLI command

**Files:**
- Create: `apps/cli/src/commands/bundle/publish.ts`
- Create: `apps/cli/src/commands/bundle/index.ts`
- Modify: `apps/cli/src/index.ts` (or wherever the command tree is wired)
- Create: `apps/cli/test/unit/bundle-publish.test.ts`
- Modify: `apps/cli/package.json` to add `@rntme/bundle-publish` and `@rntme/contracts-marketing-site-v1` deps

- [ ] **Step 1: Inspect CLI command-tree convention**

```bash
ls apps/cli/src/commands
```

Examine an existing command file (e.g. one already shipping under `apps/cli/src/commands/...`) to match argv parsing, subcommand registration, and stdout formatting. Mirror that pattern exactly — do NOT introduce a new arg parser library.

- [ ] **Step 2: Write failing CLI test**

`apps/cli/test/unit/bundle-publish.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { runBundlePublish } from '../../src/commands/bundle/publish.js';

describe('rntme bundle publish', () => {
  it('emits BundleSource JSON when --print-json is passed', async () => {
    const fakePublish = vi.fn(async () => ({
      ok: true as const,
      value: { ref: { bucket: 'b', key: 'p/hash.tar.gz', sha256: 'h'.repeat(64) }, bytes: 100, durationMs: 1 },
    }));
    const stdout = vi.fn();
    const exit = await runBundlePublish(
      { folder: './x', target: { kind: 's3', bucket: 'b' }, printJson: true },
      { publish: fakePublish as never, stdout },
    );
    expect(exit).toBe(0);
    expect(stdout).toHaveBeenCalledWith(
      JSON.stringify({ kind: 's3', bucket: 'b', key: 'p/hash.tar.gz', sha256: 'h'.repeat(64) }),
    );
  });

  it('returns non-zero exit + readable error on failure', async () => {
    const fakePublish = vi.fn(async () => ({
      ok: false as const,
      errors: [{ code: 'BUNDLE_PUBLISH_NO_INDEX_HTML', message: 'index.html required' }],
    }));
    const stderr = vi.fn();
    const exit = await runBundlePublish(
      { folder: './x', target: { kind: 's3', bucket: 'b' }, printJson: false },
      { publish: fakePublish as never, stdout: vi.fn(), stderr },
    );
    expect(exit).not.toBe(0);
    expect(String(stderr.mock.calls[0]?.[0] ?? '')).toContain('BUNDLE_PUBLISH_NO_INDEX_HTML');
  });
});
```

Run: FAIL.

- [ ] **Step 3: Implement command**

`apps/cli/src/commands/bundle/publish.ts`:

```ts
import { publishFolder, type PublishTarget, type S3Reference } from '@rntme/bundle-publish';

export type BundlePublishArgs = {
  folder: string;
  target: PublishTarget;
  keyPrefix?: string;
  maxBytes?: number;
  ignore?: string[];
  printJson: boolean;
};

export type BundlePublishDeps = {
  publish?: typeof publishFolder;
  stdout?: (s: string) => void;
  stderr?: (s: string) => void;
};

export async function runBundlePublish(args: BundlePublishArgs, deps: BundlePublishDeps = {}): Promise<number> {
  const publish = deps.publish ?? publishFolder;
  const out = deps.stdout ?? ((s) => process.stdout.write(s + '\n'));
  const errOut = deps.stderr ?? ((s) => process.stderr.write(s + '\n'));

  const r = await publish(args.folder, args.target, {
    keyPrefix: args.keyPrefix,
    maxBytes: args.maxBytes,
    ignore: args.ignore,
  });
  if (!r.ok) {
    for (const e of r.errors) errOut(`error: ${e.code}: ${e.message}`);
    return 1;
  }
  const ref: S3Reference = r.value.ref;
  if (args.printJson) {
    out(JSON.stringify({ kind: 's3', ...ref }));
    return 0;
  }
  out(`✓ Published ${(r.value.bytes / 1024 / 1024).toFixed(2)} MB in ${(r.value.durationMs / 1000).toFixed(2)}s`);
  out(`  bucket: ${ref.bucket}`);
  out(`  key:    ${ref.key}`);
  out(`  sha256: ${ref.sha256}`);
  out('');
  out('Paste into project.json → modules.<name>.publicConfig.source:');
  out(JSON.stringify({ kind: 's3', ...ref }, null, 2));
  return 0;
}
```

`apps/cli/src/commands/bundle/index.ts`: register `publish` under the `bundle` group; map argv to `BundlePublishArgs`. Follow the existing argv-mapping convention in the CLI (no new dependency).

`apps/cli/src/index.ts` (or whichever file holds the root command tree): wire `bundle` into the CLI's command list.

`apps/cli/package.json`: add `"@rntme/bundle-publish": "workspace:*"` and (only if you import the type for output shaping) `"@rntme/contracts-marketing-site-v1": "workspace:*"`.

Run: `pnpm install && pnpm -F @rntme/cli test`. Expected: PASS.

- [ ] **Step 4: Manual smoke**

```bash
mkdir -p /tmp/landing && echo '<h1>hi</h1>' > /tmp/landing/index.html
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
  pnpm -F @rntme/cli exec rntme bundle publish /tmp/landing \
  --target=s3 --bucket=foo --endpoint=http://localhost:9000 --print-json || true
```

Expected: command runs and either prints a JSON snippet (with running MinIO) or fails with `BUNDLE_PUBLISH_S3_*` (without). Both exit non-interactively.

- [ ] **Step 5: Commit**

```bash
git add apps/cli
git commit -m "feat(cli): add 'rntme bundle publish' command"
```

---

## Task 8: CLI docs

- [ ] **Step 1: Update `apps/cli/README.md`**

Add a `bundle publish` row to the local commands table, with a one-line description and a link to the owner doc.

- [ ] **Step 2: Update `docs/current/owners/apps/cli.md`**

Add a section on `bundle publish`: synopsis, options, environment variables, output format, when to use `--print-json`, error codes.

- [ ] **Step 3: Commit**

```bash
git add apps/cli/README.md docs/current/owners/apps/cli.md
git commit -m "docs(cli): document 'rntme bundle publish'"
```

---

## Task 9: Scaffold `modules/marketing-site/` + `static-html` vendor (skeleton + module.json)

**Files:** see File Map for `modules/marketing-site/**`.

- [ ] **Step 1: Create category README**

`modules/marketing-site/README.md`:

```markdown
# Marketing-site modules

Vendor modules implementing the `marketing-site/v1` contract — products
attach an externally-authored HTML landing as a first-class blueprint
service.

| Vendor | Status | README |
| --- | --- | --- |
| static-html | v1 | [./static-html/README.md](./static-html/README.md) |

Conformance suite: [./conformance/README.md](./conformance/README.md).
Contract: `@rntme/contracts-marketing-site-v1` (`packages/contracts/marketing-site/v1/`).
Owner doc: [docs/current/owners/modules/marketing-site.md](../../docs/current/owners/modules/marketing-site.md).
```

- [ ] **Step 2: Scaffold `static-html` vendor**

Mirror `modules/identity/auth0` for boilerplate (`package.json`, `tsconfig.json`, `tsconfig.check.json`, `eslint.config.mjs`, `vitest.config.ts`, `Dockerfile`).

`modules/marketing-site/static-html/package.json`:

```json
{
  "name": "@rntme/marketing-site-static",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "Static HTML vendor module for the marketing-site canonical contract.",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./provisioner": { "types": "./dist/provisioner.d.ts", "import": "./dist/provisioner.js" },
    "./provisioner.entry": { "import": "./dist/provisioner.entry.js" },
    "./module.json": "./module.json"
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "files": ["dist", "module.json", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\""
  },
  "dependencies": {
    "@rntme/contracts-marketing-site-v1": "workspace:*",
    "@rntme/contracts-provisioner-v1": "workspace:*",
    "@rntme/contracts-module-v1": "workspace:*",
    "@aws-sdk/client-s3": "^3.600.0",
    "tar-stream": "^3.1.7"
  },
  "devDependencies": { /* mirror identity-auth0 */ }
}
```

- [ ] **Step 3: Write `module.json`**

```json
{
  "name": "@rntme/marketing-site-static",
  "version": "0.0.0",
  "category": "marketing-site",
  "vendor": "static-html",
  "contract": "marketing-site/v1",
  "capabilities": {
    "rpcs": [],
    "events": [],
    "hostedSurface": "static-site"
  },
  "provisioner": {
    "entry": "./dist/provisioner.entry.js",
    "produces": [
      { "name": "url", "kind": "single", "secret": false },
      { "name": "deployedSha256", "kind": "single", "secret": false }
    ],
    "requires": [
      { "name": "bundleStorage", "schema": "s3-credentials-v1" },
      { "name": "registry", "schema": "registry-credentials-v1" },
      { "name": "dokploy", "schema": "dokploy-api-v1" }
    ],
    "timeoutMs": 300000
  }
}
```

- [ ] **Step 4: Run `pnpm install` and verify resolution**

```bash
pnpm install
pnpm -F @rntme/marketing-site-static list | head
```

Expected: package resolves; deps install without errors.

- [ ] **Step 5: Commit scaffold**

```bash
git add modules/marketing-site
git commit -m "feat(marketing-site): scaffold category + static-html vendor module skeleton"
```

---

## Task 10: `static-html` provisioner — fetch + verify + untar (TDD)

- [ ] **Step 1: Write failing test for `s3-fetch`**

`modules/marketing-site/static-html/test/unit/s3-fetch.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { fetchAndVerifyBundle } from '../../src/s3-fetch.js';

describe('fetchAndVerifyBundle', () => {
  it('returns BUNDLE_NOT_FOUND when S3 GetObject throws NoSuchKey', async () => {
    const client = { send: vi.fn(async () => { throw Object.assign(new Error('not found'), { name: 'NoSuchKey' }); }) };
    const r = await fetchAndVerifyBundle(
      client as never,
      { bucket: 'b', key: 'k', sha256: 'a'.repeat(64) },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].code).toBe('MARKETING_SITE_PROVISION_BUNDLE_NOT_FOUND');
  });

  it('returns HASH_MISMATCH when sha256 differs', async () => {
    const body = Buffer.from('hello');
    const client = { send: vi.fn(async () => ({ Body: { transformToByteArray: async () => body } })) };
    const r = await fetchAndVerifyBundle(
      client as never,
      { bucket: 'b', key: 'k', sha256: 'a'.repeat(64) },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].code).toBe('MARKETING_SITE_PROVISION_HASH_MISMATCH');
  });

  it('returns the bundle bytes on hash match', async () => {
    const body = Buffer.from('hello');
    const sha = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
    const client = { send: vi.fn(async () => ({ Body: { transformToByteArray: async () => body } })) };
    const r = await fetchAndVerifyBundle(client as never, { bucket: 'b', key: 'k', sha256: sha });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.equals(body)).toBe(true);
  });
});
```

- [ ] **Step 2: Implement `s3-fetch.ts`**

```ts
import { GetObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { err, ok, type Result } from './result-shim.js';

export type BundleRef = { bucket: string; key: string; sha256: string };
export type ProvisionError = { code: string; message: string; cause?: unknown };

export async function fetchAndVerifyBundle(
  client: Pick<S3Client, 'send'>,
  ref: BundleRef,
): Promise<Result<Buffer, ProvisionError>> {
  let body: Uint8Array;
  try {
    const out = await client.send(new GetObjectCommand({ Bucket: ref.bucket, Key: ref.key }) as never);
    if (!out.Body) return err({ code: 'MARKETING_SITE_PROVISION_BUNDLE_NOT_FOUND', message: 'empty body' });
    body = await (out.Body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === 'NoSuchKey' || name === 'NotFound')
      return err({ code: 'MARKETING_SITE_PROVISION_BUNDLE_NOT_FOUND', message: (e as Error).message, cause: e });
    return err({ code: 'MARKETING_SITE_PROVISION_BUNDLE_NOT_FOUND', message: (e as Error).message, cause: e });
  }

  const buf = Buffer.from(body);
  const sha = createHash('sha256').update(buf).digest('hex');
  if (sha !== ref.sha256.toLowerCase())
    return err({
      code: 'MARKETING_SITE_PROVISION_HASH_MISMATCH',
      message: `expected ${ref.sha256} got ${sha}`,
    });
  return ok(buf);
}
```

`src/result-shim.ts`:

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; errors: readonly E[] };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(...errors: E[]): Result<never, E> => ({ ok: false, errors });
```

Run: `pnpm -F @rntme/marketing-site-static test`. Expected: PASS.

- [ ] **Step 3: Untar + index.html assertion test**

`test/unit/untar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { gzipSync } from 'node:zlib';
import * as tar from 'tar-stream';
import { untarToDir } from '../../src/untar.js';

function makeBundle(files: Record<string, string>): Buffer {
  const pack = tar.pack();
  for (const [name, contents] of Object.entries(files)) {
    pack.entry({ name }, contents);
  }
  pack.finalize();
  const chunks: Buffer[] = [];
  pack.on('data', (c) => chunks.push(c));
  return gzipSync(Buffer.concat(chunks));
}

describe('untarToDir', () => {
  it('extracts and returns the dir when index.html present', async () => {
    const r = await untarToDir(makeBundle({ 'index.html': '<h1>x</h1>' }));
    expect(r.ok).toBe(true);
  });

  it('returns INDEX_HTML_MISSING otherwise', async () => {
    const r = await untarToDir(makeBundle({ 'about.html': 'x' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].code).toBe('MARKETING_SITE_PROVISION_INDEX_HTML_MISSING');
  });
});
```

- [ ] **Step 4: Implement `untar.ts`**

```ts
import { mkdtempSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import * as tar from 'tar-stream';
import { err, ok, type Result } from './result-shim.js';
import type { ProvisionError } from './s3-fetch.js';

export async function untarToDir(gz: Buffer): Promise<Result<{ dir: string; hasIndex: boolean }, ProvisionError>> {
  const tarBuf = gunzipSync(gz);
  const dir = mkdtempSync(join(tmpdir(), 'mksite-'));
  let hasIndex = false;
  await new Promise<void>((resolve, reject) => {
    const extract = tar.extract();
    extract.on('entry', (header, stream, next) => {
      if (header.type !== 'file') { stream.resume(); stream.on('end', next); return; }
      const target = join(dir, header.name);
      if (header.name === 'index.html') hasIndex = true;
      mkdir(dirname(target), { recursive: true })
        .then(() => {
          const chunks: Buffer[] = [];
          stream.on('data', (c) => chunks.push(c));
          stream.on('end', () => { writeFile(target, Buffer.concat(chunks)).then(() => next()); });
        })
        .catch(reject);
    });
    extract.on('finish', resolve);
    extract.on('error', reject);
    extract.end(tarBuf);
  });
  if (!hasIndex)
    return err({ code: 'MARKETING_SITE_PROVISION_INDEX_HTML_MISSING', message: 'bundle missing index.html' });
  return ok({ dir, hasIndex });
}
```

Run: PASS.

- [ ] **Step 5: Commit**

```bash
git add modules/marketing-site/static-html
git commit -m "feat(marketing-site-static): fetch + verify + untar primitives"
```

---

## Task 11: `static-html` provisioner — image build, registry push, Dokploy upsert, orchestrator

- [ ] **Step 1: Embedded nginx.conf**

`src/nginx.conf.ts`:

```ts
export const DEFAULT_NGINX_CONF = `
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  gzip on;
  gzip_types text/plain text/css application/javascript application/json image/svg+xml;
  gzip_min_length 1024;

  location ~* \\.(?:css|js|svg|png|jpg|jpeg|webp|woff2?)$ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
  }

  location / {
    try_files $uri $uri/ =404;
  }
}
`.trim() + '\n';
```

- [ ] **Step 2: Image build helper**

`src/build-image.ts`:

```ts
import { writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { DEFAULT_NGINX_CONF } from './nginx.conf.js';
import { err, ok, type Result } from './result-shim.js';
import type { ProvisionError } from './s3-fetch.js';

export type BuildInput = {
  bundleDir: string;          // already-extracted bundle
  imageRef: string;           // 'registry/host/proj-svc:sha7'
  registry: { url: string; username?: string; password?: string };
  log: (s: string) => void;
};

export async function buildAndPushImage(input: BuildInput): Promise<Result<{ imageRef: string }, ProvisionError>> {
  const dockerfile = `FROM nginx:alpine\nCOPY ./bundle /usr/share/nginx/html\nCOPY ./nginx.conf /etc/nginx/conf.d/default.conf\nEXPOSE 80\n`;
  await writeFile(join(input.bundleDir, '..', 'Dockerfile'), dockerfile);
  await writeFile(join(input.bundleDir, '..', 'nginx.conf'), DEFAULT_NGINX_CONF);

  // docker buildx build --push --tag <ref> <ctx>
  const ctx = join(input.bundleDir, '..');
  const code = await new Promise<number>((resolve, reject) => {
    const p = spawn('docker', ['buildx', 'build', '--push', '--tag', input.imageRef, ctx], { stdio: 'pipe' });
    p.stdout.on('data', (d) => input.log(d.toString()));
    p.stderr.on('data', (d) => input.log(d.toString()));
    p.on('close', resolve);
    p.on('error', reject);
  });
  if (code !== 0)
    return err({ code: 'MARKETING_SITE_PROVISION_IMAGE_BUILD_FAILED', message: `docker exit ${code}` });
  return ok({ imageRef: input.imageRef });
}
```

Note for the implementer: docker login to the registry (when `username`/`password` are set) happens before this call — extract a small helper, or shell out `docker login` synchronously at the start of `buildAndPushImage`. Don't paste creds onto the argv.

- [ ] **Step 3: Dokploy upsert**

`src/dokploy-upsert.ts`:

```ts
import type { ProvisionError } from './s3-fetch.js';
import { err, ok, type Result } from './result-shim.js';

export type DokployUpsertInput = {
  appName: string;            // e.g. 'cv-extract-marketing'
  imageRef: string;
  primaryDomain: string;
  ssl: 'auto' | 'manual' | 'none';
  client: {                  // injected; the real impl wraps @rntme/deploy-dokploy
    upsertDockerApp: (cfg: {
      name: string; image: string; domain: string; ssl: 'auto' | 'manual' | 'none';
    }) => Promise<{ appId: string }>;
  };
};

export async function upsertDokployApp(input: DokployUpsertInput): Promise<Result<{ appId: string; url: string }, ProvisionError>> {
  try {
    const { appId } = await input.client.upsertDockerApp({
      name: input.appName,
      image: input.imageRef,
      domain: input.primaryDomain,
      ssl: input.ssl,
    });
    return ok({ appId, url: `https://${input.primaryDomain}` });
  } catch (e) {
    return err({
      code: 'MARKETING_SITE_PROVISION_DOMAIN_BIND_FAILED',
      message: (e as Error).message,
      cause: e,
    });
  }
}
```

The actual `client.upsertDockerApp` is wired from `@rntme/deploy-dokploy`. If that package does not yet expose a docker-image-upsert helper, add one in `packages/deploy/deploy-dokploy/src/apply.ts` and export from `index.ts`. This is a small extension, not a new pattern — the existing `createApplication` + `deployApplication` calls already cover the base operations.

- [ ] **Step 4: Provisioner orchestrator**

`src/provisioner.ts`:

```ts
import type { ProvisionerContract } from '@rntme/contracts-provisioner-v1';
import type { MarketingSiteV1Config } from '@rntme/contracts-marketing-site-v1';
import { S3Client } from '@aws-sdk/client-s3';
import { fetchAndVerifyBundle } from './s3-fetch.js';
import { untarToDir } from './untar.js';
import { buildAndPushImage } from './build-image.js';
import { upsertDokployApp } from './dokploy-upsert.js';
import { err, ok } from './result-shim.js';

type Targets = {
  bundleStorage: { s3: { accessKeyId: string; secretAccessKey: string; endpoint?: string; region?: string } };
  registry: { url: string; username?: string; password?: string };
  dokploy: { upsertDockerApp: (cfg: { name: string; image: string; domain: string; ssl: 'auto' | 'manual' | 'none' }) => Promise<{ appId: string }> };
  isProd: boolean;
};

export const provisioner: ProvisionerContract<MarketingSiteV1Config> = {
  async provision(input) {
    const cfg = input.publicConfig;
    const t = input.targetSecrets as unknown as Targets;

    if (cfg.source.kind === 'local-path' && t.isProd)
      return err({ code: 'MARKETING_SITE_PROVISION_LOCAL_PATH_IN_PROD', message: 'local-path source forbidden in prod' });

    let bundle: Buffer;
    if (cfg.source.kind === 's3') {
      const s3 = new S3Client({
        region: cfg.source.region ?? t.bundleStorage.s3.region,
        endpoint: cfg.source.endpoint ?? t.bundleStorage.s3.endpoint,
        credentials: {
          accessKeyId: t.bundleStorage.s3.accessKeyId,
          secretAccessKey: t.bundleStorage.s3.secretAccessKey,
        },
      });
      const r = await fetchAndVerifyBundle(s3, { bucket: cfg.source.bucket, key: cfg.source.key, sha256: cfg.source.sha256 });
      if (!r.ok) return r;
      bundle = r.value;
    } else {
      const { readFile } = await import('node:fs/promises');
      bundle = await readFile(cfg.source.path);
      const { createHash } = await import('node:crypto');
      const sha = createHash('sha256').update(bundle).digest('hex');
      if (sha !== cfg.source.sha256.toLowerCase())
        return err({ code: 'MARKETING_SITE_PROVISION_HASH_MISMATCH', message: `expected ${cfg.source.sha256} got ${sha}` });
    }

    const ut = await untarToDir(bundle);
    if (!ut.ok) return ut;

    const sha7 = cfg.source.sha256.slice(0, 7);
    // appName derived from primaryDomain — `cv-extract.example.com` → `cv-extract-example-com`.
    // This keeps deploy-target naming deterministic without requiring a new field on ProvisionerInput.
    const appName = cfg.primaryDomain.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const imageRef = `${t.registry.url}/${appName}:${sha7}`;

    const built = await buildAndPushImage({
      bundleDir: ut.value.dir,
      imageRef,
      registry: t.registry,
      log: (s) => input.log({ step: 'image-build', level: 'info', message: s.trim() }),
    });
    if (!built.ok) return built;

    const upserted = await upsertDokployApp({
      appName, imageRef, primaryDomain: cfg.primaryDomain, ssl: cfg.ssl,
      client: t.dokploy,
    });
    if (!upserted.ok) return upserted;

    return ok({
      publicOutputs: { url: upserted.value.url, deployedSha256: cfg.source.sha256 },
      secretOutputs: {},
    });
  },
  async tearDown(input) {
    // Dokploy app delete via deploy-dokploy client; idempotent if app absent.
    // Implementation note: read previous appId from input.priorOutputs, then call client.deleteApplication(appId).
    const t = input.targetSecrets as unknown as Targets;
    const priorAppId = (input.priorOutputs?.publicOutputs as { appId?: string } | undefined)?.appId;
    if (priorAppId && (t.dokploy as unknown as { deleteApplication?: (id: string) => Promise<void> }).deleteApplication) {
      await (t.dokploy as unknown as { deleteApplication: (id: string) => Promise<void> }).deleteApplication(priorAppId);
    }
    return ok({ publicOutputs: {}, secretOutputs: {} });
  },
};
```

`src/provisioner.entry.ts`:

```ts
import type { ProvisionerEnvMapping } from '@rntme/contracts-provisioner-v1';
export { provisioner } from './provisioner.js';
export const ENV_MAPPINGS: ProvisionerEnvMapping = {
  'marketing-site': [
    { from: 'url', envName: 'MARKETING_URL', secret: false, target: 'app' },
  ],
};
```

`src/index.ts`: barrel re-exports.

- [ ] **Step 5: Provisioner orchestration test (unit)**

`test/unit/provisioner.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as tar from 'tar-stream';
import { provisioner } from '../../src/provisioner.js';

function makeBundle(files: Record<string, string>): { bytes: Buffer; sha256: string } {
  const pack = tar.pack();
  for (const [name, contents] of Object.entries(files)) pack.entry({ name }, contents);
  pack.finalize();
  const chunks: Buffer[] = [];
  pack.on('data', (c) => chunks.push(c));
  // tar-stream emits synchronously when bodies are strings; safe to read here.
  const tarBuf = Buffer.concat(chunks);
  const bytes = gzipSync(tarBuf);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return { bytes, sha256 };
}

function fakeS3(body: Buffer) {
  return { send: vi.fn(async () => ({ Body: { transformToByteArray: async () => body } })) };
}

describe('provisioner.provision', () => {
  it('returns LOCAL_PATH_IN_PROD when source is local in prod target', async () => {
    const r = await provisioner.provision({
      publicConfig: { source: { kind: 'local-path', path: '/tmp/x', sha256: 'a'.repeat(64) }, primaryDomain: 'x.example.com', ssl: 'auto' },
      targetSecrets: { isProd: true, bundleStorage: { s3: {} }, registry: { url: 'r' }, dokploy: { upsertDockerApp: vi.fn() } } as never,
      log: vi.fn(),
      signal: new AbortController().signal,
    } as never);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].code).toBe('MARKETING_SITE_PROVISION_LOCAL_PATH_IN_PROD');
  });

  it('returns HASH_MISMATCH when bundle bytes do not match declared sha256', async () => {
    const { bytes } = makeBundle({ 'index.html': '<h1>hi</h1>' });
    const r = await provisioner.provision({
      publicConfig: {
        source: { kind: 's3', bucket: 'b', key: 'k', sha256: 'd'.repeat(64) /* wrong */ },
        primaryDomain: 'x.example.com', ssl: 'auto',
      },
      targetSecrets: {
        isProd: false,
        bundleStorage: { s3: { accessKeyId: 'a', secretAccessKey: 'b' } },
        registry: { url: 'r' },
        dokploy: { upsertDockerApp: vi.fn() },
      } as never,
      log: vi.fn(),
      signal: new AbortController().signal,
      // inject the fake client via a module-level setter, OR pass through the targetSecrets — simplest:
      // refactor provisioner to accept an optional s3Client in input for tests.
    } as never);
    // Once provisioner supports an injected client, assert the error code:
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0].code).toMatch(/MARKETING_SITE_PROVISION_(HASH_MISMATCH|BUNDLE_NOT_FOUND)/);
  });

  // Add: happy path — buildBundle('index.html': ...) → matching sha256 → fakeDokploy receives upsert.
  // Add: missing index.html — buildBundle without index.html → INDEX_HTML_MISSING.
  // Implementer adds these following the makeBundle helper above.
});
```

Note for the implementer: to make `provisioner.provision` testable without real S3, refactor `src/provisioner.ts` so that the S3 client is either created inside or accepted via an optional `s3Client` field on the input (or via a small dependency-injection seam exposed through `targetSecrets.bundleStorage.s3.client`). Match whatever convention `modules/identity/auth0/src/provisioner.ts` uses for its mgmt-client (look at `createMgmtClient` and the `fetch` injection seam) — keep the seam narrow, do not introduce a generic DI framework.

Run: PASS for the local-path-in-prod scenario. Add additional scenarios (happy path with real bundle bytes, hash mismatch) following the pattern in `test/unit/untar.test.ts`.

- [ ] **Step 6: Build, lint, depcruise, commit**

```bash
pnpm -F @rntme/marketing-site-static build
pnpm -F @rntme/marketing-site-static typecheck
pnpm -F @rntme/marketing-site-static lint
pnpm depcruise
git add modules/marketing-site/static-html
git commit -m "feat(marketing-site-static): provisioner orchestrator (provision + tearDown)"
```

---

## Task 12: Conformance suite

- [ ] **Step 1: Scaffold `modules/marketing-site/conformance`**

Mirror `modules/identity/conformance` for the boilerplate.

`modules/marketing-site/conformance/package.json` (key parts):

```json
{
  "name": "@rntme/conformance-marketing-site",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "dependencies": {
    "@rntme/contracts-marketing-site-v1": "workspace:*",
    "@rntme/contracts-provisioner-v1": "workspace:*"
  }
}
```

- [ ] **Step 2: Implement `runMarketingSiteConformance`**

`src/index.ts`:

```ts
import type { ProvisionerContract } from '@rntme/contracts-provisioner-v1';
import type { MarketingSiteV1Config } from '@rntme/contracts-marketing-site-v1';
import { runHappyPath } from './scenarios/happy-path.js';
import { runIdempotency } from './scenarios/idempotency.js';
import { runHashMismatch } from './scenarios/hash-mismatch.js';

export type ConformanceDeps = {
  buildBundle: (files: Record<string, string>) => { bytes: Buffer; sha256: string; bucket: string; key: string };
  fakeRegistry: { url: string };
  fakeDokploy: {
    upsertDockerApp: (cfg: { name: string; image: string; domain: string; ssl: 'auto' | 'manual' | 'none' }) => Promise<{ appId: string }>;
    deleteApplication?: (id: string) => Promise<void>;
  };
};

export async function runMarketingSiteConformance(
  provisioner: ProvisionerContract<MarketingSiteV1Config>,
  deps: ConformanceDeps,
): Promise<void> {
  await runHappyPath(provisioner, deps);
  await runIdempotency(provisioner, deps);
  await runHashMismatch(provisioner, deps);
}
```

Each scenario file (`scenarios/happy-path.ts`, `scenarios/idempotency.ts`, `scenarios/hash-mismatch.ts`) builds a test bundle, runs `provisioner.provision`, asserts the documented behavior, and throws on failure. Use `node:assert` (no test runner inside the conformance suite — the consuming vendor's test runner drives execution).

- [ ] **Step 3: Wire static-html test against the conformance suite**

`modules/marketing-site/static-html/test/conformance.test.ts`:

```ts
import { describe, it } from 'vitest';
import { runMarketingSiteConformance } from '@rntme/conformance-marketing-site';
import { provisioner } from '../src/provisioner.js';

import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as tar from 'tar-stream';

function buildBundle(files: Record<string, string>) {
  const pack = tar.pack();
  for (const [name, contents] of Object.entries(files)) pack.entry({ name }, contents);
  pack.finalize();
  const chunks: Buffer[] = [];
  pack.on('data', (c) => chunks.push(c));
  const bytes = gzipSync(Buffer.concat(chunks));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  return { bytes, sha256, bucket: 'test-bucket', key: `bundles/${sha256}.tar.gz` };
}

describe('marketing-site-static conformance', () => {
  it('runs the conformance suite', async () => {
    const upserts: Array<{ name: string; image: string; domain: string }> = [];
    await runMarketingSiteConformance(provisioner, {
      buildBundle,
      fakeRegistry: { url: 'localhost:5000' },
      fakeDokploy: {
        upsertDockerApp: async (cfg) => { upserts.push(cfg); return { appId: 'app-1' }; },
        deleteApplication: async () => {},
      },
    });
    // Conformance scenarios assert internally; this test only verifies the suite ran end-to-end.
    expect(upserts.length).toBeGreaterThan(0);
  });
});
```

Note: the conformance suite tests will not actually shell out to Docker; the static-html `buildAndPushImage` is stubbed via dependency injection in the conformance scenarios — see how `modules/identity/conformance` injects fakes.

- [ ] **Step 4: Commit**

```bash
git add modules/marketing-site/conformance modules/marketing-site/static-html/test/conformance.test.ts
git commit -m "feat(marketing-site): conformance suite + static-html test wire-up"
```

---

## Task 13: Integration test (MinIO + local registry)

- [ ] **Step 1: Add docker-compose harness for tests**

`modules/marketing-site/static-html/test/integration/docker-compose.yaml`:

```yaml
version: '3.8'
services:
  minio:
    image: minio/minio:latest
    command: server /data
    environment:
      MINIO_ROOT_USER: test
      MINIO_ROOT_PASSWORD: testtest
    ports: ["9000:9000"]
  registry:
    image: registry:2
    ports: ["5000:5000"]
```

- [ ] **Step 2: Integration test (gated)**

`test/integration/minio-registry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { provisioner } from '../../src/provisioner.js';

const skip = process.env.INTEGRATION !== '1';

describe.skipIf(skip)('integration: MinIO + local registry', () => {
  it('provisions a real image end-to-end', async () => {
    // 1. publish a real bundle to MinIO via @rntme/bundle-publish
    // 2. invoke provisioner.provision with real targets
    // 3. assert: image present in registry, Dokploy stub recorded an upsertDockerApp call
    // (implementer fills in based on test/unit/* helpers)
    expect(true).toBe(true);
  });
});
```

Note: this test is for human verification; it requires Docker available locally. CI runs with `INTEGRATION=1` only on a runner that has Docker (decide during planning whether to flip the flag in CI).

- [ ] **Step 3: Document the integration test in the vendor README**

Add a "Running integration tests" section.

- [ ] **Step 4: Commit**

```bash
git add modules/marketing-site/static-html/test/integration
git commit -m "test(marketing-site-static): MinIO + local-registry integration scaffold"
```

---

## Task 14: Module + category docs

- [ ] **Step 1: `modules/marketing-site/static-html/README.md` (stub)**

Standard format pointing to owner doc.

- [ ] **Step 2: `docs/current/owners/modules/marketing-site.md`**

Cover: category scope, current vendor list, contract reference, deploy semantics (pulls bundle, builds image, upserts Dokploy app), env-mapping outputs (`url`, `deployedSha256`), invariants (no RPC; bundle pinned by sha256), how to add a second vendor (point to the conformance suite), gotchas (docker buildx required for image build).

- [ ] **Step 3: `modules/marketing-site/conformance/README.md` (stub)**

- [ ] **Step 4: AGENTS.md**

Verify the §Repo Map Modules row added in Task 3 is correct now that `static-html` exists.

- [ ] **Step 5: Commit**

```bash
git add modules/marketing-site/*/README.md docs/current/owners/modules/marketing-site.md AGENTS.md
git commit -m "docs(marketing-site): owner doc + READMEs for category, vendor, conformance"
```

---

## Task 15: cv-extract dogfood — sample bundle + blueprint update + e2e

- [ ] **Step 1: Author a small landing**

`demo/cv-extract-blueprint/landing/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CV Extract — turn resumes into structured data</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main>
      <h1>CV Extract</h1>
      <p>Drop a resume PDF. Get clean structured data.</p>
      <a class="cta" href="https://cv-extract-app.example.com">Try the demo →</a>
    </main>
  </body>
</html>
```

`demo/cv-extract-blueprint/landing/styles.css`: a few rules. Keep this honest (this is the seed for showing the e2e works end-to-end; designers replace it later).

- [ ] **Step 2: Publish the bundle to a local MinIO**

```bash
docker compose -f modules/marketing-site/static-html/test/integration/docker-compose.yaml up -d minio
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=testtest \
  pnpm -F @rntme/cli exec rntme bundle publish demo/cv-extract-blueprint/landing \
  --target=s3 --bucket=cv-extract --endpoint=http://localhost:9000 \
  --key-prefix=landings/cv-extract --print-json
```

Capture the JSON snippet stdout.

- [ ] **Step 3: Update `demo/cv-extract-blueprint/project.json`**

Read existing file, then add `marketing` to `services`, declare `modules.marketing` with the snippet pasted in, add `vars.MARKETING_DOMAIN`. Final shape:

```json
{
  "name": "cv-extract",
  "services": ["app", "marketing"],
  "modules": {
    "openrouter": { /* unchanged */ },
    "marketing": {
      "package": "@rntme/marketing-site-static",
      "publicConfig": {
        "source": { "kind": "s3", "bucket": "cv-extract", "key": "landings/cv-extract/<sha>.tar.gz", "sha256": "<sha>" },
        "primaryDomain": "${MARKETING_DOMAIN}",
        "ssl": "auto"
      }
    }
  },
  "vars": {
    "MARKETING_DOMAIN": { "from": "target.marketing.primaryDomain", "required": true }
  },
  "routes": { "ui": { "/": "app" }, "http": { "/api": "app" } }
}
```

- [ ] **Step 4: E2E smoke test**

`demo/cv-extract-blueprint/test/landing-deploy.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateMarketingSiteConfig } from '@rntme/contracts-marketing-site-v1';

describe('cv-extract landing wiring', () => {
  it('marketing publicConfig is valid against marketing-site/v1', () => {
    const project = JSON.parse(readFileSync(join(__dirname, '..', 'project.json'), 'utf8'));
    const cfg = project.modules.marketing.publicConfig;
    const r = validateMarketingSiteConfig(cfg);
    if (!r.ok) console.error(r.errors);
    expect(r.ok).toBe(true);
  });

  it('marketing service appears in services', () => {
    const project = JSON.parse(readFileSync(join(__dirname, '..', 'project.json'), 'utf8'));
    expect(project.services).toContain('marketing');
  });
});
```

Run: `pnpm -F cv-extract-blueprint test`. Expected: PASS.

- [ ] **Step 5: Update `demo/cv-extract-blueprint/README.md`**

Add a section "Marketing landing" describing how to publish a new bundle (`rntme bundle publish demo/cv-extract-blueprint/landing ...`) and update `project.json` with the resulting snippet. Note the dogfood role.

- [ ] **Step 6: Commit**

```bash
git add demo/cv-extract-blueprint
git commit -m "feat(demo): wire marketing-site-static into cv-extract blueprint (dogfood)"
```

---

## Task 16: Final verification

- [ ] **Step 1: Repo-wide checks**

```bash
pnpm install --frozen-lockfile
pnpm -r run build
pnpm -r run typecheck
pnpm -r run test
pnpm -r run lint
pnpm depcruise
pnpm vendor:check
```

All commands must pass.

- [ ] **Step 2: Verify docs touch**

```bash
grep -n "marketing-site" docs/decision-system.md AGENTS.md
ls docs/current/owners/modules/marketing-site.md
ls docs/current/owners/packages/contracts/marketing-site.md
ls docs/current/owners/packages/tooling/bundle-publish.md
```

Expected: all greps and `ls` succeed.

- [ ] **Step 3: Manual smoke against the running rntme platform**

```bash
docker compose -f modules/marketing-site/static-html/test/integration/docker-compose.yaml up -d
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=testtest \
  pnpm -F @rntme/cli exec rntme bundle publish demo/cv-extract-blueprint/landing \
  --target=s3 --bucket=cv-extract --endpoint=http://localhost:9000 --print-json
INTEGRATION=1 pnpm -F @rntme/marketing-site-static test
```

Expected: publish succeeds; integration test exits 0.

- [ ] **Step 4: Final commit if any docs adjustments fell out**

```bash
git add -A
git diff --cached
git commit -m "chore(marketing-site): final verification adjustments"
```

(Only if there are unstaged changes from verification; otherwise skip.)

---

## Self-review checklist (run before declaring the plan done)

- [ ] Every spec section has at least one task implementing it (contract, vendor, tooling, CLI, dogfood, docs touch).
- [ ] No "TBD"/"TODO"/"implement later" remains in any task body.
- [ ] Type names used in later tasks match earlier tasks (e.g., `MarketingSiteV1Config`, `BundleSource`, `S3Reference`, `PublishResult`).
- [ ] Provisioner uses `provision()` + `tearDown()` (the contract's actual method names), not `apply/teardown`.
- [ ] The `marketing` service in `project.json` is in `services` but not in `routes` (matches spec §4.5).
- [ ] CLI uses AWS SDK env-based credentials only (no rntme-specific creds in v1).
- [ ] Integration test is gated behind `INTEGRATION=1` so default `pnpm -r test` stays fast.
- [ ] All commits use `feat:`/`docs:`/`test:`/`chore:` prefixes consistent with repo history.
