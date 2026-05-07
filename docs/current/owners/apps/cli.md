# @rntme/cli

The **rntme CLI** is a command-line interface for interacting with the rntme platform. It provides tools for authentication, publishing project blueprint versions, managing projects, and token management. Deploy operations (planning, rendering, applying) are server-side and triggered through the platform control plane.

## Quick Start

### 1. Install

```bash
npm install -g @rntme/cli
# or
pnpm add -g @rntme/cli
```

### 2. Create a project blueprint

```bash
rntme init my-project
```

The canonical authoring and versioning unit is the project blueprint folder rooted at `project.json`.

### 3. Authenticate

```bash
rntme login
# Obtain a token from https://platform.rntme.com and paste it when prompted
```

### 4. Validate the blueprint

```bash
rntme project publish --dry-run --org my-org --project my-project demo/notes-blueprint
```

You can also pass the folder via `--folder demo/notes-blueprint`. The two forms are mutually exclusive.

### 5. Publish

```bash
rntme project publish --org my-org --project my-project demo/notes-blueprint
```

## Commands

```
Usage: rntme [options] <command> [subcommand] [args...]

Commands:
  login                   Save credentials to local credentials file
  logout                  Remove local credentials
  whoami                  Print the authenticated user/org
  bundle publish          Publish a static folder as a sha256-pinned S3 bundle
  project create <slug>   Create a new project
  project list            List projects in the org
  project show [slug]     Show a project
  project publish [dir]   Upload or dry-run a project blueprint
  project version list    List project versions
  project version show    Show a project version
  project deploy          Start a remote platform deployment
  project deployment list List project deployments
  project deployment show Show deployment details
  project deployment watch Watch deployment logs until terminal status

  token create <name>     Create a machine token
  token list              List tokens in the org
  token revoke <id>       Revoke a token

  target list             List deploy targets in the org
  target show <slug>      Show a deploy target
  target create <slug>    Create a new deploy target
  target set-config <slug> Update a deploy target from a JSON patch file

Global options:
  --json                  Output JSON instead of human-readable text
  --base-url <url>        API base URL (default: https://platform.rntme.com)
  --profile <name>        Credentials profile to use
  --org <slug>            Org slug
  --project <slug>        Project slug
  --token <pat>           Auth token (overrides credentials file)
  --verbose               Verbose output
  -q, --quiet             Suppress output on success
  --no-color              Disable colour output
  -h, --help              Show this help and exit
  -v, --version           Print the rntme CLI version and exit
```

Deploy operations are server-side on the platform control plane. Start them with:

```bash
rntme project deploy --org my-org --project my-project --version 4 --target dokploy-preview
rntme project deployment watch --org my-org --project my-project <deployment-id>
```

The CLI never calls Dokploy directly and never reads deploy target secrets.

### Deploying a workflow-enabled blueprint

Workflow demos need a deploy target with provisioned Redpanda, Operaton, and a
BPMN worker image:

```bash
rntme target create dokploy-workflows \
  --org my-org \
  --kind dokploy \
  --display-name "Dokploy workflows" \
  --dokploy-url https://dokploy.example.com \
  --api-token "$DOKPLOY_API_TOKEN" \
  --dokploy-project-id "$DOKPLOY_PROJECT_ID" \
  --event-bus-mode provisioned \
  --workflow-engine-image operaton/operaton:2.1.0 \
  --workflow-worker-image ghcr.io/vladprrs/rntme-bpmn-worker:e2e-bpmn-4e3f55d-json-1
```

Patch existing targets with `rntme target set-config <slug> --from patch.json`.
`--json` is reserved for CLI output mode. Deployment overrides may include
`publicBaseUrl`; the DNS record for that URL must already point at the same
Dokploy host.

```bash
rntme token create deploy-bot --preset deploy --org my-org
rntme project publish --org my-org --project order-fulfillment demo/order-fulfillment-blueprint
rntme project deploy --org my-org --project order-fulfillment --version 1 \
  --target dokploy-workflows \
  --config-overrides ./overrides.json \
  --wait
```

Project lifecycle operations are queued on the platform and can be watched:

```bash
rntme project update --org my-org --project my-project --version 4 --target dokploy-preview --wait
rntme project delete --org my-org --project my-project --confirm my-project --wait
rntme project operation list --org my-org --project my-project
rntme project operation show --org my-org --project my-project <operation-id>
rntme project operation watch --org my-org --project my-project <operation-id>
```

`project update` always requires an explicit `--target`; it never falls back to
the default deploy target implicitly.

## Bundle Publish

`rntme bundle publish` turns a prebuilt static folder into a deterministic tar+gzip bundle, uploads it to S3-compatible storage, and prints the `BundleSource` shape used by marketing-site modules.

```bash
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=testtest \
  rntme bundle publish demo/cv-extract-blueprint/landing \
  --target s3 \
  --bucket cv-extract \
  --endpoint http://localhost:9000 \
  --key-prefix landings/cv-extract \
  --print-json
```

Options:

- `<folder>` - folder to publish; must contain root `index.html`.
- `--target s3` - only target kind in v1.
- `--bucket <bucket>` - S3 bucket.
- `--endpoint <url>` - optional S3-compatible endpoint such as MinIO.
- `--region <region>` - optional AWS region.
- `--key-prefix <prefix>` - object prefix; final key is `<prefix>/<sha256>.tar.gz`.
- `--max-bytes <n>` - source-folder byte cap before bundle creation.
- `--ignore <glob>` - repeatable minimal glob, where `*` matches one segment and `**` crosses separators.
- `--print-json` - print compact `{ "kind": "s3", "bucket", "key", "sha256", ... }` for `project.json`.

Credentials use the AWS SDK default provider chain (`AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, profiles, or instance/task roles). The command does not read rntme platform credentials.

Expected publish failures are printed as `BUNDLE_PUBLISH_*` codes from `@rntme/bundle-publish`, including missing folders, missing `index.html`, oversized inputs, credential failures, and S3 PutObject failures.

## Environment Variables

| Variable | Effect | Example |
|----------|--------|---------|
| `RNTME_BASE_URL` | API base URL (overrides `--base-url`) | `https://platform.rntme.com` |
| `RNTME_TOKEN` | Authentication token (overrides credentials file and `--token`) | `pat_...` |
| `RNTME_PROFILE` | Credentials profile name (overrides `--profile`) | `work` |
| `RNTME_ORG` | Default org slug (overrides credentials `defaultOrg`; `--org` still wins) | `acme` |
| `RNTME_PROJECT` | Default project slug (overrides credentials `defaultProject`; `--project` still wins) | `notes-demo` |
| `RNTME_SERVICE` | Default service slug (when blueprint has multiple services) | `app` |

Resolution order for org/project/service: flag → env → `rntme.json` projectConfig → credentials profile defaults.

`rntme login --token <pat> [--org <slug>] [--project <slug>]` persists the org/project as profile defaults so subsequent commands work without explicit flags or env vars.
When the token lacks deploy scopes, login prints a warning with the `token create
--preset deploy` command.

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Generic error or internal failure |
| `2` | Config or credentials problem |
| `3` | Authentication failed |
| `4` | Forbidden (insufficient scope) |
| `5` | Not found or archived resource |
| `6` | Validation failed |
| `7` | Concurrency conflict (version mismatch) |
| `8` | Rate limited |
| `9` | Network error |
| `10` | Server error (5xx from platform) |

## Bundle format v2

Bundles emitted by `rntme project publish` are v2:

```
{ "version": 2, "files": { ... }, "assets": { ... } }
```

`assets` is a map from project-relative or synthetic path to base64-encoded
bytes. It includes workflow BPMN files under `workflows/**/*.bpmn` so
`workflows/workflows.json` can reference deployable process definitions, and
pre-bundled module provisioner entries keyed by
`assets/provisioners/<safeName(manifest.name)>.entry.js` where `<safeName>`
drops the leading `@` from the package name and replaces `/` with `__`.

Total `assets` size is capped at 10 MiB. CLI publish returns
`CLI_BUNDLE_ASSETS_TOO_LARGE` if exceeded.

## Error Codes

Error codes follow the format `CLI_<LAYER>_<KIND>`. Exit code mapping per [exit.ts](src/errors/exit.ts).

### Config Layer

- `CLI_CONFIG_MISSING` — required local config was not found
- `CLI_CONFIG_INVALID` — local config is malformed or invalid JSON
- `CLI_CONFIG_ARTIFACT_NOT_FOUND` — required blueprint material does not exist

### Credentials Layer

- `CLI_CREDENTIALS_MISSING` — Credentials file not found; run `rntme login`
- `CLI_CREDENTIALS_INVALID` — Credentials file is malformed or corrupted
- `CLI_CREDENTIALS_PERMISSIONS_TOO_OPEN` — Credentials file has unsafe permissions (not 0600)

### Runtime Layer

- `CLI_RESPONSE_PARSE_FAILED` — Platform API response could not be parsed (exit 10)
- `CLI_VALIDATE_LOCAL_FAILED` — local blueprint validation failed (exit 6)
- `CLI_PUBLISH_DIGEST_MISMATCH` — published digest does not match local project bundle (exit 1)
- `CLI_NETWORK_TIMEOUT` — Network request timed out (exit 9)
- `CLI_USAGE` — Incorrect command usage (exit 2)
- `CLI_BUNDLE_ASSETS_TOO_LARGE` — bundle `assets` section exceeds the 10 MiB cap (exit 6)

## See Also

- **CLI design spec:** See `docs/history/specs/historical/2026-04-19-rntme-cli-platform-commands-design.md` in the rntme monorepo
- **Platform API design:** See `docs/history/specs/historical/2026-04-19-platform-api-design.md` in the rntme monorepo
- **Deployment pipeline design:** See `docs/history/specs/historical/2026-04-24-project-deployment-pipeline-design.md` in the rntme monorepo

## Bootstrapping a new project

```bash
rntme init tracker
rntme skills install --agent claude-code   # or --agent cursor
```

In your agent, invoke `Skill: using-rntme`. The pack routes through:
brainstorming-rntme-service → designing-ui + designing-pdm → designing-bindings → designing-qsm + designing-graph-ir → composing-blueprint → publishing-via-rntme-cli.

### `rntme init <slug>`

Scaffolds `project.json` plus a minimal `services/app` project blueprint. Refuses to overwrite an existing `project.json`.

### `rntme skills install --agent <name>`

Installs the 9-skill pack. Agents: `claude-code` (→ `.claude/skills/rntme/*.md`), `cursor` (→ `.cursor/rules/rntme/*.mdc`). Flags: `--target <path>`, `--force`.
