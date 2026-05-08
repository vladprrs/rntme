# @rntme/demo-cv-extract-blueprint

Demo project blueprint for CV extraction workflows.

Current documentation: [docs/current/owners/demo/cv-extract-blueprint.md](../../docs/current/owners/demo/cv-extract-blueprint.md)

Local commands:
- `pnpm -F @rntme/demo-cv-extract-blueprint test` when the package defines a test script.
- `pnpm -F @rntme/cli exec rntme bundle publish demo/cv-extract-blueprint/landing --target s3 --bucket cv-extract --key-prefix landings/cv-extract --print-json`

Marketing landing:
- `landing/` is a small static dogfood landing for the `marketing` service.
- Publish a new bundle with `rntme bundle publish`, then update `project.json#modules.marketing.publicConfig.source` with the printed S3 `BundleSource`.
- `MARKETING_DOMAIN` is resolved from the deploy target and used as the landing `primaryDomain`.

Notes:
- Keep this file short. Update the current doc when public API, invariants, gotchas, local commands, or package navigation changes.
