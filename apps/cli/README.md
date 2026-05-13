# @rntme/cli

Command-line workspace for rntme project publishing, deploy, and skill commands.

Current documentation: [docs/current/owners/apps/cli.md](../../docs/current/owners/apps/cli.md)

Local commands:
- `bun test test/unit test/integration`
- `bun test test/e2e`
- `bun exec rntme bundle publish <folder> --target s3 --bucket <bucket> --print-json`

## Direct-mode and platform bootstrap

The CLI operates in three modes:

- **direct** — `rntme deploy <bp> --target <file>` deploys any blueprint without a running platform.
- **platform-client** — existing `rntme login` + `rntme project deploy` via the platform server.
- **platform-bootstrap** — `rntme platform up/down` deploys/tears down the bundled rntme-platform blueprint via direct-mode.

Direct-mode requires a target JSON file describing the Dokploy instance:

```json
{
  "kind": "dokploy",
  "displayName": "preview",
  "config": {
    "dokployUrl": "https://dokploy.example.com",
    "dokployProjectId": "01HZ..."
  },
  "secrets": {
    "apiToken": { "source": "env", "name": "DOKPLOY_API_TOKEN" }
  },
  "eventBus": { "mode": "provisioned" },
  "storage": {
    "mode": "provisioned",
    "provider": "rustfs",
    "publicBaseUrl": "https://files.preview.example.com",
    "accessKeyRef": "rustfs-access-key",
    "secretKeyRef": "rustfs-secret-key"
  },
  "publicBaseUrl": "https://preview.example.com"
}
```

Omit `storage` to use external/module-owned storage. Provisioned RustFS stores
secret names in the target file; the values are resolved from `secrets.extras`
at deploy time.

Commands:

```bash
rntme deploy <blueprint-dir> --target <file-path> [--name <suffix>] [--dry-run] [--json] [--log-file <path>]
rntme platform up --target <file-path> [--name <suffix>] [--dry-run] [--json] [--log-file <path>]
rntme platform down --target <file-path> [--json]
```

Notes:
- Keep this file short. Update the current doc when public API, invariants, gotchas, local commands, or package navigation changes.
