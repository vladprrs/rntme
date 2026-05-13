# Marketing-site modules

Marketing-site modules implement `@rntme/contracts-marketing-site-v1`: a deploy-shaped contract for attaching externally-authored static HTML landings as first-class blueprint services.

## Layout

- `modules/marketing-site/README.md` - category stub and vendor list.
- `modules/marketing-site/static-html/` - first vendor, `@rntme/marketing-site-static`.
- `modules/marketing-site/conformance/` - shared conformance suite for vendors.
- `packages/contracts/marketing-site/v1/` - canonical publicConfig schema and error-code namespace.

## Current Vendors

- `@rntme/marketing-site-static` (`modules/marketing-site/static-html/`) hosts a sha256-pinned static HTML bundle. Hosting is performed by the deploy target adapter; the module authoring config does not reference target-owned bundle storage, registry, or Dokploy credentials.

## Source kinds

`publicConfig.source` is one of:

- `{ kind: "project-folder", path }` — the canonical default. `@rntme/blueprint` packs the folder into `assets/project-folders/<moduleKey>/<sha256>.tar.gz` inside the project-version bundle, and `@rntme/deploy-runner`'s `materializeProjectFolderAssets` rewrites the provisioner input to a local file path + sha256 before the vendor provisioner runs.
- `{ kind: "s3", bucket, key, sha256, endpoint?, region? }` — externally-published S3 bundle (used by `rntme bundle publish`).
- `{ kind: "local-path", path, sha256 }` — non-production only.

## Static HTML Deploy Semantics

The vendor module validates `publicConfig.source` and exposes the resolved bundle bytes and `primaryDomain` to the deploy target adapter. Image build, registry push, and Docker app binding are owned by the deploy target adapter (see `@rntme/deploy-dokploy`), which renders the static-site workload as `nginx:1.27-alpine` inside the project-stack Compose resource.

The module exports:

- `publicOutputs.url` - `https://${primaryDomain}`.
- `publicOutputs.deployedSha256` - the deployed bundle hash.
- `ENV_MAPPINGS.marketing-site` - maps `url` to `MARKETING_URL` for the app target.

## Invariants

- No RPC surface in v1.
- Every deploy source is pinned by sha256 and verified before hosting.
- `local-path` sources are forbidden when `targetSecrets.isProd === true`.
- Module code may import contracts and external libraries, but not implementation packages under `packages/**`.
- The marketing module never reads bundle storage credentials, image registries, or Dokploy tokens; static-site hosting (image build, registry push, ingress) lives in the deploy target adapter.

## Conformance

`@rntme/conformance-marketing-site` runs shared scenarios for:

- happy path output URL and deployed hash,
- repeat provisioning idempotency,
- hash mismatch error code.

Every new marketing-site vendor should consume this suite and keep vendor-specific integration tests gated so the default test suite remains fast.

## Commands

- `bun run -F @rntme/conformance-marketing-site test`
- `bun run -F @rntme/marketing-site-static test`
- `bun run -F @rntme/marketing-site-static build`
- `INTEGRATION=1 bun run -F @rntme/marketing-site-static test`

## Gotchas

- `rntme bundle publish` uploads the bundle; this vendor only fetches/verifies and deploys it.
- For MinIO or other S3-compatible endpoints, S3 clients must use path-style addressing and a default region.
- The Dokploy interaction is intentionally a narrow injected shape so module layering stays `modules -> contracts` only.

## Spec

`docs/history/specs/active-rationale/2026-05-07-product-landings-marketing-site-module-design.md`
