# rntme-cli Private Submodule — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a private GitHub repository `vladprrs/rntme-cli`, mount it as a git submodule at `rntme-cli/` inside the public `vladprrs/rntme` monorepo, and wire a minimal `@rntme-cli/cli` package (bin `rntme` with `--help` / `--version`) into the parent pnpm workspace.

**Architecture:** Standalone pnpm subproject inside the submodule (own `pnpm-workspace.yaml`, own `tsconfig.base.json`, own `.gitignore`). Parent repo's `pnpm-workspace.yaml` references `rntme-cli/packages/*`, so root-level `pnpm -r` covers both code bases. CI uses a fine-grained PAT stored as `RNTME_CLI_SUBMODULE_TOKEN` to clone the submodule.

**Tech Stack:** pnpm 9.12 workspaces, TypeScript 5.5 ESM, vitest 2.1, eslint 9, Node 20 (`node:util.parseArgs`), GitHub `gh` CLI, `actions/checkout@v4`.

**Spec:** `docs/superpowers/specs/done/2026-04-18-rntme-cli-submodule-design.md`.

---

## Pre-flight

- Current working directory is the public repo root: `/home/coder/project`.
- `gh auth status` shows `vladprrs` logged in with `repo` scope.
- All commands below are run from the public repo root unless explicitly prefixed with `cd`.
- The scratch clone path used during bootstrap is `/home/coder/rntme-cli-bootstrap`; choose a different path if that one exists and delete the old path or use a suffix.

---

### Task 1: Create the private GitHub repo

**Files:**
- None in this repo. Produces `vladprrs/rntme-cli` on GitHub.

- [ ] **Step 1: Verify gh auth has repo scope**

Run: `gh auth status`
Expected: `Logged in to github.com account vladprrs` and `Token scopes:` includes `'repo'`.

- [ ] **Step 2: Create the repo (private, seeded with a README so default branch has a commit)**

Run:
```bash
gh repo create vladprrs/rntme-cli \
  --private \
  --description "Private CLI for creating rntme services from artifacts." \
  --add-readme
```
Expected: prints `https://github.com/vladprrs/rntme-cli`.

- [ ] **Step 3: Verify the repo exists and is private**

Run: `gh repo view vladprrs/rntme-cli --json visibility,defaultBranchRef`
Expected: `{"visibility":"PRIVATE","defaultBranchRef":{"name":"main"}}`.

- [ ] **Step 4: No commit in this task**

Nothing to commit locally yet.

---

### Task 2: Bootstrap the submodule root scaffolding

**Files (in scratch clone at `/home/coder/rntme-cli-bootstrap`):**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `README.md`

- [ ] **Step 1: Clone the new repo to a scratch path outside the public monorepo**

Run:
```bash
rm -rf /home/coder/rntme-cli-bootstrap
git clone https://github.com/vladprrs/rntme-cli.git /home/coder/rntme-cli-bootstrap
cd /home/coder/rntme-cli-bootstrap
```
Expected: `Cloning into '/home/coder/rntme-cli-bootstrap'...` and a single `README.md` from the seed commit.

- [ ] **Step 2: Replace the seed README with the real one**

Write `/home/coder/rntme-cli-bootstrap/README.md`:

```markdown
# rntme-cli

Private pnpm subproject holding the `rntme` CLI. Consumed as a git submodule
inside `vladprrs/rntme` until it is mature enough to live independently.

## Workspace members

- `packages/cli/` — `@rntme-cli/cli`, the `rntme` binary.

## Standalone build

```
pnpm install
pnpm -r run build
pnpm -r run test
```

## Consumed from the parent monorepo

This repo is mounted at `rntme-cli/` inside `vladprrs/rntme`. The parent's
`pnpm-workspace.yaml` includes `rntme-cli/packages/*`, so `pnpm -r` from the
parent root automatically covers members of this subproject.
```

- [ ] **Step 3: Write `.gitignore`**

Write `/home/coder/rntme-cli-bootstrap/.gitignore`:

```
node_modules/
dist/
coverage/
.turbo/
.cache/
*.tsbuildinfo
*.log
.DS_Store
```

- [ ] **Step 4: Write root `package.json`**

Write `/home/coder/rntme-cli-bootstrap/package.json`:

```json
{
  "name": "rntme-cli-root",
  "version": "0.0.0",
  "private": true,
  "description": "Root of the rntme-cli pnpm subproject. Not published.",
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  },
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "typecheck": "pnpm -r run typecheck",
    "lint": "pnpm -r run lint"
  }
}
```

- [ ] **Step 5: Write `pnpm-workspace.yaml`**

Write `/home/coder/rntme-cli-bootstrap/pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 6: Write `tsconfig.base.json`**

Write `/home/coder/rntme-cli-bootstrap/tsconfig.base.json` (a standalone copy of the parent's strict config):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "verbatimModuleSyntax": true
  }
}
```

- [ ] **Step 7: Commit and push the scaffold**

Run:
```bash
cd /home/coder/rntme-cli-bootstrap
git add .gitignore README.md package.json pnpm-workspace.yaml tsconfig.base.json
git commit -m "chore: bootstrap pnpm subproject scaffold"
git push origin main
```
Expected: one commit pushed to `origin/main`.

---

### Task 3: Scaffold the `@rntme-cli/cli` package files

**Files (in scratch clone):**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/tsconfig.check.json`
- Create: `packages/cli/eslint.config.mjs`
- Create: `packages/cli/vitest.config.ts`
- Create: `packages/cli/src/index.ts`

- [ ] **Step 1: Create the package directory tree**

Run:
```bash
cd /home/coder/rntme-cli-bootstrap
mkdir -p packages/cli/src/bin packages/cli/test/unit
```
Expected: directories created.

- [ ] **Step 2: Write `packages/cli/package.json`**

```json
{
  "name": "@rntme-cli/cli",
  "version": "0.0.0",
  "type": "module",
  "private": true,
  "description": "rntme CLI — create and operate rntme services from artifacts.",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "rntme": "./dist/bin/cli.js"
  },
  "files": ["dist", "README.md"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "postbuild": "node -e \"const f='dist/bin/cli.js';const s=require('fs').readFileSync(f,'utf8');if(!s.startsWith('#!'))require('fs').writeFileSync(f,'#!/usr/bin/env node\\n'+s);require('fs').chmodSync(f,0o755);\"",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.check.json",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "@eslint/js": "^9.10.0",
    "@types/node": "^20.14.0",
    "@typescript-eslint/eslint-plugin": "^8.6.0",
    "@typescript-eslint/parser": "^8.6.0",
    "eslint": "^9.10.0",
    "prettier": "^3.3.3",
    "typescript": "^5.5.4",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 3: Write `packages/cli/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

- [ ] **Step 4: Write `packages/cli/tsconfig.check.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "noEmit": true,
    "composite": false,
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 5: Write `packages/cli/eslint.config.mjs`**

```javascript
import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { sourceType: 'module', ecmaVersion: 2022 },
      globals: {
        console: 'readonly',
        process: 'readonly',
        URL: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'warn',
    },
  },
];
```

- [ ] **Step 6: Write `packages/cli/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
    testTimeout: 15_000,
  },
});
```

- [ ] **Step 7: Write `packages/cli/src/index.ts`** (empty programmatic API on day one)

```typescript
export {};
```

- [ ] **Step 8: Install dependencies and confirm workspace resolves**

Run:
```bash
cd /home/coder/rntme-cli-bootstrap
pnpm install
```
Expected: installs devdeps, creates `pnpm-lock.yaml`, no peer warnings that mention missing workspace packages.

- [ ] **Step 9: Commit the package scaffold**

Run:
```bash
cd /home/coder/rntme-cli-bootstrap
git add packages/cli pnpm-lock.yaml
git commit -m "feat(cli): scaffold @rntme-cli/cli package skeleton"
git push origin main
```

---

### Task 4: Write the failing CLI smoke tests (TDD red)

**Files:**
- Create: `packages/cli/test/unit/cli.test.ts`

- [ ] **Step 1: Write the test file**

Write `/home/coder/rntme-cli-bootstrap/packages/cli/test/unit/cli.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const cliPath = join(here, '..', '..', 'dist', 'bin', 'cli.js');
const pkgPath = join(here, '..', '..', 'package.json');
const pkgVersion = JSON.parse(readFileSync(pkgPath, 'utf8')).version;

function runCli(args: string[]) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: 'utf8',
  });
}

describe('rntme CLI', () => {
  it('prints usage with --help and exits 0', () => {
    const result = runCli(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: rntme');
    expect(result.stdout).toContain('--help');
    expect(result.stdout).toContain('--version');
  });

  it('prints usage with -h and exits 0', () => {
    const result = runCli(['-h']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: rntme');
  });

  it('prints the package version with --version and exits 0', () => {
    const result = runCli(['--version']);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(pkgVersion);
  });

  it('prints the package version with -v and exits 0', () => {
    const result = runCli(['-v']);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(pkgVersion);
  });

  it('prints usage to stderr and exits 1 on unknown command', () => {
    const result = runCli(['frobnicate']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown command: frobnicate');
    expect(result.stderr).toContain('Usage: rntme');
  });

  it('prints usage to stderr and exits 1 on no args', () => {
    const result = runCli([]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Usage: rntme');
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run:
```bash
cd /home/coder/rntme-cli-bootstrap
pnpm -F @rntme-cli/cli test
```
Expected: FAIL. Every test fails because `dist/bin/cli.js` does not exist. `node` exits with status 1 and prints a `Cannot find module` error to stderr, so `result.stdout` is empty and assertions like `expect(result.stdout).toContain('Usage: rntme')` fail.

- [ ] **Step 3: No commit yet**

Do not commit — tests must be green before committing.

---

### Task 5: Implement the CLI entrypoint (TDD green)

**Files:**
- Create: `packages/cli/src/bin/cli.ts`

- [ ] **Step 1: Write the CLI entrypoint**

Write `/home/coder/rntme-cli-bootstrap/packages/cli/src/bin/cli.ts`:

```typescript
/* eslint-disable no-console -- CLI entrypoint */
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const USAGE = `Usage: rntme [options] [command]

Commands:
  (none yet — real commands land in follow-up tasks)

Options:
  -h, --help       Show this help and exit.
  -v, --version    Print the rntme CLI version and exit.
`;

function readVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const pkgPath = join(here, '..', '..', 'package.json');
  const raw = readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(raw) as { version: string };
  return pkg.version;
}

function main(argv: string[]): number {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    console.error(USAGE);
    return 1;
  }

  const { values, positionals } = parsed;

  if (values['help'] === true) {
    console.log(USAGE);
    return 0;
  }

  if (values['version'] === true) {
    console.log(readVersion());
    return 0;
  }

  if (positionals.length === 0) {
    console.error(USAGE);
    return 1;
  }

  console.error(`Unknown command: ${positionals[0]}`);
  console.error(USAGE);
  return 1;
}

process.exit(main(process.argv.slice(2)));
```

- [ ] **Step 2: Build the package**

Run:
```bash
cd /home/coder/rntme-cli-bootstrap
pnpm -F @rntme-cli/cli build
```
Expected: `dist/bin/cli.js` and `dist/index.js` exist. The postbuild hook has prepended `#!/usr/bin/env node` to `dist/bin/cli.js` and set exec bit.

- [ ] **Step 3: Run the tests and confirm they pass**

Run:
```bash
cd /home/coder/rntme-cli-bootstrap
pnpm -F @rntme-cli/cli test
```
Expected: all six tests pass.

- [ ] **Step 4: Run typecheck and lint**

Run:
```bash
cd /home/coder/rntme-cli-bootstrap
pnpm -F @rntme-cli/cli typecheck
pnpm -F @rntme-cli/cli lint
```
Expected: both exit 0. (The `no-console` rule is suppressed at the top of `cli.ts` via the inline eslint-disable.)

- [ ] **Step 5: Manual smoke test the binary**

Run:
```bash
node /home/coder/rntme-cli-bootstrap/packages/cli/dist/bin/cli.js --help
node /home/coder/rntme-cli-bootstrap/packages/cli/dist/bin/cli.js --version
```
Expected: the first prints `Usage: rntme ...`, the second prints `0.0.0`.

- [ ] **Step 6: Commit and push**

Run:
```bash
cd /home/coder/rntme-cli-bootstrap
git add packages/cli/src packages/cli/test
git commit -m "feat(cli): add --help and --version via node:util parseArgs"
git push origin main
```

---

### Task 6: Register the submodule in the public repo

**Files:**
- Create: `.gitmodules` (in public repo root)
- Create: `rntme-cli/` (submodule checkout)

- [ ] **Step 1: Confirm the scratch clone points at the pushed commit**

Run:
```bash
cd /home/coder/rntme-cli-bootstrap
git status
git log --oneline origin/main -5
```
Expected: working tree clean, at least three commits ahead of the original seed commit, all pushed.

- [ ] **Step 2: Add the submodule**

Run:
```bash
cd /home/coder/project
git submodule add https://github.com/vladprrs/rntme-cli.git rntme-cli
```
Expected: `Cloning into '/home/coder/project/rntme-cli'...` followed by staging of `.gitmodules` and `rntme-cli`. Working tree now has new staged entries.

- [ ] **Step 3: Verify `.gitmodules` content**

Run: `cat .gitmodules`
Expected:
```
[submodule "rntme-cli"]
	path = rntme-cli
	url = https://github.com/vladprrs/rntme-cli.git
```

- [ ] **Step 4: Verify submodule checkout matches expected content**

Run:
```bash
ls /home/coder/project/rntme-cli
cat /home/coder/project/rntme-cli/package.json
```
Expected: directory contains `packages/`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `README.md`; `package.json` shows `"name": "rntme-cli-root"`.

- [ ] **Step 5: No commit yet**

Hold the staged entries — the workspace edit in the next task is part of the same commit.

---

### Task 7: Extend the public pnpm workspace

**Files:**
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: Read the current workspace file**

Current content:
```yaml
packages:
  - "packages/*"
  - "demo/*"
```

- [ ] **Step 2: Add the new glob**

Replace the file contents with:
```yaml
packages:
  - "packages/*"
  - "demo/*"
  - "rntme-cli/packages/*"
```

- [ ] **Step 3: Verify pnpm recognises the new member**

Run:
```bash
cd /home/coder/project
pnpm ls --depth -1 --filter "@rntme-cli/cli"
```
Expected: prints the package with its version and workspace path under `rntme-cli/packages/cli`.

---

### Task 8: Refresh the root lockfile

**Files:**
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Run install without `--frozen-lockfile` to pick up the new member**

Run:
```bash
cd /home/coder/project
pnpm install
```
Expected: success; `pnpm-lock.yaml` is updated to include `@rntme-cli/cli` entries.

- [ ] **Step 2: Verify lockfile contains the new package**

Run: `grep '@rntme-cli/cli' pnpm-lock.yaml | head -3`
Expected: at least one match.

- [ ] **Step 3: Verify reproducibility with a frozen install**

Run:
```bash
cd /home/coder/project
pnpm install --frozen-lockfile
```
Expected: success (no lockfile-mismatch error).

---

### Task 9: Verify root-level pnpm commands cover the new member

**Files:**
- None modified; verification only.

- [ ] **Step 1: Build from root**

Run:
```bash
cd /home/coder/project
pnpm -F @rntme-cli/cli build
```
Expected: success. `rntme-cli/packages/cli/dist/bin/cli.js` exists with shebang and exec bit.

- [ ] **Step 2: Invoke the built binary**

Run: `node rntme-cli/packages/cli/dist/bin/cli.js --help`
Expected: prints `Usage: rntme ...`.

- [ ] **Step 3: Run the CLI tests from root**

Run: `pnpm -F @rntme-cli/cli test`
Expected: six tests pass.

- [ ] **Step 4: Run the full monorepo sweep**

Run:
```bash
cd /home/coder/project
pnpm -r run build
pnpm -r run typecheck
pnpm -r run test
pnpm -r run lint
```
Expected: each command finishes successfully and `@rntme-cli/cli` appears in each task list.

---

### Task 10: Commit submodule + workspace wiring in the public repo

**Files:**
- Stage: `.gitmodules`, `rntme-cli`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`

- [ ] **Step 1: Inspect the staging area**

Run: `git status`
Expected: new file `.gitmodules`, new submodule entry `rntme-cli`, modified `pnpm-workspace.yaml`, modified `pnpm-lock.yaml`.

- [ ] **Step 2: Commit**

Run:
```bash
cd /home/coder/project
git add .gitmodules rntme-cli pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(workspace): add rntme-cli private submodule at rntme-cli/

Registers vladprrs/rntme-cli as a git submodule mounted at rntme-cli/ and
extends pnpm-workspace.yaml with rntme-cli/packages/*, bringing
@rntme-cli/cli into the root workspace. Lockfile refreshed.

Spec: docs/superpowers/specs/done/2026-04-18-rntme-cli-submodule-design.md
EOF
)"
```
Expected: one commit, four paths changed.

---

### Task 11: Update CI to clone the submodule

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Operational note — create the GitHub secret**

This step is performed **manually by the repo owner** in the GitHub UI and is called out here so the implementer flags it. On `https://github.com/vladprrs/rntme/settings/secrets/actions`, add a repository secret named `RNTME_CLI_SUBMODULE_TOKEN`. Value: a fine-grained PAT with `Contents: Read` permission on `vladprrs/rntme-cli` only. Until the secret exists, CI will fail at the checkout step. If the implementer is not the owner, open a GitHub issue describing the required secret instead of blocking the plan.

- [ ] **Step 2: Edit `.github/workflows/ci.yml`**

Current `checkout` step:
```yaml
      - uses: actions/checkout@v4
```

Replace with:
```yaml
      - uses: actions/checkout@v4
        with:
          submodules: recursive
          token: ${{ secrets.RNTME_CLI_SUBMODULE_TOKEN }}
```

Leave every other step unchanged.

- [ ] **Step 3: Commit**

Run:
```bash
cd /home/coder/project
git add .github/workflows/ci.yml
git commit -m "ci: check out rntme-cli submodule with PAT"
```

- [ ] **Step 4: Note on release.yml**

`.github/workflows/release.yml` filters publishes to `@rntme/*` via `pnpm -r --filter "@rntme/*"`, which already excludes `@rntme-cli/*`. No change required there.

---

### Task 12: Document the submodule in public-facing docs

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Locate the existing Quick start section in `README.md`**

Run: `grep -n '^## ' README.md | head -10`
Expected: lists existing top-level sections; locate the one that covers cloning / getting started.

- [ ] **Step 2: Insert a submodule paragraph**

Inside the Quick start section (near the `git clone` instruction if one exists, otherwise at the top of it), add:

```markdown
### Private submodule (`rntme-cli/`)

Some CLI code lives in a private submodule at `rntme-cli/` backed by
`vladprrs/rntme-cli`. Clone the monorepo with
`git clone --recurse-submodules https://github.com/vladprrs/rntme.git`, or
after a plain clone run `git submodule update --init --recursive`. New git
worktrees created with `git worktree add` do not initialise submodules
automatically — run `git submodule update --init --recursive` inside each
new worktree. External contributors without access to the private repo will
see `pnpm -r` skip `@rntme-cli/*` workspace members.
```

If the README has no Quick start section, place the paragraph immediately after the first heading so it is prominent.

- [ ] **Step 3: Update `AGENTS.md` §2 Repository map**

Locate the bullet list that currently starts with `- packages/` / `- demo/issue-tracker-api/`. Add a new bullet **after `- demo/issue-tracker-api/`** and before the next entry:

```markdown
- `rntme-cli/`              — private git submodule (`vladprrs/rntme-cli`)
  hosting `@rntme-cli/*` packages. See
  `docs/superpowers/specs/done/2026-04-18-rntme-cli-submodule-design.md`.
```

- [ ] **Step 4: Commit**

Run:
```bash
cd /home/coder/project
git add README.md AGENTS.md
git commit -m "docs: note rntme-cli submodule in README and AGENTS"
```

---

### Task 13: Final verification sweep

**Files:**
- None modified; verification only.

- [ ] **Step 1: Submodule status**

Run: `git submodule status`
Expected: one entry listing `rntme-cli` at a specific SHA (no leading `-` or `+`).

- [ ] **Step 2: Frozen install**

Run: `pnpm install --frozen-lockfile`
Expected: success.

- [ ] **Step 3: Full monorepo sweep**

Run:
```bash
pnpm -r run build
pnpm -r run typecheck
pnpm -r run test
pnpm -r run lint
```
Expected: every command passes; `@rntme-cli/cli` appears in each task list alongside `@rntme/*` packages.

- [ ] **Step 4: Binary end-to-end**

Run:
```bash
node rntme-cli/packages/cli/dist/bin/cli.js --help
node rntme-cli/packages/cli/dist/bin/cli.js --version
node rntme-cli/packages/cli/dist/bin/cli.js frobnicate
echo "exit: $?"
```
Expected: `--help` exits 0 with usage, `--version` exits 0 with `0.0.0`, `frobnicate` exits 1 with `Unknown command: frobnicate`.

- [ ] **Step 5: Fresh-clone simulation (optional but recommended)**

Run:
```bash
cd /tmp
rm -rf rntme-fresh
git clone --recurse-submodules https://github.com/vladprrs/rntme.git rntme-fresh
cd rntme-fresh
pnpm install --frozen-lockfile
pnpm -r run build
```
Expected: succeeds end-to-end with no manual `submodule update` required. (The branch must be pushed to the remote before this step is meaningful; skip or defer to after push.)

- [ ] **Step 6: Push all local commits**

Run:
```bash
cd /home/coder/project
git push origin main
```
Expected: three commits pushed (submodule wiring, CI, docs). CI will fail until `RNTME_CLI_SUBMODULE_TOKEN` is configured per Task 11 Step 1 — if the secret is not yet set, open a GitHub issue to track that and note it in the push message.

- [ ] **Step 7: Clean up the scratch clone**

Run: `rm -rf /home/coder/rntme-cli-bootstrap`
Expected: the scratch clone is deleted; the only checkout of `rntme-cli` on this machine is the submodule at `/home/coder/project/rntme-cli`.
