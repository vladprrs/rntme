> Status: autonomous-spec.
> Date: 2026-05-09.
> Current source: Multica issue RNT-533, RNT-525 LOC audit, `docs/decision-system.md`, current contracts owner docs, current package scripts/workflows, protobufjs-cli upstream README, and code/tests on `origin/main` at `a28ca4e3`.
> Why retained: SPEC rationale for treating generated protobuf JS/DTS as committed contract artifacts with explicit generated-file classification and freshness gates; verify current truth against code/tests before implementation.
> Rebased note, 2026-05-16: command examples were reconciled with current `origin/main`, which has moved to the Bun-first toolchain and `bun.lock`.

# Generated protobuf artifact strategy - design

## Problem

RNT-525 showed that generated protobuf bindings are the largest non-doc LOC
contributor in the repository:

```text
packages/contracts/*/v1/src/proto.gen.{js,d.ts}: 120,199 LOC
```

Those files are not hand-authored product code, but today they are load-bearing
source artifacts for the protobuf contract packages. The repository needs a
clear decision on whether to keep them in git, generate them during
build/prepublish/CI, or split generated artifacts into a different package or
distribution surface.

Without a repo-visible rule, future contract changes can drift in two bad
directions:

- generated files keep inflating source metrics and review diffs without
  consistent Linguist classification or freshness checks;
- generation moves into build/publish ad hoc, making local development, CI, and
  package repeatability depend on hidden side effects.

## Goals

- Pick one canonical generated-artifact strategy for protobuf contract packages.
- Preserve deterministic local dev, CI, and future package publishing.
- Keep contract packages consumable through their current public `proto`
  exports and direct type/value aliases.
- Make generated LOC explicitly classified as generated, including storage.
- Make stale generated output fail fast in CI for every protobuf contract
  package, not only identity.
- Give PLAN/DEV exact package, script, workflow, and docs surfaces to update.

## Non-goals

- No rewrite of canonical `.proto` contract schemas.
- No replacement of `protobufjs-cli` in this issue.
- No split package publication in this issue.
- No consumer-facing compatibility shim. The project is pre-stable, but the
  recommended path does not change the public contract package API.
- No `docs/decision-system.md` edit unless a later implementation changes the
  broader contract-generation convention beyond this spec.

## Current Context

Protobuf contract packages with committed generated output:

| Package | Generated LOC | Current checks/classification |
|---|---:|---|
| `packages/contracts/_common/v1` | 5,023 | `.gitattributes`; no `proto:check` |
| `packages/contracts/identity/v1` | 28,676 | `.gitattributes`; `proto:check` in `test` |
| `packages/contracts/ai-llm/v1` | 28,392 | `.gitattributes`; no `proto:check` |
| `packages/contracts/crm/v1` | 44,112 | `.gitattributes`; no `proto:check` |
| `packages/contracts/storage/v1` | 13,996 | no `.gitattributes`; no `proto:check` |

The packages use `scripts/gen.mjs` with `protobufjs-cli`:

- `pbjs --target static-module --wrap es6 --es6 --keep-case` generates
  `src/proto.gen.js`;
- `pbts --out ... src/proto.gen.js` generates `src/proto.gen.d.ts`;
- category packages stage cross-package imports through `proto-deps/` symlinks;
- generated JS is patched from namespace protobuf imports to default ESM
  imports for current Node/protobufjs behavior.

Upstream `protobufjs-cli` documents `pbjs` as the JavaScript static-code
generator and `pbts` as the TypeScript declaration generator. Its static-module
mode is a compile-step strategy: it requires generated source, but can run with
the protobufjs minimal runtime after generation.

The generated files are directly imported by `src/index.ts`:

```ts
export * as proto from './proto.gen.js';
export type { rntme as Rntme } from './proto.gen.js';
```

Identity and CRM also export direct aliases from the generated namespace, such
as `User`, `IdentityModule`, `Deal`, and `CrmModule`.

Build/publish shape today:

- package builds compile `src/index.ts` and copy `src/proto.gen.{js,d.ts}` into
  `dist/`;
- `files` includes `dist`, `proto`, `error-codes.json`, and `README.md`;
- release CI installs dependencies, builds/tests workspace packages, then
  publishes only `@rntme/runtime` today;
- future contract package publishing would depend on `dist/proto.gen.*` being
  present before `npm publish`.

CI today runs:

```text
bun install --frozen-lockfile
bun run build
bun run typecheck
bun run test
bun run lint
bun run depcruise
bun run vendor:check
```

Only `@rntme/contracts-identity-v1` currently proves generated output is fresh
by regenerating and comparing snapshots during `test`.

## Decision-System Fit

- **G1 / F6 Repeatability:** generated artifacts are acceptable only if the
  canonical input (`proto/*.proto` plus pinned generator dependency in
  `bun.lock`) and generated output stay synchronized. CI must catch drift.
- **G2 / F5 LLM-authorability:** agents changing `.proto` files need fail-fast
  feedback that says "run proto:gen and commit output" instead of discovering a
  broken package later during publish or consumer use.
- **G4 / F3 Contract-boundary check:** leaf contract packages are the public
  boundary for modules/runtime. Their npm artifacts must contain ready-to-import
  JS/DTS contract bindings; consumers should not run contract codegen.
- **G5 / F2 Canonical-way check:** every protobuf contract package should use
  the same generated-file classification and freshness rule. Identity should not
  be the only package with `proto:check`.
- **F8 Leverage existing standards/libraries:** keep using the existing
  protobufjs-cli static-module generator for now; it is already the repo's
  chosen generator and no current requirement justifies a tool migration.
- **G6 / F7 Pre-stable bias:** if a later generator/package layout migration is
  valuable, it can be breaking. This spec does not need that migration to solve
  the current LOC/repeatability problem.

Applicable locked bets include **Leaf contracts in
`packages/contracts/<category>/v1/`**, **gRPC between services**,
**CloudEvents 1.0 envelope end-to-end**, **Layering enforced by
dependency-cruiser**, and **Bun-first toolchain + scoped `tsc` exception** as
the current-default tooling stack. This design does not contradict any Goal,
Filter, or locked Bet.

## Options

### Option 1 - Keep generated files committed, classify and enforce freshness

Keep `src/proto.gen.{js,d.ts}` in git for each protobuf contract package.
Standardize generated classification and add a repo/package freshness gate that
regenerates output, compares it to committed files, restores snapshots, and
fails with an actionable message when stale.

Pros:

- minimal disruption to existing imports, tests, and package build scripts;
- future npm packages remain ready to consume without consumer codegen;
- contract changes produce reviewable generated API diffs;
- CI can prove `.proto` source and generated output agree;
- fixes the immediate LOC-metrics problem by marking every generated file,
  including storage, as generated.

Cons:

- generated LOC remains in the repository, even if tools classify it correctly;
- contract PRs keep large generated diffs when schemas change;
- every protobuf package must maintain or share the freshness-check convention.

### Option 2 - Generate during build/prepublish/CI and remove generated files from git

Remove `src/proto.gen.*` from git and make package `build` run codegen before
`tsc`, then publish generated files only in `dist`.

Pros:

- removes about 120k generated LOC from tracked source;
- generated code no longer appears in review diffs;
- `.proto` files become the only contract source checked into git.

Cons:

- local typecheck/test/build depend on build-time side effects and generator
  availability;
- TypeScript imports from `src/index.ts` fail until generation has run;
- generated output is not reviewable before publish;
- package publish determinism moves from "checked generated artifact" to "trust
  this build environment";
- current CI ordering must change so codegen always precedes build/typecheck;
- stale-generation bugs become harder to detect because no committed output can
  be compared.

### Option 3 - Split generated artifacts or publish a generated subpackage

Keep hand-authored `.proto` packages small and move generated JS/DTS to a
separate package, subpath, or artifact folder published only from CI.

Pros:

- can isolate generated LOC from source package metrics;
- could make a future contract registry/artifact boundary more explicit.

Cons:

- adds package and dependency complexity for five current contract packages;
- creates a second way to consume a contract surface;
- requires migration of internal imports and future package publishing before
  the current problem warrants it;
- risks contradicting the repo's lean, one-canonical-way bias.

## Recommendation

Use **Option 1** now.

The generated files are not merely build cache; they are part of each contract
package's current source and future publish surface. Removing them from git
would reduce LOC, but it would make every local build/typecheck/test depend on
implicit generation and would hide the generated API delta from review. That is
a worse fit for G1/F6 and G2/F5 than keeping generated files committed with
strict classification and drift checks.

This is not a product decision or locked-bet conflict. It is a repo convention
that derives from existing Goals/Filters and current package shape.

## Proposed Design

### 1. Standardize generated-file classification

Add a root `.gitattributes` entry or per-package entries that cover every
protobuf generated output:

```gitattributes
packages/contracts/*/v1/src/proto.gen.js linguist-generated=true
packages/contracts/*/v1/src/proto.gen.d.ts linguist-generated=true
```

If root `.gitattributes` is used, keep or remove package-local duplicates in a
single cleanup step. The important behavior is that storage gets covered too.

### 2. Add one freshness gate for all protobuf contract packages

Add a shared checker, for example `scripts/check-proto-generated.mjs`, that:

1. enumerates packages containing both `proto/` and `scripts/gen.mjs`;
2. snapshots `src/proto.gen.js` and `src/proto.gen.d.ts`;
3. runs the package's existing `scripts/gen.mjs`;
4. compares regenerated output with the snapshot;
5. restores original files before exit so the check is read-only;
6. removes package-local `proto-deps/`;
7. fails with package/file names and "run `bun run --filter <pkg> proto:gen`
   and commit output" guidance when drift is found.

Expose it through root `package.json` as:

```json
{
  "scripts": {
    "proto:check": "bun scripts/check-proto-generated.mjs"
  }
}
```

Then run `bun run proto:check` in CI after install and before `bun run build`.
Identity can either keep its package-local `proto:check` for focused package
testing or delegate to the shared checker with a package filter if the checker
supports one.

### 3. Keep package build/publish semantics stable

Do not make `build` run `proto:gen` implicitly in this issue. Package builds
should continue to copy committed `src/proto.gen.*` into `dist/` after `tsc`.
The new CI freshness gate is the deterministic guard.

Future package publishing should require:

```text
bun run proto:check
bun run --filter @rntme/contracts-<category>-v1 build
bun publish from package root
```

Consumers of published packages should receive `dist/index.js`,
`dist/index.d.ts`, `dist/proto.gen.js`, `dist/proto.gen.d.ts`, `proto/`,
`error-codes.json`, and `README.md`. They should never run `pbjs` or `pbts`.

### 4. Update current docs where the convention is missing

Update current owner docs for the affected contract packages to state:

- `.proto` files are hand-edited source;
- `src/proto.gen.{js,d.ts}` are committed generated contract bindings;
- generated files are regenerated with `bun run --filter <pkg> proto:gen`;
- CI/root freshness is enforced with `bun run proto:check`;
- generated files are never edited by hand.

Storage needs a current owner doc or a corrected owner-doc link because its
README currently contains full current-package documentation while the repo
navigation expects `docs/current/owners/packages/contracts/storage/v1.md`.

## Alternatives Rejected

- **Generate only during package build.** Rejected for this stage because it
  turns source imports into generated side effects and moves repeatability risk
  into every build/publish environment.
- **Generate only during npm prepublish.** Rejected because local CI/typecheck
  would not prove the publish artifact before release, and consumers should not
  be the first place generated output is exercised.
- **Split generated contracts into separate packages now.** Rejected as extra
  package-surface entropy. It may become attractive if contracts are later
  published as registry artifacts, but the current issue is metrics and
  repeatability, not package topology.
- **Use `.gitignore`/Linguist only.** Rejected because classification solves
  metrics but not stale generated output.

## Exact Affected Surfaces

Packages:

- `packages/contracts/_common/v1`
- `packages/contracts/identity/v1`
- `packages/contracts/ai-llm/v1`
- `packages/contracts/crm/v1`
- `packages/contracts/storage/v1`

Generated files:

- `packages/contracts/*/v1/src/proto.gen.js`
- `packages/contracts/*/v1/src/proto.gen.d.ts`

Package scripts:

- `packages/contracts/*/v1/scripts/gen.mjs`
- `packages/contracts/identity/v1/scripts/check-proto-gen.mjs`
- root `package.json` scripts
- optional new root `scripts/check-proto-generated.mjs`

Workflow:

- `.github/workflows/ci.yml` should run `bun run proto:check` after install and
  before build.

Docs:

- `docs/current/owners/packages/contracts/_common/v1.md`
- `docs/current/owners/packages/contracts/identity/v1.md`
- `docs/current/owners/packages/contracts/ai-llm/v1.md`
- `docs/current/owners/packages/contracts/crm/v1.md`
- new or corrected `docs/current/owners/packages/contracts/storage/v1.md`
- `packages/contracts/storage/v1/README.md` if its owner-doc pointer changes

## Validation and Evidence

Evidence inspected:

- RNT-525 audit: 120,199 generated LOC across ten `proto.gen` files.
- Current package scripts and `tsconfig` files: builds import generated files
  from `src/` and copy them into `dist/`.
- Current tests: only identity runs `proto:check`.
- Current `.gitattributes`: `_common`, identity, ai-llm, and CRM are marked;
  storage is not.
- Current CI and release workflows: CI has no root generated-proto freshness
  gate; release publishes runtime only today.
- `protobufjs-cli` upstream README: `pbjs` generates JS static modules and
  `pbts` generates TypeScript declarations as an explicit compile step.

Implementation validation should include:

- `bun install --frozen-lockfile`
- `bun run proto:check`
- `bun run --filter @rntme/contracts-common-v1 test`
- `bun run --filter @rntme/contracts-identity-v1 test`
- `bun run --filter @rntme/contracts-ai-llm-v1 test`
- `bun run --filter @rntme/contracts-crm-v1 test`
- `bun run --filter @rntme/contracts-storage-v1 test`
- `bun run depcruise` if root scripts/workflow/docs imports change package
  boundaries

## Risks

- A shared checker must restore files on failure; otherwise CI/local checks can
  leave dirty generated output and `proto-deps/` behind.
- Running codegen across all packages adds CI time. Keep the check focused on
  packages with `proto/` and generated files.
- `protobufjs-cli` output may change after dependency upgrades. That is a
  feature of the check: generator upgrades should update generated output in
  the same PR.
- Root `.gitattributes` globs should be verified against GitHub Linguist
  behavior. If uncertain, keep package-local entries and add the missing storage
  entry instead of relying only on a new glob.
