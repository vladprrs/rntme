# rntme-cli — private git submodule for the agent-facing CLI

**Status:** design
**Author:** brainstorm 2026-04-18
**Related:** `AGENTS.md` §1 (repo layout), `pnpm-workspace.yaml`, `.github/workflows/ci.yml`

## 1. Problem

The next wave of work is a vercel-style agent-facing CLI (`rntme`) that scaffolds and operates services from rntme artifacts. This code must not ship in the public `vladprrs/rntme` repository while it is still early and proprietary, but it will need to co-evolve with changes in the existing `@rntme/*` packages. Publishing it in a fully separate clone would force cross-repo branches for every change; keeping it gitignored locally would lose versioning and make multi-machine work painful.

We need a setup that keeps CLI source in a private repository from day one, yet lets the author work in the current public monorepo with a single `pnpm install` and a single `pnpm -r` surface across both code bases.

## 2. Goal

Introduce a private GitHub repository `vladprrs/rntme-cli` and mount it as a git submodule at the root of the public monorepo. The submodule hosts its own pnpm subproject with `packages/*` and a `@rntme-cli/*` npm scope, fully buildable on its own. The public repo's pnpm workspace pulls the submodule's packages into the parent workspace so root-level `pnpm -r` commands operate on both. When the private code is ready to live separately, the submodule is deinit'd and the workspace entry is removed — no edits inside `rntme-cli` are required.

**In scope:**
- Create `vladprrs/rntme-cli` on GitHub, private, under the `vladprrs` account.
- Initial internal layout: `pnpm-workspace.yaml`, root `package.json`, own `tsconfig.base.json`, `.gitignore`, `README.md`, one workspace member `packages/cli/` with scope name `@rntme-cli/cli` and bin `rntme`.
- Minimal CLI surface: `rntme --help` and `rntme --version` using Node's built-in `node:util.parseArgs`. No external CLI framework.
- Mount at `rntme-cli/` (peer of `packages/`, `demo/`, `docs/`).
- Public repo's `pnpm-workspace.yaml` extended with `rntme-cli/packages/*`.
- Existing CI (`.github/workflows/ci.yml`) updated to check out submodules with a PAT so `pnpm install` resolves the new workspace members.
- Public `README.md` gains a short clone/update note covering `--recurse-submodules`.
- Smoke test in `packages/cli/test/unit/cli.test.ts` covering `rntme --help` and `rntme --version` output.

**Explicitly out of scope:**
- Any real CLI command (`init`, `dev`, `deploy`, …). Those land in follow-up specs once the scaffold is verified.
- Publishing `@rntme-cli/cli` to npm. It is `private: true` until we pick a distribution channel.
- Turning existing `@rntme/*` packages private. Only the new CLI lives in the submodule.
- Multi-submodule support (`private/*`, `internal/*`). If that need appears we will revisit.
- CI support for external forks: PRs from forks cannot clone the private submodule; we accept this trade-off for now and document it.

## 3. Repository topology

Public repo (after setup):

```
rntme/                          (public, vladprrs/rntme)
  packages/                     public @rntme/*
  demo/
  docs/
  rntme-cli/                    ← submodule → vladprrs/rntme-cli (private)
  pnpm-workspace.yaml           ← adds "rntme-cli/packages/*"
  .gitmodules                   ← new
  .github/workflows/ci.yml      ← updated to checkout submodules
  README.md                     ← short submodule clone note
```

Private submodule (after setup):

```
rntme-cli/                      (private, vladprrs/rntme-cli, default branch main)
  .gitignore
  README.md
  package.json                  {"name":"rntme-cli-root","private":true}
  pnpm-workspace.yaml           packages: ["packages/*"]
  tsconfig.base.json            standalone copy of strict TS config
  packages/
    cli/
      package.json              @rntme-cli/cli, bin: { rntme: dist/bin/cli.js }
      src/
        index.ts                export {} placeholder for programmatic API
        bin/cli.ts              parseArgs → help/version
      test/unit/cli.test.ts
      tsconfig.json             extends ../../tsconfig.base.json
      tsconfig.check.json
      eslint.config.mjs
      vitest.config.ts
```

The submodule is *standalone-ready*: its `tsconfig.base.json` does not extend anything in the parent repo, its lint/vitest configs reference only files inside `rntme-cli/`, and its workspace declaration is self-contained. The only coupling to the parent is that `rntme-cli/packages/*` is also reachable from the parent's `pnpm-workspace.yaml`, which pnpm treats as normal workspace members regardless of the submodule boundary.

## 4. Package layering

`@rntme-cli/cli` is a leaf. It depends on:
- Node built-ins (`node:util`, `node:path`, `node:fs`).
- Devdeps mirroring `packages/seed/` (typescript, vitest, eslint, typescript-eslint, prettier, @types/node).

It does **not** (yet) depend on any `@rntme/*` package. When real commands arrive they will import `@rntme/bindings`, `@rntme/runtime`, etc., as `workspace:*` deps — pnpm resolves those across the submodule boundary because they share a root lockfile.

No `@rntme/*` package depends on `@rntme-cli/*`. Direction is strictly one-way: CLI → public packages. A future `@rntme-cli/core` (if extracted) would be a shared layer for the CLI alone.

## 5. Package conventions inside `@rntme-cli/cli`

Follows the `packages/seed/` template:

- `"type": "module"`, ESM only.
- Build: `tsc -p tsconfig.json` → `dist/`. Postbuild script prepends `#!/usr/bin/env node` to `dist/bin/cli.js` and `chmod 0755`, identical to seed.
- `bin` entry: `{ "rntme": "./dist/bin/cli.js" }`.
- `exports["."]` for programmatic use (empty on day one).
- Scripts: `build`, `postbuild`, `test`, `test:watch`, `typecheck`, `lint`, `format` — same names, same commands as seed.
- `tsconfig.check.json` — the typecheck-only config matching the rest of the monorepo.

Argument parsing: Node's built-in `node:util.parseArgs` with a hand-rolled `printHelp()` and `printVersion()`. Zero dependencies for the MVP. When command surface grows we revisit (commander/yargs/clipanion), but that decision belongs to the follow-up spec.

`--version` reads the version from `packages/cli/package.json` via `fs.readFileSync` at runtime (resolved relative to `import.meta.url`). Acceptable for day one.

## 6. Parent workspace wiring

`pnpm-workspace.yaml` in the public repo becomes:

```yaml
packages:
  - "packages/*"
  - "demo/*"
  - "rntme-cli/packages/*"
```

Root-level commands inherit the new member automatically:
- `pnpm install --frozen-lockfile` resolves `@rntme-cli/cli` and writes it into the root `pnpm-lock.yaml`.
- `pnpm -r run build|typecheck|test|lint` iterates over every workspace member including `@rntme-cli/cli`.
- `pnpm -F @rntme-cli/cli <script>` works from the root.

Root `tsconfig.base.json` is **not** referenced by the submodule. The two TS configs can drift; we accept that because the submodule must be buildable standalone.

## 7. Git submodule mechanics

Registration:

```
git submodule add https://github.com/vladprrs/rntme-cli.git rntme-cli
```

Writes `.gitmodules`:

```
[submodule "rntme-cli"]
  path = rntme-cli
  url = https://github.com/vladprrs/rntme-cli.git
  branch = main
```

The URL is HTTPS so `actions/checkout@v4` can inject the CI token without extra config. Developers who prefer SSH add a one-time local rewrite (`git config --global url."git@github.com:".insteadOf "https://github.com/"`); the submodule URL itself stays HTTPS in tracked config.

Developers clone with:

```
git clone --recurse-submodules https://github.com/vladprrs/rntme.git
# or, after a plain clone:
git submodule update --init --recursive
```

The public repo pins a specific submodule SHA. Bumping that pointer is an explicit two-step commit flow:

```
cd rntme-cli
git checkout main && git pull
cd ..
git add rntme-cli
git commit -m "bump rntme-cli to <sha>"
```

Changing code inside `rntme-cli/*` therefore produces two commits (one inside the submodule, one in the parent repo that bumps the pointer). This is a known submodule cost.

Worktrees: `git worktree add` does not recursively init submodules. Every new worktree (including the repo's `.worktrees/*` flow) must run `git submodule update --init --recursive` after creation. This is noted in `AGENTS.md` and `README.md`.

## 8. CI integration

`.github/workflows/ci.yml` needs two edits:

1. `actions/checkout@v4` takes `submodules: recursive` and `token: ${{ secrets.RNTME_CLI_SUBMODULE_TOKEN }}`.
2. No other step changes — `pnpm install --frozen-lockfile` and `pnpm -r` already cover the new workspace member.

`RNTME_CLI_SUBMODULE_TOKEN` is a fine-grained PAT issued by the repo owner with read-only access to `vladprrs/rntme-cli`, stored as a secret in the `vladprrs/rntme` repo. The token is referenced only by the `checkout` step.

`.github/workflows/release.yml` filters publishes to `@rntme/*` (`pnpm -r --filter "@rntme/*"`), so `@rntme-cli/*` is excluded from the public release path automatically. No change required there for MVP.

Known limitation: pull requests from external forks do not have access to the secret, so their CI will fail at the submodule checkout. This is acceptable while the project has no external contributors who need a full green build. Documented in `README.md` under "contributing from forks — not currently supported".

## 9. Public README and AGENTS updates

README (top "Quick start" section) gets a short paragraph:

> This repo uses a private git submodule (`rntme-cli/`) for CLI code that is not yet open-source. Clone with `--recurse-submodules`, and after adding a new git worktree run `git submodule update --init --recursive` inside it. External contributors do not have access to the submodule; most of the repo builds without it, but root-level `pnpm -r` will skip `@rntme-cli/*` workspace members until you obtain access.

AGENTS.md §1 ("Repository layout") gains one line describing `rntme-cli/` as a submodule and pointing to this spec.

## 10. Extraction plan (future)

When the private code is ready to live independently (public distribution, or a fully separate repo with no shared lockfile):

1. In the public repo: `git submodule deinit rntme-cli`, `git rm rntme-cli`, `rm -rf .git/modules/rntme-cli`, remove the entry from `.gitmodules`, remove `rntme-cli/packages/*` from `pnpm-workspace.yaml`, remove the submodule checkout from CI, regenerate `pnpm-lock.yaml`, commit.
2. The `vladprrs/rntme-cli` repository continues to exist with its full history and can be consumed via git clone or (if made public) npm install.
3. Because the submodule was standalone-buildable, zero source edits inside it are required.

## 11. Verification

After implementation:

- `git submodule status` lists `rntme-cli` with a committed SHA.
- `pnpm install --frozen-lockfile` at repo root finishes clean.
- `pnpm -F @rntme-cli/cli build` produces `rntme-cli/packages/cli/dist/bin/cli.js` with a `#!/usr/bin/env node` shebang and exec bit set.
- `node rntme-cli/packages/cli/dist/bin/cli.js --help` prints usage.
- `node rntme-cli/packages/cli/dist/bin/cli.js --version` prints the version from `package.json`.
- `pnpm -F @rntme-cli/cli test|typecheck|lint` all pass.
- `pnpm -r run build|test|typecheck|lint` at root succeed and show `@rntme-cli/cli` in the task list.
- Root `pnpm-lock.yaml` contains an entry for `@rntme-cli/cli`.
- CI passes on a PR against `main` with the submodule checkout step using `RNTME_CLI_SUBMODULE_TOKEN`.

## 12. Risks and known limitations

- **Dual-commit overhead.** Editing code inside `rntme-cli/*` requires one commit in the private repo and one in the public repo to bump the pinned SHA. Normal submodule cost; not a deal-breaker.
- **Worktree footgun.** New worktrees created via `git worktree add` do not init submodules. We document this in both `README.md` and `AGENTS.md`; we do not try to automate it.
- **Fork CI.** PRs from external forks cannot clone the submodule and their CI will fail at checkout. Acceptable today.
- **Shared lockfile.** `pnpm-lock.yaml` lives in the public repo and records versions for `@rntme-cli/*` dependencies too. Changing deps inside the submodule requires a parallel bump of the root lockfile. When we extract, the private repo generates its own lockfile.
- **TS config drift.** The submodule has its own `tsconfig.base.json`. If we later tighten compiler options in the parent, the submodule must be updated separately. Standalone-ready was chosen deliberately and this is its cost.
- **Token rotation.** `RNTME_CLI_SUBMODULE_TOKEN` has an expiry; rotating it is a manual operational task. Not automated in MVP.
