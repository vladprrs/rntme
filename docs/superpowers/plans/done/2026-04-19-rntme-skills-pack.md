# rntme skills pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship with `rntme-cli` a pack of 9 thick skills (1 navigator + 8 phase) that route an LLM-agent through outside-in authoring of a rntme service (UI+PDM → Bindings → QSM+Graph-IR → Manifest → Publish), installed into a user's project via new CLI commands `rntme init` + `rntme skills install --agent <claude-code|cursor>`. Thick content is kept in sync with `@rntme/*` schemas via two CI drift gates.

**Architecture:** All code lives inside existing `@rntme-cli/cli` (no new workspace package). Skills are agnostic markdown in `src/skills/sources/`; per-agent adapters (pure functions) render them to agent-specific on-disk paths. Starter bundle in `src/skills/starters/` bootstraps an empty-but-valid service. Drift gates (`src/skills/verify/schema-sync.ts` and `example-valid.ts`) run inside the vitest unit suite on every PR.

**Tech Stack:** TypeScript (ESM, Node 20+), Vitest, Zod 4, `@rntme-cli/platform-core` (for `validateBundle`), `@rntme/*` workspace packages (for raw Zod schemas, used by drift gates). No new runtime deps; adds `typescript` lib-only usage for AST parsing in gates (already transitively available).

---

## File Structure

**Create:**

```
rntme-cli/packages/cli/
  src/
    commands/
      init.ts                                 new — `rntme init <slug>`
      skills/
        install.ts                            new — `rntme skills install`
    skills/
      sources/                                new — 9 markdown sources
        using-rntme.md
        brainstorming-rntme-service.md
        designing-ui.md
        designing-pdm.md
        designing-bindings.md
        designing-qsm.md
        designing-graph-ir.md
        composing-manifest.md
        publishing-via-rntme-cli.md
        examples/
          issue-tracker/                      canonical worked-example bundle
            manifest.json
            pdm.json
            qsm.json
            graph-ir.json
            bindings.json
            ui.json
            seed.json
      starters/                               new — scaffold assets for `rntme init`
        rntme.json.tmpl
        artifacts/
          manifest.json
          pdm.json
          qsm.json
          graph-ir.json
          bindings.json
          ui.json
          seed.json
      adapters/
        types.ts                              new — Adapter interface
        claude-code.ts                        new — .md → .claude/skills/rntme/
        cursor.ts                             new — .md → .cursor/rules/rntme/*.mdc
      verify/
        schema-sync.ts                        new — drift gate: schema ref vs @rntme/* Zod
        example-valid.ts                      new — drift gate: worked-example bundle validity
        snapshots/                            new — generated canonical forms
          pdm.PdmArtifactSchema.txt
          qsm.QsmArtifactSchema.txt
          bindings.BindingArtifactSchema.txt
          seed.SeedArtifactSchema.txt
          graphIr.AuthoringSpecSchema.txt
  test/
    unit/
      commands/
        init.test.ts                          new
        skills/install.test.ts                new
      skills/
        adapters/claude-code.test.ts          new
        adapters/cursor.test.ts               new
        starters/init-validate.test.ts        new
        verify/schema-sync.test.ts            new
        verify/example-valid.test.ts          new
    integration/
      skills-install.test.ts                  new
      skills-chain.test.ts                    new
    e2e/
      skills-smoke.test.ts                    new
    fixtures/
      skills/
        synthetic-skill-valid.md              new — gate-test fixture
        synthetic-skill-drift.md              new — gate-test fixture
  scripts/
    copy-skills-assets.cjs                    new — post-tsc asset copy
```

**Modify:**

```
rntme-cli/packages/cli/
  src/
    errors/codes.ts                           extend CLI_ERROR_CODES
    bin/cli.ts                                add `init` + `skills` switch cases
  package.json                                add `postbuild` asset-copy step,
                                              new `gen:snapshots` script,
                                              @rntme/pdm|qsm|bindings|seed|ui|graph-ir-compiler as devDependencies
  README.md                                   add init + skills sections
```

---

## Task 1: Extend error codes registry

Add the 4 new error codes to the CLI_ERROR_CODES array per spec §7.2.

**Files:**
- Modify: `rntme-cli/packages/cli/src/errors/codes.ts`
- Test: `rntme-cli/packages/cli/test/unit/errors/codes.test.ts` (create if not exists)

- [ ] **Step 1: Write the failing test**

Create `rntme-cli/packages/cli/test/unit/errors/codes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CLI_ERROR_CODES } from '../../../src/errors/codes.js';

describe('CLI_ERROR_CODES registry', () => {
  const expectedNew = [
    'CLI_INIT_ALREADY_INITIALIZED',
    'CLI_INIT_INVALID_SLUG',
    'CLI_SKILLS_UNKNOWN_AGENT',
    'CLI_SKILLS_TARGET_NOT_WRITABLE',
  ] as const;

  it.each(expectedNew)('contains %s', (code) => {
    expect(CLI_ERROR_CODES).toContain(code);
  });

  it('is append-only (older codes still present)', () => {
    expect(CLI_ERROR_CODES).toContain('CLI_CONFIG_MISSING');
    expect(CLI_ERROR_CODES).toContain('CLI_VALIDATE_LOCAL_FAILED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/errors/codes.test.ts`
Expected: FAIL — new codes not in registry.

- [ ] **Step 3: Extend the registry**

Edit `rntme-cli/packages/cli/src/errors/codes.ts`, append the four codes to the `CLI_ERROR_CODES` tuple (before the closing `] as const`), preserving order of existing entries:

```ts
export const CLI_ERROR_CODES = [
  'CLI_CONFIG_MISSING',
  'CLI_CONFIG_INVALID',
  'CLI_CONFIG_ARTIFACT_NOT_FOUND',
  'CLI_CREDENTIALS_MISSING',
  'CLI_CREDENTIALS_INVALID',
  'CLI_CREDENTIALS_PERMISSIONS_TOO_OPEN',
  'CLI_RESPONSE_PARSE_FAILED',
  'CLI_VALIDATE_LOCAL_FAILED',
  'CLI_PUBLISH_DIGEST_MISMATCH',
  'CLI_NETWORK_TIMEOUT',
  'CLI_USAGE',
  'CLI_INIT_ALREADY_INITIALIZED',
  'CLI_INIT_INVALID_SLUG',
  'CLI_SKILLS_UNKNOWN_AGENT',
  'CLI_SKILLS_TARGET_NOT_WRITABLE',
] as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/errors/codes.test.ts`
Expected: PASS.

Also run: `pnpm -F @rntme-cli/cli typecheck`
Expected: PASS.

- [ ] **Step 5: Update exit-code mapping**

Check `rntme-cli/packages/cli/src/errors/exit.ts`. If it has a `case` for every code, add the four new cases mapping to exit 2 (config/credentials problem — all four are local/validation errors). Example:

```ts
case 'CLI_INIT_ALREADY_INITIALIZED':
case 'CLI_INIT_INVALID_SLUG':
case 'CLI_SKILLS_UNKNOWN_AGENT':
case 'CLI_SKILLS_TARGET_NOT_WRITABLE':
  return 2;
```

Run: `pnpm -F @rntme-cli/cli typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/cli/src/errors/codes.ts \
        rntme-cli/packages/cli/src/errors/exit.ts \
        rntme-cli/packages/cli/test/unit/errors/codes.test.ts
git commit -m "feat(cli): error codes for init + skills commands"
```

---

## Task 2: Adapter types + Claude Code adapter

Create the shared `Adapter` interface and the first adapter.

**Files:**
- Create: `rntme-cli/packages/cli/src/skills/adapters/types.ts`
- Create: `rntme-cli/packages/cli/src/skills/adapters/claude-code.ts`
- Test: `rntme-cli/packages/cli/test/unit/skills/adapters/claude-code.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/unit/skills/adapters/claude-code.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { claudeCodeAdapter } from '../../../../src/skills/adapters/claude-code.js';

describe('claudeCodeAdapter', () => {
  const source = {
    fileName: 'using-rntme.md',
    body: '---\nname: using-rntme\ndescription: Use when starting a rntme service.\n---\n\n## What\nbody text\n',
  };

  it('writes to .claude/skills/rntme/<fileName> with identical content', () => {
    const out = claudeCodeAdapter.render(source);
    expect(out.relPath).toBe('.claude/skills/rntme/using-rntme.md');
    expect(out.content).toBe(source.body);
  });

  it('has name "claude-code"', () => {
    expect(claudeCodeAdapter.name).toBe('claude-code');
  });

  it('preserves frontmatter byte-for-byte', () => {
    const out = claudeCodeAdapter.render(source);
    expect(out.content.startsWith('---\nname: using-rntme\n')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/skills/adapters/claude-code.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create types.ts**

Create `src/skills/adapters/types.ts`:

```ts
export type SkillSource = {
  readonly fileName: string; // e.g. "using-rntme.md"
  readonly body: string; // full markdown, including YAML frontmatter
};

export type RenderedSkill = {
  readonly relPath: string; // relative to user's project root, e.g. ".claude/skills/rntme/using-rntme.md"
  readonly content: string; // bytes to write
};

export type AdapterName = 'claude-code' | 'cursor';

export interface Adapter {
  readonly name: AdapterName;
  render(source: SkillSource): RenderedSkill;
}
```

- [ ] **Step 4: Create claude-code.ts**

Create `src/skills/adapters/claude-code.ts`:

```ts
import type { Adapter, SkillSource, RenderedSkill } from './types.js';

const TARGET_DIR = '.claude/skills/rntme';

export const claudeCodeAdapter: Adapter = {
  name: 'claude-code',
  render(source: SkillSource): RenderedSkill {
    return {
      relPath: `${TARGET_DIR}/${source.fileName}`,
      content: source.body,
    };
  },
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/skills/adapters/claude-code.test.ts`
Expected: PASS.

Run: `pnpm -F @rntme-cli/cli typecheck` → PASS.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/cli/src/skills/adapters/types.ts \
        rntme-cli/packages/cli/src/skills/adapters/claude-code.ts \
        rntme-cli/packages/cli/test/unit/skills/adapters/claude-code.test.ts
git commit -m "feat(cli): adapter types + claude-code adapter for skills"
```

---

## Task 3: Cursor adapter

Renders `.md` sources to `.cursor/rules/rntme/*.mdc` with transformed frontmatter per Cursor Rules format.

**Files:**
- Create: `rntme-cli/packages/cli/src/skills/adapters/cursor.ts`
- Test: `rntme-cli/packages/cli/test/unit/skills/adapters/cursor.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/unit/skills/adapters/cursor.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cursorAdapter } from '../../../../src/skills/adapters/cursor.js';

describe('cursorAdapter', () => {
  const source = {
    fileName: 'using-rntme.md',
    body: '---\nname: using-rntme\ndescription: Use when starting a rntme service.\n---\n\n## What\nbody text\n',
  };

  it('has name "cursor"', () => {
    expect(cursorAdapter.name).toBe('cursor');
  });

  it('renames .md extension to .mdc', () => {
    const out = cursorAdapter.render(source);
    expect(out.relPath).toBe('.cursor/rules/rntme/using-rntme.mdc');
  });

  it('injects globs and alwaysApply into frontmatter', () => {
    const out = cursorAdapter.render(source);
    expect(out.content).toContain('globs:');
    expect(out.content).toContain('**/rntme.json');
    expect(out.content).toContain('**/artifacts/**');
    expect(out.content).toContain('alwaysApply: false');
  });

  it('preserves name and description', () => {
    const out = cursorAdapter.render(source);
    expect(out.content).toContain('name: using-rntme');
    expect(out.content).toContain('description: Use when starting a rntme service.');
  });

  it('preserves body below frontmatter', () => {
    const out = cursorAdapter.render(source);
    expect(out.content).toContain('## What\nbody text');
  });

  it('fails on missing frontmatter', () => {
    expect(() =>
      cursorAdapter.render({ fileName: 'bad.md', body: 'no frontmatter here' }),
    ).toThrow(/frontmatter/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/skills/adapters/cursor.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create cursor.ts**

Create `src/skills/adapters/cursor.ts`. Implementation:

```ts
import type { Adapter, SkillSource, RenderedSkill } from './types.js';

const TARGET_DIR = '.cursor/rules/rntme';
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;

const INJECTED = `globs:\n  - "**/rntme.json"\n  - "**/artifacts/**"\nalwaysApply: false`;

export const cursorAdapter: Adapter = {
  name: 'cursor',
  render(source: SkillSource): RenderedSkill {
    const m = FRONTMATTER_RE.exec(source.body);
    if (!m) {
      throw new Error(`skill "${source.fileName}" missing YAML frontmatter`);
    }
    const [, fm, rest] = m;
    const augmented = `---\n${fm}\n${INJECTED}\n---\n${rest}`;
    const baseName = source.fileName.replace(/\.md$/, '');
    return {
      relPath: `${TARGET_DIR}/${baseName}.mdc`,
      content: augmented,
    };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/skills/adapters/cursor.test.ts`
Expected: PASS (all 6).

- [ ] **Step 5: Commit**

```bash
git add rntme-cli/packages/cli/src/skills/adapters/cursor.ts \
        rntme-cli/packages/cli/test/unit/skills/adapters/cursor.test.ts
git commit -m "feat(cli): cursor adapter for skills"
```

---

## Task 4: Canonical worked-example bundle (issue-tracker)

The shared bundle every skill's `## Worked example` section references. Must pass `validateBundle` to anchor `example-valid.ts`.

**Files:**
- Create: `rntme-cli/packages/cli/src/skills/sources/examples/issue-tracker/{manifest,pdm,qsm,graph-ir,bindings,ui,seed}.json`
- Test: `rntme-cli/packages/cli/test/unit/skills/starters/init-validate.test.ts` (reused later for starters; this task adds the issue-tracker case)

- [ ] **Step 1: Write the failing test**

Create `test/unit/skills/starters/init-validate.test.ts` (will be extended in Task 5):

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBundle } from '@rntme-cli/platform-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXAMPLES_DIR = join(HERE, '../../../../src/skills/sources/examples/issue-tracker');
const KEYS = ['manifest', 'pdm', 'qsm', 'graphIr', 'bindings', 'ui', 'seed'] as const;
const FILE_NAMES: Record<(typeof KEYS)[number], string> = {
  manifest: 'manifest.json',
  pdm: 'pdm.json',
  qsm: 'qsm.json',
  graphIr: 'graph-ir.json',
  bindings: 'bindings.json',
  ui: 'ui.json',
  seed: 'seed.json',
};

function loadBundle(dir: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of KEYS) {
    const raw = readFileSync(join(dir, FILE_NAMES[key]), 'utf8');
    out[key] = JSON.parse(raw);
  }
  return out;
}

describe('worked-example bundle (issue-tracker)', () => {
  it('passes validateBundle', async () => {
    const bundle = loadBundle(EXAMPLES_DIR) as Parameters<typeof validateBundle>[0];
    const result = await validateBundle(bundle);
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.error('validateBundle errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/skills/starters/init-validate.test.ts`
Expected: FAIL — example files missing.

- [ ] **Step 3: Author the bundle files**

Model the bundle on `demo/issue-tracker-api/artifacts/`. Copy each JSON from there as starting point, then adjust the org/project/service naming in `manifest.json` to `rntme-skills-examples` / `issue-tracker` / `api`. Each file goes in `src/skills/sources/examples/issue-tracker/<name>.json`.

**Concrete directives:**

1. Copy `demo/issue-tracker-api/artifacts/pdm.json` verbatim → `pdm.json`.
2. Copy `qsm.json`, `graph-ir.json`, `bindings.json`, `ui.json`, `seed.json` verbatim.
3. Copy `manifest.json`; change its `service.name` / `project` / `org` fields to match the examples namespace (check manifest schema via `parseManifest`-equivalent or the demo format).

If the demo bundle is not directly copyable (schema drift), read `packages/pdm/README.md` and `packages/qsm/README.md` to see their minimal-valid shapes and hand-author an Issue+Comment bundle. The acceptance criterion is `validateBundle` returns `ok`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/skills/starters/init-validate.test.ts`
Expected: PASS.

If it fails, `console.error` output lists `errors[]` — fix the artifacts per those codes (`QSM_STRUCTURAL_*`, `BINDINGS_CONSISTENCY_*`, etc.) and re-run. Do not modify @rntme/* packages; fix the example JSON.

- [ ] **Step 5: Commit**

```bash
git add rntme-cli/packages/cli/src/skills/sources/examples/issue-tracker/ \
        rntme-cli/packages/cli/test/unit/skills/starters/init-validate.test.ts
git commit -m "feat(cli): canonical issue-tracker example bundle for skills"
```

---

## Task 5: Starter bundle (for `rntme init`)

Seven minimally-valid artifact JSONs + `rntme.json.tmpl`. Must pass `validateBundle` so `rntme init && rntme validate` exits 0.

**Files:**
- Create: `rntme-cli/packages/cli/src/skills/starters/rntme.json.tmpl`
- Create: `rntme-cli/packages/cli/src/skills/starters/artifacts/{manifest,pdm,qsm,graph-ir,bindings,ui,seed}.json`
- Test: extend `rntme-cli/packages/cli/test/unit/skills/starters/init-validate.test.ts`

- [ ] **Step 1: Extend the test (add starter case)**

Append to `test/unit/skills/starters/init-validate.test.ts`:

```ts
const STARTERS_DIR = join(HERE, '../../../../src/skills/starters/artifacts');

describe('starter bundle (rntme init defaults)', () => {
  it('passes validateBundle', async () => {
    const bundle = loadBundle(STARTERS_DIR) as Parameters<typeof validateBundle>[0];
    const result = await validateBundle(bundle);
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.error('starter validateBundle errors:', JSON.stringify(result.errors, null, 2));
    }
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/skills/starters/init-validate.test.ts`
Expected: FAIL — starter files missing.

- [ ] **Step 3: Author minimally-valid starters**

Each file is the smallest object that parses + validates.

Create `src/skills/starters/artifacts/pdm.json`:

```json
{ "aggregates": [] }
```

Check each @rntme/* parser:
- `@rntme/pdm.parsePdm({ aggregates: [] })` → should succeed (empty aggregate list is valid).
- `@rntme/qsm.parseQsm({ projections: [], relations: [] })` — confirm by reading `packages/qsm/README.md` / `src/schema.ts` for the empty shape.
- `@rntme/graph-ir-compiler.parseAuthoringSpec` — empty spec per `graph_ir_rc_7.md`.
- `@rntme/bindings.parseBindingArtifact` — empty commands/queries.
- `@rntme/ui.expand` — empty UI root.
- `@rntme/seed.parseSeed` — empty events.

For each artifact, read the package's README + schema source once, write the minimally-valid JSON, run the test. Iterate until `validateBundle` returns ok.

Also create `src/skills/starters/rntme.json.tmpl`:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/skills/starters/init-validate.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add rntme-cli/packages/cli/src/skills/starters/ \
        rntme-cli/packages/cli/test/unit/skills/starters/init-validate.test.ts
git commit -m "feat(cli): starter bundle for rntme init (minimally valid)"
```

---

## Task 6: `rntme init` command

Scaffolds `rntme.json` + `artifacts/*.json` into the current directory.

**Files:**
- Create: `rntme-cli/packages/cli/src/commands/init.ts`
- Test: `rntme-cli/packages/cli/test/unit/commands/init.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/unit/commands/init.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../../src/commands/init.js';

describe('runInit', () => {
  let tmp: string;
  let origCwd: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'rntme-init-'));
    origCwd = process.cwd();
    process.chdir(tmp);
  });

  afterEach(() => {
    process.chdir(origCwd);
    rmSync(tmp, { recursive: true, force: true });
  });

  it('scaffolds rntme.json and 7 artifact files on fresh dir', async () => {
    const exit = await runInit({ slug: 'my-svc' });
    expect(exit).toBe(0);
    expect(existsSync(join(tmp, 'rntme.json'))).toBe(true);
    for (const f of ['manifest.json', 'pdm.json', 'qsm.json', 'graph-ir.json', 'bindings.json', 'ui.json', 'seed.json']) {
      expect(existsSync(join(tmp, 'artifacts', f))).toBe(true);
    }
  });

  it('substitutes service slug, default org/project placeholders', async () => {
    await runInit({ slug: 'my-svc' });
    const cfg = JSON.parse(readFileSync(join(tmp, 'rntme.json'), 'utf8'));
    expect(cfg.service).toBe('my-svc');
    expect(cfg.org).toBe('{{fill-me}}');
    expect(cfg.project).toBe('{{fill-me}}');
    expect(cfg.artifacts.pdm).toBe('artifacts/pdm.json');
  });

  it('substitutes org + project when provided', async () => {
    await runInit({ slug: 'api', org: 'acme', project: 'tracker' });
    const cfg = JSON.parse(readFileSync(join(tmp, 'rntme.json'), 'utf8'));
    expect(cfg.org).toBe('acme');
    expect(cfg.project).toBe('tracker');
  });

  it('refuses when rntme.json already exists', async () => {
    await runInit({ slug: 'one' });
    const exit = await runInit({ slug: 'two' });
    expect(exit).toBe(2);
  });

  it('rejects invalid slug', async () => {
    const exit = await runInit({ slug: 'X' }); // too short, uppercase
    expect(exit).toBe(2);
  });

  it('respects --artifacts-dir', async () => {
    await runInit({ slug: 'svc', artifactsDir: 'bundle' });
    expect(existsSync(join(tmp, 'bundle', 'pdm.json'))).toBe(true);
    const cfg = JSON.parse(readFileSync(join(tmp, 'rntme.json'), 'utf8'));
    expect(cfg.artifacts.pdm).toBe('bundle/pdm.json');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/commands/init.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement runInit**

Create `src/commands/init.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type InitArgs = {
  readonly slug: string;
  readonly org?: string | undefined;
  readonly project?: string | undefined;
  readonly artifactsDir?: string | undefined;
  readonly json?: boolean | undefined;
};

const SLUG_RE = /^[a-z0-9-]{3,60}$/;

const STARTER_FILES = [
  'manifest.json',
  'pdm.json',
  'qsm.json',
  'graph-ir.json',
  'bindings.json',
  'ui.json',
  'seed.json',
] as const;

function startersDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // src/commands/init.ts → ../skills/starters/
  // dist/commands/init.js → ../skills/starters/   (copy-skills-assets keeps this layout)
  return join(here, '..', 'skills', 'starters');
}

export async function runInit(args: InitArgs): Promise<number> {
  if (!SLUG_RE.test(args.slug)) {
    writeErr(args.json, 'CLI_INIT_INVALID_SLUG', `slug "${args.slug}" does not match ${SLUG_RE}`);
    return 2;
  }

  const cwd = process.cwd();
  if (existsSync(join(cwd, 'rntme.json'))) {
    writeErr(args.json, 'CLI_INIT_ALREADY_INITIALIZED', 'rntme.json already exists in this directory');
    return 2;
  }

  const artifactsDir = args.artifactsDir ?? 'artifacts';
  const org = args.org ?? '{{fill-me}}';
  const project = args.project ?? '{{fill-me}}';

  const tmplPath = join(startersDir(), 'rntme.json.tmpl');
  const tmpl = readFileSync(tmplPath, 'utf8')
    .replaceAll('{{org}}', org)
    .replaceAll('{{project}}', project)
    .replaceAll('{{service}}', args.slug)
    .replaceAll('{{artifactsDir}}', artifactsDir);

  writeFileSync(join(cwd, 'rntme.json'), tmpl);

  mkdirSync(join(cwd, artifactsDir), { recursive: true });
  for (const f of STARTER_FILES) {
    copyFileSync(join(startersDir(), 'artifacts', f), join(cwd, artifactsDir, f));
  }

  writeOk(args.json, { slug: args.slug, org, project, artifactsDir });
  return 0;
}

function writeOk(json: boolean | undefined, data: unknown): void {
  if (json) {
    process.stdout.write(JSON.stringify({ ok: true, data }) + '\n');
    return;
  }
  const d = data as { slug: string; org: string; project: string; artifactsDir: string };
  process.stdout.write(
    `✓ initialized rntme service "${d.slug}" (org: ${d.org}, project: ${d.project})\n` +
      `next:\n  1. edit rntme.json — set org and project\n  2. rntme skills install --agent <claude-code|cursor>\n  3. invoke Skill: using-rntme in your agent\n`,
  );
}

function writeErr(json: boolean | undefined, code: string, message: string): void {
  if (json) {
    process.stdout.write(JSON.stringify({ ok: false, error: { code, message } }) + '\n');
    return;
  }
  process.stderr.write(`error: ${code}: ${message}\n`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/commands/init.test.ts`
Expected: PASS (all 6). If the test fails on `startersDir()` resolution because assets haven't been copied to `dist/`, run tests with `vitest` directly (it runs from `src/`, not `dist/`) — should resolve to `src/skills/starters/` which exists.

- [ ] **Step 5: Commit**

```bash
git add rntme-cli/packages/cli/src/commands/init.ts \
        rntme-cli/packages/cli/test/unit/commands/init.test.ts
git commit -m "feat(cli): rntme init command"
```

---

## Task 7: `rntme skills install` command

Iterates all `.md` files in `src/skills/sources/` and renders each via the selected adapter.

**Files:**
- Create: `rntme-cli/packages/cli/src/commands/skills/install.ts`
- Test: `rntme-cli/packages/cli/test/unit/commands/skills/install.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/unit/commands/skills/install.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSkillsInstall } from '../../../../src/commands/skills/install.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCES = join(HERE, '../../../../src/skills/sources');

describe('runSkillsInstall', () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'rntme-install-'));
  });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('writes all skills to .claude/skills/rntme for claude-code', async () => {
    const exit = await runSkillsInstall({ agent: 'claude-code', target: tmp });
    expect(exit).toBe(0);
    expect(existsSync(join(tmp, '.claude/skills/rntme/using-rntme.md'))).toBe(true);
  });

  it('writes all skills to .cursor/rules/rntme for cursor', async () => {
    const exit = await runSkillsInstall({ agent: 'cursor', target: tmp });
    expect(exit).toBe(0);
    expect(existsSync(join(tmp, '.cursor/rules/rntme/using-rntme.mdc'))).toBe(true);
  });

  it('rejects unknown agent with exit 2', async () => {
    // @ts-expect-error testing runtime guard
    const exit = await runSkillsInstall({ agent: 'windsurf', target: tmp });
    expect(exit).toBe(2);
  });

  it('skips existing files without --force', async () => {
    await runSkillsInstall({ agent: 'claude-code', target: tmp });
    const path = join(tmp, '.claude/skills/rntme/using-rntme.md');
    writeFileSync(path, 'STALE');
    await runSkillsInstall({ agent: 'claude-code', target: tmp });
    expect(readFileSync(path, 'utf8')).toBe('STALE');
  });

  it('overwrites existing files with --force', async () => {
    await runSkillsInstall({ agent: 'claude-code', target: tmp });
    const path = join(tmp, '.claude/skills/rntme/using-rntme.md');
    writeFileSync(path, 'STALE');
    await runSkillsInstall({ agent: 'claude-code', target: tmp, force: true });
    expect(readFileSync(path, 'utf8')).not.toBe('STALE');
  });

  it('creates target dir if missing', async () => {
    const nested = join(tmp, 'nested');
    const exit = await runSkillsInstall({ agent: 'claude-code', target: nested });
    expect(exit).toBe(0);
    expect(existsSync(join(nested, '.claude/skills/rntme/using-rntme.md'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/commands/skills/install.test.ts`
Expected: FAIL — module missing AND (later) `using-rntme.md` source missing. Initial failure is module-not-found; subsequent failures once module exists will be because sources are empty. Skill sources are written in Tasks 12-20; this task's passing criterion is just "module exists and dispatches correctly." Adapt test to work with any present skills — see Step 3.

- [ ] **Step 3: Adjust test to be resilient to skill-count**

Replace the specific-file assertions in Step 1's test with "at least one skill was written":

```ts
// instead of: expect(existsSync(join(tmp, '.claude/skills/rntme/using-rntme.md'))).toBe(true);
// use:
import { readdirSync } from 'node:fs';
const dir = join(tmp, '.claude/skills/rntme');
expect(existsSync(dir)).toBe(true);
expect(readdirSync(dir).length).toBeGreaterThan(0);
```

Do the same for the cursor test block. The "using-rntme specifically exists" check moves to Task 21's integration test after all skills are written.

- [ ] **Step 4: Implement runSkillsInstall**

Create `src/commands/skills/install.ts`:

```ts
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claudeCodeAdapter } from '../../skills/adapters/claude-code.js';
import { cursorAdapter } from '../../skills/adapters/cursor.js';
import type { Adapter, AdapterName, SkillSource } from '../../skills/adapters/types.js';

const ADAPTERS: Record<AdapterName, Adapter> = {
  'claude-code': claudeCodeAdapter,
  cursor: cursorAdapter,
};

export type InstallArgs = {
  readonly agent: AdapterName | string;
  readonly target?: string | undefined;
  readonly force?: boolean | undefined;
  readonly json?: boolean | undefined;
};

function sourcesDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // src/commands/skills/install.ts → ../../skills/sources
  // dist/commands/skills/install.js → ../../skills/sources (post-tsc copy)
  return join(here, '..', '..', 'skills', 'sources');
}

function loadSources(): SkillSource[] {
  const dir = sourcesDir();
  const entries = readdirSync(dir, { withFileTypes: true });
  const out: SkillSource[] = [];
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    const body = readFileSync(join(dir, e.name), 'utf8');
    out.push({ fileName: e.name, body });
  }
  return out.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

export async function runSkillsInstall(args: InstallArgs): Promise<number> {
  const adapter = ADAPTERS[args.agent as AdapterName];
  if (!adapter) {
    writeErr(args.json, 'CLI_SKILLS_UNKNOWN_AGENT', `unknown agent "${args.agent}" (expected: claude-code | cursor)`);
    return 2;
  }
  const target = args.target ?? process.cwd();
  try {
    mkdirSync(target, { recursive: true });
  } catch (cause) {
    writeErr(args.json, 'CLI_SKILLS_TARGET_NOT_WRITABLE', `cannot create target dir ${target}: ${String(cause)}`);
    return 2;
  }

  const written: string[] = [];
  const skipped: string[] = [];
  for (const source of loadSources()) {
    const rendered = adapter.render(source);
    const outPath = join(target, rendered.relPath);
    if (existsSync(outPath) && !args.force) {
      skipped.push(rendered.relPath);
      continue;
    }
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, rendered.content);
    written.push(rendered.relPath);
  }

  writeOk(args.json, { agent: adapter.name, target, written, skipped });
  return 0;
}

function writeOk(json: boolean | undefined, data: { agent: string; target: string; written: string[]; skipped: string[] }): void {
  if (json) {
    process.stdout.write(JSON.stringify({ ok: true, data }) + '\n');
    return;
  }
  process.stdout.write(`✓ installed ${data.written.length} skills for ${data.agent}\n`);
  for (const p of data.written) process.stdout.write(`  → ${p}\n`);
  for (const p of data.skipped) process.stdout.write(`  · skipped ${p} (use --force to overwrite)\n`);
  process.stdout.write(`hint: in your agent, invoke Skill: using-rntme to start\n`);
}

function writeErr(json: boolean | undefined, code: string, message: string): void {
  if (json) {
    process.stdout.write(JSON.stringify({ ok: false, error: { code, message } }) + '\n');
    return;
  }
  process.stderr.write(`error: ${code}: ${message}\n`);
}
```

- [ ] **Step 5: Create placeholder source**

So tests have at least one skill to install. Create `src/skills/sources/using-rntme.md` with MINIMAL content (will be rewritten in Task 12):

```markdown
---
name: using-rntme
description: Use when starting work on a rntme service — navigator for the skill pack.
---

## Placeholder

This file is authored in Task 12.
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/commands/skills/install.test.ts`
Expected: PASS (all 6).

- [ ] **Step 7: Commit**

```bash
git add rntme-cli/packages/cli/src/commands/skills/install.ts \
        rntme-cli/packages/cli/src/skills/sources/using-rntme.md \
        rntme-cli/packages/cli/test/unit/commands/skills/install.test.ts
git commit -m "feat(cli): rntme skills install command with placeholder source"
```

---

## Task 8: Wire init + skills into dispatcher

Extend `src/bin/cli.ts` with new `switch` cases and update USAGE.

**Files:**
- Modify: `rntme-cli/packages/cli/src/bin/cli.ts`
- Test: `rntme-cli/packages/cli/test/unit/cli.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/unit/cli.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { main } from '../../src/bin/cli.js';

describe('cli dispatcher: init', () => {
  it('rejects missing slug', async () => {
    const code = await main(['init']);
    expect(code).toBe(1);
  });
});

describe('cli dispatcher: skills', () => {
  it('rejects unknown subcommand', async () => {
    const code = await main(['skills', 'foo']);
    expect(code).toBe(2);
  });

  it('rejects install without --agent', async () => {
    const code = await main(['skills', 'install']);
    expect(code).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/cli.test.ts`
Expected: FAIL — cases not yet wired (dispatcher returns "Unknown command").

- [ ] **Step 3: Add cases to dispatcher**

Edit `src/bin/cli.ts`:

**3a. Add imports at top of file (after existing runX imports):**

```ts
import { runInit } from '../commands/init.js';
import { runSkillsInstall } from '../commands/skills/install.js';
```

**3b. Add new parseArgs flags inside the `options: { ... }` block:**

```ts
// init + skills
'artifacts-dir': { type: 'string' },
agent: { type: 'string' },
target: { type: 'string' },
force: { type: 'boolean' },
```

**3c. Add new cases to the top-level switch, before the `default:` block:**

```ts
case 'init': {
  const slug = positionals[1];
  if (!slug) {
    process.stderr.write('Usage: rntme init <slug> [--org <s>] [--project <s>] [--artifacts-dir <p>]\n');
    return 1;
  }
  const initArgs: Parameters<typeof runInit>[0] = { slug };
  setIfDefined(initArgs, 'org', asString(values['org']));
  setIfDefined(initArgs, 'project', asString(values['project']));
  setIfDefined(initArgs, 'artifactsDir', asString(values['artifacts-dir']));
  setIfDefined(initArgs, 'json', asBool(values['json']));
  return runInit(initArgs);
}

case 'skills': {
  const sub = positionals[1];
  if (!sub) {
    process.stderr.write('Usage: rntme skills <install> ...\n');
    return 1;
  }
  switch (sub) {
    case 'install': {
      const agent = asString(values['agent']);
      if (!agent) {
        process.stderr.write('Usage: rntme skills install --agent <claude-code|cursor> [--target <p>] [--force]\n');
        return 1;
      }
      const installArgs: Parameters<typeof runSkillsInstall>[0] = { agent };
      setIfDefined(installArgs, 'target', asString(values['target']));
      setIfDefined(installArgs, 'force', asBool(values['force']));
      setIfDefined(installArgs, 'json', asBool(values['json']));
      return runSkillsInstall(installArgs);
    }
    default: {
      process.stderr.write(`Unknown skills subcommand: ${sub}\n`);
      return 2;
    }
  }
}
```

**3d. Update USAGE string to include these:**

```
  init <slug>             Scaffold rntme.json + artifacts/ in cwd
  skills install --agent  Install skill pack for the chosen agent
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/cli.test.ts`
Expected: PASS.

Run full test suite: `pnpm -F @rntme-cli/cli test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add rntme-cli/packages/cli/src/bin/cli.ts \
        rntme-cli/packages/cli/test/unit/cli.test.ts
git commit -m "feat(cli): wire init + skills install into dispatcher"
```

---

## Task 9: Post-tsc asset copy script

Ensures `src/skills/sources/**` and `src/skills/starters/**` ship alongside the compiled JS.

**Files:**
- Create: `rntme-cli/packages/cli/scripts/copy-skills-assets.cjs`
- Modify: `rntme-cli/packages/cli/package.json` (postbuild hook)

- [ ] **Step 1: Write the script**

Create `rntme-cli/packages/cli/scripts/copy-skills-assets.cjs`:

```js
#!/usr/bin/env node
/* eslint-env node */
const { cpSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const sources = join(root, 'src', 'skills', 'sources');
const starters = join(root, 'src', 'skills', 'starters');
const outSources = join(root, 'dist', 'skills', 'sources');
const outStarters = join(root, 'dist', 'skills', 'starters');

if (existsSync(sources)) {
  cpSync(sources, outSources, { recursive: true });
  console.log(`copied ${sources} → ${outSources}`);
}
if (existsSync(starters)) {
  cpSync(starters, outStarters, { recursive: true });
  console.log(`copied ${starters} → ${outStarters}`);
}
```

- [ ] **Step 2: Update package.json postbuild**

Modify `rntme-cli/packages/cli/package.json`. The existing `postbuild` is a one-liner `node -e ...` for shebang. Chain the asset-copy after it:

```json
"postbuild": "node -e \"const f='dist/bin/cli.js';const fs=require('fs');if(!fs.existsSync(f))process.exit(0);const s=fs.readFileSync(f,'utf8');if(!s.startsWith('#!'))fs.writeFileSync(f,'#!/usr/bin/env node\\n'+s);fs.chmodSync(f,0o755);\" && node scripts/copy-skills-assets.cjs",
```

- [ ] **Step 3: Verify the build copies assets**

Run: `pnpm -F @rntme-cli/cli build`
Expected: build succeeds; `dist/skills/sources/using-rntme.md` and `dist/skills/starters/rntme.json.tmpl` exist.

Verify:

```bash
ls rntme-cli/packages/cli/dist/skills/sources/
ls rntme-cli/packages/cli/dist/skills/starters/
```

- [ ] **Step 4: Commit**

```bash
git add rntme-cli/packages/cli/scripts/copy-skills-assets.cjs \
        rntme-cli/packages/cli/package.json
git commit -m "build(cli): copy skill sources + starters to dist after tsc"
```

---

## Task 10: Snapshot-generation script (preamble for schema-sync)

A CLI-invokable script that writes canonical forms of all `@rntme/*` schemas referenced by skills to `src/skills/verify/snapshots/*.txt`. Run by engineers when schemas change.

**Files:**
- Create: `rntme-cli/packages/cli/scripts/gen-skill-snapshots.cjs`
- Modify: `rntme-cli/packages/cli/package.json` (add `gen:snapshots` script)
- Create: `rntme-cli/packages/cli/src/skills/verify/snapshots/.gitkeep` (dir exists before any snapshot)

- [ ] **Step 1: Canonical-form helper**

The canonical form of a Zod schema is a stable string that changes iff the schema structurally changes. Simplest working impl: `JSON.stringify(zodToJsonSchema(schema), null, 2)` using `zod-to-json-schema` library. Since that adds a dep, prefer a hand-rolled walker.

Create inside the script (same file `gen-skill-snapshots.cjs`):

```js
#!/usr/bin/env node
/* eslint-env node */
const { writeFileSync, mkdirSync } = require('node:fs');
const { join } = require('node:path');

async function main() {
  // Use dynamic import() because this .cjs runs under node, but target packages are ESM.
  const pdm = await import('@rntme/pdm');
  const qsm = await import('@rntme/qsm');
  const bindings = await import('@rntme/bindings');
  const seed = await import('@rntme/seed');
  const graphIr = await import('@rntme/graph-ir-compiler');

  const targets = [
    { file: 'pdm.PdmArtifactSchema.txt',       schema: pdm.PdmArtifactSchema },
    { file: 'qsm.QsmArtifactSchema.txt',       schema: qsm.QsmArtifactSchema },
    { file: 'bindings.BindingArtifactSchema.txt', schema: bindings.BindingArtifactSchema },
    { file: 'seed.SeedArtifactSchema.txt',     schema: seed.SeedArtifactSchema },
    { file: 'graphIr.AuthoringSpecSchema.txt', schema: graphIr.AuthoringSpecSchema },
  ];

  const outDir = join(__dirname, '..', 'src', 'skills', 'verify', 'snapshots');
  mkdirSync(outDir, { recursive: true });

  for (const t of targets) {
    if (!t.schema) {
      throw new Error(`schema ${t.file} not exported by its package (check Task 10 preamble)`);
    }
    const canonical = canonicalize(t.schema._def);
    writeFileSync(join(outDir, t.file), canonical);
    console.log(`wrote ${t.file}`);
  }
}

function canonicalize(def, seen = new WeakSet()) {
  // Walk a Zod ._def tree, producing a stable JSON-ish string:
  //   typeName, keys (sorted), primitive facts.
  // Avoid cycles via WeakSet.
  if (def === null || typeof def !== 'object') return JSON.stringify(def);
  if (seen.has(def)) return '"<cycle>"';
  seen.add(def);
  const keys = Object.keys(def).filter((k) => k !== 'description').sort();
  const parts = keys.map((k) => {
    const v = def[k];
    if (v && typeof v === 'object' && '_def' in v) return `${JSON.stringify(k)}:${canonicalize(v._def, seen)}`;
    if (typeof v === 'function') return `${JSON.stringify(k)}:"<fn>"`;
    if (Array.isArray(v)) return `${JSON.stringify(k)}:[${v.map((x) => (x && typeof x === 'object' && '_def' in x ? canonicalize(x._def, seen) : canonicalize(x, seen))).join(',')}]`;
    if (v && typeof v === 'object') return `${JSON.stringify(k)}:${canonicalize(v, seen)}`;
    return `${JSON.stringify(k)}:${JSON.stringify(v)}`;
  });
  return `{${parts.join(',')}}`;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

**Note on exports:** this script names `pdm.PdmArtifactSchema`, `qsm.QsmArtifactSchema`, etc. Check these actually exist in each package. If they have different names (e.g., `pdm.ArtifactSchema`), adjust the `targets[]` accordingly. If they don't export a Zod schema at all (only a `parse` function), add a re-export to that package — this is a one-line change in `packages/<pkg>/src/index.ts`, permitted because it is additive.

- [ ] **Step 2: Add script to package.json**

Modify `rntme-cli/packages/cli/package.json`:

```json
"scripts": {
  ...
  "gen:snapshots": "node scripts/gen-skill-snapshots.cjs"
}
```

Also add `@rntme/*` as devDependencies (if not already transitively available):

```json
"devDependencies": {
  ...
  "@rntme/pdm": "workspace:*",
  "@rntme/qsm": "workspace:*",
  "@rntme/bindings": "workspace:*",
  "@rntme/seed": "workspace:*",
  "@rntme/graph-ir-compiler": "workspace:*"
}
```

- [ ] **Step 3: Run the script**

Run: `pnpm install --frozen-lockfile` (to pick up new devDeps — may fail, then run without `--frozen-lockfile` to update lockfile).

Run: `pnpm -F @rntme-cli/cli gen:snapshots`
Expected: 5 `.txt` files appear in `src/skills/verify/snapshots/`.

If any package is missing the expected schema export, add a `export { ... Schema }` line in the corresponding `packages/<pkg>/src/index.ts` and re-run.

- [ ] **Step 4: Commit**

```bash
git add rntme-cli/packages/cli/scripts/gen-skill-snapshots.cjs \
        rntme-cli/packages/cli/package.json \
        rntme-cli/packages/cli/src/skills/verify/snapshots/ \
        pnpm-lock.yaml \
        packages/  # if any index.ts was touched
git commit -m "feat(cli): gen:snapshots script + initial @rntme/* schema snapshots"
```

---

## Task 11: `schema-sync.ts` drift gate

Runs as a vitest test. Regenerates snapshots at test time (in-memory) and compares to committed files. Also scans skill sources for `ts pkg=X export=Y` blocks and asserts the snapshot exists.

**Files:**
- Create: `rntme-cli/packages/cli/src/skills/verify/schema-sync.ts`
- Test: `rntme-cli/packages/cli/test/unit/skills/verify/schema-sync.test.ts`
- Fixture: `rntme-cli/packages/cli/test/fixtures/skills/synthetic-skill-valid.md`
- Fixture: `rntme-cli/packages/cli/test/fixtures/skills/synthetic-skill-drift.md`

- [ ] **Step 1: Fixtures**

Create `test/fixtures/skills/synthetic-skill-valid.md`:

```markdown
---
name: synthetic-valid
description: Fixture referencing a real @rntme/* schema.
---

## Schema reference

```ts pkg=@rntme/pdm export=PdmArtifactSchema
// placeholder body — gate checks reference, not this text
```
```

Create `test/fixtures/skills/synthetic-skill-drift.md`:

```markdown
---
name: synthetic-drift
description: Fixture referencing a nonexistent export to trigger drift.
---

## Schema reference

```ts pkg=@rntme/pdm export=NoSuchSchema
// gate should fail because NoSuchSchema has no snapshot
```
```

- [ ] **Step 2: Write the failing test**

Create `test/unit/skills/verify/schema-sync.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSchemaSync } from '../../../../src/skills/verify/schema-sync.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '../../../fixtures/skills');

describe('runSchemaSync', () => {
  it('passes for the real sources directory (committed snapshots match live schemas)', async () => {
    const result = await runSchemaSync({ sourcesDir: join(HERE, '../../../../src/skills/sources') });
    expect(result.ok).toBe(true);
  });

  it('detects reference to unknown export', async () => {
    const result = await runSchemaSync({
      sourcesDir: FIXTURES,
      // fixture mode: scan both .md files in fixtures/skills/
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('NoSuchSchema'))).toBe(true);
  });
});
```

- [ ] **Step 3: Implement schema-sync**

Create `src/skills/verify/schema-sync.ts`:

```ts
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA_BLOCK_RE = /```ts\s+pkg=(\S+)\s+export=(\S+)\r?\n[\s\S]*?```/g;

export type SchemaSyncResult = { ok: true } | { ok: false; errors: string[] };

export type SchemaSyncArgs = {
  readonly sourcesDir: string;
};

function snapshotsDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, 'snapshots');
}

type Ref = { pkg: string; exportName: string; file: string };

function collectRefs(dir: string): Ref[] {
  const refs: Ref[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const body = readFileSync(join(dir, entry.name), 'utf8');
    for (const m of body.matchAll(SCHEMA_BLOCK_RE)) {
      refs.push({ pkg: m[1], exportName: m[2], file: entry.name });
    }
  }
  return refs;
}

function snapshotFileFor(pkg: string, exportName: string): string {
  // pkg is like "@rntme/pdm" → short "pdm"
  const short = pkg.replace(/^@rntme\//, '').replace(/-compiler$/, '');
  const safe = short === 'graph-ir' ? 'graphIr' : short;
  return `${safe}.${exportName}.txt`;
}

export async function runSchemaSync(args: SchemaSyncArgs): Promise<SchemaSyncResult> {
  const refs = collectRefs(args.sourcesDir);
  const errors: string[] = [];
  for (const ref of refs) {
    const expected = snapshotFileFor(ref.pkg, ref.exportName);
    const path = join(snapshotsDir(), expected);
    if (!existsSync(path)) {
      errors.push(
        `${ref.file}: references ${ref.pkg}.${ref.exportName}, but no snapshot at verify/snapshots/${expected}. ` +
          `Run \`pnpm -F @rntme-cli/cli gen:snapshots\` to regenerate.`,
      );
    }
  }

  // Also verify that current schemas match committed snapshots (drift check).
  const driftErrs = await verifySnapshotsMatchRuntime();
  errors.push(...driftErrs);

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

async function verifySnapshotsMatchRuntime(): Promise<string[]> {
  const errors: string[] = [];
  // Reuse canonicalize from gen-skill-snapshots.cjs logic. Inline here to avoid sharing:
  const { canonicalize } = await import('./canonicalize.js');
  const pairs = [
    { file: 'pdm.PdmArtifactSchema.txt',       load: async () => (await import('@rntme/pdm')).PdmArtifactSchema },
    { file: 'qsm.QsmArtifactSchema.txt',       load: async () => (await import('@rntme/qsm')).QsmArtifactSchema },
    { file: 'bindings.BindingArtifactSchema.txt', load: async () => (await import('@rntme/bindings')).BindingArtifactSchema },
    { file: 'seed.SeedArtifactSchema.txt',     load: async () => (await import('@rntme/seed')).SeedArtifactSchema },
    { file: 'graphIr.AuthoringSpecSchema.txt', load: async () => (await import('@rntme/graph-ir-compiler')).AuthoringSpecSchema },
  ];
  for (const p of pairs) {
    const path = join(snapshotsDir(), p.file);
    if (!existsSync(path)) continue; // caught above
    const committed = readFileSync(path, 'utf8');
    let schema;
    try {
      schema = await p.load();
    } catch (cause) {
      errors.push(`${p.file}: failed to import runtime schema (${String(cause)})`);
      continue;
    }
    const live = canonicalize(schema._def);
    if (live !== committed) {
      errors.push(
        `${p.file}: runtime schema does not match committed snapshot. ` +
          `A @rntme/* schema changed — run \`pnpm -F @rntme-cli/cli gen:snapshots\` ` +
          `and review skill files that reference this schema.`,
      );
    }
  }
  return errors;
}
```

Also create `src/skills/verify/canonicalize.ts` with the same function extracted from the cjs script:

```ts
export function canonicalize(def: unknown, seen: WeakSet<object> = new WeakSet()): string {
  if (def === null || typeof def !== 'object') return JSON.stringify(def);
  if (seen.has(def as object)) return '"<cycle>"';
  seen.add(def as object);
  const keys = Object.keys(def as object).filter((k) => k !== 'description').sort();
  const parts = keys.map((k) => {
    const v = (def as Record<string, unknown>)[k];
    if (v && typeof v === 'object' && '_def' in (v as object)) return `${JSON.stringify(k)}:${canonicalize((v as { _def: unknown })._def, seen)}`;
    if (typeof v === 'function') return `${JSON.stringify(k)}:"<fn>"`;
    if (Array.isArray(v)) return `${JSON.stringify(k)}:[${v.map((x) => (x && typeof x === 'object' && '_def' in (x as object) ? canonicalize((x as { _def: unknown })._def, seen) : canonicalize(x, seen))).join(',')}]`;
    if (v && typeof v === 'object') return `${JSON.stringify(k)}:${canonicalize(v, seen)}`;
    return `${JSON.stringify(k)}:${JSON.stringify(v)}`;
  });
  return `{${parts.join(',')}}`;
}
```

Also update `gen-skill-snapshots.cjs` to require this shared module — or keep the cjs copy as-is (accepted duplication; the cjs runs outside the TS test world).

- [ ] **Step 4: Run test**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/skills/verify/schema-sync.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add rntme-cli/packages/cli/src/skills/verify/schema-sync.ts \
        rntme-cli/packages/cli/src/skills/verify/canonicalize.ts \
        rntme-cli/packages/cli/test/unit/skills/verify/schema-sync.test.ts \
        rntme-cli/packages/cli/test/fixtures/skills/synthetic-skill-valid.md \
        rntme-cli/packages/cli/test/fixtures/skills/synthetic-skill-drift.md
git commit -m "feat(cli): schema-sync drift gate for skills"
```

---

## Task 12: `example-valid.ts` drift gate

Validates the canonical `examples/issue-tracker/` bundle and asserts every `json artifact=X` code block across all skills is JSON-deep-equal to the corresponding file.

**Files:**
- Create: `rntme-cli/packages/cli/src/skills/verify/example-valid.ts`
- Test: `rntme-cli/packages/cli/test/unit/skills/verify/example-valid.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/unit/skills/verify/example-valid.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runExampleValid } from '../../../../src/skills/verify/example-valid.js';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('runExampleValid', () => {
  it('passes: canonical bundle valid, every skill example matches', async () => {
    const result = await runExampleValid({
      sourcesDir: join(HERE, '../../../../src/skills/sources'),
    });
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.error(result.errors);
    }
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Implement example-valid**

Create `src/skills/verify/example-valid.ts`:

```ts
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBundle } from '@rntme-cli/platform-core';

const JSON_BLOCK_RE = /```json\s+artifact=(\S+)\r?\n([\s\S]*?)```/g;

const KEYS = ['manifest', 'pdm', 'qsm', 'graphIr', 'bindings', 'ui', 'seed'] as const;
const FILE_NAMES: Record<(typeof KEYS)[number], string> = {
  manifest: 'manifest.json',
  pdm: 'pdm.json',
  qsm: 'qsm.json',
  graphIr: 'graph-ir.json',
  bindings: 'bindings.json',
  ui: 'ui.json',
  seed: 'seed.json',
};

export type ExampleValidResult = { ok: true } | { ok: false; errors: string[] };
export type ExampleValidArgs = { readonly sourcesDir: string };

function examplesDir(sourcesDir: string): string {
  return join(sourcesDir, 'examples', 'issue-tracker');
}

function loadCanonicalBundle(dir: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of KEYS) {
    out[key] = JSON.parse(readFileSync(join(dir, FILE_NAMES[key]), 'utf8'));
  }
  return out;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonicalOrder(a)) === JSON.stringify(canonicalOrder(b));
}

function canonicalOrder(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(canonicalOrder);
  const obj = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) out[k] = canonicalOrder(obj[k]);
  return out;
}

export async function runExampleValid(args: ExampleValidArgs): Promise<ExampleValidResult> {
  const errors: string[] = [];

  // 1. Canonical bundle must validate.
  const bundleDir = examplesDir(args.sourcesDir);
  if (!existsSync(bundleDir)) {
    return { ok: false, errors: [`canonical bundle dir missing: ${bundleDir}`] };
  }
  const bundle = loadCanonicalBundle(bundleDir) as Parameters<typeof validateBundle>[0];
  const result = await validateBundle(bundle);
  if (!result.ok) {
    errors.push(`canonical bundle failed validateBundle: ${JSON.stringify(result.errors)}`);
  }

  // 2. Every json artifact=X block in skills must deep-equal the canonical file.
  const canonicalByName: Record<string, unknown> = {};
  for (const key of KEYS) canonicalByName[key] = bundle[key];
  // Also accept "graph-ir" as an alias for "graphIr"
  canonicalByName['graph-ir'] = bundle.graphIr;

  for (const entry of readdirSync(args.sourcesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
    const body = readFileSync(join(args.sourcesDir, entry.name), 'utf8');
    for (const m of body.matchAll(JSON_BLOCK_RE)) {
      const artifactName = m[1];
      const jsonText = m[2];
      const canon = canonicalByName[artifactName];
      if (canon === undefined) {
        errors.push(`${entry.name}: unknown artifact name "${artifactName}" in worked-example block`);
        continue;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch (cause) {
        errors.push(`${entry.name}: worked-example block (artifact=${artifactName}) is not valid JSON (${String(cause)})`);
        continue;
      }
      if (!deepEqual(parsed, canon)) {
        errors.push(
          `${entry.name}: worked-example for artifact=${artifactName} does not match canonical ` +
            `examples/issue-tracker/${FILE_NAMES[(artifactName === 'graph-ir' ? 'graphIr' : artifactName) as (typeof KEYS)[number]]}. ` +
            `Copy the canonical file verbatim into the skill.`,
        );
      }
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
```

- [ ] **Step 3: Run test**

Run: `pnpm -F @rntme-cli/cli vitest run test/unit/skills/verify/example-valid.test.ts`
Expected: PASS (no skills yet reference a json artifact= block, so the only assertion that runs is canonical-bundle-valid).

- [ ] **Step 4: Commit**

```bash
git add rntme-cli/packages/cli/src/skills/verify/example-valid.ts \
        rntme-cli/packages/cli/test/unit/skills/verify/example-valid.test.ts
git commit -m "feat(cli): example-valid drift gate for skills"
```

---

## Task 13: `using-rntme.md`

The navigator skill. Replaces the placeholder from Task 7. Thin — routes agent to the right next skill.

**Files:**
- Modify: `rntme-cli/packages/cli/src/skills/sources/using-rntme.md`

- [ ] **Step 1: Author**

Replace file with full navigator content. Template per spec §6:

```markdown
---
name: using-rntme
description: Use when starting work on a rntme service — navigator for the outside-in authoring pipeline (brief → UI+PDM → bindings → QSM+graph-IR → manifest → publish).
---

## What you're building
rntme services are authored as 7 declarative JSON artifacts (manifest, pdm, qsm, graph-ir, bindings, ui, seed) and published as a bundle. This skill routes you through the pipeline.

## Choose your mode

### New service mode
You ran `rntme init <slug>` and have empty-but-valid artifacts. Start with the brief.

  → Invoke Skill: brainstorming-rntme-service

### Quick-edit mode
You have an existing service bundle and want to change ONE artifact. Skip brainstorming. Cross-artifact consistency is your responsibility; `rntme validate` catches structural mismatches.

  → Invoke the matching skill:
    - change a screen/form/list → designing-ui
    - add an aggregate/event/command → designing-pdm
    - expose a new command/query → designing-bindings
    - add a projection / JOIN → designing-qsm
    - change query compilation → designing-graph-ir
    - bump metadata or wire services → composing-manifest
    - just publish → publishing-via-rntme-cli

## Red flags
| Thought | Reality |
|---|---|
| "I'll design PDM first" | PDM co-evolves with UI — do them together, not before. |
| "I'll start with QSM since projections are the hard part" | QSM is DERIVED from bindings. Bindings come before QSM. |
| "I'll skip validate between steps" | Validate after every artifact change. Compounding errors are hard to debug. |
| "I'll write graph-ir before QSM is stable" | Graph-ir lowers QSM queries. Stabilise QSM shape first, then author graph-ir for it. |

## Checklist
1. Confirm you have `rntme.json` in your cwd. Missing → run `rntme init <slug>` first.
2. Decide: new service (full pipeline) vs quick-edit (single skill).
3. Invoke the matching Skill; do not freelance.
4. After each design-skill completes, run `rntme validate`. Do not advance until exit 0.
5. Never edit @rntme/* packages to make validate pass — edit the artifact.

## Anti-patterns
- Starting without `rntme init` (no rntme.json to anchor paths).
- Editing multiple artifacts simultaneously without validating between them.
- Calling `rntme publish` before a clean `rntme validate`.

## Validation & self-review
This skill produces no artifact. Exit when you have invoked the next skill.

## Next step
- New service → Invoke Skill: brainstorming-rntme-service
- Quick-edit → Invoke the matching designing-* skill directly
```

- [ ] **Step 2: Verify gates still pass**

Run: `pnpm -F @rntme-cli/cli test`
Expected: all tests pass (using-rntme has no `ts pkg=` or `json artifact=` blocks, so drift gates are trivially ok).

- [ ] **Step 3: Commit**

```bash
git add rntme-cli/packages/cli/src/skills/sources/using-rntme.md
git commit -m "feat(skills): using-rntme navigator"
```

---

## Task 14: `brainstorming-rntme-service.md`

Standalone brainstorming skill (not a wrapper over superpowers:brainstorming). Asks discovery questions rntme-specific: aggregates, use-cases, UI-or-not, read models.

**Files:**
- Create: `rntme-cli/packages/cli/src/skills/sources/brainstorming-rntme-service.md`

- [ ] **Step 1: Author**

```markdown
---
name: brainstorming-rntme-service
description: Use after `rntme init`, before any designing-* skill. Turns a natural-language idea into a structured brief — aggregates, use-cases, UI style, read models — that later skills reference.
---

## What you're building
A brief (`brief.md`) in the service root documenting the domain and use-cases at a level concrete enough to author UI+PDM from it. This is NOT a full spec — it is an anchor the other skills consult.

## Checklist
1. Read or collect from the user the NL idea ("issue tracker for Acme's SRE team").
2. Ask one question at a time to fill the brief template (see Worked example below).
3. Write `brief.md` in the service root (same dir as `rntme.json`).
4. Confirm brief with user; iterate on unclear sections.
5. Invoke paired skills (`designing-ui` + `designing-pdm`) in parallel.

## Red flags
| Thought | Reality |
|---|---|
| "I'll just guess the aggregates" | No — ask explicitly what "things" exist in the domain. |
| "User said 'issues and comments', I'll skip Q&A" | Confirm 2-3 key use-cases anyway; half-specified briefs produce wrong PDMs. |
| "I'll skip the UI question if backend-only" | Every rntme service has UI artifact. If truly no UI, brief says "headless" and `designing-ui` authors a placeholder. |
| "I'll include SQL queries in the brief" | No — those go in graph-ir later. Brief is domain-level. |

## Brief template (what you're producing)

```markdown
# <service-name> brief

## Purpose
<1-2 sentences: what this service does for whom>

## Aggregates (likely)
- <AggregateA> — <1 sentence>
- <AggregateB> — ...

## Use-cases
1. <Actor> <does> <thing>, resulting in <outcome>
2. ...

## Read models (what consumers need to see)
- <List or detail view> — <fields>
- ...

## UI style
<"admin back-office" | "consumer" | "headless" | other>

## Out of scope
- <things explicitly not in v1>
```

## Worked example

User said: "I want an issue tracker for our team."

Brief after Q&A:

```markdown
# issue-tracker brief

## Purpose
Minimal issue tracker for Acme's platform team. Replaces a shared spreadsheet.

## Aggregates (likely)
- Issue — a unit of work with status and owner
- Comment — discussion attached to an issue

## Use-cases
1. Team member opens an issue with title + description
2. Team member assigns an owner
3. Team member adds comments to an issue
4. Anyone closes an issue (marks resolved)
5. Team lead views all open issues assigned to a person

## Read models
- List of open issues (title, owner, updated-at)
- Issue detail page (all fields + comment thread)

## UI style
Admin back-office — table + detail pages, no public pages.

## Out of scope
- Notifications / email
- Attachments
- SLA tracking
```

## Anti-patterns
- Skipping the "out of scope" section. Without explicit cuts, the agent will keep expanding.
- Naming aggregates as verbs (`CreateIssue`) — those are commands, not aggregates.
- Including field-level schema here (that's PDM's job).

## Validation & self-review
Before exiting:
- Brief file exists at `<service-root>/brief.md`.
- At least 2 aggregates listed.
- At least 3 use-cases listed.
- UI style declared.
- User confirmed "looks right".

## Next step
Invoke in parallel: Skill: designing-ui AND Skill: designing-pdm.
They co-evolve — iterate between them before advancing to designing-bindings.
```

- [ ] **Step 2: Verify**

Run: `pnpm -F @rntme-cli/cli test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add rntme-cli/packages/cli/src/skills/sources/brainstorming-rntme-service.md
git commit -m "feat(skills): brainstorming-rntme-service"
```

---

## Task 15: `designing-pdm.md`

**Files:**
- Create: `rntme-cli/packages/cli/src/skills/sources/designing-pdm.md`

- [ ] **Step 1: Gather schema + example inputs**

Read:
- `packages/pdm/README.md` — authoring convention.
- `packages/pdm/src/schema.ts` (or equivalent) — the Zod source for `PdmArtifactSchema`.
- `src/skills/sources/examples/issue-tracker/pdm.json` — the canonical worked example (Task 4).
- Existing `@rntme/pdm` error codes (`PDM_STRUCTURAL_*`, etc.).

- [ ] **Step 2: Author**

Template per spec §6. Concrete directives for each section:

- **frontmatter** — `name: designing-pdm`, `description: Use when authoring or revising artifacts/pdm.json (aggregates, events, commands). Paired with designing-ui; both produce artifacts under the brief from brainstorming-rntme-service.`
- **What you're building** — 2-3 sentences explaining PDM as domain noun/event/command definitions that every other artifact references by name.
- **Checklist** — 6-8 TodoWrite-per-item steps from "read brief.md" to "run rntme validate". Include: list candidate aggregates, for each list fields/commands/events, check UI skill's actions map to commands, write to `artifacts/pdm.json`, run validate.
- **Red flags** — at least 4 rows. Include: derived fields, shared fields, command=event naming, UI-state-in-events.
- **Schema reference** — fenced block `ts pkg=@rntme/pdm export=PdmArtifactSchema` with the **verbatim** Zod/TS source copied from `packages/pdm/src/schema.ts`. Do not paraphrase — literal copy so `schema-sync.ts` drift detection is tight if the package changes.
- **Worked example** — fenced block `json artifact=pdm` with the **verbatim** contents of `src/skills/sources/examples/issue-tracker/pdm.json`. (example-valid.ts will assert equality.) Add prose walkthrough: why `Issue` has which fields, how `IssueOpened` becomes a projection row later.
- **Anti-patterns** — 5+ bullets. Include: storing UI state, events referencing other aggregates by value (use FK), commands without corresponding events, fields not declared in aggregate schema.
- **Validation & self-review** — concrete: re-read brief, run `rntme validate`, fix any `PDM_*` codes.
- **Next step** — explicit: "Once BOTH this skill and designing-ui pass validation, invoke Skill: designing-bindings."

- [ ] **Step 3: Verify gates**

Run: `pnpm -F @rntme-cli/cli test`
Expected: PASS. If `example-valid` fails, the JSON block body does not match `examples/issue-tracker/pdm.json` — fix (usually whitespace). If `schema-sync` fails, the snapshot is out of date — run `pnpm gen:snapshots` then re-commit.

- [ ] **Step 4: Commit**

```bash
git add rntme-cli/packages/cli/src/skills/sources/designing-pdm.md
git commit -m "feat(skills): designing-pdm"
```

---

## Task 16: `designing-ui.md`

**Files:**
- Create: `rntme-cli/packages/cli/src/skills/sources/designing-ui.md`

- [ ] **Step 1: Gather**

Read:
- `packages/ui/README.md`, `packages/ui-runtime/README.md`.
- `docs/superpowers/specs/done/2026-04-16-ui-artifact-v2-design.md`.
- Canonical example `src/skills/sources/examples/issue-tracker/ui.json`.
- `packages/ui/src/schema.ts` (source of UI Zod).

- [ ] **Step 2: Author**

Template per spec §6. Directives:

- **frontmatter** — `name: designing-ui`, `description: Use when authoring artifacts/ui.json (pages, components, forms, lists). Paired with designing-pdm; every UI action must map to a PDM command.`
- **What you're building** — 2-3 sentences: UI JSON declares pages with components, bound to commands+queries from bindings.
- **Checklist** — 6-8 items: read brief, list pages from use-cases, for each page list components (list/detail/form), map form fields to future PDM fields, write ui.json, validate. Sync-point note: ask designing-pdm author to name the command for each form-submit.
- **Red flags** — 4+ rows. Include: UI action with no corresponding PDM command, fields in UI that don't exist in PDM aggregate, hard-coded IDs instead of bindings, pages without routes.
- **Schema reference** — `ts pkg=@rntme/ui export=<actual export name>` with verbatim Zod.
- **Worked example** — `json artifact=ui` verbatim from canonical bundle.
- **Anti-patterns** — 5+. Include: embedding business logic in UI, client-side state that should be an event, duplicating PDM structure inline.
- **Validation & self-review** — run validate, fix `UI_*` codes.
- **Next step** — "When BOTH this skill and designing-pdm are green, invoke Skill: designing-bindings."

- [ ] **Step 3: Verify gates + Commit**

Run tests. Commit as:

```bash
git add rntme-cli/packages/cli/src/skills/sources/designing-ui.md
git commit -m "feat(skills): designing-ui"
```

---

## Task 17: `designing-bindings.md`

**Files:**
- Create: `rntme-cli/packages/cli/src/skills/sources/designing-bindings.md`

- [ ] **Step 1: Gather**

Read:
- `packages/bindings/README.md`, `packages/bindings-http/README.md`.
- `packages/bindings/src/schema.ts` for `BindingArtifactSchema`.
- Canonical `examples/issue-tracker/bindings.json`.
- Spec for cmd/query surface: `docs/superpowers/specs/done/2026-04-19-platform-api-design.md` adjacent work.

- [ ] **Step 2: Author**

Template per spec §6. Directives:

- **frontmatter** — `name: designing-bindings`, `description: Use after designing-ui + designing-pdm. Authors artifacts/bindings.json — the public HTTP surface: commands + queries, derived from UI actions and PDM commands.`
- **What you're building** — bindings = derived contract. Commands mirror PDM command declarations with HTTP method + path; queries mirror UI list/detail pages.
- **Checklist** — from UI: list every action → bind to a PDM command. From UI: list every list/detail view → bind to a query. Declare request/response shapes (references PDM aggregate fields). Write bindings.json. Validate.
- **Red flags** — 4+. Include: command path not REST-y, query without a projection (QSM will be orphan), shape referencing non-existent PDM entity.
- **Schema reference** — verbatim from `@rntme/bindings`.
- **Worked example** — verbatim from canonical bundle.
- **Anti-patterns** — 5+. Include: exposing PDM internals directly (always use explicit shapes), commands without pre-fetch middleware when they need one, coupling query shape to one specific projection.
- **Validation & self-review** — run validate, fix `BINDINGS_*` codes.
- **Next step** — "Invoke in parallel: Skill: designing-qsm AND Skill: designing-graph-ir."

- [ ] **Step 3: Verify + Commit**

```bash
git add rntme-cli/packages/cli/src/skills/sources/designing-bindings.md
git commit -m "feat(skills): designing-bindings"
```

---

## Task 18: `designing-qsm.md`

**Files:**
- Create: `rntme-cli/packages/cli/src/skills/sources/designing-qsm.md`

- [ ] **Step 1: Gather**

Read:
- `packages/qsm/README.md`, including post-2026-04-16 relation metadata migration (JOINs).
- `packages/qsm/src/schema.ts` for `QsmArtifactSchema`.
- Canonical `examples/issue-tracker/qsm.json`.
- `docs/superpowers/specs/done/2026-04-16-qsm-relations-migration-design.md`.

- [ ] **Step 2: Author**

Template. Directives:

- **frontmatter** — `name: designing-qsm`, `description: Use after designing-bindings. Paired with designing-graph-ir. Authors artifacts/qsm.json — projections (read tables) + relations (JOIN metadata) derived from queries declared in bindings.`
- **What you're building** — QSM defines read-side tables the event-sourced projection consumer materialises. Each projection has columns; relations declare FK edges for JOINs.
- **Checklist** — from bindings queries: list projections needed. For each: columns, primary key, event handlers (which PDM events mutate which columns). From shared entities: declare relations with cardinality. Write qsm.json. Validate.
- **Red flags** — 4+. Include: orphan projection (no query uses it — YAGNI), projection without event handler (cannot be populated), relation to nonexistent projection.
- **Schema reference** — verbatim.
- **Worked example** — verbatim.
- **Anti-patterns** — 5+. Include: caching derived values that graph-ir can compute on read, duplicating PDM field types manually (always reference), including mutable state in projection primary key.
- **Validation & self-review** — run validate, fix `QSM_*` codes.
- **Next step** — "When BOTH this skill and designing-graph-ir are green, invoke Skill: composing-manifest."

- [ ] **Step 3: Verify + Commit**

```bash
git add rntme-cli/packages/cli/src/skills/sources/designing-qsm.md
git commit -m "feat(skills): designing-qsm"
```

---

## Task 19: `designing-graph-ir.md`

**Files:**
- Create: `rntme-cli/packages/cli/src/skills/sources/designing-graph-ir.md`

- [ ] **Step 1: Gather**

Read:
- `graph_ir_rc_7.md` at repo root (the IR spec — **do not** edit it to match your understanding; it is source of truth).
- `packages/graph-ir-compiler/README.md`.
- `packages/graph-ir-compiler/src/schema.ts` for `AuthoringSpecSchema`.
- Canonical `examples/issue-tracker/graph-ir.json`.
- memory: `rntme_graph_ir_rc7_not_canon.md` — rc7 was first-step IR spec; later specs supersede; read `AGENTS.md` §7 context.

- [ ] **Step 2: Author**

Template. Directives:

- **frontmatter** — `name: designing-graph-ir`, `description: Use after designing-bindings. Paired with designing-qsm. Authors artifacts/graph-ir.json — the dataflow graphs that compile query bindings to SQLite and execute command bindings against the event store.`
- **What you're building** — graph-ir is an authoring-spec tree per rc7 (shapes, graphs, nodes). Each binding query → one graph (lowers to SELECT on QSM tables). Each binding command → one graph (reads state, emits events).
- **Checklist** — from bindings: list every query + command. For each: pick graph shape (rowset/row for queries, emit for commands), reference QSM tables for reads, reference PDM for event emission. Use predicate_optional correctly (see memory: `rntme_predicate_optional_bug`). Write graph-ir.json. Validate.
- **Red flags** — 4+. Include: predicate_optional mixed with fixed params in wrong position, cross-service joins (forbidden — use orchestration per memory: `rntme_orchestration_only`), writing custom SQL instead of using normal nodes, referencing nonexistent QSM column.
- **Schema reference** — verbatim from `@rntme/graph-ir-compiler`.
- **Worked example** — verbatim from canonical.
- **Anti-patterns** — 5+. Include: graph without `output.type` matching binding response shape, emit node with event type not in PDM, runtime-only fields leaking into graph signatures.
- **Validation & self-review** — run validate, fix GRAPH_IR_* codes.
- **Next step** — "When BOTH this skill and designing-qsm are green, invoke Skill: composing-manifest."

- [ ] **Step 3: Verify + Commit**

```bash
git add rntme-cli/packages/cli/src/skills/sources/designing-graph-ir.md
git commit -m "feat(skills): designing-graph-ir"
```

---

## Task 20: `composing-manifest.md`

**Files:**
- Create: `rntme-cli/packages/cli/src/skills/sources/composing-manifest.md`

- [ ] **Step 1: Gather**

Read:
- `packages/runtime/README.md` and `packages/runtime/src/manifest*.ts` — manifest schema.
- Canonical `examples/issue-tracker/manifest.json`.

- [ ] **Step 2: Author**

Template. Directives:

- **frontmatter** — `name: composing-manifest`, `description: Use after all other artifacts pass rntme validate. Authors artifacts/manifest.json — the index over the other 6 artifacts plus org/project/service identity and plugin seam config.`
- **What you're building** — manifest declares service identity, artifact pointers, and plugin seam config (DbDriver, EventBus, Surface). rntme runtime consumes it to boot.
- **Checklist** — set org/project/service from brief. Confirm all 6 other artifacts exist. Declare plugin defaults (BetterSqliteDriver, InMemoryBus, HttpSurface) unless overriding. Write manifest.json. Validate entire bundle.
- **Red flags** — 3+. Include: manifest paths do not match rntme.json, plugin override to Postgres (forbidden per CLAUDE.md — SQLite/Turso only), service name mismatch with seed events.
- **Schema reference** — verbatim from manifest schema module.
- **Worked example** — verbatim from canonical.
- **Anti-patterns** — 4+. Include: embedding schemas in manifest, per-environment branching in manifest (use env vars), runtime-only fields in author-time manifest.
- **Validation & self-review** — final `rntme validate` — entire bundle green.
- **Next step** — "Invoke Skill: publishing-via-rntme-cli."

- [ ] **Step 3: Verify + Commit**

```bash
git add rntme-cli/packages/cli/src/skills/sources/composing-manifest.md
git commit -m "feat(skills): composing-manifest"
```

---

## Task 21: `publishing-via-rntme-cli.md`

Terminal skill. No schema-ref. Worked example is a terminal transcript.

**Files:**
- Create: `rntme-cli/packages/cli/src/skills/sources/publishing-via-rntme-cli.md`

- [ ] **Step 1: Author**

```markdown
---
name: publishing-via-rntme-cli
description: Use after composing-manifest when the bundle passes rntme validate and you want to publish. Walks validate → publish → tag → verify, with error-code mapping.
---

## What you're building
No artifact. A successful `rntme publish` call that returns a version seq, sets requested tags, and echoes a bundleDigest matching the local digest.

## Checklist
1. Final `rntme validate` from service root — exit 0, no warnings.
2. Confirm credentials: `rntme whoami` — prints org + scopes; matches rntme.json's org.
3. `rntme publish --tag <name> --message "<what changed>"` — expects 201 with seq.
4. Re-run the same publish — expects 200 "idempotent replay", same seq.
5. `rntme version show <seq>` — confirm bundleDigest matches local.
6. If additional tags: `rntme tag set <name> <seq>` (atomic, server-side).

## Red flags
| Thought | Reality |
|---|---|
| "I'll skip validate — publish will catch it" | Server validate IS authoritative but local validate is faster feedback. |
| "422 means retry" | No — 422 means fix the bundle. 409 is the retry case. |
| "I'll force-overwrite with --force" | There is no --force for publish. `(service_id, bundleDigest)` is idempotent by design; re-run is always safe. |
| "I'll delete a tag to move it" | Use `rntme tag set` — atomic. Delete-then-set is racy. |

## Worked example

```bash
$ rntme validate
✓ bundle valid (7 artifacts, bundleDigest=c3a1...d9e2)

$ rntme whoami
{ org: acme, account: you@acme.com, role: admin }

$ rntme publish --tag preview --message "add Comment aggregate"
✓ published seq=3 (bundleDigest=c3a1...d9e2) tag=preview

$ rntme publish --tag preview
✓ idempotent replay seq=3 (same bundleDigest)

$ rntme version show 3
seq=3, publishedAt=..., tags=[preview], digest=c3a1...d9e2
```

## Exit-code table

| Exit | Meaning | Action |
|---|---|---|
| 0 | success | — |
| 2 | config/credentials problem | check rntme.json, `rntme login --token -` |
| 3 | auth failed | refresh PAT |
| 4 | forbidden/scope | widen token scopes |
| 5 | not found / archived | check project/service slugs |
| 6 | validation failed (local or server) | fix the artifact per nested error codes |
| 7 | concurrent publish | re-run; idempotency-key protects |
| 8 | rate limited | wait and retry |
| 9 | network error | retry |
| 10 | 5xx from platform | retry |

## Anti-patterns
- Committing credentials into the repo (use `rntme login`).
- Publishing without a `--message` for non-trivial changes (audit log needs it).
- Using `--previous-version-seq` without reading its meaning (it's a race-guard, not a rollback).

## Validation & self-review
Exit when: `rntme version show <seq>` returns the just-published version with the expected tags.

## Next step
Terminal. If iterating: return to the relevant designing-* skill, edit, re-validate, re-publish.
```

- [ ] **Step 2: Verify + Commit**

```bash
pnpm -F @rntme-cli/cli test
git add rntme-cli/packages/cli/src/skills/sources/publishing-via-rntme-cli.md
git commit -m "feat(skills): publishing-via-rntme-cli (terminal)"
```

---

## Task 22: Integration test + e2e smoke + README

Wire the full bootstrap path end-to-end.

**Files:**
- Create: `rntme-cli/packages/cli/test/integration/skills-install.test.ts`
- Create: `rntme-cli/packages/cli/test/integration/skills-chain.test.ts`
- Create: `rntme-cli/packages/cli/test/e2e/skills-smoke.test.ts`
- Modify: `rntme-cli/packages/cli/README.md`

- [ ] **Step 1: Integration — full install per agent**

Create `test/integration/skills-install.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runSkillsInstall } from '../../src/commands/skills/install.js';

const EXPECTED = [
  'using-rntme',
  'brainstorming-rntme-service',
  'designing-ui',
  'designing-pdm',
  'designing-bindings',
  'designing-qsm',
  'designing-graph-ir',
  'composing-manifest',
  'publishing-via-rntme-cli',
];

describe('skills install — full set', () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'rntme-int-')); });
  afterEach(() => rmSync(tmp, { recursive: true, force: true }));

  it('claude-code: installs all 9 skills', async () => {
    await runSkillsInstall({ agent: 'claude-code', target: tmp });
    const dir = join(tmp, '.claude/skills/rntme');
    const files = readdirSync(dir).sort();
    expect(files).toHaveLength(9);
    for (const name of EXPECTED) {
      expect(files).toContain(`${name}.md`);
    }
  });

  it('cursor: installs all 9 skills as .mdc', async () => {
    await runSkillsInstall({ agent: 'cursor', target: tmp });
    const dir = join(tmp, '.cursor/rules/rntme');
    const files = readdirSync(dir).sort();
    expect(files).toHaveLength(9);
    for (const name of EXPECTED) {
      expect(files).toContain(`${name}.mdc`);
    }
    // frontmatter injection check
    const sample = readFileSync(join(dir, 'using-rntme.mdc'), 'utf8');
    expect(sample).toContain('alwaysApply: false');
    expect(sample).toContain('globs:');
  });
});
```

- [ ] **Step 2: Integration — skill chain is connected**

Create `test/integration/skills-chain.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCES = join(HERE, '../../src/skills/sources');

describe('skills chain graph', () => {
  it('every Next-step reference targets an existing skill', () => {
    const files = readdirSync(SOURCES).filter((f) => f.endsWith('.md'));
    const names = new Set(files.map((f) => f.replace(/\.md$/, '')));

    const skillRefRe = /Skill:\s+([a-z-]+)/g;
    const unknown: string[] = [];
    for (const f of files) {
      const body = readFileSync(join(SOURCES, f), 'utf8');
      for (const m of body.matchAll(skillRefRe)) {
        const ref = m[1];
        if (!names.has(ref)) unknown.push(`${f}: references unknown skill "${ref}"`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('every non-terminal skill has a "Next step" section', () => {
    const files = readdirSync(SOURCES).filter((f) => f.endsWith('.md'));
    const missing: string[] = [];
    for (const f of files) {
      const body = readFileSync(join(SOURCES, f), 'utf8');
      if (!body.includes('## Next step')) missing.push(f);
    }
    expect(missing).toEqual([]);
  });

  it('every skill description starts with "Use when"', () => {
    const files = readdirSync(SOURCES).filter((f) => f.endsWith('.md'));
    const bad: string[] = [];
    for (const f of files) {
      const body = readFileSync(join(SOURCES, f), 'utf8');
      const m = /description:\s+([^\n]+)/.exec(body);
      if (!m || !m[1].startsWith('Use ')) bad.push(f);
    }
    expect(bad).toEqual([]);
  });
});
```

- [ ] **Step 3: E2E smoke**

Create `test/e2e/skills-smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../../src/bin/cli.js';

describe('skills smoke (e2e, no network)', () => {
  it('init + skills install + validate', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'rntme-e2e-'));
    const origCwd = process.cwd();
    try {
      process.chdir(tmp);
      expect(await main(['init', 'smoke-svc'])).toBe(0);
      expect(await main(['skills', 'install', '--agent', 'claude-code'])).toBe(0);
      expect(existsSync(join(tmp, '.claude/skills/rntme/using-rntme.md'))).toBe(true);
      expect(existsSync(join(tmp, 'rntme.json'))).toBe(true);
      expect(existsSync(join(tmp, 'artifacts/pdm.json'))).toBe(true);
      // validate the scaffold (no network)
      const validateExit = await main(['validate']);
      expect(validateExit).toBe(0);
    } finally {
      process.chdir(origCwd);
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 4: README update**

Append to `rntme-cli/packages/cli/README.md`:

```markdown
## Bootstrapping a new service

```bash
rntme init my-svc --org acme --project tracker
rntme skills install --agent claude-code   # or --agent cursor
```

In your agent, invoke `Skill: using-rntme`. The pack routes through:
brainstorming-rntme-service → designing-ui + designing-pdm → designing-bindings → designing-qsm + designing-graph-ir → composing-manifest → publishing-via-rntme-cli.

### `rntme init <slug>`

Scaffolds `rntme.json` + 7 empty-but-valid artifact files. Flags: `--org`, `--project`, `--artifacts-dir`. Refuses to overwrite existing `rntme.json`.

### `rntme skills install --agent <name>`

Installs the 9-skill pack. Agents: `claude-code` (→ `.claude/skills/rntme/*.md`), `cursor` (→ `.cursor/rules/rntme/*.mdc`). Flags: `--target <path>`, `--force`.
```

- [ ] **Step 5: Run full suite + e2e**

```bash
pnpm -F @rntme-cli/cli test
pnpm -F @rntme-cli/cli test:e2e
pnpm -F @rntme-cli/cli typecheck
pnpm -F @rntme-cli/cli lint
pnpm -F @rntme-cli/cli build
```

All expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add rntme-cli/packages/cli/test/integration/skills-install.test.ts \
        rntme-cli/packages/cli/test/integration/skills-chain.test.ts \
        rntme-cli/packages/cli/test/e2e/skills-smoke.test.ts \
        rntme-cli/packages/cli/README.md
git commit -m "test(cli): integration + e2e for skills pack; README updated"
```

---

## Final verification

After all tasks:

```bash
pnpm -r run typecheck
pnpm -r run test
pnpm -r run lint
pnpm -F @rntme-cli/cli build
pnpm -F @rntme-cli/cli test:e2e

# Manual smoke:
cd $(mktemp -d)
node /path/to/rntme-cli/packages/cli/dist/bin/cli.js init smoke --org demo --project x
node /path/to/rntme-cli/packages/cli/dist/bin/cli.js skills install --agent claude-code
ls .claude/skills/rntme/   # 9 files
node /path/to/rntme-cli/packages/cli/dist/bin/cli.js validate
```

Then commit the submodule bump on the parent repo to advance `rntme-cli` pointer.
