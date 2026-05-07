> Status: active-rationale.
> Date: 2026-05-04.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# `rntme local` — local-deploy CLI for any blueprint — design

**Status:** brainstorming approved, awaiting user review of this spec
**Author:** brainstorm 2026-05-04
**Related:**
- `docs/history/specs/historical/2026-04-24-project-deployment-pipeline-design.md` — `provision → plan → render → apply → verify` pipeline; this spec adds a new render+apply pair (`@rntme/deploy-local`) following that pattern.
- `docs/history/specs/historical/2026-05-01-provisioned-event-bus-design.md` — Redpanda compose generator (`renderRedpandaCompose`); this spec extracts it to a target-neutral helper so both Dokploy and Local adapters share it.
- `docs/history/specs/historical/2026-05-03-module-provisioner-contract-design.md` — module provisioner contract; this spec defines local-mode behavior (skipped by default, opt-in via `--provision`).
- `docs/history/specs/historical/2026-05-04-notes-demo-fresh-tenant-deployable-design.md` — fresh-tenant deploy via Dokploy. This spec is the local-mode counterpart; the same notes-blueprint should run via `rntme local up` without any Auth0 tenant at all.
- Future spec (out of scope here): `platform-as-blueprint` — converts `apps/platform-http` into a blueprint and uses `rntme local up` to dev it. This spec is the prerequisite enabler.

**Implementation locations:**
- New package — `packages/deploy/deploy-local/` (render + apply + verify, mirrors `deploy-dokploy` shape).
- New package — `packages/modules/module-dev-identity/` (drop-in identity contract for local).
- Composer hook — `packages/artifacts/blueprint/src/compose/substitute-identity-for-local.ts`; wired through `loadComposedBlueprint` option.
- Plan extension — `packages/deploy/deploy-core/src/plan.ts` (`DeploymentTarget` union: add `'local'` kind; default `eventBus.mode` per service count).
- Redpanda extraction — move `renderRedpandaCompose` out of `packages/deploy/deploy-dokploy/src/render.ts` into target-neutral `packages/deploy/deploy-core/src/render-helpers/redpanda.ts`; both adapters consume it.
- CLI commands — `apps/cli/src/commands/local/{up,down,status,logs,reset,ps}.ts` + `_workdir.ts` + `_docker.ts`.
- Runtime image release — new CI workflow in repo root publishing `ghcr.io/vladprrs/rntme-runtime:<version>` from `packages/runtime/runtime/`.
- Docs — `AGENTS.md §6` how-to "spin up a blueprint locally"; `apps/cli/README.md` commands table; new READMEs for `@rntme/deploy-local` and `@rntme/module-dev-identity`.

## 1. Problem

Every rntme blueprint today can only be exercised by going through the full platform → Dokploy deploy pipeline:

1. `rntme project publish` to bundle and upload to platform's rustfs
2. `rntme project deploy --target dokploy-...` to enqueue a deployment
3. Wait for the executor (`provision → plan → render → apply → verify`) to finish on a remote VM
4. Hit the resulting host

This costs minutes per iteration, requires a live Dokploy target + Auth0 tenant + remote network, and means **`demo/notes-blueprint` cannot be tried by a new contributor without first owning Dokploy + Auth0 credentials**.

There is no local equivalent. The runtime (`@rntme/runtime`) can boot one service in-process for tests, but it is not packaged as a one-command UX, has no compose-rendering step that fans services into containers, and has no story for project-level composition (modules, identity, multi-service eventing) without going through the production deploy pipeline.

The market analogues (Supabase, Encore, Wasp, Convex, Multica) all converge on a single pattern: **one CLI command renders a docker-compose, brings it up, prints a status table with all URLs, no external service setup required for hello-world**. rntme has every internal piece (composed blueprint, plan pipeline, runtime container) but no command that wires them.

## 2. Goal

`rntme local up [path]` takes any rntme blueprint folder and brings it up locally via `docker compose up -d`. The user sees a Supabase-style status table with all URLs. No Auth0 / WorkOS / external secrets needed for the hello-world path.

**Success criteria (acceptance):**

1. **Single-service hello-world.** A user with only Docker installed runs `git clone <notes-blueprint-repo> && rntme local up` and within 30 seconds sees a working UI on `http://localhost:<port>`, can log in as `dev@local`, add notes, restart (`local down && local up`), and the notes are still there.
2. **Multi-service.** `rntme local up` against a multi-service blueprint launches Redpanda + N runtime containers, cross-service events propagate, all reachable on localhost ports.
3. **Reset.** `rntme local reset` always returns the blueprint to clean state.
4. **Logs.** `rntme local logs <service>` streams that service's logs (`-f` tails).
5. **Multi-blueprint isolation.** Two blueprints checked out into different folders, both `up`, do not collide on container names, networks, volumes; ports either auto-allocate or fail with a clear `--port-base` hint.
6. **Snapshot tests.** `@rntme/deploy-local` emits deterministic compose YAML for typical blueprint shapes; snapshots are version-controlled.

## 3. Non-goals

- **Convert `apps/platform-http` to a blueprint.** Separate spec. This spec is a prerequisite enabler — once it lands, dogfooding the platform is just `rntme local up platform-blueprint/`.
- **File watch / hot reload.** Follow-up spec. Design must not preclude it (a `watch.ts` + `up --watch` flag will slot in cleanly).
- **K8s / k3d / kind / swarm-on-localhost.** Compose CLI only. K8s parity is a separate adapter someday.
- **Local registry / private images / per-service custom Dockerfiles.** All services use the published `rntme-runtime` base image with bind-mounted artifacts. If a future blueprint needs custom code, separate spec.
- **TLS / mkcert / domain routing on localhost.** Plain `http://localhost:<port>` per service. OAuth callbacks for `--keep-identity` users work because Auth0/WorkOS allow `http://localhost` callback URLs.
- **`rntme local sync` (import production state for debugging).** Separate spec.
- **Unification of `rntme local up` with `rntme project deploy --target local`.** This spec ships local under its own `local` namespace; convergence with `project deploy` waits until both are stable.
- **File system permissions on Linux corner cases.** Named volumes only (no host bind-mount of writable data paths) sidesteps uid/gid wars.

## 4. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Scope of this spec | `deploy-local` adapter only. Platform conversion + dogfooding handled by separate later spec. |
| D2 | Local container orchestrator | `docker compose` CLI shell-out. Reuses existing Compose rendering style from `deploy-dokploy`; matches Supabase / Encore / Wasp / Multica / n8n / Appsmith. K8s and direct Docker SDK rejected. |
| D3 | Lifecycle model | Daemon (Supabase-style): `up` / `down` / `status` / `logs` / `reset` / `ps`. `up` brings detached containers + prints table + exits. Foreground `dev` mode deferred to follow-up. |
| D4 | Identity for hello-world | Auto-substitute. `@rntme/module-dev-identity` (new) replaces any `contract: 'identity'` module at compose time when target.kind=`'local'`. `--keep-identity` flag opts out and reads `.env.local` for real Auth0/WorkOS credentials. |
| D5 | Image strategy | Runtime base image (`ghcr.io/vladprrs/rntme-runtime:<pinned>`) + read-only bind-mount of blueprint folder. No `docker build` per `up`; no per-service published image. Sub-second restart loop. |
| D6 | Event bus default | When `target.kind === 'local'` and project has 1 service: `eventBus.mode = 'in-memory'`. Multi-service: `eventBus.mode = 'provisioned'` (Redpanda in compose). User can override via deploy config; both modes already exist in `deploy-core`. |
| D7 | Module provisioners in local | Skipped by default (most reconcile remote state we don't need locally — Auth0 clients, S3 buckets). `--provision` opt-in to run them. dev-identity has no provisioner so the auth flow needs no opt-in. |
| D8 | MVP scope | Full surface: single + multi-service blueprints both work. No watch/hot-reload (follow-up). |
| D9 | Workdir location | `~/.rntme/local/<slug>/` where slug = `<blueprint-dirname>-<sha8(absPath)>`. Keeps blueprint git tree clean. |
| D10 | Compose project naming | `rntme-local-<slug>`. Avoids collisions between two checkouts of the same blueprint. |
| D11 | Edge gateway in local | None. Each service binds to `127.0.0.1:<port>` directly. No Nginx, no Traefik, no domain routing. |
| D12 | Snapshot tests | Yes. `@rntme/deploy-local` ships golden compose YAMLs for: notes-blueprint, a synthetic 2-service blueprint, and a blueprint with `--keep-identity`. |
| D13 | Workspace package layout | New packages under `packages/deploy/deploy-local/` and `packages/modules/module-dev-identity/`. Follows existing per-package README convention. |

## 5. Architecture

### 5.1 Package boundaries

```
packages/deploy/deploy-local/                       NEW
  src/
    render.ts            renderLocalPlan(plan, config) → LocalRendered
    apply.ts             applyLocalPlan(rendered, ctx) → ApplyResult
    verify.ts            verifyLocalPlan(rendered, ctx) → VerifyResult
    compose/             single-file YAML builder
    types.ts
  test/unit/             snapshot tests for typical blueprints

packages/modules/module-dev-identity/               NEW
  module.json
  src/server/            JWT issuer + /auth/* endpoints + pre-step middleware
  src/client/            LoginScreen, UserBadge, login()/logout() operations
  test/unit/

packages/artifacts/blueprint/                       EXTEND
  src/compose/
    substitute-identity-for-local.ts                NEW: composer hook
    load-composed-blueprint.ts                      add option { localIdentitySubstitution? }

packages/deploy/deploy-core/                        EXTEND
  src/plan.ts            DeploymentTarget union: add 'local' kind;
                          target.kind='local' triggers default eventBus mode resolution
  src/render-helpers/
    redpanda.ts                                     NEW (extracted from deploy-dokploy)

packages/deploy/deploy-dokploy/                     EXTEND
  src/render.ts          renderRedpandaCompose import becomes
                          @rntme/deploy-core/render-helpers/redpanda

apps/cli/                                           EXTEND
  src/commands/local/
    up.ts down.ts status.ts logs.ts reset.ts ps.ts
    _workdir.ts _docker.ts
```

The boundary line: `@rntme/deploy-local` knows nothing about CLI; CLI knows nothing about Docker internals. Same separation as `deploy-dokploy`.

### 5.2 Flow of `rntme local up`

```
1. Resolve blueprint dir (cwd or [path] arg).
2. Pre-flight:
   - docker compose available?           else exit 2
   - docker daemon up?                    else exit 2
   - blueprint dir has node_modules/?     else `pnpm install` step (if package.json present)
3. loadComposedBlueprint(dir, {
     localIdentitySubstitution: !flags.keepIdentity,
   })
   ↳ identity modules → @rntme/module-dev-identity
4. buildProjectDeploymentPlan(composed, {
     target: {
       kind: 'local',
       bindHost: '127.0.0.1',
       portBase: flags.portBase ?? 3000,
     },
     eventBus: composed.services.length === 1
       ? { mode: 'in-memory' }
       : { mode: 'provisioned' },
     skipModuleProvisioners: !flags.provision,
   })
5. renderLocalPlan(plan, {
     runtimeImage: 'ghcr.io/vladprrs/rntme-runtime:<pinned>',
     blueprintHostPath: <abs path>,
   })
   → { composeYaml, envFile, blueprintBindMounts }
6. applyLocalPlan(rendered, { workdir: ~/.rntme/local/<slug>/ }):
   a. Write compose + .env into workdir
   b. shell-out: docker compose -p rntme-local-<slug> up -d
   c. Wait for healthchecks (timeout 60s, configurable)
7. verifyLocalPlan: HTTP GET /health on each service
8. Print status table (see §7).
```

`down`, `status`, `logs`, `reset`, `ps` re-resolve the same workdir (slug from blueprint path) and shell-out to corresponding `docker compose` subcommands.

## 6. CLI surface

```
rntme local up [path]              Bring blueprint up locally.
                                   --keep-identity       Don't substitute identity → real auth from .env.local
                                   --provision           Run module provisioners
                                   --rebuild             Pass --build to docker compose
                                   --port-base N         Base port (default 3000)
                                   --runtime-image TAG   Override pinned runtime image (dev only)

rntme local down [path]            Stop containers; volumes preserved.
                                   --remove-volumes      Also remove volumes (alias `reset`)

rntme local status [path]          Print status table.
                                   --json                Machine-readable

rntme local logs [service] [path]  Stream logs (all services if no [service]).
                                   -f / --follow         Tail mode
                                   --tail N              Last N lines

rntme local reset [path]           down --remove-volumes + up

rntme local ps [path]              Pass-through to `docker compose ps` for the blueprint.
```

`[path]` defaults to cwd. All commands resolve the same workdir from blueprint absolute path.

**Exit codes:**
- 0 — success
- 1 — generic error
- 2 — docker not available
- 3 — port conflict (with hint to use `--port-base`)
- 4 — blueprint validation failed (validator errors printed verbatim)
- 5 — healthcheck timeout

## 7. Status table (Supabase-style)

```
✔ Blueprint loaded         notes-blueprint @ /home/coder/notes
✔ Identity substituted     auth0-spa → @rntme/module-dev-identity
✔ Plan built               1 service, event-bus: in-memory
✔ Compose rendered         ~/.rntme/local/notes-a3f2/docker-compose.yml
✔ Containers up            rntme-local-notes-a3f2 (1 container)
✔ Healthy                  app (200 OK in 1.2s)

┌──────────────────────────────────────────────────────────────────┐
│  notes-blueprint  (project: rntme-local-notes-a3f2)              │
├──────────────────────────────────────────────────────────────────┤
│  app                                                             │
│    UI         http://localhost:3001/                             │
│    API        http://localhost:3001/api/                         │
│    DB         ~/.rntme/local/notes-a3f2/data/app.sqlite          │
│                                                                  │
│  Identity     dev@local (auto-login enabled)                     │
│                                                                  │
│  Logs         rntme local logs                                   │
│  Stop         rntme local down                                   │
│  Reset        rntme local reset                                  │
└──────────────────────────────────────────────────────────────────┘
```

Multi-service variant adds rows per service and an `Event bus  redpanda @ event-bus:9092 (internal)` line.

## 8. Render output (compose YAML)

### 8.1 Single-service example (notes-blueprint, in-memory event bus)

```yaml
name: rntme-local-notes-a3f2
services:
  app:
    image: ghcr.io/vladprrs/rntme-runtime:0.x.x
    container_name: rntme-local-notes-a3f2-app
    environment:
      RNTME_BLUEPRINT_DIR: /var/rntme/blueprint
      RNTME_SERVICE_NAME: app
      RNTME_PERSISTENCE_MODE: persistent
      RNTME_PERSISTENCE_PATH: /var/rntme/data/app.sqlite
      RNTME_HTTP_PORT: 3001
      RNTME_EVENT_BUS_MODE: in-memory
      RNTME_PUBLIC_CONFIG_JSON: '{"modules":{"identity":{"loginAs":"dev@local","autoLogin":true}}}'
    volumes:
      - type: bind
        source: /home/coder/notes        # absolute host path to blueprint dir
        target: /var/rntme/blueprint
        read_only: true
      - type: volume
        source: app-data
        target: /var/rntme/data
    ports:
      - "127.0.0.1:3001:3001"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://127.0.0.1:3001/health"]
      interval: 5s
      timeout: 3s
      retries: 6
      start_period: 10s

volumes:
  app-data: {}
```

### 8.2 Multi-service example (Redpanda in compose)

```yaml
services:
  event-bus:
    image: docker.redpanda.com/redpandadata/redpanda:vXX.YY    # same as deploy-dokploy
    command: [...]                                              # via render-helpers/redpanda
    volumes:
      - event-bus-data:/var/lib/redpanda/data
    healthcheck: [...]

  service-a:
    image: ghcr.io/vladprrs/rntme-runtime:0.x.x
    environment:
      RNTME_EVENT_BUS_MODE: external
      RNTME_EVENT_BUS_BROKERS: event-bus:9092
      RNTME_EVENT_BUS_PROTOCOL: plaintext
      RNTME_EVENT_BUS_TOPIC_PREFIX: rntme.local-notes-a3f2.
      ...
    depends_on:
      event-bus: { condition: service_healthy }

  service-b: { ... analogous ... }

volumes:
  event-bus-data: {}
  service-a-data: {}
  service-b-data: {}
```

### 8.3 Determinism

`renderLocalPlan(plan, config)` is pure. Given the same composed-blueprint + config, output is byte-identical. Snapshot tests in `packages/deploy/deploy-local/test/unit/` enforce this.

### 8.4 What we do NOT render (vs deploy-dokploy)

- Edge gateway / Nginx — services bind to `127.0.0.1:<port>` directly.
- Traefik labels.
- `dokploy-network` overlay — default compose network is sufficient.
- Module provisioner mini-images — opt-in via `--provision`.

### 8.5 Reuse across adapters

`renderRedpandaCompose` extracted from `deploy-dokploy` into `@rntme/deploy-core/src/render-helpers/redpanda.ts`. Both `deploy-dokploy` and `deploy-local` import it. Avoids YAML drift between two implementations.

## 9. `@rntme/module-dev-identity`

Drop-in replacement for any identity module in local mode. Issues a fixed `dev@local` session.

### 9.1 module.json

```json
{
  "name": "@rntme/module-dev-identity",
  "version": "0.1.0",
  "kind": "integration-module",
  "contract": "identity",
  "environments": ["local"],
  "capabilities": ["session", "user-info"],
  "client": {
    "config": {
      "schema": {
        "type": "object",
        "properties": {
          "loginAs":     { "type": "string",  "default": "dev@local" },
          "displayName": { "type": "string",  "default": "Dev User" },
          "autoLogin":   { "type": "boolean", "default": true }
        }
      }
    },
    "boot":       "./client/boot.js",
    "components": {
      "LoginScreen": "./client/login-screen.js",
      "UserBadge":   "./client/user-badge.js"
    },
    "operations": {
      "login":  "./client/operations.js#login",
      "logout": "./client/operations.js#logout"
    }
  },
  "server": {
    "preStep":   "./server/pre-step.js",
    "endpoints": "./server/provider.js"
  }
}
```

### 9.2 Behavior

- `autoLogin: true` (default) — UI loads as `dev@local` with no LoginScreen
- `autoLogin: false` — LoginScreen with single "Login as dev@local" button
- `logout()` — server clears cookie → UI returns to LoginScreen
- Server pre-step accepts any Bearer JWT signed by per-blueprint dev secret; invalid → session = null

### 9.3 Substitution mechanic

```ts
// packages/artifacts/blueprint/src/compose/substitute-identity-for-local.ts
export function substituteIdentityForLocal(
  composed: ComposedProject,
): Result<ComposedProject> {
  const next = { ...composed, modules: [...composed.modules] };
  for (let i = 0; i < next.modules.length; i++) {
    if (next.modules[i].contract === 'identity') {
      next.modules[i] = loadDevIdentityModule({
        publicConfig: { loginAs: 'dev@local', autoLogin: true },
      });
    }
  }
  return ok(next);
}
```

Called from `loadComposedBlueprint(dir, { localIdentitySubstitution: true })`. Affects only the in-memory composed structure — blueprint JSON files are never modified.

### 9.4 What gets substituted

- Any entry in `project.json#modules` whose loaded `module.json` declares `contract: 'identity'` (recognized by reading the resolved package's manifest, not by package name).
- Manifest, public config schema, executor wiring, bindings that reference `identity.<op>` by contract — all rewired transparently because the contract is preserved.

### 9.5 What does NOT get substituted

- Identity SDK calls done by the blueprint via the **package name** directly (e.g. `import auth0 from '@rntme/module-identity-auth0'` inside a UI component) — substitution does not touch package-name imports. Such blueprints need `--keep-identity` + real `.env.local`.

### 9.6 Production safety

- `module.json` declares `"environments": ["local"]`. `@rntme/blueprint` rejects loading dev-identity into any composed-project where target.kind is not `'local'`.
- README of `module-dev-identity` opens with a large "DO NOT USE IN PRODUCTION" block.
- A safety test asserts that `@rntme/deploy-dokploy` errors out if dev-identity appears in the composed project.

## 10. Edge cases

### 10.1 Port allocation

- Compose project name = `rntme-local-<slug>`, slug = `<dirname>-<sha8(absPath)>`. Two copies of the same blueprint in different folders get distinct namespaces and volumes.
- Ports are allocated as `portBase + serviceIndex` (where `serviceIndex` is the position in the plan's service array; deterministic).
- Pre-flight `nc -z 127.0.0.1 <port>` per service. Collision → exit 3 with hint to use `--port-base`.

### 10.2 Runtime image versioning

- `@rntme/deploy-local` pins one runtime image tag per release.
- Image is published in the same CI workflow that publishes npm packages (new `runtime-image.yml`).
- Blueprint using artifact features newer than the runtime image → runtime emits validation error visible via `local logs`.
- `--runtime-image <tag>` overrides for development of rntme itself.

### 10.3 Module package resolution

This connects to the known gap in `rntme_provisioner_resolver_gap.md` (provisioner resolver looks in platform-http node_modules). For local:

- **dev-identity**: pre-bundled inside the runtime base image at `/usr/local/lib/rntme/modules/dev-identity/`. Runtime knows this prefix and loads without needing it in blueprint's `node_modules`.
- **All other modules** (auth0, etc): blueprint dir must have `node_modules/` populated with declared package versions. Bind-mounting blueprint dir picks them up. If absent, runtime errors at boot: `module @rntme/X not found, run pnpm install in blueprint dir`. The CLI's pre-flight catches the obvious case (no `node_modules/` next to a `package.json`) and runs `pnpm install --frozen-lockfile` automatically.

### 10.4 Bind-mount on macOS

- Docker Desktop requires host paths to be in shared paths. By default `/Users` is shared, so most blueprints work.
- If not, `docker compose up` errors; CLI catches and prints: "Add `<path>` to Docker Desktop → Settings → Resources → File sharing".

### 10.5 SQLite file ownership

- Runtime image runs as non-root (uid 1000).
- SQLite lives in a **named volume** (not a host bind-mount), so Docker creates with correct permissions automatically. No uid/gid wars.

### 10.6 Re-running `up` when already up

- `docker compose up -d` is idempotent. CLI uses it as-is; recreates only if config changed. Prints "No changes" if nothing was recreated.

### 10.7 Partial-up failure recovery

- Healthcheck timeout → status table shows failed services + suggests `local logs <svc>`. CLI does **not** auto-teardown (user may want to inspect). `local down` is explicit.

### 10.8 `--keep-identity` workflow

- User runs `rntme local up --keep-identity` and places `.env.local` in blueprint dir.
- CLI reads `.env.local` and propagates `AUTH0_*` / `WORKOS_*` / etc. into the runtime container's environment.
- Identity module behaves as in production. Provisioners are still skipped (Auth0 client is not auto-created); user must set up the Auth0 client manually beforehand.

### 10.9 Runtime image release pipeline

- New CI workflow on release tag `runtime-vX.Y.Z` builds `packages/runtime/runtime/` Dockerfile and pushes `ghcr.io/vladprrs/rntme-runtime:X.Y.Z`.
- README of `@rntme/runtime` documents the Dockerfile + entrypoint contract.
- Until the first published image exists, `--rebuild` flag falls back to a local `docker build` from `packages/runtime/runtime/`. This is a transitional convenience, not a permanent code path.

### 10.10 `--provision` opt-in

- Module provisioners (PR-#134-style) are skipped by default in local mode.
- `--provision` runs them sequentially via `runProvisioners` from `@rntme/deploy-core`.
- For most modules this fails locally because they hit external APIs without secrets. Documented as opt-in for users who want to test full integration locally.

## 11. Implementation phases

Five PRs in dependency order. PR1 is the foundation; PR2-PR4 can be parallel after PR1; PR5 is the user-facing wiring.

| PR | Subject | Depends on |
|---|---|---|
| PR1 | Extract `renderRedpandaCompose` to `@rntme/deploy-core/src/render-helpers/redpanda.ts`; update `deploy-dokploy` to consume; no behavior change. Adds a snapshot test for the helper. | none |
| PR2 | New package `@rntme/deploy-local` (`render.ts`, `apply.ts`, `verify.ts`, snapshot tests). No CLI wiring yet. Inputs: a fixed `ComposedProject` + a `LocalDeploymentConfig`. | PR1 |
| PR3 | New package `@rntme/module-dev-identity` (server + client + module.json + README). Standalone unit-tested. | none |
| PR4 | `@rntme/blueprint` composer hook `substitute-identity-for-local.ts`; option on `loadComposedBlueprint`. Production-safety test that dev-identity refuses non-local targets. | PR3 |
| PR5 | CLI commands `apps/cli/src/commands/local/{up,down,status,logs,reset,ps}.ts`. End-to-end: `rntme local up demo/notes-blueprint` works. Wires `DeploymentTarget.kind='local'` extension in `deploy-core/src/plan.ts`. | PR2, PR4 |

The runtime image release pipeline is a sixth side task, not blocking the PR chain (PRs use `--rebuild` until image is published).

## 12. Out of scope (already noted but consolidated)

- Watch / hot reload (follow-up).
- Local registry / per-service custom Dockerfiles.
- TLS / domain routing.
- `local sync` from production.
- Convergence of `rntme local up` and `rntme project deploy --target local`.
- All gaps required for "platform as blueprint" — see §13 bridge.

## 13. Bridge to platform-as-blueprint (next spec)

After this spec ships, the blocking gaps to convert `apps/platform-http` into a blueprint and run it via `rntme local up platform-blueprint/` are (each its own future spec, in dependency order):

| Gap | Why platform needs it |
|---|---|
| Blueprint vault primitive (encrypted secrets at rest declared in blueprint, not only on `deploy_target`) | Platform stores other tenants' Dokploy API tokens. |
| File storage binding (rustfs/S3 as a first-class blueprint resource) | Platform stores project version blobs. |
| Multi-tenant primitive (orgs / users / RLS as a blueprint shape) | Platform is a multi-tenant SaaS. |
| RBAC via identity contract (roles + scopes) | WorkOS scopes / token scopes. |
| Background workers / job queue in blueprint shape | Deploy executor + orphan-detector. |
| DB migration story for SQLite at blueprint level (or platform migrating to SQLite-target) | Platform currently on Postgres+Drizzle. |

This spec **enables** that work by giving us the local dev loop, but **closes none** of those gaps.

## 14. Documentation touches landing in PR5

- `AGENTS.md §6` — add how-to entry "spin up a blueprint locally" pointing to `apps/cli` + `@rntme/deploy-local` READMEs.
- `apps/cli/README.md` — add `local` subcommand table.
- `packages/deploy/deploy-local/README.md` — new, follows uniform README template (file map / quick start / API / invariants / out of scope / where to look first / specs).
- `packages/modules/module-dev-identity/README.md` — new, includes "DO NOT USE IN PRODUCTION" header.
- `CLAUDE.md` "Architecture in one paragraph" — add one sentence about local deploy adapter.
- `README.md` packages table — add `@rntme/deploy-local` and `@rntme/module-dev-identity` rows.

Per `CLAUDE.md` checklist: each PR includes its own doc-touch task; PR5 lands the cross-cutting docs above.
