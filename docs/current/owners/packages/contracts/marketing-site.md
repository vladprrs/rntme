# @rntme/contracts-marketing-site-v1

Canonical marketing-site contract v1 for externally-authored static landing bundles. This is a deploy-shaped leaf contract: it defines `publicConfig` validation, types, and error codes, but no RPC service.

## Layout

- `src/schema.ts` - zod schemas for `BundleSource` and `MarketingSiteV1Config`.
- `src/types.ts` - TypeScript types inferred from the schemas.
- `src/index.ts` - public schema, type, validator, and error-code exports.
- `src/error-codes.ts` - typed view of `error-codes.json`.
- `error-codes.json` - canonical `MARKETING_SITE_<LAYER>_<KIND>` codes.
- `test/` - schema and error-code contract tests.

## Public API

```ts
import {
  BundleSourceSchema,
  MarketingSiteV1ConfigSchema,
  validateMarketingSiteConfig,
  type BundleSource,
  type MarketingSiteV1Config,
} from '@rntme/contracts-marketing-site-v1';
```

`BundleSource` is a discriminated union:

- `project-folder` - `{ kind, path }` — canonical default; the folder is packed as a canonical project-version bundle asset at `assets/project-folders/<moduleKey>/<sha256>.tar.gz`. The deploy-runner stage `materializeProjectFolderAssets` rewrites this to a local file path + sha256 before the vendor provisioner runs, so the contract source union stays target-agnostic.
- `s3` - `{ kind, bucket, key, sha256, endpoint?, region? }`
- `local-path` - `{ kind, path, sha256 }`

`MarketingSiteV1Config` contains:

- `source` - a sha256-pinned bundle source.
- `primaryDomain` - hostname for the hosted landing.
- `ssl` - `auto`, `manual`, or `none`.

`validateMarketingSiteConfig(input)` returns a `Result`-shaped object and never throws for validation failures.

## Error Codes

Validation codes live in the `validate` layer:

- `MARKETING_SITE_VALIDATE_INVALID_CONFIG`
- `MARKETING_SITE_VALIDATE_INVALID_SOURCE`
- `MARKETING_SITE_VALIDATE_INVALID_DOMAIN`

Provision-time codes are declared here so vendor modules can share the canonical namespace:

- `MARKETING_SITE_PROVISION_BUNDLE_NOT_FOUND`
- `MARKETING_SITE_PROVISION_HASH_MISMATCH`
- `MARKETING_SITE_PROVISION_INDEX_HTML_MISSING`
- `MARKETING_SITE_PROVISION_DOMAIN_BIND_FAILED`
- `MARKETING_SITE_PROVISION_LOCAL_PATH_IN_PROD`
- `MARKETING_SITE_PROVISION_IMAGE_BUILD_FAILED`
- `MARKETING_SITE_PROVISION_REGISTRY_PUSH_FAILED`

## Invariants

- This package is a contract leaf. It may depend on `zod` and `@rntme/contracts-common-v1`; it must not import implementation packages or modules.
- The contract has no RPC surface in v1.
- Every bundle source is immutable by sha256. Provisioners must verify bytes before hosting.
- Do not bypass `validateMarketingSiteConfig` with casts at package boundaries.

## Commands

- `bun test`
- `bun run build`
- `bun run typecheck`
- `bun run lint`

## Spec

`docs/history/specs/active-rationale/2026-05-07-product-landings-marketing-site-module-design.md`
