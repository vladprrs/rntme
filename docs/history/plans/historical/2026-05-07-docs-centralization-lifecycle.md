> Status: historical.
> Date: 2026-05-07.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# Docs Centralization Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Wave 1 of the docs centralization design by moving detailed current docs into `docs/current`, replacing local README files with short stubs, and updating agent navigation.

**Architecture:** This is a docs-only migration. Local README files become stable entry stubs, detailed current docs move to `docs/current/owners`, cross-cutting authoring references move to `docs/current/guides`, and `docs/README.md` becomes the docs entry point. Wave 2 and Wave 3 are described as principles and review gates only; they need separate follow-up implementation plans before moving historical specs/plans or deleting retired material.

**Tech Stack:** Markdown, `git mv`, small Node.js one-off scripts for mechanical file moves and link/stub generation, `rg`/`find`/`wc` verification. No runtime code changes and no CI documentation guard.

---

## Scope Boundary

This plan executes **Wave 1 - Current Docs** from
`docs/history/specs/active-rationale/2026-05-07-docs-centralization-lifecycle-design.md`.

Wave 2 and Wave 3 are intentionally not decomposed into file-by-file tasks here.
They are documented below as principles and gates for follow-up plans because
moving `docs/superpowers/{specs,plans}` and retiring historical documents needs
separate review after current docs exist.

The active implementation plan stays at
`docs/history/plans/historical/2026-05-07-docs-centralization-lifecycle.md` until this
work completes. It is not historical while it is being executed.

## File Structure

### Create

- `docs/README.md` - documentation entry point and authority map.
- `docs/current/guides/bindings-authoring.md` - moved bindings LLM authoring guide.
- `docs/current/guides/bindings-examples.md` - moved bindings examples.
- `docs/current/guides/graph-ir-authoring.md` - moved Graph IR LLM authoring guide.
- `docs/current/guides/graph-ir-examples.md` - moved Graph IR examples.
- `docs/current/owners/**` - current owner docs moved from local README files.

### Move Then Replace With Stubs

- `apps/cli/README.md`
- `apps/landing/README.md`
- `apps/platform-http/README.md`
- `demo/cv-extract-blueprint/README.md`
- `demo/cv-extract-blueprint/test/fixtures/README.md`
- `demo/notes-blueprint/README.md`
- `demo/order-fulfillment-blueprint/README.md`
- `modules/ai-llm/README.md`
- `modules/ai-llm/conformance/README.md`
- `modules/ai-llm/openrouter/README.md`
- `modules/analytics/google-analytics/README.md`
- `modules/crm/README.md`
- `modules/crm/amocrm/README.md`
- `modules/crm/bitrix24/README.md`
- `modules/crm/conformance/README.md`
- `modules/identity/README.md`
- `modules/identity/auth0/README.md`
- `modules/identity/clerk/README.md`
- `modules/identity/conformance/README.md`
- `modules/identity/workos/README.md`
- `modules/presentation/md-mermaid/README.md`
- `modules/presentation/tiptap/README.md`
- `packages/artifacts/bindings/README.md`
- `packages/artifacts/blueprint/README.md`
- `packages/artifacts/graph-ir-compiler/README.md`
- `packages/artifacts/pdm/README.md`
- `packages/artifacts/qsm/README.md`
- `packages/artifacts/seed/README.md`
- `packages/artifacts/ui/README.md`
- `packages/artifacts/workflows/README.md`
- `packages/contracts/_common/v1/README.md`
- `packages/contracts/ai-llm/v1/README.md`
- `packages/contracts/analytics/v1/README.md`
- `packages/contracts/client-runtime/v1/README.md`
- `packages/contracts/crm/v1/README.md`
- `packages/contracts/handlers/v1/README.md`
- `packages/contracts/identity/v1/README.md`
- `packages/contracts/module/v1/README.md`
- `packages/contracts/provisioner/v1/README.md`
- `packages/deploy/deploy-core/README.md`
- `packages/deploy/deploy-dokploy/README.md`
- `packages/platform/platform-core/README.md`
- `packages/platform/platform-storage/README.md`
- `packages/runtime/bindings-grpc/README.md`
- `packages/runtime/bindings-http/README.md`
- `packages/runtime/bpmn-worker/README.md`
- `packages/runtime/event-store/README.md`
- `packages/runtime/projection-consumer/README.md`
- `packages/runtime/runtime/README.md`
- `packages/runtime/ui-runtime/README.md`
- `packages/tooling/module-scaffold/README.md`

### Modify

- `AGENTS.md` - read order, package lookup, navigation recipes, historical lookup, docs-touch policy.
- `CLAUDE.md` - bootstrap wording that package README files are stubs pointing to current owner docs.
- Current docs under `docs/current/owners/**` after moving, to replace stale authority wording.

### Delete By Move Only

- `packages/artifacts/bindings/docs/examples.md`
- `packages/artifacts/bindings/docs/llm-authoring-guide.md`
- `packages/artifacts/graph-ir-compiler/docs/examples.md`
- `packages/artifacts/graph-ir-compiler/docs/llm-authoring-guide.md`

The source files above are removed from their package-local locations only
because they are moved into `docs/current/guides`. Do not delete their content.

## Task 1: Create Docs Entrypoint

**Files:**
- Create: `docs/README.md`

- [ ] **Step 1: Add the docs entrypoint**

Use `apply_patch` to create `docs/README.md` with this content:

```md
# rntme docs

This directory is split by authority and lifecycle.

## Current Docs

Use `docs/current/**` for current package, app, module, demo, and authoring
documentation.

- `docs/current/owners/**` mirrors workspace ownership paths. These files own
  current public surfaces, invariants, gotchas, local commands, and "where to
  look first" pointers.
- `docs/current/guides/**` contains cross-cutting current guides such as
  artifact authoring guides and examples.

Local README files beside packages/apps/modules/demos are intentionally short
stubs. They point here instead of duplicating detailed current documentation.

## Decisions

Use `docs/decision-system.md` for strategic, architectural, and convention
decisions. It owns goals, decision filters, locked-in bets, and the update
protocol.

## History

Specs, plans, ADRs, audits, research notes, reports, and gap analyses are
history/rationale unless a current owner doc or `docs/decision-system.md`
promotes the decision.

Historical documents answer "why did we decide this at the time?" They are not
current-state truth by themselves. Verify current behavior against code/tests,
`docs/current/**`, `docs/decision-system.md`, and `.dependency-cruiser.cjs`.

## Docs Touch

Every implementation plan must evaluate whether it changes:

- `docs/current/owners/**` for public APIs, errors, invariants, gotchas, local
  commands, package boundaries, or navigation pointers;
- local README stubs when the current-doc target or local command hint changes;
- `docs/current/guides/**` when authoring rules or examples change;
- `docs/decision-system.md` when strategic, architectural, or convention
  decisions change;
- `AGENTS.md` or `CLAUDE.md` when bootstrap navigation changes.
```

- [ ] **Step 2: Verify the entrypoint was created**

Run:

```bash
test -f docs/README.md && sed -n '1,120p' docs/README.md
```

Expected: output starts with `# rntme docs` and includes `Current Docs`,
`Decisions`, `History`, and `Docs Touch`.

- [ ] **Step 3: Commit the entrypoint**

Run:

```bash
git add docs/README.md
git commit -m "docs: add docs entrypoint"
```

Expected: commit succeeds with one new Markdown file.

## Task 2: Move Cross-Cutting Authoring Guides

**Files:**
- Move: `packages/artifacts/bindings/docs/llm-authoring-guide.md` -> `docs/current/guides/bindings-authoring.md`
- Move: `packages/artifacts/bindings/docs/examples.md` -> `docs/current/guides/bindings-examples.md`
- Move: `packages/artifacts/graph-ir-compiler/docs/llm-authoring-guide.md` -> `docs/current/guides/graph-ir-authoring.md`
- Move: `packages/artifacts/graph-ir-compiler/docs/examples.md` -> `docs/current/guides/graph-ir-examples.md`
- Modify: `packages/artifacts/bindings/README.md`
- Modify: `packages/artifacts/graph-ir-compiler/README.md`

- [ ] **Step 1: Move the guide files with history**

Run:

```bash
mkdir -p docs/current/guides
git mv packages/artifacts/bindings/docs/llm-authoring-guide.md docs/current/guides/bindings-authoring.md
git mv packages/artifacts/bindings/docs/examples.md docs/current/guides/bindings-examples.md
git mv packages/artifacts/graph-ir-compiler/docs/llm-authoring-guide.md docs/current/guides/graph-ir-authoring.md
git mv packages/artifacts/graph-ir-compiler/docs/examples.md docs/current/guides/graph-ir-examples.md
```

Expected: `git status --short` shows four renames.

- [ ] **Step 2: Update local references to moved guides**

Run:

```bash
rg -n "docs/(examples|llm-authoring-guide)\\.md|packages/artifacts/(bindings|graph-ir-compiler)/docs" packages/artifacts docs/current AGENTS.md CLAUDE.md
```

Expected before edits: references may appear in package README files or moved
guide files.

Use `apply_patch` to replace package-local guide references with:

```md
docs/current/guides/bindings-authoring.md
docs/current/guides/bindings-examples.md
docs/current/guides/graph-ir-authoring.md
docs/current/guides/graph-ir-examples.md
```

- [ ] **Step 3: Verify no package-local guide paths remain**

Run:

```bash
rg -n "packages/artifacts/(bindings|graph-ir-compiler)/docs|docs/(examples|llm-authoring-guide)\\.md" packages/artifacts docs/current AGENTS.md CLAUDE.md
```

Expected: no output.

- [ ] **Step 4: Commit guide moves**

Run:

```bash
git add docs/current/guides packages/artifacts/bindings packages/artifacts/graph-ir-compiler AGENTS.md CLAUDE.md
git commit -m "docs: move artifact authoring guides to current docs"
```

Expected: commit succeeds with four renames and any reference fixes.

## Task 3: Move Owner Docs And Generate Local Stubs

**Files:**
- Move and recreate every README listed in "Move Then Replace With Stubs".
- Create matching files under `docs/current/owners/**`.

- [ ] **Step 1: Move README content to owner docs and generate stubs**

Run this one-off Node.js script from the repository root:

```bash
node <<'NODE'
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const entries = [
  ['apps/cli/README.md', 'docs/current/owners/apps/cli.md', 'Command-line workspace for rntme project publishing, deploy, and skill commands.'],
  ['apps/landing/README.md', 'docs/current/owners/apps/landing.md', 'Astro landing site workspace for rntme.com.'],
  ['apps/platform-http/README.md', 'docs/current/owners/apps/platform-http.md', 'HTTP platform app for organizations, projects, deploy targets, and registry flows.'],
  ['demo/cv-extract-blueprint/README.md', 'docs/current/owners/demo/cv-extract-blueprint.md', 'Demo project blueprint for CV extraction workflows.'],
  ['demo/cv-extract-blueprint/test/fixtures/README.md', 'docs/current/owners/demo/cv-extract-blueprint/test-fixtures.md', 'Fixture documentation for the CV extraction demo tests.'],
  ['demo/notes-blueprint/README.md', 'docs/current/owners/demo/notes-blueprint.md', 'Demo project blueprint for the notes application.'],
  ['demo/order-fulfillment-blueprint/README.md', 'docs/current/owners/demo/order-fulfillment-blueprint.md', 'Demo project blueprint for order fulfillment workflows.'],
  ['modules/ai-llm/README.md', 'docs/current/owners/modules/ai-llm.md', 'AI/LLM module category documentation.'],
  ['modules/ai-llm/conformance/README.md', 'docs/current/owners/modules/ai-llm/conformance.md', 'Conformance suite documentation for AI/LLM modules.'],
  ['modules/ai-llm/openrouter/README.md', 'docs/current/owners/modules/ai-llm/openrouter.md', 'OpenRouter vendor module documentation for the AI/LLM contract.'],
  ['modules/analytics/google-analytics/README.md', 'docs/current/owners/modules/analytics/google-analytics.md', 'Google Analytics vendor module documentation.'],
  ['modules/crm/README.md', 'docs/current/owners/modules/crm.md', 'CRM module category documentation.'],
  ['modules/crm/amocrm/README.md', 'docs/current/owners/modules/crm/amocrm.md', 'amoCRM vendor module documentation for the CRM contract.'],
  ['modules/crm/bitrix24/README.md', 'docs/current/owners/modules/crm/bitrix24.md', 'Bitrix24 vendor module documentation for the CRM contract.'],
  ['modules/crm/conformance/README.md', 'docs/current/owners/modules/crm/conformance.md', 'Conformance suite documentation for CRM modules.'],
  ['modules/identity/README.md', 'docs/current/owners/modules/identity.md', 'Identity module category documentation.'],
  ['modules/identity/auth0/README.md', 'docs/current/owners/modules/identity/auth0.md', 'Auth0 vendor module documentation for the identity contract.'],
  ['modules/identity/clerk/README.md', 'docs/current/owners/modules/identity/clerk.md', 'Clerk vendor module documentation for the identity contract.'],
  ['modules/identity/conformance/README.md', 'docs/current/owners/modules/identity/conformance.md', 'Conformance suite documentation for identity modules.'],
  ['modules/identity/workos/README.md', 'docs/current/owners/modules/identity/workos.md', 'WorkOS vendor module documentation for the identity contract.'],
  ['modules/presentation/md-mermaid/README.md', 'docs/current/owners/modules/presentation/md-mermaid.md', 'Markdown and Mermaid presentation module documentation.'],
  ['modules/presentation/tiptap/README.md', 'docs/current/owners/modules/presentation/tiptap.md', 'Tiptap presentation module documentation.'],
  ['packages/artifacts/bindings/README.md', 'docs/current/owners/packages/artifacts/bindings.md', 'HTTP binding artifact compiler documentation.'],
  ['packages/artifacts/blueprint/README.md', 'docs/current/owners/packages/artifacts/blueprint.md', 'Project blueprint artifact compiler documentation.'],
  ['packages/artifacts/graph-ir-compiler/README.md', 'docs/current/owners/packages/artifacts/graph-ir-compiler.md', 'Graph IR compiler package documentation.'],
  ['packages/artifacts/pdm/README.md', 'docs/current/owners/packages/artifacts/pdm.md', 'Physical data model artifact package documentation.'],
  ['packages/artifacts/qsm/README.md', 'docs/current/owners/packages/artifacts/qsm.md', 'Query semantic model artifact package documentation.'],
  ['packages/artifacts/seed/README.md', 'docs/current/owners/packages/artifacts/seed.md', 'Seed artifact package documentation.'],
  ['packages/artifacts/ui/README.md', 'docs/current/owners/packages/artifacts/ui.md', 'UI artifact compiler documentation.'],
  ['packages/artifacts/workflows/README.md', 'docs/current/owners/packages/artifacts/workflows.md', 'Workflow artifact package documentation.'],
  ['packages/contracts/_common/v1/README.md', 'docs/current/owners/packages/contracts/_common/v1.md', 'Shared contract primitives package documentation.'],
  ['packages/contracts/ai-llm/v1/README.md', 'docs/current/owners/packages/contracts/ai-llm/v1.md', 'AI/LLM canonical contract package documentation.'],
  ['packages/contracts/analytics/v1/README.md', 'docs/current/owners/packages/contracts/analytics/v1.md', 'Analytics canonical contract package documentation.'],
  ['packages/contracts/client-runtime/v1/README.md', 'docs/current/owners/packages/contracts/client-runtime/v1.md', 'Client runtime canonical contract package documentation.'],
  ['packages/contracts/crm/v1/README.md', 'docs/current/owners/packages/contracts/crm/v1.md', 'CRM canonical contract package documentation.'],
  ['packages/contracts/handlers/v1/README.md', 'docs/current/owners/packages/contracts/handlers/v1.md', 'Handler contract package documentation.'],
  ['packages/contracts/identity/v1/README.md', 'docs/current/owners/packages/contracts/identity/v1.md', 'Identity canonical contract package documentation.'],
  ['packages/contracts/module/v1/README.md', 'docs/current/owners/packages/contracts/module/v1.md', 'Module manifest contract package documentation.'],
  ['packages/contracts/provisioner/v1/README.md', 'docs/current/owners/packages/contracts/provisioner/v1.md', 'Provisioner contract package documentation.'],
  ['packages/deploy/deploy-core/README.md', 'docs/current/owners/packages/deploy/deploy-core.md', 'Deploy planning core package documentation.'],
  ['packages/deploy/deploy-dokploy/README.md', 'docs/current/owners/packages/deploy/deploy-dokploy.md', 'Dokploy deploy adapter package documentation.'],
  ['packages/platform/platform-core/README.md', 'docs/current/owners/packages/platform/platform-core.md', 'Platform core package documentation.'],
  ['packages/platform/platform-storage/README.md', 'docs/current/owners/packages/platform/platform-storage.md', 'Platform storage package documentation.'],
  ['packages/runtime/bindings-grpc/README.md', 'docs/current/owners/packages/runtime/bindings-grpc.md', 'gRPC bindings runtime package documentation.'],
  ['packages/runtime/bindings-http/README.md', 'docs/current/owners/packages/runtime/bindings-http.md', 'HTTP bindings runtime package documentation.'],
  ['packages/runtime/bpmn-worker/README.md', 'docs/current/owners/packages/runtime/bpmn-worker.md', 'BPMN worker runtime package documentation.'],
  ['packages/runtime/event-store/README.md', 'docs/current/owners/packages/runtime/event-store.md', 'Event store runtime package documentation.'],
  ['packages/runtime/projection-consumer/README.md', 'docs/current/owners/packages/runtime/projection-consumer.md', 'Projection consumer runtime package documentation.'],
  ['packages/runtime/runtime/README.md', 'docs/current/owners/packages/runtime/runtime.md', 'Core service runtime package documentation.'],
  ['packages/runtime/ui-runtime/README.md', 'docs/current/owners/packages/runtime/ui-runtime.md', 'UI runtime package documentation.'],
  ['packages/tooling/module-scaffold/README.md', 'docs/current/owners/packages/tooling/module-scaffold.md', 'Module scaffold tooling package documentation.']
];

function repoPath(p) {
  return p.split(path.sep).join('/');
}

for (const [readme, owner, purpose] of entries) {
  fs.mkdirSync(path.dirname(owner), { recursive: true });
  cp.execFileSync('git', ['mv', readme, owner], { stdio: 'inherit' });

  const packageJson = path.join(path.dirname(readme), 'package.json');
  let title = readme.replace(/\/README\.md$/, '');
  let command = '- Use root commands from `AGENTS.md`.';
  if (fs.existsSync(packageJson)) {
    const parsed = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
    if (parsed.name) {
      title = parsed.name;
      command = `- \`pnpm -F ${parsed.name} test\` when the package defines a test script.`;
    }
  }

  const relOwner = repoPath(path.relative(path.dirname(readme), owner));
  const stub = `# ${title}

${purpose}

Current documentation: [${owner}](${relOwner})

Local commands:
${command}

Notes:
- Keep this file short. Update the current doc when public API, invariants, gotchas, local commands, or package navigation changes.
`;
  fs.writeFileSync(readme, stub);
}
NODE
```

Expected: script exits successfully. `git status --short` shows renamed README
files under `docs/current/owners/**` and modified local README files at their
original paths.

- [ ] **Step 2: Verify every local README is a short stub**

Run:

```bash
find apps packages modules demo -name README.md -print0 | xargs -0 wc -l | sort -nr | head -20
```

Expected: every local README listed in the output is short. A typical stub is
9-11 lines. `demo/cv-extract-blueprint/test/fixtures/README.md` is also a stub.

- [ ] **Step 3: Verify owner docs exist**

Run:

```bash
find docs/current/owners -name '*.md' | sort | wc -l
```

Expected: `51`.

- [ ] **Step 4: Commit owner doc moves and stubs**

Run:

```bash
git add apps packages modules demo docs/current/owners
git commit -m "docs: centralize current owner docs"
```

Expected: commit succeeds with README renames plus new local stubs.

## Task 4: Update Agent Bootstrap Navigation

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update read-order wording**

Use `apply_patch` to make these semantic changes:

- In `AGENTS.md`, change "Before opening source in a package, read that
  package's README" to "read the local README stub, then the linked
  `docs/current/owners/**` owner doc".
- In `CLAUDE.md`, change "Package internals live in each package's README" to
  "local package README files are stubs; current internals live in linked
  `docs/current/owners/**` docs".

- [ ] **Step 2: Update repo map**

Use `apply_patch` to make `AGENTS.md` describe:

```md
- `docs/current/` — current owner docs and authoring guides.
- `docs/history/` — future home for archived specs/plans/ADRs/audits/research/gaps.
- `docs/history/specs/active-rationale/`, `docs/history/plans/historical/` — active design/plan files until Wave 2 moves historical material.
```

- [ ] **Step 3: Update package lookup table**

Use `apply_patch` to keep local README paths in the lookup table, but change the
lead-in sentence to:

```md
Open the local README stub first, then follow its `Current documentation` link.
The owner doc under `docs/current/owners/**` owns APIs, invariants, gotchas, and
where-to-look-first pointers.
```

- [ ] **Step 4: Update navigation recipes**

Use `apply_patch` to keep recipe targets as local README stubs. Add one sentence
before the recipe list:

```md
Recipe paths point to local README stubs; follow each stub's current-doc link
for detailed package documentation.
```

- [ ] **Step 5: Update historical lookup command**

Use `apply_patch` to replace:

```bash
rg -n "topic words" docs/superpowers docs/adr
```

with:

```bash
rg -n "topic words" docs/current docs/superpowers docs/adr docs/audit docs/gaps docs/research
```

Wave 2 will replace this command with `docs/history`.

- [ ] **Step 6: Update docs-touch checklist**

Use `apply_patch` to include these surfaces in `AGENTS.md`:

- local README stub when the current-doc link or local command hint changes;
- `docs/current/owners/**` when public API, errors, invariants, gotchas, or
  local navigation changes;
- `docs/current/guides/**` when authoring rules or examples change;
- `docs/README.md` when documentation navigation changes.

- [ ] **Step 7: Verify bootstrap wording**

Run:

```bash
rg -n "Package internals live in each package's README|Package READMEs own current internals|source of truth" AGENTS.md CLAUDE.md
```

Expected: no stale claim that package README files own detailed current docs.
Occurrences of "source of truth" are acceptable only when they refer to code,
`docs/decision-system.md`, `.dependency-cruiser.cjs`, or explicitly scoped
domain concepts.

- [ ] **Step 8: Commit bootstrap updates**

Run:

```bash
git add AGENTS.md CLAUDE.md
git commit -m "docs: point agents at current owner docs"
```

Expected: commit succeeds with only `AGENTS.md` and `CLAUDE.md` changes.

## Task 5: Normalize Current-Doc Authority Wording

**Files:**
- Modify: `docs/current/owners/**/*.md`
- Modify: `docs/current/guides/**/*.md`

- [ ] **Step 1: Find dangerous wording**

Run:

```bash
rg -n "authoritative design|active umbrella spec|specs are source of truth|code that disagrees with a spec is a bug|source of truth" docs/current
```

Expected before edits: matches may appear because package README content was
moved verbatim.

- [ ] **Step 2: Replace unsafe claims with current/history language**

Use `apply_patch` to apply these wording rules in `docs/current/**`:

- Replace "authoritative design" with "historical design rationale" unless the
  sentence refers to code/tests or a current owner doc.
- Replace "active umbrella spec" with "historical umbrella design".
- Replace "spec is source of truth" or "specs are source of truth" with
  "spec is rationale/history; verify current behavior in code/tests and this
  owner doc".
- Keep scoped domain wording such as "PDM is the source of truth for domain
  entities" only when it describes an artifact relationship that is still true.

- [ ] **Step 3: Verify only safe authority wording remains**

Run:

```bash
rg -n "authoritative design|active umbrella spec|specs are source of truth|code that disagrees with a spec is a bug" docs/current
```

Expected: no output.

Run:

```bash
rg -n "source of truth" docs/current
```

Expected: any remaining output is scoped to current artifacts, code, tests,
`docs/current/**`, `docs/decision-system.md`, or `.dependency-cruiser.cjs`.

- [ ] **Step 4: Commit wording normalization**

Run:

```bash
git add docs/current
git commit -m "docs: clarify current docs authority"
```

Expected: commit succeeds with only `docs/current/**` wording edits.

## Task 6: Repair Links After Current-Doc Moves

**Files:**
- Modify: `docs/current/owners/**/*.md`
- Modify: `docs/current/guides/**/*.md`
- Modify: local README stubs if any generated current-doc link is wrong.

- [ ] **Step 1: Check local stub current-doc links**

Run:

```bash
node <<'NODE'
const fs = require('fs');
const path = require('path');
const readmes = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) walk(p);
    if (stat.isFile() && name === 'README.md') readmes.push(p);
  }
}
for (const root of ['apps', 'packages', 'modules', 'demo']) walk(root);
let failed = false;
for (const readme of readmes) {
  const text = fs.readFileSync(readme, 'utf8');
  const match = text.match(/Current documentation: \[[^\]]+\]\(([^)]+)\)/);
  if (!match) {
    console.error(`missing current-doc link: ${readme}`);
    failed = true;
    continue;
  }
  const target = path.normalize(path.join(path.dirname(readme), match[1]));
  if (!fs.existsSync(target)) {
    console.error(`broken current-doc link: ${readme} -> ${match[1]}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log(`checked ${readmes.length} README stubs`);
NODE
```

Expected: `checked 51 README stubs`.

- [ ] **Step 2: Find moved-doc links that still point through old relative paths**

Run:

```bash
rg -n "\\]\\(\\.\\./|\\]\\(\\.\\./\\.\\./|\\]\\(\\.\\./\\.\\./\\.\\./|\\]\\(\\.\\./\\.\\./\\.\\./\\.\\./" docs/current
```

Expected before edits: output may exist because content moved from workspace
directories into `docs/current/owners`.

- [ ] **Step 3: Repair old relative links**

Use `apply_patch` to repair each match from Step 2. Apply these rules:

- Links to moved local README files should point to the matching
  `docs/current/owners/**` document.
- Links to guide files should point to `docs/current/guides/**`.
- Links to historical specs/plans/ADRs may keep their current `docs/superpowers`
  or `docs/adr` target until Wave 2.
- Links to source files should be recalculated relative to the new
  `docs/current/owners/**` file location.

- [ ] **Step 4: Verify no obvious old relative links remain**

Run:

```bash
rg -n "\\]\\(\\.\\./|\\]\\(\\.\\./\\.\\./|\\]\\(\\.\\./\\.\\./\\.\\./|\\]\\(\\.\\./\\.\\./\\.\\./\\.\\./" docs/current
```

Expected: no output unless the link intentionally points from one
`docs/current/**` file to another sibling using `../`.

- [ ] **Step 5: Commit link repairs**

Run:

```bash
git add docs/current apps packages modules demo
git commit -m "docs: repair current doc links"
```

Expected: commit succeeds with link-only changes.

## Task 7: Wave 2 Principles For Historical Lifecycle

**Files:**
- No file moves in this task.
- Reference: `docs/history/specs/active-rationale/2026-05-07-docs-centralization-lifecycle-design.md`
- Reference: `docs/README.md`
- Reference: `AGENTS.md`

Wave 2 moves historical material into `docs/history`, but this plan does not
execute those moves. Use these principles when writing the follow-up plan:

- **Current docs first.** Do not move specs/plans until `docs/current/owners/**`
  exists and current docs no longer depend on old specs as current truth.
- **Classification before movement.** Each historical document needs a lifecycle
  status before or during movement: `active-rationale`, `historical`, or
  `retired`.
- **Banners are mandatory.** Every document moved under `docs/history/**` gets a
  short banner with `Status`, `Date`, `Current source`, and `Why retained` or
  `Why retired`.
- **Retirement is not deletion.** `retired/` means "known stale or harmful enough
  to be a deletion candidate." The file remains in git and is link-reviewable.
- **No body rewrites.** Historical document bodies should not be rewritten in
  bulk. Add banners and fix links only when needed for navigation.
- **Preserve rationale paths where useful.** If a package owner doc references a
  spec for why a choice was made, keep one related-history link after the move.
  The link text must say "historical rationale", not "authoritative design".
- **Current source must be concrete.** A retired document's `Current source`
  should name a replacement such as `docs/current/owners/packages/runtime/event-store.md`,
  `docs/current/guides/graph-ir-authoring.md`, or `docs/decision-system.md`.
- **Active plans are separate.** A currently executing implementation plan may
  remain under `docs/superpowers/plans` while active. After completion, a later
  cleanup can move it into `docs/history/plans/historical`.

- [ ] **Step 1: Record that Wave 2 is deferred**

Run:

```bash
rg -n "Wave 2|docs/history|retired" docs/README.md AGENTS.md docs/history/specs/active-rationale/2026-05-07-docs-centralization-lifecycle-design.md
```

Expected: output shows `docs/README.md` and `AGENTS.md` describe historical
material as rationale and do not claim Wave 2 is already complete.

## Task 8: Wave 3 Principles For Link Review And Retirement Review

**Files:**
- No file moves in this task.
- Reference: `docs/history/specs/active-rationale/2026-05-07-docs-centralization-lifecycle-design.md`

Wave 3 is a review and cleanup gate after Wave 2. Use these principles when
writing the follow-up plan:

- **Deletion requires replacement.** A retired document can be deleted only if
  its banner names a current replacement and that replacement exists.
- **Deletion requires link review.** Run `rg` for the retired file path,
  basename, title, and major old concept names before deleting.
- **Deletion is a separate commit.** Do not combine retirement movement and
  physical deletion in one commit.
- **Prefer fewer links.** Current docs should link to history only when the
  rationale materially helps future decisions.
- **Keep decision history in decision-system.** If a retired spec explains a
  locked or superseded architectural bet, promote the concise decision into
  `docs/decision-system.md` before deleting the long historical artifact.
- **Do not chase every old link in historical bodies.** Fix historical links when
  they block navigation from current docs or from banners. Old links inside
  historical bodies may remain if the document is clearly bannered and retained
  only as context.
- **A future guard is optional.** CI checks for README stubs or owner-doc
  existence can be proposed later, but this migration remains review-policy
  only.

- [ ] **Step 1: Record that Wave 3 is deferred**

Run:

```bash
rg -n "No CI/API-surface guard|No retired document is physically deleted|deletion review" docs/history/specs/active-rationale/2026-05-07-docs-centralization-lifecycle-design.md docs/README.md AGENTS.md
```

Expected: output confirms deletion and automation remain future follow-ups.

## Task 9: Final Verification

**Files:**
- Verify: `README.md`
- Verify: `AGENTS.md`
- Verify: `CLAUDE.md`
- Verify: `docs/README.md`
- Verify: `docs/current/**`
- Verify: local README stubs under `apps`, `packages`, `modules`, and `demo`

- [ ] **Step 1: Verify docs-only diff**

Run:

```bash
git diff --stat HEAD~5..HEAD
```

Expected: only Markdown files changed or moved. No `.ts`, `.js`, `.json`,
lockfile, or package manifest changes.

- [ ] **Step 2: Verify local README stubs are short**

Run:

```bash
find apps packages modules demo -name README.md -print0 | xargs -0 wc -l | sort -nr | head -20
```

Expected: all local README files are short stubs. Any file above 20 lines must
be reviewed; it should either be shortened or explicitly justified in the commit
message.

- [ ] **Step 3: Verify owner docs count**

Run:

```bash
find docs/current/owners -name '*.md' | wc -l
```

Expected: `51`.

- [ ] **Step 4: Verify guide docs count**

Run:

```bash
find docs/current/guides -name '*.md' | sort
```

Expected output:

```text
docs/current/guides/bindings-authoring.md
docs/current/guides/bindings-examples.md
docs/current/guides/graph-ir-authoring.md
docs/current/guides/graph-ir-examples.md
```

- [ ] **Step 5: Verify stale package-local guide paths are gone**

Run:

```bash
rg -n "packages/artifacts/(bindings|graph-ir-compiler)/docs|docs/(examples|llm-authoring-guide)\\.md" apps packages modules demo docs/current AGENTS.md CLAUDE.md
```

Expected: no output.

- [ ] **Step 6: Verify dangerous current-doc wording is gone**

Run:

```bash
rg -n "authoritative design|active umbrella spec|specs are source of truth|code that disagrees with a spec is a bug" docs/current AGENTS.md CLAUDE.md
```

Expected: no output.

- [ ] **Step 7: Verify active historical directories were not moved yet**

Run:

```bash
test -d docs/superpowers/specs && test -d docs/superpowers/plans && echo "historical waves deferred"
```

Expected: `historical waves deferred`.

- [ ] **Step 8: Run markdown-only link smoke checks**

Run:

```bash
rg -n "Current documentation:" apps packages modules demo
rg -n "docs/current/owners|docs/current/guides" docs/README.md AGENTS.md CLAUDE.md
```

Expected: first command finds each local README stub. Second command finds the
new current-doc navigation in bootstrap docs.

- [ ] **Step 9: Final commit if verification changed files**

If any verification fixes were needed, run:

```bash
git add README.md AGENTS.md CLAUDE.md docs apps packages modules demo
git commit -m "docs: verify current docs centralization"
```

Expected: commit succeeds only if verification fixes changed files. If no files
changed, skip this commit.

## Self-Review

Spec coverage:

- `docs/README.md` entrypoint: Task 1.
- `docs/current/guides` authoring guide move: Task 2.
- `docs/current/owners` owner-doc move and local stubs: Task 3.
- Agent navigation update: Task 4.
- Current docs no longer treating specs as current truth: Task 5.
- Link repair after moves: Task 6.
- Wave 2 and Wave 3 as principles rather than detailed execution: Tasks 7 and 8.
- Verification and docs-only safety: Task 9.

Red-flag scan: this plan does not use unresolved fill-in markers.

Documentation-touch evaluation:

- `AGENTS.md` changes because repo navigation, package lookup behavior, and
  docs-touch policy change.
- `CLAUDE.md` changes because bootstrap package-doc wording changes.
- `docs/README.md` is created as the new docs entrypoint.
- Local README files change into stubs.
- `docs/current/**` is created as the current documentation home.
- `docs/decision-system.md` does not change in Wave 1 because no strategic,
  architectural, or convention bet changes.
