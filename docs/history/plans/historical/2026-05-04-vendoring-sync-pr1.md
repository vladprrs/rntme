> Status: historical.
> Date: 2026-05-04.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Vendoring Sync (PR1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a workspace-level `pnpm vendor:check` / `pnpm vendor:sync` toolchain that keeps `demo/<blueprint>/node_modules/<pkg>/{module.json,package.json}` in sync with the source-of-truth `modules/<cat>/<vendor>/`. Re-vendor the currently-drifted `rntme_identity_auth0` copy. Add `vendor:check` to CI.

**Architecture:** Two plain Node ESM scripts at workspace root (`scripts/vendor-check.mjs`, `scripts/vendor-sync.mjs`). Each reads workspace package.json files (`pnpm-workspace.yaml` + `modules/*/*/package.json`) plus vendored copies (`demo/*/node_modules/*/package.json`), maps by `package.json#name` ↔ vendored dir name (which uses underscores instead of `@scope/`), diffs the **tracked** subset (module.json + package.json) byte-for-byte. `dist/` is gitignored and excluded.

**Tech Stack:** Node 20, pnpm 9.12+, plain `.mjs` (no compilation), Node `node:fs/promises`. CI uses GitHub Actions.

**Spec reference:** `docs/history/specs/historical/2026-05-04-notes-demo-fresh-tenant-deployable-design.md` §8.

**Out-of-band facts (verified by reconnaissance):**
- Vendored modules track only `module.json` + `package.json`. `dist/` is gitignored locally and in vendored copies.
- Vendored dir naming convention: `@rntme/identity-auth0` → `rntme_identity_auth0` (drop `@`, replace `/` with `_`). Same convention as `safeProvisionerName` from blueprint, but with `_` instead of `__`. **The convention used here is the existing convention** — do not rename to match `safeProvisionerName`.
- Currently drifted: `demo/notes-blueprint/node_modules/rntme_identity_auth0/{module.json, package.json}` are unstaged-modified locally; running `vendor:sync` is what produces the canonical state.
- Workspace `package.json` has no `"type": "module"` field — `.mjs` extension required for ESM scripts.
- CI workflow `.github/workflows/ci.yml` chains `install → build → typecheck → test → lint`. New `vendor:check` step inserted after lint.

---

### Task 1: Workspace package.json wires up vendor scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Read current workspace package.json**

```bash
cat package.json
```

Expected: scripts block has `build`, `test`, `lint` only.

- [ ] **Step 2: Add vendor:check and vendor:sync scripts**

Edit `package.json` scripts block:

```json
{
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint",
    "vendor:check": "node scripts/vendor-check.mjs",
    "vendor:sync": "node scripts/vendor-sync.mjs"
  }
}
```

- [ ] **Step 3: Verify pnpm sees them**

Run: `pnpm run`
Expected: list includes `vendor:check` and `vendor:sync`.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore(workspace): wire vendor:check and vendor:sync scripts"
```

---

### Task 2: Implement vendor-check.mjs

**Files:**
- Create: `scripts/vendor-check.mjs`

- [ ] **Step 1: Create the script**

Write `scripts/vendor-check.mjs`:

```js
#!/usr/bin/env node
// Verifies that demo blueprint vendored modules match their source-of-truth in modules/<cat>/<vendor>/.
// Compared files: module.json, package.json. dist/ is gitignored and not checked.

import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

const ROOT = resolve(process.cwd());
const MODULES_DIR = join(ROOT, 'modules');
const DEMOS_DIR = join(ROOT, 'demo');
const TRACKED_FILES = ['module.json', 'package.json'];

function vendoredDirName(pkgName) {
  // "@rntme/identity-auth0" -> "rntme_identity_auth0"
  return pkgName.replace(/^@/, '').replaceAll('/', '_');
}

async function listSourceOfTruthModules() {
  const out = new Map();
  if (!existsSync(MODULES_DIR)) return out;
  for (const cat of await readdir(MODULES_DIR)) {
    const catPath = join(MODULES_DIR, cat);
    if (!(await stat(catPath)).isDirectory()) continue;
    for (const vendor of await readdir(catPath)) {
      const vendorPath = join(catPath, vendor);
      const pkgPath = join(vendorPath, 'package.json');
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
      out.set(pkg.name, vendorPath);
    }
  }
  return out;
}

async function listVendoredCopies() {
  const out = [];
  if (!existsSync(DEMOS_DIR)) return out;
  for (const demo of await readdir(DEMOS_DIR)) {
    const nm = join(DEMOS_DIR, demo, 'node_modules');
    if (!existsSync(nm)) continue;
    for (const dir of await readdir(nm)) {
      const dirPath = join(nm, dir);
      if (!(await stat(dirPath)).isDirectory()) continue;
      const pkgPath = join(dirPath, 'package.json');
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
      out.push({ demo, dirName: dir, pkgName: pkg.name, vendoredPath: dirPath });
    }
  }
  return out;
}

function normalize(text) {
  // Strip BOM, normalize CRLF→LF, drop trailing whitespace.
  return text.replace(/^﻿/, '').replaceAll('\r\n', '\n').replace(/[ \t]+$/gm, '');
}

async function main() {
  const sourceMap = await listSourceOfTruthModules();
  const vendored = await listVendoredCopies();
  const drift = [];

  for (const v of vendored) {
    const expectedDirName = vendoredDirName(v.pkgName);
    if (v.dirName !== expectedDirName) {
      drift.push({
        demo: v.demo,
        pkg: v.pkgName,
        reason: `dir name "${v.dirName}" expected "${expectedDirName}"`,
      });
      continue;
    }
    const sotPath = sourceMap.get(v.pkgName);
    if (!sotPath) {
      drift.push({
        demo: v.demo,
        pkg: v.pkgName,
        reason: `no source-of-truth in modules/ for package ${v.pkgName}`,
      });
      continue;
    }
    for (const file of TRACKED_FILES) {
      const sotFile = join(sotPath, file);
      const venFile = join(v.vendoredPath, file);
      if (!existsSync(sotFile) || !existsSync(venFile)) {
        drift.push({
          demo: v.demo,
          pkg: v.pkgName,
          reason: `${file} missing on ${existsSync(sotFile) ? 'vendored' : 'source'} side`,
        });
        continue;
      }
      const sotText = normalize(await readFile(sotFile, 'utf8'));
      const venText = normalize(await readFile(venFile, 'utf8'));
      if (sotText !== venText) {
        drift.push({
          demo: v.demo,
          pkg: v.pkgName,
          reason: `${file} content differs`,
        });
      }
    }
  }

  if (drift.length === 0) {
    console.log('vendor:check ok — all vendored copies in sync');
    return;
  }
  console.error('vendor:check failed:');
  for (const d of drift) {
    console.error(`  demo/${d.demo}: ${d.pkg} — ${d.reason}`);
  }
  console.error('\nrun `pnpm vendor:sync` to update vendored copies.');
  process.exit(1);
}

main().catch((e) => {
  console.error('vendor:check crashed:', e);
  process.exit(2);
});
```

- [ ] **Step 2: Run on current (drifted) state**

Run: `pnpm vendor:check`
Expected: exits with code 1, prints `demo/notes-blueprint: @rntme/identity-auth0 — module.json content differs` (and same for package.json).

- [ ] **Step 3: Commit**

```bash
git add scripts/vendor-check.mjs
git commit -m "chore(scripts): add vendor:check for demo blueprint module sync"
```

---

### Task 3: Implement vendor-sync.mjs

**Files:**
- Create: `scripts/vendor-sync.mjs`

- [ ] **Step 1: Create the script**

Write `scripts/vendor-sync.mjs`:

```js
#!/usr/bin/env node
// Copies module.json + package.json from modules/<cat>/<vendor>/ to demo/<bp>/node_modules/<pkg>/.
// Idempotent. dist/ is gitignored and not synced.

import { copyFile, readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

const ROOT = resolve(process.cwd());
const MODULES_DIR = join(ROOT, 'modules');
const DEMOS_DIR = join(ROOT, 'demo');
const TRACKED_FILES = ['module.json', 'package.json'];

async function listSourceOfTruthModules() {
  const out = new Map();
  if (!existsSync(MODULES_DIR)) return out;
  for (const cat of await readdir(MODULES_DIR)) {
    const catPath = join(MODULES_DIR, cat);
    if (!(await stat(catPath)).isDirectory()) continue;
    for (const vendor of await readdir(catPath)) {
      const vendorPath = join(catPath, vendor);
      const pkgPath = join(vendorPath, 'package.json');
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
      out.set(pkg.name, vendorPath);
    }
  }
  return out;
}

async function listVendoredCopies() {
  const out = [];
  if (!existsSync(DEMOS_DIR)) return out;
  for (const demo of await readdir(DEMOS_DIR)) {
    const nm = join(DEMOS_DIR, demo, 'node_modules');
    if (!existsSync(nm)) continue;
    for (const dir of await readdir(nm)) {
      const dirPath = join(nm, dir);
      if (!(await stat(dirPath)).isDirectory()) continue;
      const pkgPath = join(dirPath, 'package.json');
      if (!existsSync(pkgPath)) continue;
      const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
      out.push({ demo, pkgName: pkg.name, vendoredPath: dirPath });
    }
  }
  return out;
}

async function main() {
  const sourceMap = await listSourceOfTruthModules();
  const vendored = await listVendoredCopies();
  let synced = 0;

  for (const v of vendored) {
    const sotPath = sourceMap.get(v.pkgName);
    if (!sotPath) {
      console.warn(`skip demo/${v.demo}: ${v.pkgName} — no source-of-truth in modules/`);
      continue;
    }
    for (const file of TRACKED_FILES) {
      const sotFile = join(sotPath, file);
      const venFile = join(v.vendoredPath, file);
      if (!existsSync(sotFile)) {
        console.warn(`skip demo/${v.demo}: ${v.pkgName} — source ${file} missing`);
        continue;
      }
      await copyFile(sotFile, venFile);
      synced++;
    }
    console.log(`synced demo/${v.demo}: ${v.pkgName}`);
  }

  console.log(`vendor:sync done — ${synced} file(s) updated`);
}

main().catch((e) => {
  console.error('vendor:sync crashed:', e);
  process.exit(2);
});
```

- [ ] **Step 2: Run vendor:sync on the drifted state**

Run: `pnpm vendor:sync`
Expected: prints `synced demo/notes-blueprint: @rntme/identity-auth0`, then `vendor:sync done — 2 file(s) updated`.

- [ ] **Step 3: Verify vendor:check now passes**

Run: `pnpm vendor:check`
Expected: prints `vendor:check ok — all vendored copies in sync`.

- [ ] **Step 4: Verify the sync produced the right diff**

Run: `git diff demo/notes-blueprint/node_modules/rntme_identity_auth0/module.json`
Expected: shows `provisioner.entry` becoming `./dist/provisioner.entry.js` (was `./dist/provisioner.js` after the local pre-existing edit, OR an addition if it was originally absent).

- [ ] **Step 5: Commit script + re-vendored content**

```bash
git add scripts/vendor-sync.mjs demo/notes-blueprint/node_modules/rntme_identity_auth0/
git commit -m "chore(demo): sync vendored identity-auth0 module to source-of-truth

Re-vendors module.json and package.json so notes-demo blueprint matches
modules/identity/auth0/ after the provisioner-bundle-transport change."
```

---

### Task 4: Wire vendor:check into CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Read current CI**

```bash
cat .github/workflows/ci.yml
```

Expected: see existing `pnpm install`, `pnpm -r run build`, `pnpm -r run typecheck`, `pnpm -r run test`, `pnpm -r run lint` chain.

- [ ] **Step 2: Add vendor:check step**

Edit `.github/workflows/ci.yml`. Insert after the `lint` step:

```yaml
      - run: pnpm -r run lint
      - run: pnpm vendor:check
```

- [ ] **Step 3: Verify locally**

Run: `pnpm vendor:check`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: enforce demo blueprint vendoring sync"
```

---

### Task 5: AGENTS.md how-to entry

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Find §6 (how-to recipes section)**

Run: `grep -n "^##\|^###" AGENTS.md | head -30`

Expected: a section header for "how to" recipes (likely titled something with "How", "Tasks", or "Recipes"). Pick the section that hosts task-indexed recipes.

- [ ] **Step 2: Add the vendoring how-to**

Insert in the appropriate `##`/`###` location:

```markdown
### Update a vendored module in a demo blueprint

When `modules/<category>/<vendor>/` changes, the demo blueprint's vendored copy must follow.

1. Edit `modules/<category>/<vendor>/`.
2. Build the module: `pnpm -F <pkg-name> build` (produces `dist/`, including `dist/provisioner.entry.js` if the module declares a `provisioner` block).
3. Run `pnpm vendor:sync` from the workspace root. This copies `module.json` and `package.json` from the source-of-truth to every `demo/<bp>/node_modules/<vendored-dir>/` whose `package.json#name` matches.
4. Commit both the source change and the vendored copy in the same PR.

CI runs `pnpm vendor:check`. PRs that edit `modules/` without re-vendoring fail the check with a clear error message pointing at the drifted file.

`dist/` is gitignored on both source and vendored sides — only `module.json` and `package.json` are tracked. Local builds (or fresh `pnpm install` followed by `pnpm -r build`) materialize `dist/` for both copies.
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): how-to for updating a vendored module in a demo blueprint"
```

---

### Task 6: Open the PR

- [ ] **Step 1: Push branch and open PR**

```bash
git push -u origin <branch>
gh pr create --title "chore(workspace): demo blueprint vendoring sync (PR1/4)" --body "$(cat <<'EOF'
## Summary

- Adds workspace `pnpm vendor:check` and `pnpm vendor:sync` scripts (`scripts/vendor-{check,sync}.mjs`).
- Re-vendors `demo/notes-blueprint/node_modules/rntme_identity_auth0/{module.json,package.json}` against the source-of-truth `modules/identity/auth0/`.
- Wires `pnpm vendor:check` into CI after lint.
- Adds an AGENTS.md how-to.

This is PR1 of 4 implementing the design at `docs/history/specs/historical/2026-05-04-notes-demo-fresh-tenant-deployable-design.md`. PR1 unblocks bundle-transport for the demo by aligning the manifest's `provisioner.entry` path. PR2 (boot fragility) and PR3 (pipeline reorder) follow.

## Test plan

- [ ] CI green (build, typecheck, test, lint, vendor:check).
- [ ] Local: `pnpm vendor:check` passes.
- [ ] Local: intentional drift (edit a vendored `module.json`) → `pnpm vendor:check` fails with clear message → `pnpm vendor:sync` restores → check passes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Verify PR URL is reachable**

Note the PR URL printed by `gh pr create`. Done.
