# Architecture audit — `@rntme/conformance-ai-llm`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-218` (`1bf440e1-ca3b-4715-91cc-113380cc797c`) |
| **Issue title** | Audit: package architecture — @rntme/conformance-ai-llm |
| **Package / scope** | `@rntme/conformance-ai-llm` |
| **Verdict (summary)** | OK — the package matches its implementation plan and all tests pass. However, there is |
| **Audit comment id** | `e6f6b3fd-22ab-450e-8807-6e6007b77028` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: @rntme/conformance-ai-llm

**Verdict:** OK — the package matches its implementation plan and all tests pass. However, there is **medium architectural debt** in cross-category consistency that will surface when  lands.

---

### 1. Cross-category  interface divergence — HIGH

**Evidence:**
-  uses  and 
-  uses  and 
-  mirrors AI-LLM exactly

**Impact:** The future shared conformance runner cannot consume all three category suites without adapter code or runtime normalization. This violates the modules-monorepo spec §7.1 vision of a single  shape.

**Recommendation:** Pick one shape (prefer AI-LLM/Identity's  +  with readonly markers) and migrate CRM in a follow-up. Add a cross-category contract test that fails when any conformance package drifts from the canonical interface.

---

### 2.  duplicated verbatim across AI-LLM and Identity — MEDIUM

**Evidence:**


**Impact:** Every type-level change to the conformance framework stub must be applied in N places. Risk of skew when the framework lands.

**Recommendation:** Either (a) extract a shared  workspace package now, or (b) add a CI check that diffs the normalized types files across categories and fails on divergence. Prefer (a) if the stub survives more than one more sprint.

---

### 3.  script inconsistency across categories — MEDIUM

**Evidence:**
- AI-LLM: 
- Identity: 
- CRM: no  at all (relies on workspace topo-order)

**Impact:** Divergent build strategies make it harder to reason about which packages need pre-building. The  ERROR  Unknown option: 'recursive'
For help, run: pnpm help recursive approach is more robust against directory moves; the Version 9.12.0 (compiled to binary; bundled Node.js v24.15.0)
Usage: pnpm [command] [flags]
       pnpm [ -h | --help | -v | --version ]

Manage your dependencies:
      add                  Installs a package and any packages that it depends
                           on. By default, any new package is installed as a
                           prod dependency
      import               Generates a pnpm-lock.yaml from an npm
                           package-lock.json (or npm-shrinkwrap.json) file
   i, install              Install all dependencies for a project
  it, install-test         Runs a pnpm install followed immediately by a pnpm
                           test
  ln, link                 Connect the local project to another one
      prune                Removes extraneous packages
  rb, rebuild              Rebuild a package
  rm, remove               Removes packages from node_modules and from the
                           project's package.json
      unlink               Unlinks a package. Like yarn unlink but pnpm
                           re-installs the dependency after removing the
                           external link
  up, update               Updates packages to their latest version based on the
                           specified range

Review your dependencies:
      audit                Checks for known security issues with the installed
                           packages
      licenses             Check licenses in consumed packages
  ls, list                 Print all the versions of packages that are
                           installed, as well as their dependencies, in a
                           tree-structure
      outdated             Check for outdated packages

Run your scripts:
      exec                 Executes a shell command in scope of a project
      run                  Runs a defined package script
      start                Runs an arbitrary command specified in the package's
                           "start" property of its "scripts" object
   t, test                 Runs a package's "test" script, if one was provided

Other:
      cat-file             Prints the contents of a file based on the hash value
                           stored in the index file
      cat-index            Prints the index file of a specific package from the
                           store
      find-hash            Experimental! Lists the packages that include the
                           file with the specified hash.
      pack                 Create a tarball from a package
      publish              Publishes a package to the registry
      root                 Prints the effective modules directory

Manage your store:
      store add            Adds new packages to the pnpm store directly. Does
                           not modify any projects or files outside the store
      store path           Prints the path to the active store directory
      store prune          Removes unreferenced (extraneous, orphan) packages
                           from the store
      store status         Checks for modified packages in the store

Options:
  -r, --recursive          Run the command for each project in the workspace. approach breaks if the package relocates.

**Recommendation:** Standardize on  for all conformance packages, and add  to CRM for consistency. Alternatively, remove  from all conformance packages and rely on Scope: all 30 projects
rntme/packages/bindings build$ tsc -p tsconfig.json
rntme/packages/contracts/_common/v1 build$ tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/packages/db-studio build$ tsc -p tsconfig.json
rntme/packages/event-store build$ tsc -p tsconfig.json
rntme/packages/contracts/_common/v1 build: Done
rntme/packages/pdm build$ tsc -p tsconfig.json
rntme/packages/event-store build: Done
rntme/packages/ui build$ tsc -p tsconfig.json
rntme/packages/bindings build: Done
rntme/packages/db-studio build: Done
rntme/packages/pdm build: Done
rntme/packages/ui build: Done
rntme/packages/contracts/ai-llm/v1 build$ tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/packages/contracts/identity/v1 build$ tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/packages/contracts/crm/v1 build$ node scripts/build.mjs
rntme/packages/qsm build$ tsc -p tsconfig.json
rntme/packages/contracts/ai-llm/v1 build: Done
rntme/packages/seed build$ tsc -p tsconfig.json
rntme/packages/contracts/identity/v1 build: Done
rntme/packages/ui-runtime build$ tsc -p tsconfig.json && pnpm run build:client
rntme/packages/contracts/crm/v1 build: Done
rntme/packages/qsm build: Done
rntme/packages/seed build: Done
rntme/packages/seed postbuild$ node -e "const f='dist/bin/cli.js';const s=require('fs').readFileSync(f,'utf8');if(!s.startsWith('#!'))require('fs').writeFileSync(f,'#!/usr/bin/env node\n'+s);require('fs').chmodSync(f,0o755);"
rntme/packages/seed postbuild: Done
rntme/packages/ui-runtime build: > @rntme/ui-runtime@0.0.0 build:client /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/ui-runtime
rntme/packages/ui-runtime build: > tsx src/build.ts
rntme/packages/ui-runtime build: JS built → build/main.js
rntme/packages/ui-runtime build: npm warn Unknown env config "recursive". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
rntme/packages/ui-runtime build: ≈ tailwindcss v4.2.2
rntme/packages/ui-runtime build: Done in 209ms
rntme/packages/ui-runtime build: CSS built → build/main.css
rntme/packages/ui-runtime build: Done
rntme build$ pnpm -r run build
rntme/modules/ai-llm/conformance build$ pnpm run build:deps && tsc -p tsconfig.json
rntme/modules/identity/conformance build$ pnpm run build:deps && tsc -p tsconfig.json
rntme/modules/crm/conformance build$ tsc -p tsconfig.json
rntme/modules/ai-llm/conformance build: > @rntme/conformance-ai-llm@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/ai-llm/conformance
rntme/modules/ai-llm/conformance build: > pnpm -F @rntme/contracts-common-v1 run build && pnpm -F @rntme/contracts-ai-llm-v1 run build
rntme/modules/identity/conformance build: > @rntme/conformance-identity@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/conformance
rntme/modules/identity/conformance build: > pnpm --dir ../../../packages/contracts/_common/v1 run build && pnpm --dir ../../../packages/contracts/identity/v1 run build
rntme build: Scope: 29 of 30 workspace projects
rntme build: packages/bindings build$ tsc -p tsconfig.json
rntme build: packages/contracts/_common/v1 build$ tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: packages/db-studio build$ tsc -p tsconfig.json
rntme build: packages/event-store build$ tsc -p tsconfig.json
rntme/modules/identity/conformance build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme/modules/identity/conformance build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/modules/ai-llm/conformance build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme/modules/ai-llm/conformance build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/modules/crm/conformance build: Done
rntme/packages/blueprint build$ tsc -p tsconfig.json
rntme build: packages/contracts/_common/v1 build: Done
rntme build: packages/pdm build$ tsc -p tsconfig.json
rntme build: packages/event-store build: Done
rntme build: packages/ui build$ tsc -p tsconfig.json
rntme build: packages/bindings build: Done
rntme/modules/identity/conformance build: > @rntme/contracts-identity-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/identity/v1
rntme/modules/identity/conformance build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/modules/ai-llm/conformance build: > @rntme/contracts-ai-llm-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/ai-llm/v1
rntme/modules/ai-llm/conformance build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/packages/blueprint build: Done
rntme/packages/graph-ir-compiler build$ tsc -p tsconfig.json
rntme build: packages/db-studio build: Done
rntme build: packages/pdm build: Done
rntme build: packages/ui build: Done
rntme build: packages/contracts/ai-llm/v1 build$ tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: packages/contracts/crm/v1 build$ node scripts/build.mjs
rntme build: packages/contracts/identity/v1 build$ tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: packages/qsm build$ tsc -p tsconfig.json
rntme build: packages/contracts/ai-llm/v1 build: Done
rntme build: packages/seed build$ tsc -p tsconfig.json
rntme build: packages/contracts/identity/v1 build: Done
rntme build: packages/ui-runtime build$ tsc -p tsconfig.json && pnpm run build:client
rntme build: packages/contracts/crm/v1 build: Done
rntme/modules/ai-llm/conformance build: Done
rntme build: packages/qsm build: Done
rntme/modules/identity/conformance build: Done
rntme/packages/graph-ir-compiler build: Done
rntme build: packages/seed build: Done
rntme build: packages/seed postbuild$ node -e "const f='dist/bin/cli.js';const s=require('fs').readFileSync(f,'utf8');if(!s.startsWith('#!'))require('fs').writeFileSync(f,'#!/usr/bin/env node\n'+s);require('fs').chmodSync(f,0o755);"
rntme build: packages/seed postbuild: Done
rntme build: packages/ui-runtime build: > @rntme/ui-runtime@0.0.0 build:client /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/ui-runtime
rntme build: packages/ui-runtime build: > tsx src/build.ts
rntme build: packages/ui-runtime build: JS built → build/main.js
rntme build: packages/ui-runtime build: npm warn Unknown env config "recursive". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
rntme build: packages/ui-runtime build: ≈ tailwindcss v4.2.2
rntme build: packages/ui-runtime build: Done in 189ms
rntme build: packages/ui-runtime build: CSS built → build/main.css
rntme build: packages/ui-runtime build: Done
rntme build: modules/ai-llm/conformance build$ pnpm run build:deps && tsc -p tsconfig.json
rntme build: modules/crm/conformance build$ tsc -p tsconfig.json
rntme build: packages/blueprint build$ tsc -p tsconfig.json
rntme build: modules/identity/conformance build$ pnpm run build:deps && tsc -p tsconfig.json
rntme build: modules/ai-llm/conformance build: > @rntme/conformance-ai-llm@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/ai-llm/conformance
rntme build: modules/ai-llm/conformance build: > pnpm -F @rntme/contracts-common-v1 run build && pnpm -F @rntme/contracts-ai-llm-v1 run build
rntme build: modules/identity/conformance build: > @rntme/conformance-identity@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/conformance
rntme build: modules/identity/conformance build: > pnpm --dir ../../../packages/contracts/_common/v1 run build && pnpm --dir ../../../packages/contracts/identity/v1 run build
rntme build: modules/identity/conformance build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme build: modules/identity/conformance build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: modules/ai-llm/conformance build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme build: modules/ai-llm/conformance build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: modules/crm/conformance build: Done
rntme build: packages/graph-ir-compiler build$ tsc -p tsconfig.json
rntme build: packages/blueprint build: Done
rntme build: modules/identity/conformance build: > @rntme/contracts-identity-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/identity/v1
rntme build: modules/identity/conformance build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: modules/ai-llm/conformance build: > @rntme/contracts-ai-llm-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/ai-llm/v1
rntme build: modules/ai-llm/conformance build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: packages/graph-ir-compiler build: Done
rntme build: modules/identity/conformance build: Done
rntme build: modules/ai-llm/conformance build: Done
rntme build: modules/crm/amocrm build$ pnpm run build:deps && tsc -p tsconfig.json
rntme build: modules/crm/bitrix24 build$ pnpm run build:deps && tsc -p tsconfig.json
rntme build: modules/identity/clerk build$ pnpm run build:deps && tsc -p tsconfig.json
rntme build: modules/identity/auth0 build$ pnpm run build:deps && tsc -p tsconfig.json
rntme build: modules/crm/bitrix24 build: > @rntme/crm-bitrix24@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/crm/bitrix24
rntme build: modules/crm/bitrix24 build: > pnpm -F @rntme/contracts-common-v1 run build && pnpm -F @rntme/contracts-crm-v1 run build && pnpm -F @rntme/conformance-crm run build
rntme build: modules/identity/auth0 build: > @rntme/identity-auth0@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/auth0
rntme build: modules/identity/auth0 build: > pnpm -F @rntme/contracts-common-v1 run build && pnpm -F @rntme/contracts-identity-v1 run build && pnpm -F @rntme/conformance-identity run build
rntme build: modules/crm/amocrm build: > @rntme/crm-amocrm@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/crm/amocrm
rntme build: modules/crm/amocrm build: > pnpm --dir ../../../packages/contracts/_common/v1 run build && pnpm --dir ../../../packages/contracts/crm/v1 run build && pnpm --dir ../conformance run build
rntme build: modules/identity/clerk build: > @rntme/identity-clerk@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/clerk
rntme build: modules/identity/clerk build: > pnpm --dir ../../../packages/contracts/_common/v1 run build && pnpm --dir ../../../packages/contracts/identity/v1 run build && pnpm --dir ../conformance run build
rntme build: modules/identity/clerk build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme build: modules/identity/clerk build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: modules/identity/auth0 build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme build: modules/identity/auth0 build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: modules/crm/amocrm build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme build: modules/crm/amocrm build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: modules/crm/bitrix24 build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme build: modules/crm/bitrix24 build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: modules/crm/amocrm build: > @rntme/contracts-crm-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/crm/v1
rntme build: modules/crm/amocrm build: > node scripts/build.mjs
rntme build: modules/crm/bitrix24 build: > @rntme/contracts-crm-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/crm/v1
rntme build: modules/crm/bitrix24 build: > node scripts/build.mjs
rntme build: modules/identity/clerk build: > @rntme/contracts-identity-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/identity/v1
rntme build: modules/identity/clerk build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: modules/identity/auth0 build: > @rntme/contracts-identity-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/identity/v1
rntme build: modules/identity/auth0 build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: modules/identity/clerk build: > @rntme/conformance-identity@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/conformance
rntme build: modules/identity/clerk build: > pnpm run build:deps && tsc -p tsconfig.json
rntme build: modules/crm/amocrm build: > @rntme/conformance-crm@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/crm/conformance
rntme build: modules/crm/amocrm build: > tsc -p tsconfig.json
rntme build: modules/identity/auth0 build: > @rntme/conformance-identity@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/conformance
rntme build: modules/identity/auth0 build: > pnpm run build:deps && tsc -p tsconfig.json
rntme build: modules/crm/bitrix24 build: > @rntme/conformance-crm@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/crm/conformance
rntme build: modules/crm/bitrix24 build: > tsc -p tsconfig.json
rntme build: modules/identity/clerk build: > @rntme/conformance-identity@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/conformance
rntme build: modules/identity/clerk build: > pnpm --dir ../../../packages/contracts/_common/v1 run build && pnpm --dir ../../../packages/contracts/identity/v1 run build
rntme build: modules/identity/auth0 build: > @rntme/conformance-identity@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/conformance
rntme build: modules/identity/auth0 build: > pnpm --dir ../../../packages/contracts/_common/v1 run build && pnpm --dir ../../../packages/contracts/identity/v1 run build
rntme build: modules/identity/clerk build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme build: modules/identity/clerk build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: modules/identity/auth0 build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme build: modules/identity/auth0 build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: modules/identity/clerk build: > @rntme/contracts-identity-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/identity/v1
rntme build: modules/identity/clerk build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: modules/identity/auth0 build: > @rntme/contracts-identity-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/identity/v1
rntme build: modules/identity/auth0 build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: modules/crm/amocrm build: Done
rntme build: modules/identity/workos build$ pnpm run build:deps && tsc -p tsconfig.json
rntme build: modules/crm/bitrix24 build: Done
rntme build: packages/bindings-http build$ rm -rf dist && tsc -p tsconfig.json
rntme build: modules/identity/workos build: > @rntme/identity-workos@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/workos
rntme build: modules/identity/workos build: > pnpm --dir ../../../packages/contracts/_common/v1 run build && pnpm --dir ../../../packages/contracts/identity/v1 run build && pnpm --dir ../conformance run build
rntme build: modules/identity/workos build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme build: modules/identity/workos build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: modules/identity/workos build: > @rntme/contracts-identity-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/identity/v1
rntme build: modules/identity/workos build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: packages/bindings-http build: Done
rntme build: packages/projection-consumer build$ tsc -p tsconfig.json
rntme build: modules/identity/clerk build: Done
rntme build: modules/identity/auth0 build: Done
rntme build: packages/projection-consumer build: Done
rntme build: modules/identity/workos build: > @rntme/conformance-identity@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/conformance
rntme build: modules/identity/workos build: > pnpm run build:deps && tsc -p tsconfig.json
rntme build: modules/identity/workos build: > @rntme/conformance-identity@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/conformance
rntme build: modules/identity/workos build: > pnpm --dir ../../../packages/contracts/_common/v1 run build && pnpm --dir ../../../packages/contracts/identity/v1 run build
rntme build: modules/identity/workos build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme build: modules/identity/workos build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: modules/identity/workos build: > @rntme/contracts-identity-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/identity/v1
rntme build: modules/identity/workos build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme build: modules/identity/workos build: Done
rntme build: packages/bindings-grpc build$ tsc -p tsconfig.json
rntme build: packages/bindings-grpc build: Done
rntme build: packages/runtime build$ rm -rf dist && tsc -p tsconfig.json
rntme build: packages/runtime build: Done
rntme build: demo/pre-step-demo build$ tsc -p tsconfig.json
rntme build: demo/issue-tracker-api build$ tsc -p tsconfig.json
rntme build: packages/module-skeleton build$ tsc -p tsconfig.json
rntme build: packages/module-skeleton build: Done
rntme build: demo/pre-step-demo build: Done
rntme build: demo/issue-tracker-api build: Done
rntme build: Done
rntme/modules/crm/amocrm build$ pnpm run build:deps && tsc -p tsconfig.json
rntme/modules/crm/bitrix24 build$ pnpm run build:deps && tsc -p tsconfig.json
rntme/modules/identity/auth0 build$ pnpm run build:deps && tsc -p tsconfig.json
rntme/modules/identity/clerk build$ pnpm run build:deps && tsc -p tsconfig.json
rntme/modules/identity/auth0 build: > @rntme/identity-auth0@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/auth0
rntme/modules/identity/auth0 build: > pnpm -F @rntme/contracts-common-v1 run build && pnpm -F @rntme/contracts-identity-v1 run build && pnpm -F @rntme/conformance-identity run build
rntme/modules/identity/clerk build: > @rntme/identity-clerk@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/clerk
rntme/modules/identity/clerk build: > pnpm --dir ../../../packages/contracts/_common/v1 run build && pnpm --dir ../../../packages/contracts/identity/v1 run build && pnpm --dir ../conformance run build
rntme/modules/crm/bitrix24 build: > @rntme/crm-bitrix24@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/crm/bitrix24
rntme/modules/crm/bitrix24 build: > pnpm -F @rntme/contracts-common-v1 run build && pnpm -F @rntme/contracts-crm-v1 run build && pnpm -F @rntme/conformance-crm run build
rntme/modules/crm/amocrm build: > @rntme/crm-amocrm@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/crm/amocrm
rntme/modules/crm/amocrm build: > pnpm --dir ../../../packages/contracts/_common/v1 run build && pnpm --dir ../../../packages/contracts/crm/v1 run build && pnpm --dir ../conformance run build
rntme/modules/identity/clerk build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme/modules/identity/clerk build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/modules/crm/amocrm build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme/modules/crm/amocrm build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/modules/identity/auth0 build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme/modules/identity/auth0 build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/modules/crm/bitrix24 build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme/modules/crm/bitrix24 build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/modules/crm/amocrm build: > @rntme/contracts-crm-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/crm/v1
rntme/modules/crm/amocrm build: > node scripts/build.mjs
rntme/modules/identity/clerk build: > @rntme/contracts-identity-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/identity/v1
rntme/modules/identity/clerk build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/modules/identity/auth0 build: > @rntme/contracts-identity-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/identity/v1
rntme/modules/identity/auth0 build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/modules/crm/bitrix24 build: > @rntme/contracts-crm-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/crm/v1
rntme/modules/crm/bitrix24 build: > node scripts/build.mjs
rntme/modules/identity/clerk build: > @rntme/conformance-identity@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/conformance
rntme/modules/identity/clerk build: > pnpm run build:deps && tsc -p tsconfig.json
rntme/modules/identity/auth0 build: > @rntme/conformance-identity@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/conformance
rntme/modules/identity/auth0 build: > pnpm run build:deps && tsc -p tsconfig.json
rntme/modules/crm/amocrm build: > @rntme/conformance-crm@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/crm/conformance
rntme/modules/crm/amocrm build: > tsc -p tsconfig.json
rntme/modules/crm/bitrix24 build: > @rntme/conformance-crm@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/crm/conformance
rntme/modules/crm/bitrix24 build: > tsc -p tsconfig.json
rntme/modules/identity/clerk build: > @rntme/conformance-identity@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/conformance
rntme/modules/identity/clerk build: > pnpm --dir ../../../packages/contracts/_common/v1 run build && pnpm --dir ../../../packages/contracts/identity/v1 run build
rntme/modules/identity/auth0 build: > @rntme/conformance-identity@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/conformance
rntme/modules/identity/auth0 build: > pnpm --dir ../../../packages/contracts/_common/v1 run build && pnpm --dir ../../../packages/contracts/identity/v1 run build
rntme/modules/identity/clerk build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme/modules/identity/clerk build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/modules/identity/auth0 build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme/modules/identity/auth0 build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/modules/identity/clerk build: > @rntme/contracts-identity-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/identity/v1
rntme/modules/identity/clerk build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/modules/identity/auth0 build: > @rntme/contracts-identity-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/identity/v1
rntme/modules/identity/auth0 build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/modules/crm/amocrm build: Done
rntme/modules/identity/workos build$ pnpm run build:deps && tsc -p tsconfig.json
rntme/modules/crm/bitrix24 build: Done
rntme/packages/bindings-http build$ rm -rf dist && tsc -p tsconfig.json
rntme/modules/identity/workos build: > @rntme/identity-workos@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/workos
rntme/modules/identity/workos build: > pnpm --dir ../../../packages/contracts/_common/v1 run build && pnpm --dir ../../../packages/contracts/identity/v1 run build && pnpm --dir ../conformance run build
rntme/modules/identity/workos build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme/modules/identity/workos build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/modules/identity/workos build: > @rntme/contracts-identity-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/identity/v1
rntme/modules/identity/workos build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/packages/bindings-http build: Done
rntme/packages/projection-consumer build$ tsc -p tsconfig.json
rntme/modules/identity/auth0 build: Done
rntme/modules/identity/clerk build: Done
rntme/packages/projection-consumer build: Done
rntme/modules/identity/workos build: > @rntme/conformance-identity@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/conformance
rntme/modules/identity/workos build: > pnpm run build:deps && tsc -p tsconfig.json
rntme/modules/identity/workos build: > @rntme/conformance-identity@0.0.0 build:deps /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/modules/identity/conformance
rntme/modules/identity/workos build: > pnpm --dir ../../../packages/contracts/_common/v1 run build && pnpm --dir ../../../packages/contracts/identity/v1 run build
rntme/modules/identity/workos build: > @rntme/contracts-common-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/_common/v1
rntme/modules/identity/workos build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/modules/identity/workos build: > @rntme/contracts-identity-v1@0.0.0 build /home/coder/.multica/workspaces/4581b4ac-546d-40f2-a4dc-c959734fbaba/1d38cd0c/workdir/rntme/packages/contracts/identity/v1
rntme/modules/identity/workos build: > tsc -p tsconfig.json && cp src/proto.gen.d.ts src/proto.gen.js dist/
rntme/modules/identity/workos build: Done
rntme/packages/bindings-grpc build$ tsc -p tsconfig.json
rntme/packages/bindings-grpc build: Done
rntme/packages/runtime build$ rm -rf dist && tsc -p tsconfig.json
rntme/packages/runtime build: Done
rntme/demo/issue-tracker-api build$ tsc -p tsconfig.json
rntme/demo/pre-step-demo build$ tsc -p tsconfig.json
rntme/packages/module-skeleton build$ tsc -p tsconfig.json
rntme/packages/module-skeleton build: Done
rntme/demo/pre-step-demo build: Done
rntme/demo/issue-tracker-api build: Done at the workspace root (the CRM approach), which is cleaner if the workspace topo-sort is trustworthy.

---

### 4. Missing per-RPC assertion registry — MEDIUM

**Evidence:**
- CRM has  — a  with human-readable assertion descriptions for every RPC.
- AI-LLM (and Identity) only have free-form docstrings inside each scenario file.

**Impact:** The framework runner cannot emit a capability-coverage report with assertion summaries for AI-LLM vendors. CRM modules get richer reporting for free.

**Recommendation:** Add  to AI-LLM conformance, mirroring CRM's pattern. This is a quick win — the docstrings already contain the text; they just need to be hoisted into a programmatic registry.

---

### 5.  runs  — LOW

**Evidence:**
- AI-LLM: 
- Identity:  (correct)

**Impact:** Watch mode is unnecessarily slow; every file change triggers dependency rebuilds.

**Recommendation:** Remove  from . Quick win.

---

### 6.  dead fallback path — LOW

**Evidence:** :


**Impact:** This path resolves to  which does not exist. The  check means it never executes at runtime, but it is confusing code that looks like a copy-paste artifact from a different directory structure.

**Recommendation:** Remove the fallback branch and simplify to a direct .

---

### 7.  runtime coupling to contract package — LOW

**Evidence:**  imports  from  and uses  enum values.

**Impact:** Fixtures now have a runtime dependency on the generated contract bindings. If the contract package's generated code changes (e.g. protobufjs version bump), fixture values may shift silently.

**Recommendation:** This is a trade-off, not a clear bug. The plan originally specified raw numeric literals (, , etc.) to avoid this coupling. Using the proto enum is more type-safe but creates the dependency. Decide product-wide: either (a) revert to raw literals with a comment mapping, or (b) accept the coupling and add a fixture-level test that validates enum values haven't drifted. Either is fine, but document the decision.

---

### 8. What works well

- Package exactly matches implementation plan .
- All 11 tests pass (3 fixture-sanity + 4 drift + 4 suite-shape).
- Drift detector correctly introspects  proto and enforces 1:1 RPC-to-file mapping.
- Binary fixtures are validated for size (≤100KB) and magic bytes.
- Category README at  is present and comprehensive.
-  correctly includes  glob.

---

### Quick wins (can be done without product decision)
1. Fix  to skip .
2. Remove dead fallback path in .
3. Add  registry.
4. Standardize  script across all conformance packages.

### Requires Vlad's decision
1. **Canonical  shape**: Which interface does the framework runner target? CRM's snake_case or AI-LLM/Identity's camelCase?
2. **Type duplication strategy**: Create a shared stub package, or accept duplication until the framework lands?
3. **Fixture enum coupling**: Raw literals (plan-specified) or proto imports (current implementation)?

---

**Bottom line:** The package is a faithful implementation of its plan and poses no immediate risk. The debt is entirely in cross-category consistency — it will become expensive when the conformance framework runner tries to consume all three suites. Addressing the interface divergence (issue #1) before the framework lands is the highest-value cleanup.
