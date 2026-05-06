# Current Priority Retirement Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining rows in `docs/audit/01-current-priority-tasks.md` without introducing standalone architecture churn that the audit document itself says to avoid.

**Architecture:** Treat the remaining rows as triage/documentation work, not code work. U-029 and U-111 are broad SRP refactors with no behavior defect; U-112 is a future worker/process split that depends on stable deploy semantics; U-002 and U-003 are monorepo topology work that should wait for stable project-level runtime intake and gRPC/bindings seam changes; U-004 is already governed by the dependency-upgrade deferral spec. Remove these from the active priority table, keep real architecture items parked with explicit triggers, and close U-004 against the canonical deferral decision.

**Tech Stack:** Markdown audit ledger only; no runtime code changes.

---

## File Map

- Modify `docs/audit/01-current-priority-tasks.md` to make the sorted active list empty and record retired/deferred rows with triggers.
- Modify `docs/audit/00-waves.md` to close U-004 per the dependency deferral spec and add explicit active-list retirement notes for U-029, U-111, U-112, U-002, and U-003.

### Task 1: Retire Non-Actionable Active Rows

- [x] **Step 1: Update active priority table**

Remove U-029, U-111, U-112, U-002, U-003, and U-004 from the sorted active list and add a short “no active code-work rows remain” statement.

- [x] **Step 2: Add deferred-row trigger notes**

Record why each retired row remains parked/deferred and what future trigger should bring it back.

### Task 2: Ledger Updates

- [x] **Step 1: Close U-004 per dependency deferral spec**

Mark U-004 `✅ closed | A15` and update the monorepo package summary.

- [x] **Step 2: Add active-list retirement notes**

Leave U-029, U-111, U-112, U-002, and U-003 parked in `00-waves.md`, but append explicit “removed from current priority” rationale so they do not reappear as immediate work.

### Task 3: Verification

- [x] **Step 1: Verify no sorted active rows remain**

Run:

```bash
rg -n "^[|] [0-9]+ [|]" docs/audit/01-current-priority-tasks.md
rg -n "U-029|U-111|U-112|U-002|U-003|U-004" docs/audit/01-current-priority-tasks.md docs/audit/00-waves.md
```

Expected: no rows in the sorted active list; retired units appear only in deferred/ledger context.

Observed: the active-row `rg` returned no matches; retired units appear in
parked/deferred ledger rows and the current-priority retired section only.

---

## Self-Review

- Scope control: avoids unsupported large refactors and process splits.
- Source-of-truth alignment: U-004 follows `2026-04-30-dependency-upgrade-deferral-design.md`; the other rows remain parked with triggers.
- Documentation-touch: both audit docs are updated.
