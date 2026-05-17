> Status: active-rationale.
> Date: 2026-05-07.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Product Landings — `marketing-site` Module Category — design

**Status:** brainstorming approved, awaiting user review of this spec
**Author:** brainstorm 2026-05-07
**Related:**
- `docs/decision-system.md` §3.5 Modules & Integrations — this spec adds a new category and first vendor (`locked-pending`).
- `docs/history/specs/historical/2026-04-26-identity-canonical-contract-design.md` — pattern for canonical leaf contracts and category modules. This spec mirrors the contract/vendor split.
- `docs/history/specs/historical/2026-04-26-project-deploy-flow-design.md` — `deploy-core`/`deploy-dokploy` lifecycle. This spec plugs in a new provisioner that uses the same lifecycle.
- `docs/history/specs/historical/2026-05-06-storage-s3-module-design.md` — S3 storage module. Bundle hosting reuses S3-compatible APIs, but the `marketing-site-static` provisioner pulls from arbitrary S3-compatible endpoints and does not depend on the storage module.
- Memories: `rntme_blueprint_vars_vs_provisioner`, `rntme_provisioner_resolver_gap`, `dokploy_compose_dns_collision`, `project_pre_stable_stage`.

**Implementation locations:**
- New canonical contract: `packages/contracts/marketing-site/v1/`
- New module category: `modules/marketing-site/` with first vendor `static-html/`
- New tooling package: `packages/tooling/bundle-publish/`
- CLI command: `apps/cli` (extends `rntme` with `bundle publish`)
- Demo dogfood: `demo/cv-extract-blueprint/` adds a `marketing` service.

---

## 1. Problem and goal

Products built with rntme need top-of-funnel marketing landings. Authoring those landings as in-app `@rntme/ui` artifacts (structured JSON component model) constrains design too much: marketing pages need free-form HTML/CSS produced by external AI design tools (Claude Design, Figma Make, similar). Today rntme has no first-class slot for "a landing page that goes with a product"; products that want one have to spin up a separate Astro project off-blueprint, which violates G1 (blueprint = unit of truth) and creates one-off deploy paths.

**Goal of this spec:** define a thin, blueprint-native way to attach a marketing landing to a product, where the landing is an externally-authored HTML bundle and rntme's job is to publish + host it under the product's domain story. Architecture must not block evolution to build-time wiring (L2) or live integration (L3) without breaking changes.

## 2. Decision-system anchoring

| Bet/filter | How this spec lands |
| --- | --- |
| G1 — blueprint = unit of truth | Landing is a service in `project.json`; the bundle reference (S3 key + sha256) is part of the blueprint. |
| G2 / F5 — AI-authorability | Schema-validated `publicConfig`; CLI publish has `--print-json` for agents; error codes follow `<PKG>_<LAYER>_<KIND>`. |
| G3 — inspectable runtime | N/A for v1 (static hosting), but L3 evolution path keeps observability hooks reachable through the contract. |
| G4 / F1 / F3 — modules under canonical contracts; lean core | New leaf contract `@rntme/contracts-marketing-site-v1`; vendor modules under `modules/marketing-site/<vendor>/`. Nothing added to `packages/runtime/runtime`. |
| G5 / F2 — one canonical way | Marketing pages are deliberately a separate authoring track from the in-app `@rntme/ui` artifact. The "two presentation layers" tension is acknowledged: structured (in-app) and free-form (marketing) serve different audiences and authoring stacks. |
| F6 — repeatability | `BundleSource.sha256` pins the bundle. Identical blueprint + identical bundle key = identical deploy. Fail-fast on hash mismatch. |
| F7 — pre-stable | No backwards-compat shims; existing `apps/landing` is not changed by this spec. Migration of `apps/landing` to this module is deferred (see §7). |
| F8 — leverage standards | Bundle = HTML/CSS/assets (web standard). Hosting = `nginx:alpine` (existing pattern). Storage = S3-compatible (industry standard). No custom format. |

## 3. Architecture

```
packages/contracts/marketing-site/v1/        ← new leaf contract
  ├ package.json                              @rntme/contracts-marketing-site-v1
  ├ src/
  │ ├ index.ts                                public types + validators
  │ └ schema.ts                               JSON Schema for publicConfig
  ├ error-codes.json                          MARKETING_SITE_<LAYER>_<KIND>
  └ test/                                     schema unit tests

modules/marketing-site/                       ← new category
  ├ README.md                                 category overview
  ├ static-html/                              v1 vendor
  │ ├ module.json                             category=marketing-site, vendor=static-html
  │ ├ src/
  │ │ ├ provisioner.ts                        plan/apply/teardown
  │ │ └ build-image.ts                        nginx:alpine + bundle → image
  │ └ test/
  └ conformance/                              shared vendor test suite

packages/tooling/bundle-publish/              ← new generic primitive
  ├ src/
  │ ├ index.ts                                publishFolder()
  │ ├ tar.ts                                  deterministic tar+gzip
  │ ├ hash.ts                                 streaming sha256
  │ └ s3-put.ts                               S3-compatible PutObject
  └ test/

apps/cli/                                     ← extension
  └ src/commands/bundle/publish.ts            rntme bundle publish <folder>
```

**Layering invariants** (enforced by `dependency-cruiser`):
- `packages/contracts/marketing-site/v1` is a leaf — no rntme imports.
- `modules/marketing-site/static-html` imports only `@rntme/contracts-marketing-site-v1` and `@rntme/contracts-provisioner-v1`.
- `packages/tooling/bundle-publish` is leaf-ish — depends only on `@aws-sdk/client-s3`, no rntme imports.
- `apps/cli` consumes `@rntme/bundle-publish` and `@rntme/contracts-marketing-site-v1` (for the source-snippet shape).

**Difference from `identity`/`ai-llm` modules.** Those expose runtime gRPC services and their contracts are RPC-shaped. `marketing-site` is **deploy-shaped** — no RPCs, no events. The contract is a thin schema + capability marker; lifecycle goes through the existing `@rntme/contracts-provisioner-v1`. This is closer to how a future "static-site / docs-site" module category would look.

## 4. Components

### 4.1 `@rntme/contracts-marketing-site-v1`

Single source of truth for `publicConfig` shape and validation.

```ts
// schema.ts (TS shape; emitted to JSON Schema for runtime validation)
export type BundleSource =
  | {
      kind: 's3';
      bucket: string;
      key: string;
      sha256: string;       // hex-encoded, lowercase
      endpoint?: string;    // S3-compatible endpoint, defaults to AWS
      region?: string;
    }
  | {
      kind: 'local-path';   // dev only; provisioner refuses if running in prod target
      path: string;         // relative to blueprint root
      sha256: string;
    };

export type MarketingSiteV1Config = {
  source: BundleSource;
  primaryDomain: string;          // FQDN, e.g. "cv-extract.example.com"
  ssl: 'auto' | 'manual' | 'none';
};
```

Capability marker (declared by every vendor's `module.json`):

```json
{
  "category": "marketing-site",
  "contract": "marketing-site/v1",
  "capabilities": { "hostedSurface": "static-site" }
}
```

Error codes (`MARKETING_SITE_<LAYER>_<KIND>`):
- `MARKETING_SITE_VALIDATE_INVALID_SOURCE`
- `MARKETING_SITE_VALIDATE_INVALID_DOMAIN`
- `MARKETING_SITE_PROVISION_BUNDLE_NOT_FOUND`
- `MARKETING_SITE_PROVISION_HASH_MISMATCH`
- `MARKETING_SITE_PROVISION_INDEX_HTML_MISSING`
- `MARKETING_SITE_PROVISION_DOMAIN_BIND_FAILED`
- `MARKETING_SITE_PROVISION_LOCAL_PATH_IN_PROD`

### 4.2 `@rntme/marketing-site-static` (first vendor)

Implements `@rntme/contracts-provisioner-v1`. No runtime server; the module is invoked only at deploy time.

`plan(config)`:
- For `source.kind: 's3'`: HEAD object, verify ETag/length nonzero. Do not pull bytes.
- For `source.kind: 'local-path'`: refuse if target marker says non-dev.
- Validate `primaryDomain` against deploy target's domain policy (existing `deploy-dokploy` helper).
- Return desired-state diff vs current Dokploy app state.

`apply(config)`:
1. Pull bundle (S3 GetObject or local FS read).
2. Stream-hash; abort with `HASH_MISMATCH` if differs.
3. Untar to a scratch dir; assert `index.html` exists.
4. Build a Docker image: `FROM nginx:alpine`, `COPY ./bundle /usr/share/nginx/html`, ship a small `nginx.conf` (gzip on, cache headers, strict static — no SPA fallback in v1; a `routing` option can be added additively if a real product needs it).
5. Tag image as `<registry>/<project>-<service>:<sha256-short>` and push.
6. Through `deploy-dokploy`: upsert app pointing to the image, bind `primaryDomain`, request SSL (auto = Let's Encrypt).
7. Idempotency: if image tag already exists in registry and Dokploy app already points to it, no-op.

`teardown()`: delete Dokploy app, leave registry image alone (cheap; orphan-cleanup is out of scope).

### 4.3 `@rntme/bundle-publish`

Generic, vendor-neutral. Reusable by any module/task that needs "publish a folder to S3, get back a verifiable reference". Defines its own neutral `S3Reference` type rather than importing `BundleSource` from `@rntme/contracts-marketing-site-v1` — keeps the tool decoupled from any single contract.

```ts
export type PublishTarget =
  | { kind: 's3'; bucket: string; endpoint?: string; region?: string }; // creds via env

export type PublishOptions = {
  keyPrefix?: string;                 // 'landings/cv-extract' → key 'landings/cv-extract/<sha256>.tar.gz'
  maxBytes?: number;                  // default 50 * 1024 * 1024
  ignore?: string[];                  // default ['.git/**', 'node_modules/**']
};

export type S3Reference = {
  bucket: string;
  key: string;
  sha256: string;                     // hex, lowercase
  endpoint?: string;
  region?: string;
};

export type PublishResult = {
  ref: S3Reference;
  bytes: number;
  durationMs: number;
};

export function publishFolder(
  folder: string,
  target: PublishTarget,
  opts?: PublishOptions,
): Promise<Result<PublishResult, PublishError>>;
```

`apps/cli`'s `bundle publish` wraps `S3Reference` in `{ kind: 's3', ...ref }` to produce a contract-shaped `BundleSource` for stdout/`--print-json`. The contract layer owns the `kind` discriminator; the tool stays neutral.

Determinism requirements:
- tar entries sorted by path; mtime fixed (`0`); uid/gid `0`; mode normalized.
- gzip with `--no-name` semantics (no embedded mtime/filename).
- Output: same input folder ⇒ same sha256, regardless of host or filesystem case.

### 4.4 `apps/cli` — `rntme bundle publish`

```
rntme bundle publish <folder> [options]

Options:
  --target=s3                         (only 's3' in v1)
  --bucket=<name>                     required for --target=s3
  --endpoint=<url>                    optional, defaults to AWS
  --region=<region>                   optional
  --key-prefix=<prefix>               default: 'bundles/<basename(folder)>'
  --print-json                        machine-readable output (for AI agents)
  --max-bytes=<int>                   override default
  --ignore=<glob>                     repeatable
```

Auth: standard AWS-SDK env (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL` optional). No rntme-specific creds in v1.

Stdout (human form):
```
✓ Published 1.24 MB in 2.31s
  bucket: rntme-cv-extract
  key:    landings/cv-extract/abc123def456.tar.gz
  sha256: abc123def456…

Paste into project.json → modules.<name>.publicConfig.source:
{
  "kind": "s3",
  "bucket": "rntme-cv-extract",
  "key": "landings/cv-extract/abc123def456.tar.gz",
  "sha256": "abc123def456…"
}
```

`--print-json` emits the `BundleSource` object on stdout (agent-friendly).

### 4.5 Blueprint integration

```json
{
  "name": "cv-extract",
  "services": ["app", "marketing"],
  "modules": {
    "openrouter": { "package": "@rntme/ai-llm-openrouter", "publicConfig": { /* … */ } },
    "marketing": {
      "package": "@rntme/marketing-site-static",
      "publicConfig": {
        "source": {
          "kind": "s3",
          "bucket": "rntme-cv-extract",
          "key": "landings/abc123.tar.gz",
          "sha256": "abc123…"
        },
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

Notes:
- `marketing` is in `services` (deploy unit), but **not** in `routes` — it is a separate hosted unit with its own domain, not a route inside the runtime.
- S3 credentials for `provisioner.apply` are not in the blueprint. They live in deploy-target environment (e.g., `target.bundleStorage.s3.{accessKey,secretKey,endpoint}`), resolved at deploy-time through the existing target-config mechanism.
- Per `rntme_blueprint_vars_vs_provisioner` memory, `${MARKETING_DOMAIN}` resolves at PLAN time, so `target.marketing.primaryDomain` must exist on the deploy target before `rntme deploy` runs.

## 5. Data flow

### Phase A — Publish (off-runtime, initiated by author)

```
designer (Claude Design / Figma Make)
   │ exports HTML/CSS/assets
   ▼
./dist/landing/
   │
   │  rntme bundle publish ./dist/landing --target=s3 --bucket=… --key-prefix=…
   ▼
@rntme/bundle-publish
   ├── deterministic tar+gzip
   ├── streaming sha256
   ├── S3 PutObject (key: <prefix>/<sha256>.tar.gz)
   └── stdout: BundleSource snippet
   │
   ▼
author/agent edits project.json → modules.marketing.publicConfig.source
   │
   ▼
git commit
```

### Phase B — Deploy (rntme runtime / platform)

```
project.json
   │
   ▼
blueprint validate (parse → structural → references → consistency)
   │  publicConfig validated by marketing-site/v1 schema
   ▼
deploy-core plan
   │  resolveProvisioner(@rntme/marketing-site-static)
   │  provisioner.plan(config) → S3 HEAD + domain check
   ▼
provisioner.apply(config)
   │  pull bundle → verify sha256 → assert index.html
   │  docker build (nginx:alpine + bundle) → push registry
   │  deploy-dokploy.upsertApp(image, primaryDomain, ssl)
   ▼
Dokploy → traefik → live landing at primaryDomain
```

### Repeatability

- Identical `project.json` + identical S3 object behind `(bucket, key, sha256)` ⇒ identical deploy.
- Bundle reupload under same key with different content ⇒ `MARKETING_SITE_PROVISION_HASH_MISMATCH` at `apply`.
- Rollback = revert `BundleSource` block in blueprint to previous `(key, sha256)` and redeploy.

### How L2/L3 attach without breaking v1

- **L2 (build-time wiring):** insert a step between "verify sha256" and "docker build" that walks the HTML for `data-rntme-*` markers and substitutes values from a new `wiring` block in `publicConfig`. v1 bundles without markers are no-ops. Contract evolves additively (`wiring` becomes optional in v1.x).
- **L3 (live):** add `renderMode: 'static' | 'edge'` to the contract; `'edge'` selects a different image (nginx + edge worker, or SSR runtime). Existing `'static'` (default) keeps identical behavior.

## 6. Validation and error handling

| Phase | Check | Error code |
| --- | --- | --- |
| CLI publish | folder exists | `BUNDLE_PUBLISH_FOLDER_MISSING` |
| CLI publish | folder size ≤ maxBytes | `BUNDLE_PUBLISH_TOO_LARGE` |
| CLI publish | `index.html` present | `BUNDLE_PUBLISH_NO_INDEX_HTML` |
| CLI publish | S3 creds set | `BUNDLE_PUBLISH_S3_CREDS_MISSING` |
| Blueprint structural | `publicConfig` matches v1 schema | `MARKETING_SITE_VALIDATE_INVALID_SOURCE`, `MARKETING_SITE_VALIDATE_INVALID_DOMAIN` |
| Blueprint consistency | if `${MARKETING_DOMAIN}` referenced, `vars.MARKETING_DOMAIN` declared | existing `BLUEPRINT_VALIDATE_VAR_MISSING` |
| Provisioner plan | S3 object reachable (HEAD) | `MARKETING_SITE_PROVISION_BUNDLE_NOT_FOUND` |
| Provisioner plan | `local-path` only in dev target | `MARKETING_SITE_PROVISION_LOCAL_PATH_IN_PROD` |
| Provisioner apply | sha256 matches | `MARKETING_SITE_PROVISION_HASH_MISMATCH` |
| Provisioner apply | bundle has `index.html` | `MARKETING_SITE_PROVISION_INDEX_HTML_MISSING` |
| Provisioner apply | Dokploy domain bind succeeds | `MARKETING_SITE_PROVISION_DOMAIN_BIND_FAILED` |

All errors returned as `Result<T, E>` per rntme convention; no exceptions cross package boundaries.

## 7. Testing

| Level | Coverage | Mechanism |
| --- | --- | --- |
| Unit (contract) | JSON Schema accepts valid configs, rejects invalid | vitest in `packages/contracts/marketing-site/v1` |
| Unit (bundle-publish) | tar+gzip is deterministic; ignore-globs respected; stream-hash matches reference; `maxBytes` enforced | vitest with in-memory FS |
| Unit (provisioner) | plan/apply diff math, idempotency on repeat | vitest with mocked S3 + mocked deploy-dokploy |
| Conformance | shared suite asserting any vendor satisfies plan/apply/teardown contract | `modules/marketing-site/conformance/` (mirrors `modules/identity/conformance`) |
| Integration | real MinIO + local Docker registry; full apply path producing a runnable image | docker-compose harness; CI behind a flag (skip on free runners) |
| E2E demo | `demo/cv-extract-blueprint` deploys with a `marketing` service; landing reachable | extends existing `demo/cv-extract-blueprint/test` |

## 8. Scope, evolution, dogfood

### In scope (v1)

- New leaf contract `@rntme/contracts-marketing-site-v1`.
- Vendor module `@rntme/marketing-site-static` (HTML bundle from S3 → static nginx).
- Generic `@rntme/bundle-publish` package.
- `rntme bundle publish` CLI command.
- Demo dogfood: add `marketing` service to `demo/cv-extract-blueprint`.

### Out of scope (deferred)

- L2 build-time wiring (`data-rntme-*` HTML rewrite). Separate spec.
- L3 live integration (auth-aware components, forms → product API, shared event store). Separate spec.
- `--target=platform` (publish to platform.rntme.com rustfs with WorkOS auth). Separate spec.
- Multi-locale, A/B variants, redirects/headers beyond `primaryDomain` + `ssl`.
- Migration of `apps/landing` (rntme.com) to this module. Deferred until L3 lands — current `apps/landing` uses Astro features (MDX content, React components, dynamic sections) that exceed L1's static-HTML contract. Migrating prematurely would lose value.
- Bundle GC / orphaned-image cleanup in registry.

### Evolution path

| Version | Adds | Breaking? |
| --- | --- | --- |
| v1 | `marketing-site-static`, S3 publish, bundle pin | — |
| v1.1 | `--target=platform`, rntme-platform auth | No |
| v2 (L2) | `wiring: { ctas, forms, brandTokens }` in contract; HTML rewrite step in provisioner | No (additive; bundles without markers stay no-op) |
| v3 (L3) | `renderMode: 'edge'` or new vendor `marketing-site-edge`; auth-aware components | No (additive) |

### Dogfood

- v1 proof: `demo/cv-extract-blueprint` gains a `marketing` service serving a real landing for the existing cv-extract demo product.
- `apps/landing` (rntme.com) migration deferred to L3.

## 9. Docs touch

| Surface | Change |
| --- | --- |
| `docs/decision-system.md` §3.5 | Add bet line: `marketing-site` category, first vendor `marketing-site-static`, `locked-pending` until impl lands. |
| `AGENTS.md` Repo Map / Modules | Add `marketing-site` row to category table; mention `bundle publish` under common commands if relevant. |
| `docs/current/owners/modules/marketing-site.md` | New owner doc — category overview, vendor list, contract reference. |
| `docs/current/owners/packages/contracts/marketing-site.md` | New owner doc — contract surface, validation, error codes. |
| `docs/current/owners/packages/tooling/bundle-publish.md` | New owner doc — `publishFolder` API, determinism guarantees. |
| `docs/current/owners/apps/cli.md` | Document `rntme bundle publish`. |
| New READMEs (stubs, point to owner docs) | `packages/contracts/marketing-site/v1/`, `modules/marketing-site/`, `modules/marketing-site/static-html/`, `modules/marketing-site/conformance/`, `packages/tooling/bundle-publish/`. |
| `apps/cli/README.md` | Add `bundle publish` to local commands. |
| `demo/cv-extract-blueprint/README.md` | Note new `marketing` service after impl. |

`docs/README.md`, root `README.md`, `CLAUDE.md` — not touched.

## 10. Open questions deferred to plan

- Exact tar+gzip determinism strategy: roll our own or use an existing deterministic tar (`@npmcli/tar` + flags). Decide during plan, not spec.
- nginx config defaults (gzip levels, cache headers, SPA fallback opt-in): finalize during impl with sensible defaults.
- Whether to emit a CloudEvent on successful deploy (`MarketingSiteDeployed`) — defer; not needed for L1 inspectability.
- How to expose `bundle publish` outputs to AI agents in long-running flows (file-based handoff vs stdout pipe). Plan-time concern.
