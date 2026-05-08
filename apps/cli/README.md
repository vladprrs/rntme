# @rntme/cli

Command-line workspace for rntme project publishing, deploy, and skill commands.

Current documentation: [docs/current/owners/apps/cli.md](../../docs/current/owners/apps/cli.md)

Local commands:
- `pnpm -F @rntme/cli test` when the package defines a test script.
- `pnpm -F @rntme/cli exec rntme bundle publish <folder> --target s3 --bucket <bucket> --print-json`

Notes:
- Keep this file short. Update the current doc when public API, invariants, gotchas, local commands, or package navigation changes.
