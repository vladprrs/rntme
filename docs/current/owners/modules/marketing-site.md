# Marketing-site modules

Marketing-site modules implement `@rntme/contracts-marketing-site-v1`: a deploy-shaped contract for attaching externally-authored static HTML landings as first-class blueprint services.

## Layout

- `modules/marketing-site/README.md` - category stub and vendor list.
- `modules/marketing-site/static-html/` - first vendor, `@rntme/marketing-site-static`.
- `modules/marketing-site/conformance/` - shared conformance suite for vendors.
- `packages/contracts/marketing-site/v1/` - canonical publicConfig schema and error-code namespace.

## Current Vendors

- `@rntme/marketing-site-static` (`modules/marketing-site/static-html/`) hosts a sha256-pinned tar+gzip HTML bundle via `nginx:alpine`.

## Static HTML Deploy Semantics

The provisioner:

1. Reads an immutable bundle source from `publicConfig.source`.
2. Fetches from S3 or reads a local bundle path in non-production targets.
3. Verifies sha256 before unpacking.
4. Untars into a scratch directory and requires root `index.html`.
5. Builds and pushes an `nginx:alpine` image containing the bundle.
6. Calls an injected Dokploy-shaped client to upsert a Docker app bound to `primaryDomain`.

The module exports:

- `publicOutputs.url` - `https://${primaryDomain}`.
- `publicOutputs.deployedSha256` - the deployed bundle hash.
- `ENV_MAPPINGS.marketing-site` - maps `url` to `MARKETING_URL` for the app target.

## Invariants

- No RPC surface in v1.
- Every deploy source is pinned by sha256 and verified before image build.
- `local-path` sources are forbidden when `targetSecrets.isProd === true`.
- Module code may import contracts and external libraries, but not implementation packages under `packages/**`.
- Docker image build requires `docker buildx` unless tests inject a fake build function through target secrets.

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
