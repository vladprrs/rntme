# Audit Waves Build-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce `docs/audit/00-waves.md` — the consolidated, verified, triaged, wave-ordered planning document built from the architecture audit corpus in `docs/audit/`.

**Architecture:** Eight sequential phases, each internally parallel where possible. Phase 1 extracts atomic findings from 32 audit files into a working JSON ledger. Phase 2 verifies findings via per-package Explore agents using smart-sampling policy. Phase 3 verifies systemic monorepo findings via tooling. Phase 4 triages each verified finding through the decision tree. Phase 5 deduplicates across audits and identifies cross-cutting themes. Phase 6 assembles units into waves and validates invariants. Phase 7 renders the working JSON into the final markdown document. Phase 8 performs final validation and commits.

**Tech Stack:** Node 20+, pnpm 9.12+ (for tooling-based systemic verification: `pnpm ls`, `pnpm why`); `git` (for `git log` / `git submodule status` checks); Bash (for invariant grep checks); `jq` (for working-ledger manipulation); Explore agents (for parallel per-package verification).

**Source spec:** `docs/superpowers/specs/done/2026-04-28-audit-consolidation-and-waves-design.md`.

**Out of scope for this plan:** Writing fixes for any audit finding. Estimating effort. Discovering new findings outside what falls into evidence verification (per spec §6 E3 — adjacent findings during verification ARE in scope, but expanded exploration is not). Editing original audit snapshots.

---

## File Structure

### Final deliverable

```
docs/audit/00-waves.md                   # the consolidated planning document
```

### Working artifacts (intermediate, gitignored)

```
.tmp/audit-waves/
├── ledger.json                          # working JSON ledger across phases 1-6
├── verification-reports/                # per-package agent outputs
│   ├── runtime.json
│   ├── graph-ir-compiler.json
│   └── ... (one per audited package)
└── invariant-check.log                  # output of phase-8 validation
```

### Plan-related files

```
docs/superpowers/plans/done/2026-04-28-audit-waves-buildout.md   # this plan
```

---

## Phase 0 — Setup

### Task 0.1: Branch + working directory

**Files:**
- Create: `.tmp/audit-waves/` (working directory, gitignored)

- [ ] **Step 1: Create a feature branch off main**

```bash
git checkout -b feat/audit-waves-buildout
git status
```

Expected: clean working tree on new branch `feat/audit-waves-buildout`.

- [ ] **Step 2: Create working directory and confirm `.tmp/` is gitignored**

```bash
mkdir -p .tmp/audit-waves/verification-reports
grep -q '^\.tmp/$\|^\.tmp$' .gitignore || echo ".tmp/" >> .gitignore
git status --short | grep -E '^\?\? \.tmp/' && echo "tmp dir is untracked (expected)"
```

Expected: `.tmp/` is in `.gitignore` (or already excluded); working dir created.

- [ ] **Step 3: Initialise empty ledger**

Create `.tmp/audit-waves/ledger.json` with shell:

```bash
cat > .tmp/audit-waves/ledger.json <<'EOF'
{
  "build_metadata": {
    "spec": "docs/superpowers/specs/done/2026-04-28-audit-consolidation-and-waves-design.md",
    "audit_corpus_dir": "docs/audit/",
    "audit_comment_date": "2026-04-28",
    "build_started_at": null,
    "build_commit_hash": null
  },
  "units": [],
  "rejected": [],
  "decide": [],
  "park": []
}
EOF

git rev-parse HEAD > .tmp/audit-waves/build_commit_hash.txt
jq --arg h "$(cat .tmp/audit-waves/build_commit_hash.txt)" \
   --arg d "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
   '.build_metadata.build_commit_hash = $h | .build_metadata.build_started_at = $d' \
   .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

Expected: `ledger.json` exists with non-null `build_commit_hash` and `build_started_at`.

- [ ] **Step 4: Commit gitignore update if changed**

```bash
git add .gitignore
git commit -m "chore: ensure .tmp/ is gitignored for audit-waves work" || echo "nothing to commit"
```

Expected: either commit succeeds or "nothing to commit" if `.tmp/` was already excluded.

---

## Phase 1 — Extract findings

Goal: read every `docs/audit/**/README.md`, extract atomic findings, append to `ledger.json` as `units` array entries with placeholder `verified: pending` and `category: pending`. After this phase, ledger contains every finding and nothing else.

### Task 1.1: Define unit JSON schema

**Files:**
- Modify: `.tmp/audit-waves/SCHEMA.md` (reference only, not committed)

- [ ] **Step 1: Write schema reference**

```bash
cat > .tmp/audit-waves/SCHEMA.md <<'EOF'
# Unit JSON schema (per spec §4)

Each unit in `ledger.json:units[]` has:

{
  "id": "U-001",                       // string, U-NNN, immutable
  "audit_ref": ["RNT-205#1"],          // string[], one or more
  "pkg": "@rntme/graph-ir-compiler",   // string OR comma-list for cross-pkg
  "severity": "High",                  // "Blocker" | "High" | "Medium" | "Low"
  "category": "pending",               // "pending" | "fire" | "gun" | "blueprint" | "decide" | "park" | "rejected"
  "verified": "pending",               // "pending" | "ok" | "no" | "skipped" | "n/a"
  "evidence": "src/lower/sqlite/lower.ts:lowerToSqlite — unsafe default param",
  "title": "66 throw new Error in src/ violate package boundary",
  "triage_rationale": "",              // filled in phase 4
  "wave": "—",                         // "W1" | "W2" | ... | "Wp" | "blocked-on-decide" | "—"
  "depends_on": [],                    // U-IDs
  "co_edits": [],                      // file paths
  "owner_hint": "@rntme/graph-ir-compiler",  // optional
  "linked_spec": null,                 // optional path
  "discovered_during": null,           // U-ID if found via E3
  "re_evaluate_when": null,            // string trigger if park
  "decide_blocks": [],                 // for decide-track entries: U-IDs blocked
  "closed_by": null,                   // PR# when done (lifecycle)
  "status": "open"                     // "open" | "done" (lifecycle)
}
EOF
```

Expected: schema reference file written.

### Task 1.2: Extract findings from one audit file (template)

**Files:**
- Read: `docs/audit/<pkg>/README.md`
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: Pick the smallest audit as the template — `event-store` (74 lines)**

Read full file:

```bash
cat docs/audit/@rntme/event-store/README.md
```

Identify all atomic findings. Each finding in the audit has a `### N.` or `**N. Title**` header followed by Evidence/Impact/Recommendation. Count them.

- [ ] **Step 2: Manually convert the first finding to a JSON unit**

For each finding, build:

```json
{
  "id": "U-001",
  "audit_ref": ["RNT-204#1"],
  "pkg": "@rntme/event-store",
  "severity": "<copied from audit's section header>",
  "category": "pending",
  "verified": "pending",
  "evidence": "<short ≤80 chars: file:function or quote>",
  "title": "<finding section header without numbering>",
  "triage_rationale": "",
  "wave": "—",
  "depends_on": [],
  "co_edits": [],
  "owner_hint": "<from audit Owner: field if present>",
  "linked_spec": null,
  "discovered_during": null,
  "re_evaluate_when": null,
  "decide_blocks": [],
  "closed_by": null,
  "status": "open"
}
```

Append to `ledger.json:units[]` with jq:

```bash
NEW_UNIT='{ ... }'  # the JSON above
jq --argjson u "$NEW_UNIT" '.units += [$u]' \
   .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

Expected: `jq '.units | length' .tmp/audit-waves/ledger.json` returns 1.

- [ ] **Step 3: Extract remaining findings from event-store**

Repeat Step 2 for every finding in `event-store/README.md`. ID assignment is sequential: `U-002`, `U-003`, etc.

After completion: count findings in audit (look for section markers like `### 1.`, `### 2.`) and confirm count matches `jq '.units | length' .tmp/audit-waves/ledger.json`.

- [ ] **Step 4: Commit checkpoint**

```bash
git add docs/superpowers/plans/done/2026-04-28-audit-waves-buildout.md  # commit plan if not yet committed
git commit -m "docs(plan): add audit-waves buildout plan" || echo "already committed"
# .tmp/ is gitignored — extraction state isn't in git, but plan is
```

Expected: plan committed.

### Task 1.3: Dispatch parallel extraction for remaining 31 audit files

**Files:**
- Read: `docs/audit/**/README.md` (31 files: all except `event-store` done in 1.2)
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: Compose Explore-agent extraction prompt**

The prompt template — DO NOT reword without re-reviewing for completeness:

```
You are extracting atomic findings from one architecture audit file.

INPUT:
- File: docs/audit/<PKG_PATH>/README.md
- Reference schema: .tmp/audit-waves/SCHEMA.md

TASK:
Parse the file. Each finding is a numbered section under severity headings (Blocker / High / Medium / Low) — typically `### 1.`, `### 2.`, or `**N.**` style. For each finding, output ONE JSON object matching the schema (only fields you can fill from the audit text — leave id, category, verified, triage_rationale, wave, depends_on, co_edits, discovered_during, re_evaluate_when, decide_blocks, closed_by, status to defaults).

For `severity`, use the heading the finding was under in the audit (Blocker / High / Medium / Low).

For `evidence`, extract the most concrete file:function or short quote from the Evidence section, truncated to ≤80 chars. NO line numbers in the evidence string (line numbers drift; the audit may include them but we strip).

For `title`, take the finding's heading text WITHOUT the leading number.

For `audit_ref`, format is `["RNT-XXX#N"]` where XXX is the issue number (visible in the file's "Multica issue" header) and N is the finding's number within the audit.

For `owner_hint`, copy from the finding's `Owner:` field if present, else null.

OUTPUT FORMAT:
A JSON array of unit objects, one per finding. Use stdout. No prose around the JSON.

Do NOT verify findings, do NOT triage, do NOT deduplicate. ONLY extract.

If you encounter a finding you cannot parse cleanly, emit it with `title: "PARSE_FAILURE: <reason>"` and as much else filled in as possible.
```

- [ ] **Step 2: Dispatch agents in parallel batches of ~8**

Single message with multiple Agent tool calls (one per audit file). Group all 31 remaining files (every file except event-store, which is done) across ~4 parallel batches. Use `subagent_type: "Explore"` and per-file prompts substituting `<PKG_PATH>`.

For each agent return value (a JSON array), append to ledger:

```bash
# pseudocode for each agent's output saved as .tmp/audit-waves/extract-<pkg>.json
NEXT_ID=$(jq '.units | length + 1' .tmp/audit-waves/ledger.json)
jq --arg next "$NEXT_ID" --slurpfile new .tmp/audit-waves/extract-<pkg>.json '
  .units += ($new[0] | to_entries | map(.value + {id: ("U-" + (((($next | tonumber) + .key) | tostring | ("000" + .))[-3:]))}) | map(.value? // .))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
  && mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

(In practice: write a tiny Node or shell helper that takes an array of units and assigns sequential `U-NNN` IDs starting at the current count + 1. Place helper in `.tmp/audit-waves/append-units.sh`.)

- [ ] **Step 3: Sanity-check the extracted total**

Run:

```bash
jq '.units | length' .tmp/audit-waves/ledger.json
jq '.units | group_by(.pkg) | map({pkg: .[0].pkg, count: length}) | sort_by(.count) | reverse' .tmp/audit-waves/ledger.json
```

Expected: total in the rough range 280–500. Per-package counts should roughly match the per-audit findings counts visible in `docs/audit/README.md` index (which lists severity hints for each package).

- [ ] **Step 4: Resolve PARSE_FAILURE entries (if any)**

```bash
jq '.units[] | select(.title | startswith("PARSE_FAILURE"))' .tmp/audit-waves/ledger.json
```

For each: read the original audit file directly, manually compose a corrected JSON unit, replace via:

```bash
jq --argjson fix '<corrected unit JSON>' '
  .units = (.units | map(if .id == "<U-XXX>" then $fix else . end))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
  && mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

Expected: no remaining `PARSE_FAILURE` entries.

---

## Phase 2 — Verify findings (per-package, parallel)

Goal: every Blocker/High becomes `verified: ok` or `verified: no`; ~30% of Medium per package becomes `verified: ok` or `verified: no`; rest of Medium and all Low become `verified: skipped`. Systemic findings (RNT-230) get `verified: n/a` and are handled in Phase 3.

### Task 2.1: Build per-package verification queues

**Files:**
- Modify: `.tmp/audit-waves/verification-reports/<pkg>.queue.json`

- [ ] **Step 1: For each package, generate a verification queue**

```bash
mkdir -p .tmp/audit-waves/verification-reports

for pkg in $(jq -r '.units | map(.pkg) | unique | .[]' .tmp/audit-waves/ledger.json); do
  pkg_safe=$(echo "$pkg" | tr '/@' '__')
  jq --arg p "$pkg" '
    .units
    | map(select(.pkg == $p))
    | {
        pkg: $p,
        verify_full: map(select(.severity == "Blocker" or .severity == "High")),
        verify_sample: (
          map(select(.severity == "Medium"))
          | (length as $n | if $n == 0 then [] elif $n <= 3 then . else .[0:3] end)
        ),
        skip: map(select(.severity == "Low")) + (
          map(select(.severity == "Medium"))
          | (length as $n | if $n <= 3 then [] else .[3:] end)
        )
      }
  ' .tmp/audit-waves/ledger.json \
    > .tmp/audit-waves/verification-reports/${pkg_safe}.queue.json
done
```

Expected: one queue file per unique package.

- [ ] **Step 2: Sanity-check sample sizes**

```bash
for f in .tmp/audit-waves/verification-reports/*.queue.json; do
  jq '{pkg: .pkg, full: (.verify_full | length), sample: (.verify_sample | length), skip: (.skip | length)}' "$f"
done
```

Expected: every package's `sample` is `min(3, total_medium)`, `full` is all Blocker+High, and `skip` accounts for the remainder.

### Task 2.2: Define verification agent prompt

**Files:**
- Read: `.tmp/audit-waves/verification-reports/<pkg>.queue.json`
- Modify: `.tmp/audit-waves/verification-reports/<pkg>.results.json`

- [ ] **Step 1: Compose Explore-agent verification prompt template**

```
You are verifying audit findings against the current source code.

INPUT:
- Queue: .tmp/audit-waves/verification-reports/<PKG_SAFE>.queue.json
- The queue contains `verify_full` (all units to fully verify) and `verify_sample` (a 30% spot-check sample).

POLICY:
- For every unit in `verify_full + verify_sample`:
  1. Read the unit's `evidence` and the source files it references.
  2. Determine if the condition the audit describes is present in the current code.
  3. Output verification result: "ok" (condition present) or "no" (condition absent — fixed/refactored/never existed).
  4. If "no", run `git log -- <file> --since=2026-04-28 --oneline` to find the commit that snapped it; include that commit hash in your reason if found.
- For each unit, also note ONE adjacent finding you observed in the same file IF AND ONLY IF it is severe (security gap, silent corruption, broken invariant). Do NOT do exploratory research. Stop after one adjacent observation per file.

EXPANSION RULE:
If your sample (`verify_sample`) yields ≥ 1 "no", you MUST also process every Medium-severity unit you can find for this package. Look them up by reading the original audit file at `docs/audit/<PKG_DIR>/README.md`. Output them in the same format.

OUTPUT FORMAT:
A JSON object:
{
  "pkg": "<package>",
  "results": [
    {
      "id": "U-XXX",
      "verified": "ok" | "no",
      "reason": "<one line; if 'no' include 'fixed by <commit>' if found>"
    },
    ...
  ],
  "discovered": [
    {
      "from_unit": "U-XXX",
      "file": "<file path>",
      "title": "<short>",
      "evidence": "<≤80 chars>",
      "severity_estimate": "Blocker" | "High" | "Medium" | "Low"
    },
    ...
  ],
  "expansion_triggered": true | false
}

Stdout JSON only. No prose.
```

- [ ] **Step 2: Note: don't dispatch yet — Task 2.3 dispatches all in parallel**

This task only defines the prompt. No code change.

### Task 2.3: Dispatch verification agents in parallel

**Files:**
- Modify: `.tmp/audit-waves/verification-reports/<pkg>.results.json` (one per package, 32 total)

- [ ] **Step 1: Dispatch all per-package verification agents in batches of ~8**

Use multiple Agent tool calls in a single message per batch. Each agent gets:
- `subagent_type: "Explore"`
- The full prompt from Task 2.2 with `<PKG_SAFE>` substituted.
- Instruction to write its output to `.tmp/audit-waves/verification-reports/<pkg>.results.json`.

Wait for each batch to complete before launching the next. With 32 packages and batch size 8, this is 4 batches.

- [ ] **Step 2: Validate agent outputs**

```bash
ls .tmp/audit-waves/verification-reports/*.results.json | wc -l
```

Expected: count equals number of unique packages (typically 32).

```bash
for f in .tmp/audit-waves/verification-reports/*.results.json; do
  jq -e '.pkg and (.results | type == "array")' "$f" > /dev/null || echo "BAD: $f"
done
```

Expected: no "BAD" output.

- [ ] **Step 3: Apply results back to the ledger**

For each `.results.json`:

```bash
for f in .tmp/audit-waves/verification-reports/*.results.json; do
  jq -s '
    .[0] as $ledger | .[1] as $report |
    $ledger
    | .units = (.units | map(
        . as $u
        | (($report.results | map(select(.id == $u.id)))[0]) as $r
        | if $r then $u + {verified: $r.verified, triage_rationale: ($u.triage_rationale + (if $r.reason then "[verify] " + $r.reason else "" end))} else $u end
      ))
  ' .tmp/audit-waves/ledger.json "$f" > .tmp/audit-waves/ledger.json.tmp \
    && mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
done
```

- [ ] **Step 4: Mark all unprocessed Medium and all Low as `skipped`**

```bash
jq '
  .units = (.units | map(
    if .verified == "pending" and (.severity == "Medium" or .severity == "Low")
    then . + {verified: "skipped", triage_rationale: ((.triage_rationale // "") + "[verify] not in sample")}
    else .
    end
  ))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

- [ ] **Step 5: Append `discovered` units to the ledger**

For each `.results.json`, take its `discovered[]` and convert to new units:

```bash
for f in .tmp/audit-waves/verification-reports/*.results.json; do
  PKG=$(jq -r '.pkg' "$f")
  jq --arg pkg "$PKG" --slurpfile rep "$f" '
    .units as $existing
    | (($existing | length) + 1) as $start
    | $rep[0].discovered as $disc
    | $disc | to_entries
    | map(. as $e | {
        id: ("U-" + ((($start + $e.key) | tostring | ("000" + .))[-3:])),
        audit_ref: ["discovered-during-" + $e.value.from_unit],
        pkg: $pkg,
        severity: $e.value.severity_estimate,
        category: "pending",
        verified: "ok",
        evidence: $e.value.evidence,
        title: $e.value.title,
        triage_rationale: ("[verify] discovered during verification of " + $e.value.from_unit),
        wave: "—",
        depends_on: [],
        co_edits: [],
        owner_hint: null,
        linked_spec: null,
        discovered_during: $e.value.from_unit,
        re_evaluate_when: null,
        decide_blocks: [],
        closed_by: null,
        status: "open"
      }) as $new_units
    | .units += $new_units
  ' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
    && mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
done
```

- [ ] **Step 6: Auto-route `verified: no` to rejected**

```bash
jq '
  .rejected += (.units | map(select(.verified == "no")) | map({id, audit_ref, pkg, reason: .triage_rationale}))
  | .units = (.units | map(select(.verified != "no")))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

- [ ] **Step 7: Verification phase status report**

```bash
jq '{
  total: (.units | length),
  verified_ok: (.units | map(select(.verified == "ok")) | length),
  verified_skipped: (.units | map(select(.verified == "skipped")) | length),
  verified_pending: (.units | map(select(.verified == "pending")) | length),
  rejected: (.rejected | length),
  per_pkg_stats: (.units | group_by(.pkg) | map({pkg: .[0].pkg, total: length}))
}' .tmp/audit-waves/ledger.json
```

Expected: `verified_pending == 0` (all units assigned a verification status). `rejected` count is positive (RNT-230 B1 about empty submodule should land here, given `git status` shows `M rntme-cli`).

---

## Phase 3 — Verify systemic findings

Goal: process RNT-230 systemic units (cross-pkg, infra-level) using tooling, mark `verified: ok` or `verified: no`, and create dedicated `pkg: monorepo` cross-cutting units for the cross-package themes mentioned in spec §6 E7.

### Task 3.1: Verify B1 (rntme-cli submodule state)

**Files:**
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: Check current submodule state**

```bash
git submodule status rntme-cli
ls rntme-cli/ | head
git -C rntme-cli rev-parse HEAD 2>/dev/null || echo "no submodule HEAD"
git status --short | grep rntme-cli
```

Capture findings (whether submodule is initialised, has files, has uncommitted changes).

- [ ] **Step 2: Update U-NNN for B1 in ledger**

Find the unit with audit_ref `RNT-230#B1`:

```bash
B1_ID=$(jq -r '.units[] | select(.audit_ref[] | contains("RNT-230") and contains("B1") | not | not) | .id' .tmp/audit-waves/ledger.json | head -1)
# (the predicate above is awkward — alternative below)
B1_ID=$(jq -r '.units[] | select(.audit_ref | tostring | contains("RNT-230#B1")) | .id' .tmp/audit-waves/ledger.json | head -1)
echo "B1 unit: $B1_ID"
```

If submodule is initialised + populated, mark `verified: no` with reason "submodule initialised at <commit>; finding outdated":

```bash
jq --arg id "$B1_ID" --arg reason "submodule populated as of $(date -u +%Y-%m-%d); see git submodule status" '
  .units = (.units | map(if .id == $id then . + {verified: "no", triage_rationale: ((.triage_rationale // "") + "[verify-systemic] " + $reason)} else . end))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

If submodule is empty, mark `verified: ok` and leave for triage to classify as fire.

### Task 3.2: Verify B2 (runtime god-package)

**Files:**
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: List runtime workspace deps**

```bash
jq '.dependencies | keys' packages/runtime/package.json
jq '.dependencies | to_entries | map(select(.value | startswith("workspace:"))) | length' packages/runtime/package.json
```

Expected: count visible.

- [ ] **Step 2: Mark B2 as `verified: ok` if count ≥ 10, else `verified: no`**

```bash
COUNT=$(jq '[.dependencies | to_entries[] | select(.value | startswith("workspace:"))] | length' packages/runtime/package.json)
B2_ID=$(jq -r '.units[] | select(.audit_ref | tostring | contains("RNT-230#B2")) | .id' .tmp/audit-waves/ledger.json | head -1)
if [ "$COUNT" -ge 10 ]; then
  STATUS=ok
  REASON="confirmed: ${COUNT} workspace deps in runtime"
else
  STATUS=no
  REASON="only ${COUNT} workspace deps in runtime — not god-package"
fi
jq --arg id "$B2_ID" --arg s "$STATUS" --arg r "$REASON" '
  .units = (.units | map(if .id == $id then . + {verified: $s, triage_rationale: ((.triage_rationale // "") + "[verify-systemic] " + $r)} else . end))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

### Task 3.3: Verify B3 (bindings-grpc → bindings-http)

**Files:**
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: Check the dep**

```bash
jq '.dependencies' packages/bindings-grpc/package.json
```

If `@rntme/bindings-http` present in `dependencies` → confirm. Else mark `no`.

- [ ] **Step 2: Update ledger**

Same pattern as Task 3.2 — find the B3 unit, set `verified` accordingly.

### Task 3.4: Verify H1 (version divergence)

**Files:**
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: Scan all package.json for divergent versions**

```bash
for dep in @grpc/grpc-js protobufjs better-sqlite3 typescript vitest; do
  echo "=== $dep ==="
  for f in $(find packages demo modules rntme-cli/packages -name package.json -not -path "*/node_modules/*" 2>/dev/null); do
    v=$(jq -r --arg d "$dep" '(.dependencies[$d] // .devDependencies[$d] // .peerDependencies[$d] // empty)' "$f" 2>/dev/null)
    [ -n "$v" ] && echo "  $f: $v"
  done | sort -u -k2
done
```

- [ ] **Step 2: Update H1 unit with confirmed-or-rejected status**

For each shared dep listed in the audit, check if multiple versions exist. If at least 2 versions of any tracked dep exist in workspace → `verified: ok`. Otherwise `verified: no` with note "all deps now unified".

### Task 3.5: Verify H2 (build:deps in module packages)

**Files:**
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: Scan for build:deps scripts**

```bash
grep -rl '"build:deps"' modules/ packages/ demo/ 2>/dev/null
```

- [ ] **Step 2: Update H2 unit accordingly**

Count of files with `build:deps` ≥ 1 → `verified: ok`. Else `verified: no`.

### Task 3.6: Verify H3 / H4 / M1 / M2 / M3 / M4 / M5 / L1

**Files:**
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: For each, run the appropriate tooling check**

| Unit | Check |
|---|---|
| H3 | `for m in modules/*/package.json; do jq '.name as $n | (.dependencies // {}) | to_entries | map(select(.key | test("conformance"))) | map($n + ": " + .key + " in deps")' "$m"; done` |
| H4 | `jq '.dependencies["@rntme/seed"]' packages/runtime/package.json` — confirm `workspace:^` (or whatever it is now) |
| M1 | `grep -n "Import directly from '@rntme/runtime/src/" packages/runtime/src/index.ts` |
| M2 | `jq '.dependencies' packages/blueprint/package.json` — confirm seed + ui present |
| M3 | `jq '.dependencies' packages/bindings-http/package.json` — confirm graph-ir-compiler present |
| M4 | `find packages demo modules -maxdepth 2 -name .gitignore \| wc -l` vs total package count |
| M5 | `for p in packages/db-studio packages/ui packages/ui-runtime; do jq '.description' $p/package.json; done` |
| L1 | `jq '.exports // .main // "none"' demo/issue-tracker-api-demo/package.json demo/pre-step-demo/package.json` |

- [ ] **Step 2: Mark each unit accordingly using the same jq update pattern**

After this task, every systemic unit from RNT-230 has a definitive verification status.

### Task 3.7: Set `verified: n/a` on all RNT-230 units that weren't explicitly checked

**Files:**
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: Update remaining RNT-230 units**

```bash
jq '
  .units = (.units | map(
    if (.audit_ref | tostring | contains("RNT-230")) and .verified == "pending"
    then . + {verified: "n/a", triage_rationale: ((.triage_rationale // "") + "[verify-systemic] not subject to file-level check")}
    else .
    end
  ))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

- [ ] **Step 2: Auto-route any `verified: no` to rejected (re-run Phase 2 Step 6)**

```bash
jq '
  .rejected += (.units | map(select(.verified == "no")) | map({id, audit_ref, pkg, reason: .triage_rationale}))
  | .units = (.units | map(select(.verified != "no")))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

- [ ] **Step 3: Confirm no `verified: pending` remain**

```bash
jq '[.units[] | select(.verified == "pending")] | length' .tmp/audit-waves/ledger.json
```

Expected: `0`.

---

## Phase 4 — Triage

Goal: every unit (other than rejected) gets a final `category` and a non-empty `triage_rationale`. Also seed `re_evaluate_when` for park units, and seed `decide_blocks` reverse-link for decide units.

### Task 4.1: Build per-category candidate lists

**Files:**
- Modify: `.tmp/audit-waves/triage-buckets.json`

- [ ] **Step 1: Apply heuristic pre-classification**

For each unit, run a programmatic first-pass (will be reviewed by hand for correctness, but speeds up triage):

```bash
jq '
  .units = (.units | map(
    . as $u
    | $u + {
        _hint: (
          if ($u.title | test("(?i)test.*fail|build.*fail|broken|crash|hangs|silent.*delet|silent.*drop")) then "fire"
          elif ($u.title | test("(?i)tls|insecure|secret|credential|injection|validation|sanitize|body limit|rate limit|cors|silent corruption|catch-all|swallow|nan|integer overflow|race")) then "gun"
          elif ($u.pkg | test("identity|conformance-identity|contracts-identity")) then "blueprint"
          elif ($u.pkg | test("event-store|projection-consumer")) then "blueprint"
          elif ($u.pkg | test("module-skeleton|manifest|runtime")) and ($u.title | test("(?i)bus|kafka|topic|consumer|producer|surface|module|manifest|adapter|actor|config")) then "blueprint"
          elif ($u.title | test("(?i)description|gitignore|comment|doc|readme|naming|consistency|cleanup")) then "park"
          elif ($u.title | test("(?i)decision|strategy|policy|architectural|redesign")) then "decide"
          else "review"
          end
        )
      }
  ))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json

jq '.units | group_by(._hint) | map({hint: .[0]._hint, count: length})' .tmp/audit-waves/ledger.json
```

Expected: every unit has a `_hint`. Distribution visible.

- [ ] **Step 2: Print one bucket at a time for manual review**

```bash
jq '.units[] | select(._hint == "fire") | {id, pkg, title, evidence}' .tmp/audit-waves/ledger.json
jq '.units[] | select(._hint == "gun") | {id, pkg, title, evidence}' .tmp/audit-waves/ledger.json
jq '.units[] | select(._hint == "blueprint") | {id, pkg, title, evidence}' .tmp/audit-waves/ledger.json
jq '.units[] | select(._hint == "review") | {id, pkg, title, evidence}' .tmp/audit-waves/ledger.json
jq '.units[] | select(._hint == "park") | {id, pkg, title, evidence}' .tmp/audit-waves/ledger.json
jq '.units[] | select(._hint == "decide") | {id, pkg, title, evidence}' .tmp/audit-waves/ledger.json
```

These are starting points — every unit will be confirmed/changed by the decision tree in Task 4.2.

### Task 4.2: Run the triage decision tree per unit

**Files:**
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: For each `_hint == "fire"` candidate, confirm Q1**

For each candidate, ask: "Is this currently breaking something? (test failing | build failing | observed bug | live error)" Read the unit's evidence + verification reason. If yes → `category: fire`, write `triage_rationale: "[triage] fire: <how it shoots>"`. If no → reset `_hint` to whichever Q the unit answers yes for (Q2 / Q3 / Q4 / park).

Update via:

```bash
jq --arg id "U-XXX" --arg cat "fire" --arg reason "fire: <specific>" '
  .units = (.units | map(if .id == $id then . + {category: $cat, triage_rationale: ($cat + " — " + $reason), _hint: null} else . end))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

Apply for every fire candidate.

- [ ] **Step 2: For each `_hint == "gun"` candidate, confirm Q2**

Q2: "Is this a security gap, silent data corruption mechanism, error-contract violation, or freshness/idempotency invariant break?" If yes → `category: gun`. Else fall through to Q3.

- [ ] **Step 3: For each `_hint == "blueprint"` candidate, confirm Q3**

Q3 decoders (a–d):
- (a) identity contracts/modules/conformance
- (b) event-store/projection-consumer/bus
- (c) module-skeleton/manifest/runtime CQR
- (d) HTTP transport as auth entry

If at least one decoder hits → `category: blueprint`, `triage_rationale: "[triage] blueprint: blocks <decoder> — <how>"`. Else fall through to Q4.

- [ ] **Step 4: For each `_hint == "review"` candidate, walk Q1→Q2→Q3→Q4**

Manually classify each. Use one of `fire | gun | blueprint | decide | park`. Always write a `triage_rationale`.

- [ ] **Step 5: For each `_hint == "decide"` candidate, write the DECIDE entry**

For each unit set as decide:

```bash
jq --arg id "U-XXX" --arg q "<short question for vlad>" --arg back "<one-line background>" --arg blocks "" '
  .decide += [{id: $id, question: $q, background: $back, blocks: ($blocks | split(","))}]
  | .units = (.units | map(if .id == $id then . + {category: "decide", triage_rationale: "[triage] decide: " + $q} else . end))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

For decide units that **also** block a blueprint (E6 case): set `category: blueprint`, `wave: blocked-on-decide`, AND add the decide entry with `blocks: [<unit_id>]`. Don't double-count: the unit lives in DEV ledger as blueprint, the decide-track entry is metadata on the decision needed.

- [ ] **Step 6: For each `_hint == "park"` candidate, write `re_evaluate_when`**

Every park unit MUST have a non-empty `re_evaluate_when`. Common triggers (use what fits):
- "second service appears in workspace"
- "first prod deploy"
- "first pre-release version tag"
- "next breaking change to <pkg>"
- "user reports actual confusion"
- "auditor or maintainer flags via test failure"
- "systemic decision made on <theme>"

Apply via:

```bash
jq --arg id "U-XXX" --arg trig "second service appears" '
  .units = (.units | map(if .id == $id then . + {category: "park", re_evaluate_when: $trig, triage_rationale: ("[triage] park: " + $trig)} else . end))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

If a park candidate has no clear trigger, promote to decide with question "what would make this urgent?".

- [ ] **Step 7: Apply E4 (deprecated package default)**

For units in deprecated packages — currently only `demo/issue-tracker-api-demo` per CLAUDE.md:

```bash
jq '
  .units = (.units | map(
    if .pkg == "@rntme/issue-tracker-api-demo" and .category != "fire"
    then . + {category: "park", re_evaluate_when: "replaced by canonical project-shape example", triage_rationale: "[triage] E4 deprecated package default — non-fire findings parked"}
    else .
    end
  ))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

- [ ] **Step 8: Validate triage completeness**

```bash
jq '[.units[] | select(.category == "pending")] | length' .tmp/audit-waves/ledger.json
jq '[.units[] | select(.category == "park" and (.re_evaluate_when | not or . == ""))] | length' .tmp/audit-waves/ledger.json
jq '[.units[] | select(.triage_rationale == "")] | length' .tmp/audit-waves/ledger.json
```

Expected: all three return `0`.

- [ ] **Step 9: Strip the temporary `_hint` field**

```bash
jq '.units = (.units | map(del(._hint)))' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

---

## Phase 5 — Cross-cutting analysis

Goal: identify duplicate units across audits (E2), identify cross-cutting consistency themes (E7), apply E9 priority where two categories fit.

### Task 5.1: Find duplicate findings across audits

**Files:**
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: Group by similar evidence/title**

```bash
jq '.units | group_by(.title | ascii_downcase | sub("[^a-z ]"; ""; "g") | split(" ") | sort | join(" "))
    | map(select(length > 1))
    | map({titles: map(.title), ids: map(.id), pkgs: map(.pkg), audit_refs: map(.audit_ref) | flatten})' \
   .tmp/audit-waves/ledger.json > .tmp/audit-waves/duplicate-candidates.json
```

- [ ] **Step 2: For each candidate group, decide merge or keep**

Read each group manually. If two units describe the same symptom (one from a per-package audit, one from RNT-230 systemic), merge:

```bash
PRIMARY=U-AAA  # the one to keep
SECONDARY=U-BBB  # the one to merge in

jq --arg p "$PRIMARY" --arg s "$SECONDARY" '
  (.units | map(select(.id == $s)) | .[0]) as $sec
  | .units = (.units | map(
      if .id == $p then . + {audit_ref: (.audit_ref + $sec.audit_ref | unique)}
      else .
      end
    ))
  | .rejected += [{id: $s, audit_ref: $sec.audit_ref, pkg: $sec.pkg, reason: "merged into " + $p}]
  | .units = (.units | map(select(.id != $s)))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

### Task 5.2: Identify and label cross-cutting themes (E7)

**Files:**
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: Common themes to look for**

- "throw new Error → Result migration" (mentioned RNT-205 #1; possibly elsewhere)
- "Custom semver parser" (RNT-210 #19)
- "RuntimeConfig validation" (RNT-210 #7)
- "Missing .gitignore" (RNT-230 M4)
- "Missing description" (RNT-230 M5)
- "exports — internal exposed as public" (RNT-205 #8)

For each theme: count how many units across packages mention it. If ≥ 3 → it's a cross-cutting theme.

- [ ] **Step 2: Apply E7 default — park unless one pkg is fire**

For each cross-cutting theme:

```bash
# Identify the matching units
jq --arg pat "throw new Error" '.units[] | select(.title + " " + .evidence | test($pat; "i")) | {id, pkg, category}' .tmp/audit-waves/ledger.json
```

If none of the matching units is `fire` → mark all as `park` with `re_evaluate_when: "systemic decision on <theme>"`. Add a corresponding `decide` entry asking "do we want to standardise <theme> across packages?".

If at least one pkg has `fire` for this theme → keep that one, park the rest with `re_evaluate_when: "after systemic decision following <fire-unit-id> resolution"`.

### Task 5.3: Apply E9 (one category per unit, priority hierarchy)

**Files:**
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: Find units whose triage rationale mentions a secondary category**

```bash
jq '.units[] | select(.triage_rationale | test("also: |secondary: "))' .tmp/audit-waves/ledger.json
```

Verify each is filed under the higher-priority category in `category: fire > gun > blueprint > decide > park`. If wrong, reassign.

---

## Phase 6 — Wave assembly

Goal: every wave-eligible unit (`category in [fire, gun, blueprint]`) has `wave` set, `depends_on` populated, `co_edits` computed. Validate spec §5 invariants.

### Task 6.1: Assign W1 (Foundation)

**Files:**
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: Identify W1 candidates**

W1 includes:
- Every `fire` unit whose effect is workspace-wide build/test break.
- Topology-changing systemic units from RNT-230 (H1, H4, B3 if they triaged as fire/gun/blueprint).

```bash
jq '.units[] | select(.category == "fire") | {id, pkg, title, triage_rationale}' .tmp/audit-waves/ledger.json
jq '.units[] | select(.category == "gun" or .category == "blueprint") | select(.audit_ref | tostring | test("RNT-230#[BH]")) | {id, pkg, title, triage_rationale}' .tmp/audit-waves/ledger.json
```

- [ ] **Step 2: Mark candidates as wave: W1**

For each W1 unit:

```bash
jq --arg id "U-XXX" '
  .units = (.units | map(if .id == $id then . + {wave: "W1"} else . end))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

### Task 6.2: Assign W2/W3/W4 (Blueprint readiness)

**Files:**
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: Apply W2 (Identity surface)**

```bash
jq '
  .units = (.units | map(
    if .category == "blueprint" and (.pkg | test("identity|conformance-identity|contracts-identity"))
    then . + {wave: "W2"}
    elif .category == "blueprint" and (.pkg | test("bindings-http")) and (.title | test("(?i)body|tls|auth|cors|rate"))
    then . + {wave: "W2"}
    else .
    end
  ))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

- [ ] **Step 2: Apply W3 (Event bus / projection live readiness)**

```bash
jq '
  .units = (.units | map(
    if .category == "blueprint" and (.pkg | test("event-store|projection-consumer"))
    then . + {wave: "W3"}
    elif .category == "blueprint" and (.title | test("(?i)bus|kafka|topic|consumer|producer|retention|seen.events|idempot|cursor"))
    then . + {wave: "W3"}
    else .
    end
  ))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

- [ ] **Step 3: Apply W4 (Module-skeleton / manifest / runtime CQR)**

```bash
jq '
  .units = (.units | map(
    if .category == "blueprint" and .wave == "—"
    then . + {wave: "W4"}
    else .
    end
  ))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

- [ ] **Step 4: Override blueprint units with `wave: blocked-on-decide` if E6 applies**

For any blueprint unit whose resolution requires a DECIDE answer:

```bash
jq --arg id "U-XXX" '
  .units = (.units | map(if .id == $id then . + {wave: "blocked-on-decide"} else . end))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

### Task 6.3: Assign per-package cleanup waves (W5..Wm)

**Files:**
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: Define layer order**

Layer assignment per package (used to compute wave number):

| Layer | Packages | Wave start |
|---|---|---|
| 1 — contracts | contracts-* | W5 |
| 2 — core | pdm, qsm, event-store | W6 |
| 3 — compilation | graph-ir-compiler | W7 |
| 4 — transport | bindings, bindings-http, bindings-grpc | W8 |
| 5 — runtime | runtime, projection-consumer | W9 |
| 6 — tooling | blueprint, seed, db-studio | W10 |
| 7 — modules | conformance-*, crm-*, identity-*, ai-llm-* | W11 |
| 8 — demos | issue-tracker-api-demo, pre-step-demo | W12 |
| 9 — cli | rntme-cli/* | W13 |
| 10 — ui | ui, ui-runtime | W14 |
| 11 — platform | platform-* | W15 |

(Note: only `fire | gun` units that haven't already gone to W1/W2/W3/W4 land here.)

- [ ] **Step 2: Apply layer-based wave assignment**

```bash
declare -A LAYER_WAVE
LAYER_WAVE["contracts"]="W5"
LAYER_WAVE["core"]="W6"
LAYER_WAVE["compilation"]="W7"
LAYER_WAVE["transport"]="W8"
LAYER_WAVE["runtime"]="W9"
LAYER_WAVE["tooling"]="W10"
LAYER_WAVE["modules"]="W11"
LAYER_WAVE["demos"]="W12"
LAYER_WAVE["cli"]="W13"
LAYER_WAVE["ui"]="W14"
LAYER_WAVE["platform"]="W15"

jq '
  .units = (.units | map(
    if (.category == "fire" or .category == "gun") and .wave == "—"
    then . + {wave: (
      if .pkg | test("contracts") then "W5"
      elif .pkg | test("pdm|qsm|event-store") then "W6"
      elif .pkg | test("graph-ir-compiler") then "W7"
      elif .pkg | test("bindings") then "W8"
      elif .pkg | test("runtime|projection-consumer") then "W9"
      elif .pkg | test("blueprint|seed|db-studio") then "W10"
      elif .pkg | test("conformance|crm|identity|ai-llm|module-skeleton") then "W11"
      elif .pkg | test("issue-tracker-api-demo|pre-step-demo") then "W12"
      elif .pkg | test("rntme-cli/(cli|deploy-core|deploy-dokploy|landing)") then "W13"
      elif .pkg | test("/ui|/ui-runtime") then "W14"
      elif .pkg | test("platform") then "W15"
      else "Wp"
      end
    )}
    else .
    end
  ))
' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
&& mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
```

- [ ] **Step 3: Trim unused waves**

Some waves may end up empty (no fire/gun in that layer). Renumber to keep waves contiguous:

```bash
USED_WAVES=$(jq -r '[.units[] | .wave] | unique | map(select(test("^W[0-9]+$"))) | sort_by(. | sub("W"; "") | tonumber) | .[]' .tmp/audit-waves/ledger.json)
echo "Used waves: $USED_WAVES"
```

If gaps exist (e.g. W7 is empty), document it: empty waves are fine — keep numbering stable for traceability rather than renumber on every change.

### Task 6.4: Compute co-edits (per spec §5 invariant 2)

**Files:**
- Modify: `.tmp/audit-waves/ledger.json`

- [ ] **Step 1: For each wave, find files that appear in ≥2 units' evidence**

```bash
for w in W1 W2 W3 W4 W5 W6 W7 W8 W9 W10 W11 W12 W13 W14 W15 Wp; do
  jq --arg w "$w" '
    [.units[] | select(.wave == $w) | {id, evidence}]
    | map(. + {file: (.evidence | capture("(?<f>[A-Za-z0-9_./-]+\\.[a-z]+)").f? // null)})
    | map(select(.file))
    | group_by(.file)
    | map(select(length >= 2))
    | map({file: .[0].file, units: map(.id)})
  ' .tmp/audit-waves/ledger.json > .tmp/audit-waves/co-edits-$w.json
done
```

- [ ] **Step 2: Apply co-edits back to units**

```bash
for w in W1 W2 W3 W4 W5 W6 W7 W8 W9 W10 W11 W12 W13 W14 W15 Wp; do
  CO_FILE=.tmp/audit-waves/co-edits-$w.json
  if [ -s "$CO_FILE" ] && [ "$(jq 'length' "$CO_FILE")" != "0" ]; then
    jq --slurpfile co "$CO_FILE" --arg w "$w" '
      .units = (.units | map(
        if .wave == $w then
          . + {co_edits: (
            $co[0]
            | map(select(.units | index(.id != null and (. as $i | . | test("^U-")) | true)))
            | map(.file)
          )}
        else .
        end
      ))
    ' .tmp/audit-waves/ledger.json > .tmp/audit-waves/ledger.json.tmp \
    && mv .tmp/audit-waves/ledger.json.tmp .tmp/audit-waves/ledger.json
  fi
done
```

(Note: jq syntax is fiddly; if it doesn't parse cleanly, fall back to a 20-line Node script in `.tmp/audit-waves/compute-coedits.mjs`.)

### Task 6.5: Validate spec §5 invariants

**Files:**
- Modify: `.tmp/audit-waves/invariant-check.log`

- [ ] **Step 1: Invariant 1 — no backward dependency**

```bash
jq -r '
  .units
  | map(select(.depends_on | length > 0))
  | map(. as $u | $u.depends_on | map(. as $d | {u: $u.id, u_wave: $u.wave, dep: $d, dep_wave: ($u as $u | .units? // [] | map(select(.id == $d)) | .[0].wave // "?")}))
  | flatten
  | map(select(.dep_wave != "?" and (.u_wave | sub("W"; "") | tonumber) <= (.dep_wave | sub("W"; "") | tonumber)))
  | if length == 0 then "INVARIANT-1: PASS" else "INVARIANT-1: FAIL " + tostring end
' .tmp/audit-waves/ledger.json | tee -a .tmp/audit-waves/invariant-check.log
```

If FAIL: move offending units one wave later, repeat.

- [ ] **Step 2: Invariant 3 — every park has a re-evaluate trigger**

```bash
jq -r '
  [.units[] | select(.category == "park" and ((.re_evaluate_when // "") == ""))]
  | if length == 0 then "INVARIANT-3: PASS" else "INVARIANT-3: FAIL — " + (length | tostring) + " park units missing trigger: " + (map(.id) | tostring) end
' .tmp/audit-waves/ledger.json | tee -a .tmp/audit-waves/invariant-check.log
```

If FAIL: fix each park unit (set the trigger) or promote to decide.

---

## Phase 7 — Render document

Goal: produce `docs/audit/00-waves.md` from the working ledger. Single output file, populated from `ledger.json`.

### Task 7.1: Render Header

**Files:**
- Create: `docs/audit/00-waves.md`

- [ ] **Step 1: Write the file header**

```bash
SPEC_LINK="docs/superpowers/specs/done/2026-04-28-audit-consolidation-and-waves-design.md"
BUILD_DATE=$(jq -r '.build_metadata.build_started_at' .tmp/audit-waves/ledger.json)
BUILD_HASH=$(jq -r '.build_metadata.build_commit_hash' .tmp/audit-waves/ledger.json)
TOTAL=$(jq '.units | length' .tmp/audit-waves/ledger.json)
REJECTED=$(jq '.rejected | length' .tmp/audit-waves/ledger.json)

cat > docs/audit/00-waves.md <<EOF
# Audit waves — consolidated planning

> **Status:** initial build. See [spec](../../specs/done/2026-04-28-audit-consolidation-and-waves-design.md) for the canonical process.

| Field | Value |
|---|---|
| Build date | ${BUILD_DATE} |
| Build commit | \`${BUILD_HASH}\` |
| Audit corpus dir | \`docs/audit/\` (RNT-199..230, snapshot date 2026-04-28) |
| Spec | \`${SPEC_LINK}\` |
| Total active units | ${TOTAL} |
| Rejected (false positives + duplicates) | ${REJECTED} |

## Triage formula (one paragraph)

Each verified finding runs the decision tree: **Q1 already shoots? → fire**; else **Q2 loaded gun? (security/silent-corruption/error-contract/freshness-or-idempotency-break) → gun**; else **Q3 blueprint blocker? (identity / kafka-bus / module-skeleton / http-as-auth-entry) → blueprint**; else **Q4 needs product/architectural decision → decide**; else **park** with mandatory \`re-evaluate when:\` trigger.

## Categories

- 🔥 **fire** — already shooting; in execution waves
- 🔫 **gun** — loaded but not shot; in execution waves
- 🚧 **blueprint** — blocks first real blueprint (identity + Redpanda + Operaton); in execution waves
- 🤔 **decide** — needs product/architectural input; tracked, not actioned
- 📦 **park** — real per audit but no shoot, no foreseeable shoot; tracked with re-evaluate trigger
- ❌ **rejected** — false positive, outdated, or duplicate

## Last updated

- ${BUILD_DATE} — initial build at \`${BUILD_HASH}\`

EOF
```

Expected: header section written.

### Task 7.2: Render Lens A (wave timeline)

**Files:**
- Modify: `docs/audit/00-waves.md`

- [ ] **Step 1: Iterate waves and append**

```bash
echo "" >> docs/audit/00-waves.md
echo "---" >> docs/audit/00-waves.md
echo "" >> docs/audit/00-waves.md
echo "## Lens A — Wave timeline (operational view)" >> docs/audit/00-waves.md
echo "" >> docs/audit/00-waves.md

for w in W1 W2 W3 W4 W5 W6 W7 W8 W9 W10 W11 W12 W13 W14 W15 Wp blocked-on-decide; do
  COUNT=$(jq --arg w "$w" '[.units[] | select(.wave == $w)] | length' .tmp/audit-waves/ledger.json)
  [ "$COUNT" -eq 0 ] && continue

  # Wave focus copy from the wave-focus-table below
  case "$w" in
    W1) FOCUS="Foundation — workspace build/test stable; topology stable" ;;
    W2) FOCUS="Identity surface readiness — auth0/clerk + HTTP entry hardening" ;;
    W3) FOCUS="Event bus / projection live readiness — Redpanda transition prerequisites" ;;
    W4) FOCUS="Module-skeleton / manifest / runtime CQR — Operaton-ready boot pipeline" ;;
    W5) FOCUS="Per-package cleanup — contracts layer" ;;
    W6) FOCUS="Per-package cleanup — core (pdm/qsm/event-store)" ;;
    W7) FOCUS="Per-package cleanup — compilation (graph-ir-compiler)" ;;
    W8) FOCUS="Per-package cleanup — transport (bindings/http/grpc)" ;;
    W9) FOCUS="Per-package cleanup — runtime / projection-consumer" ;;
    W10) FOCUS="Per-package cleanup — tooling (blueprint/seed/db-studio)" ;;
    W11) FOCUS="Per-package cleanup — modules + module-skeleton" ;;
    W12) FOCUS="Per-package cleanup — demos" ;;
    W13) FOCUS="Per-package cleanup — rntme-cli" ;;
    W14) FOCUS="Per-package cleanup — UI" ;;
    W15) FOCUS="Per-package cleanup — platform" ;;
    Wp) FOCUS="Polish — Low items + CI guardrails (dependency-cruiser, pnpm catalogs, eslint guards, coverage gates)" ;;
    blocked-on-decide) FOCUS="Blocked on DECIDE answers — execution paused until product/architectural input" ;;
  esac

  echo "### Wave ${w} — ${FOCUS}" >> docs/audit/00-waves.md
  echo "" >> docs/audit/00-waves.md
  echo "**Units (${COUNT}):**" >> docs/audit/00-waves.md
  echo "" >> docs/audit/00-waves.md

  jq -r --arg w "$w" '
    .units[] | select(.wave == $w)
    | "- [ ] \(.id) — \(.title) — `\(.pkg)` — \(
        if .category == "fire" then "🔥"
        elif .category == "gun" then "🔫"
        elif .category == "blueprint" then "🚧"
        else "?" end)"
  ' .tmp/audit-waves/ledger.json >> docs/audit/00-waves.md
  echo "" >> docs/audit/00-waves.md

  # Co-edits subgroup
  CO_COUNT=$(jq --arg w "$w" '[.units[] | select(.wave == $w) | .co_edits[]?] | unique | length' .tmp/audit-waves/ledger.json)
  if [ "$CO_COUNT" -gt 0 ]; then
    echo "**Co-edits (merge serialise):**" >> docs/audit/00-waves.md
    echo "" >> docs/audit/00-waves.md
    jq -r --arg w "$w" '
      [.units[] | select(.wave == $w) | . as $u | $u.co_edits[]? | {file: ., id: $u.id}]
      | group_by(.file)
      | map({file: .[0].file, ids: map(.id)})
      | .[]
      | "- `\(.file)` — \(.ids | join(", "))"
    ' .tmp/audit-waves/ledger.json >> docs/audit/00-waves.md
    echo "" >> docs/audit/00-waves.md
  fi

  # Exit criteria — manual paragraph per wave
  echo "**Exit criteria:**" >> docs/audit/00-waves.md
  case "$w" in
    W1) echo "- \`pnpm -r run build\` green without per-package \`build:deps\`." >> docs/audit/00-waves.md
        echo "- \`pnpm -r run test\` green." >> docs/audit/00-waves.md
        echo "- Single version per shared external dep." >> docs/audit/00-waves.md
        echo "- No \`runtime → seed\` in production deps; no \`bindings-grpc → bindings-http\` in production deps." >> docs/audit/00-waves.md ;;
    W2) echo "- Identity contracts pass conformance suite green against auth0 and clerk modules." >> docs/audit/00-waves.md
        echo "- HTTP transport rejects oversized bodies + supports TLS config when relevant." >> docs/audit/00-waves.md ;;
    W3) echo "- Event-store passes idempotency / single-writer / monotonic-cursor invariants under integration tests." >> docs/audit/00-waves.md
        echo "- Projection-consumer green with retention env validation." >> docs/audit/00-waves.md
        echo "- InMemoryBus topic isolation verified or replaced with Redpanda-backed bus in test bootstrap." >> docs/audit/00-waves.md ;;
    W4) echo "- Manifest validation gates Operaton-style runtime config." >> docs/audit/00-waves.md
        echo "- Runtime boot-pipeline error codes preserved end-to-end." >> docs/audit/00-waves.md
        echo "- Module-skeleton can mount auth0/clerk modules without manual wiring." >> docs/audit/00-waves.md ;;
    Wp) echo "- All Low units closed." >> docs/audit/00-waves.md
        echo "- CI guardrails active: dependency-cruiser, pnpm catalogs enforcement, eslint no-internal-modules, coverage gate." >> docs/audit/00-waves.md ;;
    *) echo "- All units in this wave closed; affected packages green on \`pnpm -F <pkg> test\`." >> docs/audit/00-waves.md ;;
  esac
  echo "" >> docs/audit/00-waves.md
done
```

Expected: Lens A appended to `00-waves.md` with one section per non-empty wave.

### Task 7.3: Render Lens B (findings ledger)

**Files:**
- Modify: `docs/audit/00-waves.md`

- [ ] **Step 1: Append the master ledger table**

```bash
echo "---" >> docs/audit/00-waves.md
echo "" >> docs/audit/00-waves.md
echo "## Lens B — Findings ledger (data view)" >> docs/audit/00-waves.md
echo "" >> docs/audit/00-waves.md
echo "| id | pkg | audit-ref | severity | category | wave | verified | evidence | triage rationale | depends-on | co-edits |" >> docs/audit/00-waves.md
echo "|----|-----|-----------|----------|----------|------|----------|----------|------------------|------------|----------|" >> docs/audit/00-waves.md

jq -r '
  .units
  | sort_by(.id)
  | .[]
  | "| \(.id) | `\(.pkg)` | \(.audit_ref | join(", ")) | \(.severity) | \(
      if .category == "fire" then "🔥 fire"
      elif .category == "gun" then "🔫 gun"
      elif .category == "blueprint" then "🚧 blueprint"
      elif .category == "decide" then "🤔 decide"
      elif .category == "park" then "📦 park"
      else .category end) | \(.wave) | \(
      if .verified == "ok" then "✓"
      elif .verified == "no" then "✗"
      elif .verified == "skipped" then "skip"
      elif .verified == "n/a" then "n/a"
      else .verified end) | \(.evidence) | \(.triage_rationale | sub("\\\\|"; "\\\\\\\\|"; "g")) | \(.depends_on | join(", ")) | \(.co_edits | join(", ")) |"
' .tmp/audit-waves/ledger.json >> docs/audit/00-waves.md

echo "" >> docs/audit/00-waves.md
```

Expected: ledger table appended; row count matches `jq '.units | length' ledger.json`.

### Task 7.4: Render Lens C (per-package index)

**Files:**
- Modify: `docs/audit/00-waves.md`

- [ ] **Step 1: Append per-package summary**

```bash
echo "---" >> docs/audit/00-waves.md
echo "" >> docs/audit/00-waves.md
echo "## Lens C — Per-package index (auditor view)" >> docs/audit/00-waves.md
echo "" >> docs/audit/00-waves.md

jq -r '
  (.units + (.rejected | map(. + {category: "rejected"})))
  | group_by(.pkg)
  | sort_by(.[0].pkg)
  | .[]
  | (.[0].pkg) as $pkg
  | (length) as $total
  | "### `\($pkg)` — total findings: \($total)\n\n"
    + "- → DEV: \( map(select(.category == "fire" or .category == "gun" or .category == "blueprint")) | map(.id) | sort | join(", ") )\n"
    + "- → DECIDE: \( map(select(.category == "decide")) | map(.id) | sort | join(", ") )\n"
    + "- → PARK: \( map(select(.category == "park")) | map(.id) | sort | join(", ") )\n"
    + "- → REJECTED: \( map(select(.category == "rejected")) | map(.id) | sort | join(", ") )\n"
' .tmp/audit-waves/ledger.json >> docs/audit/00-waves.md
```

Expected: one subsection per package; values are id-lists or empty.

### Task 7.5: Render Track DECIDE

**Files:**
- Modify: `docs/audit/00-waves.md`

- [ ] **Step 1: Append decide-track section**

```bash
echo "---" >> docs/audit/00-waves.md
echo "" >> docs/audit/00-waves.md
echo "## Track DECIDE" >> docs/audit/00-waves.md
echo "" >> docs/audit/00-waves.md
echo "Open questions blocking units. Each requires product or architectural input." >> docs/audit/00-waves.md
echo "" >> docs/audit/00-waves.md

jq -r '
  .decide
  | sort_by(.id)
  | .[]
  | "### \(.id) — \(.question)\n\n"
    + "**Background:** \(.background)\n\n"
    + "**Blocks:** \(if .blocks | length > 0 then (.blocks | join(", ")) else "—" end)\n\n"
    + "**@vlad:** ?\n"
' .tmp/audit-waves/ledger.json >> docs/audit/00-waves.md
```

Expected: one subsection per decide entry, awaiting answer.

### Task 7.6: Render Track PARK

**Files:**
- Modify: `docs/audit/00-waves.md`

- [ ] **Step 1: Append park-track section grouped by trigger**

```bash
echo "---" >> docs/audit/00-waves.md
echo "" >> docs/audit/00-waves.md
echo "## Track PARK" >> docs/audit/00-waves.md
echo "" >> docs/audit/00-waves.md
echo "Findings real per audit, but no current shoot and no foreseeable shoot. Each grouped by re-evaluate trigger." >> docs/audit/00-waves.md
echo "" >> docs/audit/00-waves.md

jq -r '
  .units
  | map(select(.category == "park"))
  | group_by(.re_evaluate_when)
  | sort_by(.[0].re_evaluate_when)
  | .[]
  | "### Trigger: \(.[0].re_evaluate_when)\n\n"
    + (map("- \(.id) — \(.title) — `\(.pkg)`") | join("\n"))
    + "\n"
' .tmp/audit-waves/ledger.json >> docs/audit/00-waves.md
```

Expected: one section per unique trigger; bullet lists of unit ids.

### Task 7.7: Render Track REJECTED

**Files:**
- Modify: `docs/audit/00-waves.md`

- [ ] **Step 1: Append rejected list**

```bash
echo "---" >> docs/audit/00-waves.md
echo "" >> docs/audit/00-waves.md
echo "## Track REJECTED" >> docs/audit/00-waves.md
echo "" >> docs/audit/00-waves.md
echo "False positives, outdated findings, and merged duplicates." >> docs/audit/00-waves.md
echo "" >> docs/audit/00-waves.md

jq -r '
  .rejected
  | sort_by(.id)
  | .[]
  | "- \(.id) — `\(.pkg)` — \(.audit_ref | join(", ")) — \(.reason)"
' .tmp/audit-waves/ledger.json >> docs/audit/00-waves.md
echo "" >> docs/audit/00-waves.md
```

Expected: bullet list of rejected entries.

### Task 7.8: Render Footer / Appendix

**Files:**
- Modify: `docs/audit/00-waves.md`

- [ ] **Step 1: Append meta-observations and CI guardrails listing**

```bash
cat >> docs/audit/00-waves.md <<'EOF'

---

## Appendix — meta observations

### Auditor disagreements

(To be filled if any units' `triage_rationale` contained `disagreement:` — rare but occurs at boundaries between systemic RNT-230 view and per-package view.)

### Cross-cutting consistency themes — parked by default

- **`throw new Error` vs `Result<T>` migration** — mostly graph-ir-compiler (RNT-205 #1). Local fix without systemic decision risks reverting on next contributor. Parked pending decide on whether the convention applies to internal invariants.
- **Custom semver / shared utilities** — multiple packages roll their own. Parked pending need for pre-release tags.
- **Internal-modules export discipline** — covered by future eslint guardrail in Wp.

### CI guardrails (deferred to Wp)

From RNT-230 §3:
- `dependency-cruiser` or `skott` — layer violations check in CI.
- `pnpm.catalogs` — single-version contract for shared external deps.
- `eslint-plugin-import` with `no-internal-modules` — block imports past `exports`.
- Custom eslint rule — ban `workspace:^` (only `workspace:*`).
- CI check — `pnpm -r run build` must pass without per-package `build:deps`.
- Dependency graph diff in PR comments — show changes in topology when `package.json` changes.
- Coverage gate — `@vitest/coverage-v8`, ≥80% for `src/`.

These are the *self-preserving* mechanisms. They land in Wp because activating them earlier would fail every PR until preceding waves are clean.
EOF
```

Expected: appendix written.

---

## Phase 8 — Final validation + commit

### Task 8.1: Final structural validation

**Files:**
- Read: `docs/audit/00-waves.md`

- [ ] **Step 1: Document is non-empty and well-formed**

```bash
wc -l docs/audit/00-waves.md
grep -c "^## Lens A" docs/audit/00-waves.md
grep -c "^## Lens B" docs/audit/00-waves.md
grep -c "^## Lens C" docs/audit/00-waves.md
grep -c "^## Track DECIDE" docs/audit/00-waves.md
grep -c "^## Track PARK" docs/audit/00-waves.md
grep -c "^## Track REJECTED" docs/audit/00-waves.md
```

Expected: file has 500+ lines (depends on unit count); each `^## ...` count is exactly `1`.

- [ ] **Step 2: No placeholders remain in document**

```bash
grep -niE "tbd|todo|fixme|<.*>" docs/audit/00-waves.md | grep -v "code\|backtick\|escaped" | head
```

Expected: only legitimate `<...>` cases (e.g. inside code blocks). No literal `TBD`, `TODO`, `FIXME`.

- [ ] **Step 3: Verify ledger row count matches unit count in JSON**

```bash
LEDGER_ROWS=$(grep -cE "^\| U-[0-9]+" docs/audit/00-waves.md)
JSON_UNITS=$(jq '.units | length' .tmp/audit-waves/ledger.json)
echo "Doc rows: $LEDGER_ROWS, JSON units: $JSON_UNITS"
[ "$LEDGER_ROWS" -eq "$JSON_UNITS" ] && echo "MATCH" || echo "MISMATCH"
```

Expected: MATCH.

### Task 8.2: Commit deliverable

**Files:**
- Add: `docs/audit/00-waves.md`

- [ ] **Step 1: Commit the consolidation document**

```bash
git add docs/audit/00-waves.md
git commit -m "$(cat <<'EOF'
docs(audit): publish consolidated waves planning document

Builds on docs/superpowers/specs/done/2026-04-28-audit-consolidation-and-waves-design.md.
Aggregates 32 architecture audits (RNT-199..230) into a single living
planning document with three lenses (wave timeline / findings ledger /
per-package index) and three non-execution tracks (DECIDE / PARK /
REJECTED). Triage filter is biased against cleanup-for-consistency:
only fire / gun / blueprint-blocker units enter waves.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected: commit succeeds; `git log --oneline -3` shows the new commit.

### Task 8.3: Update memory snapshot

**Files:**
- Possibly modify: `/home/coder/.claude/projects/-home-coder-project/memory/rntme_orchestration_only.md` (replace `Zeebe only` with `Operaton via BPMN`)
- Possibly create: `/home/coder/.claude/projects/-home-coder-project/memory/audit_waves_doc.md` (pointer to `docs/audit/00-waves.md` as living document)

- [ ] **Step 1: Update the orchestration memory if user confirmed Operaton replaces Zeebe**

Since the user explicitly stated "BPMN(Operaton)" during brainstorming, update memory:

```markdown
---
name: rntme orchestration choice
description: Cross-service orchestration is Operaton (BPMN), not Zeebe. Reactive/choreography between services still forbidden.
type: project
---

Cross-service async = Operaton (open-source BPMN engine, Camunda 7 fork).

**Why:** User confirmed during 2026-04-28 audit-waves brainstorming that the first
real blueprint will use Operaton, not Zeebe. Zeebe was the prior placeholder.

**How to apply:** When discussing async cross-service flows, reference Operaton.
Choreography (reactive consumers between services) remains forbidden — orchestration
only.
```

Replace existing `rntme_orchestration_only.md` with above. Update `MEMORY.md` index line.

- [ ] **Step 2: Add pointer to the living document**

```markdown
---
name: audit waves living doc
description: docs/audit/00-waves.md is the consolidated audit planning doc; lifecycle in spec 2026-04-28-audit-consolidation-and-waves-design.md.
type: reference
---

`docs/audit/00-waves.md` is a **living** consolidated audit planning document built
from RNT-199..230 (snapshots in `docs/audit/<pkg>/README.md`).

It is updated as units close, get re-categorised, or as DECIDE answers arrive.
Process is canonical in
`docs/superpowers/specs/done/2026-04-28-audit-consolidation-and-waves-design.md`.

When working on audit follow-up, read the spec for process and `00-waves.md`
for state. Do not edit per-package audit snapshots.
```

Add a line to `MEMORY.md`:

```
- [audit_waves_doc.md](audit_waves_doc.md) — docs/audit/00-waves.md is the living waves planning doc; spec 2026-04-28
```

- [ ] **Step 3: Memory commit (memory dir is outside repo, no git action needed)**

The memory directory is in `~/.claude/` and not part of the repo, so no git step. Just save the files.

### Task 8.4: Hand-off summary to user

- [ ] **Step 1: Print a summary**

Show user:
- Final commit hash + message.
- `00-waves.md` line count.
- DEV unit count by wave (table).
- DECIDE count and a list of question titles awaiting answer.
- PARK count and trigger groups.
- REJECTED count.
- Pointer to spec for process; pointer to `00-waves.md` for state.

This is the natural pause point before user picks up DECIDE-track items or starts execution of W1.

---

## Self-review checklist (run before declaring plan done)

- [ ] Every Phase has at least one Task; every Task has at least one Step.
- [ ] No Step contains "TBD", "TODO", "fill in", "similar to above" without inline code.
- [ ] All `jq` and `bash` commands use real syntax (not pseudocode) — verified by reading them, not by running them in this plan.
- [ ] Every spec section §2-§7 has at least one corresponding Phase or Task that produces it.
- [ ] All file paths in tasks are absolute or repo-relative — no `/path/to/...` placeholders.

(Self-review notes will be embedded as commit-time review when the executor reaches Phase 8.)
