# rntme skills pack — agent-authoring skill pack shipped via `rntme-cli`

**Status:** design
**Author:** brainstorm 2026-04-19
**Location of implementation:** `rntme-cli/packages/cli` (private submodule `vladprrs/rntme-cli`)
**Related:**
- `docs/superpowers/specs/2026-04-19-rntme-cli-platform-commands-design.md` (CLI command surface; this spec extends it)
- `docs/superpowers/specs/2026-04-19-platform-api-design.md` (control-plane contract)
- `docs/superpowers/specs/2026-04-18-rntme-cli-submodule-design.md` (submodule mechanics)
- `AGENTS.md` §3 (package layering), `CLAUDE.md` (non-obvious conventions)
- memory: `project_platform_vision` (LLM-agent-driven DDD framing), `rntme_vision_framing` (artifact-driven runtime for AI-agent-generated services)
- external reference: `agentskills.io/home` (skill-format convention), `github/spec-kit` (CLI-delivered skill scaffolding pattern)

## 1. Problem

`rntme` compiles a service backend from 7 declarative JSON artifacts (`manifest`, `pdm`, `qsm`, `graph-ir`, `bindings`, `ui`, `seed`). The platform (`platform.rntme.com`) accepts these bundles via `rntme-cli`. Authoring a correct bundle from scratch requires knowledge of:

- which artifacts exist and how they reference each other,
- the correct authoring order (outside-in: UI+PDM → Bindings → QSM+Graph-IR → Manifest),
- the validator chain that checks them (bottom-up: pdm → qsm → graphIr → bindings → ui → seed → manifest),
- the `rntme publish` flow and error semantics.

An LLM-agent (Claude Code, Cursor) starting from a natural-language brief (`"build an issue tracker with issues and comments"`) has no built-in discipline for this workflow. Without guidance the agent typically:

- invents orphan projections before knowing what queries are needed (YAGNI violation; QSM-first thinking instead of bindings-first),
- writes a UI that references commands the PDM does not expose,
- designs graph-ir lowering before QSM projections are stable,
- skips `rntme validate` and discovers errors only on `rntme publish`.

We need a skill pack — short, agent-invoked markdown files with YAML frontmatter per `agentskills.io` convention — that imposes the correct authoring discipline, ships with the CLI, and installs into the user's project via a CLI command (spec-kit pattern: install the tool, then configure skills for a chosen agent).

## 2. Goal

Ship with `rntme-cli` a set of 9 skills + 2 new CLI commands so that:

1. A user runs `rntme init <svc>` to scaffold `rntme.json` + minimally-valid `artifacts/*.json`, then `rntme skills install --agent <claude-code|cursor>` to install skills into the project.
2. The agent invokes `Skill: using-rntme` and is routed through `brainstorming-rntme-service → designing-ui + designing-pdm → designing-bindings → designing-qsm + designing-graph-ir → composing-manifest → publishing-via-rntme-cli`.
3. Each design-skill produces the corresponding `artifacts/<name>.json`; the agent runs `rntme validate` between steps; `rntme publish` at the end.
4. Skills are thick (self-contained with full schema-reference, worked example, anti-patterns) so the agent does not need to read the `rntme` repo to author a bundle.
5. Thick content does not drift from `@rntme/*` package schemas: CI enforces schema-sync and worked-example validity on every PR.

**In scope:**
- 9 skill files (8 phase + 1 meta) under `rntme-cli/packages/cli/src/skills/sources/`.
- 2 adapters (`claude-code`, `cursor`) under `rntme-cli/packages/cli/src/skills/adapters/`.
- 2 new CLI commands: `rntme skills install`, `rntme init`.
- Starter bundle under `rntme-cli/packages/cli/src/skills/starters/` (rntme.json.tmpl + 7 minimally-valid artifacts).
- Drift-protection CI gates: `schema-sync.ts` + `example-valid.ts`.
- Unit + integration + e2e tests.

**Explicitly out of scope:**
- Copilot, Windsurf, Continue, Aider adapters — next iteration once `claude-code + cursor` MVP is stable.
- Auto-refresh of installed skills after `rntme-cli` upgrade (`rntme skills update` command) — v2.
- MCP-server wrapper exposing skills as MCP tools (`@rntme-cli/skills-mcp`) — future work.
- `designing-seed` skill — seed is optional for MVP services; can be added by hand until an agent-authoring pattern stabilises.
- Skill marketplace submission (publishing to agentskills.io index) — private MVP; ships inside the private submodule.
- Content translation (non-English skill bodies) — skills are in English; CLI output already mixes RU/EN per existing convention.
- `rntme upgrade` (self-update of the CLI binary) — orthogonal work.

## 3. Decisions matrix

| # | Решение |
|---|---|
| Q1 | Scope C: full pack (9 skills) vs thin overview / small-set |
| Q2 | Authoring order UI+PDM → Bindings → QSM+Graph-IR → Manifest → Publish (outside-in) — distinct from validator chain |
| Q3 | Distribution: ship inside `rntme-cli`, install via CLI command (spec-kit pattern) |
| Q4 | MVP agents: Claude Code + Cursor, project-local install |
| Q5 | Content depth: Thick (schema-ref + worked-example inline, CI-protected against drift) |
| Q6 | Command split: `rntme skills install` (skills only) + `rntme init <svc>` (scaffold); composable |
| Q7 | Skill template: hybrid C (checklist + red flags + schema-ref + worked example + anti-patterns + next-step) |
| Q8 | `brainstorming-rntme-service` is standalone (B), not a wrapper over `superpowers:brainstorming`, so pack has no plugin dependency |
| Q9 | Each design-skill explicitly links to the next via `## Next step`; `using-rntme` is a navigator, not a pipeline controller |

## 4. Architecture & module boundaries

### 4.1 Package layout

Skills and new commands live inside the existing `@rntme-cli/cli`. No new workspace packages.

```
rntme-cli/packages/cli/src/
  commands/
    skills/
      install.ts                  parse --agent, dispatch to adapter
    init.ts                       scaffold rntme.json + artifacts/*.json
  skills/
    sources/                      canonical agnostic markdown (source of truth)
      using-rntme.md
      brainstorming-rntme-service.md
      designing-ui.md
      designing-pdm.md
      designing-bindings.md
      designing-qsm.md
      designing-graph-ir.md
      composing-manifest.md
      publishing-via-rntme-cli.md
    starters/                     for `rntme init`
      rntme.json.tmpl             {{org}}, {{project}}, {{service}} placeholders
      artifacts/
        pdm.json                  minimally-valid
        qsm.json
        graph-ir.json
        bindings.json
        ui.json
        seed.json
        manifest.json
    adapters/
      types.ts                    interface Adapter
      claude-code.ts              .md → .claude/skills/rntme/
      cursor.ts                   .md → .cursor/rules/rntme/*.mdc (Rules format)
    verify/
      schema-sync.ts              CI: skill `Schema reference` vs @rntme/* Zod
      example-valid.ts            CI: skill `Worked example` JSON validates
  test/
    unit/skills/
    integration/skills/
    e2e/skills/
    fixtures/skills/
```

Source markdown files are read at runtime via `fs.readFileSync` relative to `__dirname`, so they ship in the built package (`dist/skills/sources/*.md`, copied by a build step — see §12.1).

### 4.2 Invariants (extend spec §4.4 of `rntme-cli-platform-commands-design`)

- `@rntme-cli/cli` still must not import `@rntme-cli/platform-*`, `@workos-inc/*`, `drizzle-orm`, `pg*`, `@aws-sdk/*`.
- `src/skills/verify/*.ts` may import `@rntme/*` validators lazily (test-time only, not bundled in the CLI binary path).
- Starter JSONs in `src/skills/starters/artifacts/` must pass their respective `@rntme/*` validators — enforced by `init-starters-validate` unit test.

### 4.3 Runtime deps

No new runtime dependencies. Uses `zod` (already present), `node:fs/promises`, `node:path`, `node:crypto`.

### 4.4 Distribution

Skills travel with the CLI binary. Install flow:

```
# Option A — submodule parent:
pnpm -F @rntme-cli/cli build
node rntme-cli/packages/cli/dist/bin/cli.js skills install --agent claude-code

# Option B — future npm publish:
npm i -g @rntme-cli/cli
rntme skills install --agent claude-code
```

No separate `@rntme-cli/skills` package. No Claude Code plugin registration. Skills are plain markdown files in the user's project after install.

## 5. Skill inventory and chaining

### 5.1 Inventory

| Skill | Produces | Depends on | Next |
|---|---|---|---|
| `using-rntme` | nothing (navigator) | — | `brainstorming-rntme-service` (new service) OR target-skill (quick-edit mode) |
| `brainstorming-rntme-service` | `brief.md` in service root | — | `designing-ui` + `designing-pdm` (parallel) |
| `designing-ui` | `artifacts/ui.json` | `brief.md` | after PDM also done → `designing-bindings` |
| `designing-pdm` | `artifacts/pdm.json` | `brief.md` | after UI also done → `designing-bindings` |
| `designing-bindings` | `artifacts/bindings.json` | `pdm.json`, `ui.json` | `designing-qsm` + `designing-graph-ir` (parallel) |
| `designing-qsm` | `artifacts/qsm.json` | `pdm.json`, `bindings.json` | after graph-ir also done → `composing-manifest` |
| `designing-graph-ir` | `artifacts/graph-ir.json` | `pdm.json`, `qsm.json`, `bindings.json` | after qsm also done → `composing-manifest` |
| `composing-manifest` | `artifacts/manifest.json` | all prior artifacts | `publishing-via-rntme-cli` |
| `publishing-via-rntme-cli` | published version (remote) | full bundle | — (terminal) |

### 5.2 Chaining graph

```
using-rntme
    │
    ▼
brainstorming-rntme-service
    │
    ▼
    ┌──────────┬──────────┐
    ▼          ▼
designing-ui   designing-pdm           (co-evolve; sync point after both green on rntme validate)
    │          │
    └────┬─────┘
         ▼
  designing-bindings
         │
    ┌────┴─────┐
    ▼          ▼
designing-qsm  designing-graph-ir      (co-evolve; sync point)
    │          │
    └────┬─────┘
         ▼
   composing-manifest
         │
         ▼
publishing-via-rntme-cli  (terminal)
```

### 5.3 Paired-skill discipline

For `designing-ui`/`designing-pdm` and `designing-qsm`/`designing-graph-ir`, each skill's `## Next step` reads:

> Work on this artifact until `rntme validate` passes for it in isolation. When your paired skill (`designing-<other>`) is also at that state, proceed to `designing-bindings` (or `composing-manifest`).

An agent iterating on a single artifact in the pair can loop inside its current skill without invoking the paired one again. A human can also run the pair sequentially (UI first, then PDM, or vice versa).

### 5.4 `using-rntme` as navigator

Two modes in its body:

1. **New service mode:** «just ran `rntme init`, starting from brief» → invoke `brainstorming-rntme-service`.
2. **Quick-edit mode:** «bundle already exists, want to change only X» → invoke `designing-<X>` directly; skip brainstorming + earlier skills. Warn: cross-artifact consistency is agent's responsibility; `rntme validate` is the safety net.

## 6. Skill template (hybrid C)

Every skill file follows this structure:

```markdown
---
name: <skill-name>
description: Use when <trigger condition>. Produces <artifact> (if applicable). Depends on <prior artifacts>.
---

## What you're building
<concept paragraph — what this artifact is in the rntme architecture>

## Checklist
<TodoWrite-per-item numbered list; 4–8 items>

## Red flags
<table: "Thought" | "Reality"; 4–8 rows of tempting shortcuts + why they are wrong>

## Schema reference
<fenced code block with metadata header:>
```ts pkg=@rntme/<pkg> export=<SchemaName>
<full inline Zod/TS schema copied from canonical source>
```

## Worked example
<fenced JSON block with metadata header:>
```json artifact=<name>
<complete valid example artifact>
```
<prose walkthrough: why each field is there, how it connects to other artifacts>

## Anti-patterns
<bullet list of common mistakes + why they fail>

## Validation & self-review
<pre-exit checklist: re-read brief, cross-check paired artifact, run `rntme validate`, confirm no `<PKG>_*` errors>

## Next step
<explicit: "Invoke Skill: <next-skill-name>" OR conditions for terminal>
```

**Exceptions to the template:**

- `using-rntme` — no `Schema reference`, no `Worked example`; has `## New service mode` + `## Quick-edit mode` decision tree.
- `brainstorming-rntme-service` — no `Schema reference`; `Worked example` = example brief (NL-style, not JSON); `Checklist` is discovery-question order.
- `publishing-via-rntme-cli` — no `Schema reference`; `Worked example` = terminal-session transcript (validate → publish → tag → verify); anti-patterns about skipping validate, confusing tag-names with seqs.

### 6.1 Schema-reference code-block metadata

Fenced with `ts pkg=@rntme/<pkg> export=<Schema>`:

```markdown
```ts pkg=@rntme/pdm export=PdmArtifactSchema
type PdmArtifact = { aggregates: Aggregate[] };
// ...
```
```

`verify/schema-sync.ts` parses these blocks, imports the named export, and compares the structural shape (see §8).

### 6.2 Worked-example JSON-block metadata

Fenced with `json artifact=<name>`:

```markdown
```json artifact=pdm
{ "aggregates": [ { "name": "Issue", ... } ] }
```
```

`verify/example-valid.ts` parses the block, pipes through the matching `@rntme/*` validator, fails CI if `Validated*` brand is not produced (see §8).

## 7. CLI commands

### 7.1 `rntme skills install`

**Usage:**

```
rntme skills install --agent <claude-code|cursor> [--target <path>] [--force] [--json]
```

**Flags:**

| Flag | Required | Default | Meaning |
|---|---|---|---|
| `--agent` | yes | — | adapter selector; unknown value → `CLI_SKILLS_UNKNOWN_AGENT` (exit 2) |
| `--target` | no | cwd | base path where skills are written |
| `--force` | no | false | overwrite existing files |
| `--json` | no | false | machine-readable output |

**Behaviour:**

1. Resolve adapter from `--agent`.
2. Read all files from `src/skills/sources/*.md`.
3. For each source, call `adapter.render(source)` → `{ relPath, content }`.
4. Write to `<target>/<relPath>` unless file exists and `--force` is false (→ skip + warning).
5. Print summary: n written / n skipped.

**Output (human):**

```
✓ installed 9 skills for claude-code
  → .claude/skills/rntme/using-rntme.md
  → .claude/skills/rntme/brainstorming-rntme-service.md
  ...
hint: in your agent, invoke Skill: using-rntme to start
```

**Output (`--json`):**

```json
{
  "ok": true,
  "data": {
    "agent": "claude-code",
    "target": "/path/to/project",
    "written": [".claude/skills/rntme/using-rntme.md", "..."],
    "skipped": []
  }
}
```

**Exit codes:** reuse spec §7.4 of `rntme-cli-platform-commands-design`. Specifically:
- `0` success
- `1` generic (file system error)
- `2` `CLI_SKILLS_UNKNOWN_AGENT`, `CLI_SKILLS_TARGET_NOT_WRITABLE`

### 7.2 `rntme init <service-slug>`

**Usage:**

```
rntme init <slug> [--org <s>] [--project <s>] [--artifacts-dir <path>] [--json]
```

**Flags:**

| Flag | Required | Default | Meaning |
|---|---|---|---|
| `<slug>` positional | yes | — | service slug; validates against `/^[a-z0-9-]{3,60}$/` |
| `--org` | no | `{{fill-me}}` | org slug in rntme.json |
| `--project` | no | `{{fill-me}}` | project slug in rntme.json |
| `--artifacts-dir` | no | `artifacts` | relative dir for artifact files |
| `--json` | no | false | machine-readable output |

**Behaviour:**

1. Refuse if `rntme.json` already exists in cwd — hint user to delete or use a fresh dir. Exit 2 (`CLI_INIT_ALREADY_INITIALIZED`).
2. Render `src/skills/starters/rntme.json.tmpl` with substitutions → write `rntme.json`.
3. Create `<artifacts-dir>/`, copy each starter artifact from `src/skills/starters/artifacts/*.json`.
4. Print next-steps hint.

**Output (human):**

```
✓ initialized rntme service "my-svc"
  rntme.json (org: {{fill-me}}, project: {{fill-me}}, service: my-svc)
  artifacts/pdm.json
  artifacts/qsm.json
  ...
next:
  1. edit rntme.json — set org and project
  2. rntme skills install --agent <claude-code|cursor>
  3. open your agent, invoke Skill: using-rntme
```

**Error codes added:**

```
CLI_INIT_ALREADY_INITIALIZED   rntme.json already present
CLI_INIT_INVALID_SLUG          slug regex mismatch
CLI_SKILLS_UNKNOWN_AGENT       --agent <unknown>
CLI_SKILLS_TARGET_NOT_WRITABLE target path unwritable / does not exist
```

Append to registry in `errors/codes.ts` per spec §7.5.

### 7.3 Discovery from existing commands

`rntme --help` now lists `init` and `skills` in the top-level command table. `rntme skills --help` lists `install` as the only subcommand for MVP.

## 8. Drift protection (CI gates)

Thick content is protected by two CI gates, both in `src/skills/verify/`. They run as part of `pnpm -F @rntme-cli/cli test`.

### 8.1 `schema-sync.ts`

**Input:** all `*.md` files in `src/skills/sources/`.

**Algorithm:**

1. For each file, find fenced blocks with pattern `^```ts pkg=(@rntme/[\w-]+) export=(\w+)$`.
2. Extract the code body.
3. Dynamically `import()` the named export from the declared package.
4. Compare:
   - For Zod schemas: walk `._def` recursively, check same shape (same keys, same nested types).
   - For bare TypeScript types: convert the code body to AST via `typescript` compiler API, compare structural shape with the imported runtime type's Zod mirror (each `@rntme/*` package exports a Zod schema matching its TS types by convention).
5. Mismatch → print unified diff, fail CI.

**Output on failure:**

```
schema-sync: drift detected in designing-pdm.md
  pkg:    @rntme/pdm
  export: PdmArtifactSchema
  diff:
    - optional field `archivedAt` present in runtime, missing from skill
    + unknown field `legacyCode` in skill, not in runtime
  fix: update the `## Schema reference` block in designing-pdm.md to match @rntme/pdm
```

### 8.2 `example-valid.ts`

**Input:** all `*.md` files in `src/skills/sources/`.

**Algorithm:**

1. For each file, find fenced blocks with pattern `^```json artifact=(\w+)$`.
2. Parse the JSON body.
3. Map artifact name → validator (`pdm` → `@rntme/pdm.validate`, `qsm` → `@rntme/qsm.validate`, etc.).
4. Run validator; expect `Result<Validated<T>, E[]>` to be `ok`.
5. Not ok → print errors, fail CI.

**Output on failure:**

```
example-valid: invalid worked example in designing-pdm.md
  artifact: pdm
  errors:
    - PDM_STRUCTURAL_DUPLICATE_AGGREGATE at aggregates[1].name="Issue"
  fix: update the `## Worked example` block in designing-pdm.md
```

### 8.3 Runs as

`pnpm -F @rntme-cli/cli test` (default CI gate on every PR). Both gates run before unit tests (fast fail). Cannot be skipped by `--force` in CLI — they are static CI checks.

### 8.4 Consequence

Any PR that modifies `@rntme/*` Zod schemas in a structurally-breaking way and does not co-update skill content fails CI. Any PR that modifies skill content with a broken example fails CI. Skills are thus always consistent with the runtime.

## 9. Adapters

### 9.1 `adapters/types.ts`

```ts
export interface Adapter {
  name: 'claude-code' | 'cursor';
  render(source: SkillSource): RenderedSkill;
}

export type SkillSource = { fileName: string; body: string };
export type RenderedSkill = { relPath: string; content: string };
```

### 9.2 `adapters/claude-code.ts`

- `relPath` = `.claude/skills/rntme/<fileName>` (unchanged extension `.md`).
- `content` = `source.body` verbatim. Frontmatter (`name`, `description`) preserved.

### 9.3 `adapters/cursor.ts`

- `relPath` = `.cursor/rules/rntme/<basename>.mdc`.
- Transform body frontmatter:
  - Keep `name`, `description`.
  - Add `globs: ["**/rntme.json", "**/artifacts/**"]`.
  - Add `alwaysApply: false`.
- Body content below frontmatter unchanged.

Cursor Rules format is stable enough for the MVP; the adapter is a pure function and easy to update if Cursor changes the format.

### 9.4 Future adapters

New agent support = one file under `adapters/`, plus an entry in the `--agent` switch in `commands/skills/install.ts`. No schema changes, no registry file. Out of scope for MVP.

## 10. Starter bundle (for `rntme init`)

All under `src/skills/starters/`.

### 10.1 `rntme.json.tmpl`

```json
{
  "$schema": "https://platform.rntme.com/schemas/rntme-config-v1.json",
  "org": "{{org}}",
  "project": "{{project}}",
  "service": "{{service}}",
  "artifacts": {
    "manifest": "{{artifactsDir}}/manifest.json",
    "pdm": "{{artifactsDir}}/pdm.json",
    "qsm": "{{artifactsDir}}/qsm.json",
    "graphIr": "{{artifactsDir}}/graph-ir.json",
    "bindings": "{{artifactsDir}}/bindings.json",
    "ui": "{{artifactsDir}}/ui.json",
    "seed": "{{artifactsDir}}/seed.json"
  }
}
```

### 10.2 Starter artifacts

Each artifact is the minimally-valid instance its `@rntme/*` validator accepts. Examples:

- `pdm.json`: `{ "aggregates": [] }`
- `qsm.json`: `{ "projections": [], "relations": [] }`
- `graph-ir.json`: the empty-compilation canonical form per `graph_ir_rc_7.md` section on empty IR.
- `bindings.json`: `{ "commands": [], "queries": [] }`
- `ui.json`: `{ "pages": [] }` (or the UI v2 empty-shape per `2026-04-16-ui-artifact-v2-design.md`).
- `seed.json`: `{ "events": [] }`
- `manifest.json`: pointer index matching the other six empty artifacts.

**Invariant:** `rntme validate` against the starter bundle exits 0. Enforced by `init-starters-validate` unit test.

### 10.3 Intentional omissions

Starter bundle is only for bootstrapping. It does not include example domain content (no starter `Issue` aggregate). The agent fills it by following `brainstorming-rntme-service` → `designing-*`. Examples live only in skill `Worked example` sections.

## 11. Testing

### 11.1 Unit (`test/unit/skills/`)

| Subject | Tests |
|---|---|
| `adapters/claude-code.ts` | frontmatter preserved, relPath = `.claude/skills/rntme/<f>`, content identical to source |
| `adapters/cursor.ts` | `.md → .mdc`, globs injected, alwaysApply=false, name/description preserved, body below frontmatter untouched |
| `commands/skills/install.ts` | --agent dispatch for each adapter, --target resolution, --force semantics, unknown agent → exit 2 |
| `commands/init.ts` | scaffold writes rntme.json + 7 starters, placeholder substitution correct, refuse-if-exists, slug-regex validation |
| `init-starters-validate` (unit, not a command) | for each of 7 starter artifacts → matching `@rntme/*` validator returns `ok` |
| `verify/schema-sync.ts` | synthetic mismatch detected (injected extra field), no-drift → pass, missing `pkg=` metadata → fail with hint |
| `verify/example-valid.ts` | valid example → pass, example with injected PDM_STRUCTURAL_* → fail with errors printed, missing `artifact=` metadata → fail |

Target coverage ≥90% for `adapters/`, `verify/`, `commands/skills/`, `commands/init.ts`.

### 11.2 Integration (`test/integration/skills/`)

MSW is not needed — these commands are filesystem-only, no HTTP.

| Scenario | Expect |
|---|---|
| `rntme skills install --agent claude-code` in empty tmp dir | 9 files in `.claude/skills/rntme/`, each parses as markdown with valid frontmatter |
| `rntme skills install --agent cursor` same dir | 9 `.mdc` files in `.cursor/rules/rntme/`, each has `globs`, `alwaysApply: false` |
| install → install without `--force` | second run: 0 written, 9 skipped warnings |
| install → install with `--force` | second run: 9 written (overwrite) |
| `rntme init svc + rntme validate` | exit 0 (starter bundle valid) |
| `rntme init svc` twice | second fails with `CLI_INIT_ALREADY_INITIALIZED` |
| `rntme init my-svc --org acme --project tracker` | rntme.json has correct values |
| skill-chain check | for each `*.md` in sources, parse `## Next step`; assert all referenced skill names exist in the pack (graph connected) |
| frontmatter-lint | each skill's `description` starts with `Use when ` per agentskills convention |

### 11.3 E2E (`test/e2e/skills/`)

Single smoke test, no network:

```bash
tmp=$(mktemp -d)
cd $tmp
rntme init smoke-svc --org rntme-cli-e2e --project skills-e2e
rntme skills install --agent claude-code
test -f .claude/skills/rntme/using-rntme.md
test -f rntme.json
test -f artifacts/pdm.json
rntme validate       # exit 0
```

Runs in `test:e2e` script of `@rntme-cli/cli`, no secrets required.

### 11.4 Drift-gate tests (CI-wide)

`schema-sync` and `example-valid` are run as part of the unit-test phase (§8.3). They are not user-visible — they fail CI, block merge, and the failure message points to the specific skill file and block to fix.

## 12. Verification

### 12.1 Build & packaging

- `src/skills/sources/*.md` and `src/skills/starters/**` must be copied to `dist/skills/sources/` and `dist/skills/starters/` by the tsc build step. Achieve via a small post-`tsc` copy script (`scripts/copy-skills-assets.ts`) wired into `build` script in `package.json`.
- `dist/bin/cli.js` can locate skill sources via `path.join(__dirname, '../skills/sources/')`.
- `pnpm pack @rntme-cli/cli` — tarball includes `dist/skills/**`.

### 12.2 Local smoke (developer workflow)

```bash
pnpm -F @rntme-cli/cli build

mkdir /tmp/rntme-smoke && cd /tmp/rntme-smoke
node <path>/rntme-cli/packages/cli/dist/bin/cli.js init my-svc
node <path>/rntme-cli/packages/cli/dist/bin/cli.js skills install --agent claude-code
ls -la .claude/skills/rntme/   # 9 files
node <path>/rntme-cli/packages/cli/dist/bin/cli.js validate    # exit 0
```

### 12.3 Cross-cutting

- **Invariant §4.2:** `@rntme-cli/cli` does not import `platform-*`, `@workos-inc/*`, `drizzle-orm`, `pg*`, `@aws-sdk/*`. Existing lint step from spec §4.4 of platform-commands extends to cover `src/skills/**`.
- **Skill completeness:** the 9-skill graph is connected (see §11.2). Adding a skill requires adding it to the graph and to `using-rntme`'s routing table.
- **Starter validity:** every starter passes `rntme validate` — enforced by `init-starters-validate`.
- **Thick-content consistency:** schema-sync + example-valid CI gates (§8).

### 12.4 Documentation

- `rntme-cli/packages/cli/README.md` adds sections for `init` and `skills install`, with a Quick start showing the two-command bootstrap.
- No separate skill-pack README. Skills document themselves; `using-rntme` is the entry point agents discover.

## 13. Risks & known limitations

- **Thick-content drift.** The main risk. Mitigation: `schema-sync.ts` + `example-valid.ts` CI gates (§8). A breaking change in `@rntme/pdm` schema that does not co-update `designing-pdm.md` fails CI.
- **Agent-adapter format drift.** Claude Code or Cursor change their skill/rules format. Mitigation: adapters are isolated pure functions. An update = one file edit + unit test. For Cursor, the Rules format is still evolving; we accept this risk for MVP and plan a quarterly smoke check: install skills into a real Cursor project, verify they load.
- **Chaining rigidity.** The linear UI+PDM → Bindings → QSM+Graph-IR → Manifest pipeline is strict. A user making a small surgical edit (e.g., rename a UI label) should not have to walk the full pipeline. Mitigation: `using-rntme` has a `## Quick-edit mode` that routes directly to the target skill, with a warning that cross-artifact consistency is the agent's responsibility and `rntme validate` is the safety net.
- **Skill context size.** Thick content × 9 files is a lot of tokens. Mitigation: each skill is self-contained, so the agent loads only one at a time. `using-rntme` is kept deliberately thin — it navigates, not duplicates content.
- **Cursor maturity.** Cursor Rules are less uniformly supported than Claude Code skills across versions. MVP risk: one adapter may silently stop matching the current Cursor runtime. Mitigation: documented quarterly smoke check; unit tests assert the current format.
- **Starter-bundle evolution.** When `@rntme/*` validators change structurally (e.g., required field added to PDM empty form), starter JSONs must update. Mitigation: `init-starters-validate` unit test runs each starter through its validator on every PR.
- **Private submodule distribution.** `rntme-cli` ships as a git submodule, not yet as an npm package. Agents in non-rntme projects cannot `npm i -g @rntme-cli/cli` yet. Mitigation: this spec assumes internal use; public npm publishing is existing `rntme-cli` work, orthogonal. Spec-kit-style UX comes for free once that lands.
- **Brainstorming duplication.** `brainstorming-rntme-service` is standalone (decision Q9 = B), so it duplicates some generic questioning patterns from `superpowers:brainstorming`. Accepted: the pack must work for agents without superpowers installed.
- **No `rntme skills update`.** After the user installs skills and later upgrades `rntme-cli`, their `.claude/skills/rntme/` is stale until they re-run `install --force`. Mitigation: README documents the `--force` re-install pattern. v2 adds a dedicated `update` subcommand that diffs installed vs bundled and prompts.
- **No seed authoring skill.** `designing-seed` is omitted from MVP. Seed is often hand-authored or left empty. If demand emerges, the pack extends to 10 skills without structural changes.
- **English-only.** Skill bodies are English, matching `agentskills.io` convention and reducing LLM prompt-contamination risk. The CLI itself continues to support mixed RU/EN output per existing project convention.

## 14. Glossary

- **Skill pack** — the set of 9 markdown files installed by `rntme skills install`. Canonical under `rntme-cli/packages/cli/src/skills/sources/`.
- **Adapter** — a pure function mapping a canonical skill source to an agent-specific on-disk format (Claude Code `.md` in `.claude/skills/rntme/`, Cursor `.mdc` in `.cursor/rules/rntme/`).
- **Starter bundle** — the 7 minimally-valid artifact files + `rntme.json.tmpl` that `rntme init` materializes into a new service directory.
- **Thick content** — skill body contains full inline schema reference + worked example (decision Q5). Opposite of a pointer-only skill.
- **Authoring order** — UI+PDM → Bindings → QSM+Graph-IR → Manifest → Publish. Outside-in: use-case visibility drives all derivatives. Distinct from the validator chain (bottom-up: pdm → qsm → graphIr → bindings → ui → seed → manifest).
- **Paired skill** — two skills meant to co-evolve (`designing-ui`+`designing-pdm`, `designing-qsm`+`designing-graph-ir`). The agent iterates between them until both pass validation, then proceeds to the next step.
- **Drift gate** — a CI check in `src/skills/verify/` that fails the build if skill thick content has diverged from `@rntme/*` canonical sources.
- **Quick-edit mode** — `using-rntme`'s branch for agents editing an already-valid bundle; routes directly to the target skill and skips brainstorming + earlier phases.
- **Skill chain** — explicit `## Next step` pointer in each skill, forming a directed graph that `using-rntme` enumerates and the integration test verifies is connected.
