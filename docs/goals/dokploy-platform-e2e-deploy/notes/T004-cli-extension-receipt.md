# T004 — Worker receipt: CLI direct-mode target extension + platform target file

Author: Worker / pm-loop iteration 1
Date: 2026-05-11

## Scope

Extend `apps/cli/src/deploy-engine/` so `rntme platform up --target <file>` can
parse a Dokploy target that carries the platform blueprint's needs:

- `workflows.engine` (Operaton provisioned) + `worker.image`.
- `target.auth.auth0.{domain, audience, redirectUri}` for blueprint var
  resolution (`AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, `AUTH0_REDIRECT_URI`).
- `secrets.extras` accepting both leaf env refs *and* nested-object env
  refs (composite secret like `auth0Mgmt = { tenantDomain, mgmtClientId,
  mgmtClientSecret }` required by `@rntme/identity-auth0`'s provisioner).

Author the canonical platform target file
`/home/coder/project/platform.target.json` for
`rntme-platform/production` (project `wmiyt_0T7SKvS3sr6rzGK`,
env `rvVDXwBImLyL739o1ZdPQ`).

## Files changed

| File | Change |
| --- | --- |
| `apps/cli/src/deploy-engine/target-schema.ts` | Added `WorkflowsTargetSchema`, `Auth0TargetAuthSchema`, `OperatonUiAccessSchema`, `NestedSecretRefSchema`, `ExtraSecretRefSchema`. `secrets.extras` is now `Record<string, ExtraSecretRef>` (leaf-or-nested); `workflows` and `auth.auth0` are optional top-level fields. |
| `apps/cli/src/deploy-engine/load-target.ts` | New helpers `buildAuthSection` and `buildWorkflowsSection`. Maps file → NormalizedDeployTarget with `auth.auth0.clientId` defaulted to `''` (platform blueprint sources the SPA client id from provisioner output, not target.auth — see comment). `secretRefs.extras` now passes the file `extras` through unchanged. |
| `apps/cli/src/deploy-engine/load-secrets.ts` | `SecretRefMap.extras` widened to `Record<string, ExtraSecretRef>`. New `resolveSecrets` walks nested refs and emits composite objects in `ResolvedTargetSecrets.extras[<key>]` (`Record<string, string>`). Sub-key path is included in error messages (`<key>.<subKey>`). |
| `apps/cli/src/deploy-engine/types.ts` | `LoadedTarget.secretRefs.extras` typed as `Record<string, ExtraSecretRef>` (necessary in-folder type alignment, treated as in-scope for this slice — surface is the same `deploy-engine/` directory; the change is mechanical). |
| `apps/cli/test/unit/deploy-engine/load-target.test.ts` | New test: parses `target-platform.json` fixture and asserts workflows.engine, auth.auth0 and nested extras populate correctly. |
| `apps/cli/test/unit/deploy-engine/load-secrets.test.ts` | Two new tests: resolves nested auth0Mgmt object; reports missing sub-key with composite path in the error message. |
| `apps/cli/test/fixtures/target-platform.json` | Fixture for the platform-shaped target (env refs only — no secret values). |
| `platform.target.json` (repo root) | Real platform target pointing at Dokploy project `wmiyt_0T7SKvS3sr6rzGK` and the live `.env` keys (`DOKPLOY_API_KEY`, `AUTH0_*`). Contains no secret values, only env-var references. |

## Gates run

```
bun run --filter @rntme/cli typecheck   → exit 0
bun run --filter @rntme/cli test        → 180 pass / 2 skip / 0 fail (182 tests, 48 files, 7.01s)
bun run --filter @rntme/cli lint        → exit 0
bun run depcruise                       → no violations (818 modules, 1126 deps)
```

## Notable design decisions

- **`auth.auth0.clientId` defaulted to `''`.** `DeployTargetForBuild` types
  `clientId` as required `string`, but the platform blueprint declares
  `AUTH0_SPA_CLIENT_ID ← provision.identity.spaClient.id` — sourced from
  the Auth0 provisioner output, not from `target.auth`. Setting it to
  `''` keeps the field structurally present without leaking a placeholder
  id; `resolveVars` only reads the optional domain/audience/redirectUri
  paths that the blueprint declares. If downstream code asserts a
  non-empty clientId, plan stage will fail loudly in T005 and we'll
  address it then. No silent skip.
- **Composite secrets via nested-object env refs.** Modeled as a union
  `ExtraSecretRef = SecretRef | Record<string, SecretRef>` rather than a
  new `kind` field. Reason: the Auth0 module's `provisioner.requires` is
  named `auth0Mgmt` and the provisioner reads `input.targetSecrets.auth0Mgmt`
  as a `{tenantDomain, mgmtClientId, mgmtClientSecret}` object — the
  nested env-ref shape mirrors that structure 1:1. Future composite
  secrets (e.g. Kafka SASL `{username, password}`) get the same path
  without further schema changes.
- **`platform.target.json` lives at the repo root**, not under
  `targets/` or similar — single platform-bootstrap target per repo,
  matches the spec's `rntme platform up --target ./platform.target.json`
  ergonomics. `.gitignore` covers neither `*.target.json` nor a `targets/`
  prefix, and the file contains only env-ref names, so committing is
  safe.

## Out-of-scope (deferred to later slices)

- `manualAccess.redpandaConsole` and `policyValues` paths in the target
  schema — not required for first platform deploy.
- Secret sources other than `env` (1Password CLI, age-encrypted files).
- Module-level `target.modules[*]` overrides — platform-bootstrap uses
  zero overrides.
- Updating `docs/current/owners/apps/cli.md` and `apps/cli/README.md`
  with the new schema — held back to T005 receipt so the docs land
  alongside the proven deploy flow.

## Stop conditions checked

- `deploy-runner`/`deploy-core` types are consumed as imports (NormalizedDeployTarget,
  ResolvedTargetSecrets). No changes outside `apps/cli/src/deploy-engine/`
  were required. Depcruise green.
- `auth0Mgmt`'s exact shape is documented in
  `modules/identity/auth0/module.json#provisioner.requires` and in
  `modules/identity/auth0/src/provisioner.ts:45` — `Auth0TargetSecrets['auth0Mgmt']
  = { tenantDomain, mgmtClientId, mgmtClientSecret }`. Schema mirrors it
  exactly.

## Next active task

Hand-off to **T005** (Worker): build the CLI (so `dist/platform-blueprint`
is materialised by the postbuild copy step) and run
`bun apps/cli/dist/bin/cli.js platform up --target platform.target.json --log-file …`
against `rntme-platform/production`. Watch the deploy via Dokploy MCP.
