# Decision system — design

> Status: design (brainstorming complete). Use as input for `writing-plans`.
> Scope: create `docs/decision-system.md` as the canonical home for goals, decision filters, and locked-in bets. Define an update protocol for evolving the system through contradictions. Define how Claude integrates the file into brainstorming and architectural decisions. Cascading shrink of `CLAUDE.md`, `AGENTS.md`, and the deletion of `docs/architecture.md` are **noted as follow-ups**, not part of this spec's implementation.
> Non-goals: writing the slimmed CLAUDE.md / AGENTS.md (separate spec); deleting `docs/architecture.md` (separate spec); modifying the `superpowers:brainstorming` skill itself; building tooling (linters, validators) around the decision-system file; migrating per-package READMEs; editing historical specs.

## 1. Problem

Current rntme decision context is scattered across at least six surfaces:

- `CLAUDE.md` — project conventions, "Architecture in one paragraph", "Non-obvious conventions" list
- `AGENTS.md` — research map + per-package recipes + anti-patterns
- `docs/architecture.md` — 1669-line C4 overview with `Cutoff: 2026-04-26` disclaimer (rotting doc)
- `docs/adr/2026-04-15-event-driven-architecture.md` — single ADR analysis artifact
- `docs/superpowers/specs/` — per-feature designs (rationale embedded per spec)
- `MEMORY.md` — episodic facts, gotchas, vision framing

The pains this causes during brainstorming and design work:

1. **Repeat questions on settled choices** — "OSS or commercial?", "Result<T> or throw?", "Postgres or SQLite?" — answers are recorded somewhere but Claude re-asks because no canonical surface gathers them.
2. **No derivation path from goals to decisions** — when there is no explicit bet, Claude lacks an articulated set of filters to derive an answer (e.g. "this would lengthen time-to-second-service" is in memory but not actionable as a filter).
3. **Drift between specs** — one spec assumes X, another assumes not-X, because there is no canonical reference to disagree with.
4. **Slow context onboarding** — each session re-reads ~6 surfaces to reconstruct strategic posture.

The 2026-05-07 vision-deletion / README-rework spec retired the OSS-vs-commercial split and broadened the wedge. That refresh narrowed the strategic surface but left the structural problem: there is no place where goals, filters, and locked-in bets live together with a defined evolution mechanism.

## 2. Goal

After this spec lands:

1. `docs/decision-system.md` exists as the canonical home for: north-star goals, decision filters, locked-in bets, an update protocol, and an open-questions list.
2. The file is sized to be loaded fully at the start of any brainstorm session (target 400-600 lines).
3. The file defines an explicit **update protocol** so contradictions between new decisions and the system trigger deliberate edits to goals/filters/bets, not silent drift.
4. The file defines how Claude **integrates** it into the brainstorming flow: read at start, consult before each clarifying question, evaluate proposed approaches against filters, write back updates at the end of the session.
5. `CLAUDE.md` and `AGENTS.md` gain a single `## Decision system` paragraph pointing at the file. The shrinking of those files is left as a follow-up spec.
6. `docs/architecture.md` deletion is noted as a follow-up. This spec does not delete it.
7. Existing inputs (CLAUDE.md "Non-obvious conventions", positioning paragraph, memory framing files, ADR D1-D14, recent specs) are mined into the bets table without inventing new positions. Any contradiction surfaced during mining is recorded as an open question, not silently resolved.

## 3. Decisions

| Q | Question | Decision |
|---|---|---|
| Q1 | One canonical doc, two-doc split, or per-decision ADR style? | **One canonical doc** (`docs/decision-system.md`). Single read at brainstorm start; atomic edits; no aggregation cost. The ADR-style approach is rejected because reading "current state" requires walking N files. |
| Q2 | Scope of decisions captured? | **Strategic + architectural conventions.** Includes Result<T>, branded Validated*, error-code naming, layering rules, JSON-only authoring. Excludes feature-level bets (feature specs remain authoritative for those). |
| Q3 | Where do feature-level bets (Auth0, OpenRouter, S3, Drizzle) live? | **In the bets table**, linked to their specs. They are derivative of canonical-contract bets; the contracts are the load-bearing layer, the vendors are pragmatic-default choices. |
| Q4 | Goals layer included or only filters/bets? | **Goals included** as load-bearing claims. Goals → filters → bets is the layering. Contradiction handling per §5 of the file targets goals/filters first; bets are derivative. |
| Q5 | Should OSS-only / Apache 2.0 be a goal? | **No, it is a Strategic bet.** It is identity/constraint-shaped, not daily-decision-shaped. Removing it from goals avoids cargo-culted goal entries. |
| Q6 | How to mark bets that are pragmatic defaults vs hard locks? | **Status field** with values `locked`, `current-default`, `locked-conditional`, `locked-pending`, `superseded`. Status transitions defined in §5 of the file. |
| Q7 | Audit trail for changes? | **Git history of `docs/decision-system.md` + inline links from bets/filters to specs that changed them.** No separate change log section (duplication). |
| Q8 | Does Claude auto-edit the file? | **Filters and bets — Claude proposes edits inside the spec for that brainstorm; user approves via spec approval. Goals — Claude never edits without explicit user authorization.** |
| Q9 | Integration mechanism (how does Claude reliably read it)? | **Pointer paragraphs in CLAUDE.md and AGENTS.md** instructing the read at brainstorm-context-load time. The `superpowers:brainstorming` skill is not modified. |
| Q10 | Cascading shrink of CLAUDE.md / AGENTS.md / architecture.md? | **Out of scope for this spec.** Recorded as follow-up specs (§7). This spec only lands `decision-system.md` and the pointer paragraphs. |

## 4. File design — `docs/decision-system.md`

### 4.1 Skeleton

```
# Decision System

> Канон стратегических и архитектурных решений rntme.
> Если нужно принять решение — читай отсюда.
> Если решение не вписывается — правь Goals/Filters, не Bets.
> Update protocol — §5.

## 1. North-star goals
## 2. Decision filters
## 3. Locked-in bets
##    3.1 Strategy
##    3.2 Storage / persistence
##    3.3 Eventing & messaging
##    3.4 API & contracts
##    3.5 Modules & integrations
##    3.6 Conventions
##    3.7 Tooling
## 4. Status meanings
## 5. Update protocol
## 6. Open questions
```

Target size: 400-600 lines. The TL;DR header at the top is 4-6 lines so a casual reader sees the contract immediately.

### 4.2 North-star goals (verbatim content)

Six goals. Stable. Edited deliberately through update protocol §5.C.

**G1 · Blueprint = unit of truth.** Project blueprint folder — каноническая единица authoring, versioning, deploy. Identical inputs → identical running system. Authoring, review, rollback оперируют на уровне blueprint.

**G2 · AI agents author, humans decide.** Основной автор артефактов — AI agent, решающий проблему человека. Оптимизируем под: structured artifacts (validatable), codified errors (LLM-correctable), canonical conventions (LLM-composable), fail-fast validation. Humans **не читают артефакты** — они review через inspection surfaces (см. G3).

**G3 · Inspectable runtime.** Понимание системы человеком идёт через UI / observability surfaces (routes, events, ownership, state, traces) — **не через чтение JSON**. UI можно строить позже, но runtime обязан поставлять данные для него уже сейчас. Каждое архитектурное решение либо обеспечивает, либо сохраняет inspectability.

**G4 · Compose via canonical contracts; keep core lean.** Бизнес-процессы и опциональные capabilities собираются из vendor modules под canonical contracts (BPMN, CloudEvents, gRPC, leaf contracts). Vendor SDK живут за contract boundary. Blueprint core содержит **только universally-required артефакты** (то, без чего service'а не существует). Всё что нужно лишь некоторым service'ам — module. Default bias: «скорее новый module под существующий contract, чем новый артефакт/концепт в core». File storage, AI/LLM, identity, CRM, email, seed — модули, не core.

**G5 · Minimize entropy.** One canonical way per concept. Convention over flexibility. Новая абстракция оправдывает себя против существующих; «ещё один способ делать X» — smell.

**G6 · Pre-stable: change is free** *(stage-conditional, expires at first design partners)*. Нет пользователей → backwards-compat обсуждения преждевременны. Renames/removals/breaking changes — free когда мотивация ясна. Заменится stability-дисциплиной на следующей стадии — и тогда этот goal удаляется или инвертируется.

### 4.3 Decision filters (verbatim content)

Eight filters. Each derives from one or more goals. Filters answer "почему?" for any decision; if no filter answers, see §5.B.

**F1 · Lean-core check** *(from G4)*. «Нужно ли это каждому service'у/проекту, или только некоторым?» Только некоторым → module под существующий contract, не расширение core.

**F2 · Canonical-way check** *(from G5)*. «Делает ли это то же что уже существующий механизм, но иначе?» Если да — обоснуй почему существующий не подходит; иначе используй существующий.

**F3 · Contract-boundary check** *(from G4)*. Двухступенчатый:
1. *If contract exists* — vendor SDK типы и поведение живут только в module реализации. Contract — leaf, без vendor-зависимостей. Решение требует менять contract под одного vendor'а → smell.
2. *If contract is being shaped* — выводи его из (a) поведения которое runtime'у реально нужно, (b) общих capabilities у нескольких vendors которых ты планируешь поддержать. Contract — наименьший общий знаменатель под нужды runtime, не один vendor. По мере добавления vendors contract эволюционирует; квирки одного vendor'а не диктуют форму.

**F4 · Inspectability check** *(from G3)*. «Может ли будущий UI показать что эта функциональность делает в runtime?» Если ответ требует «прочитай код / артефакт» — нарушение. Runtime эмитит события, state, ownership, traces в общеизвестные surfaces (CloudEvents, OpenTelemetry).

**F5 · LLM-authorability check** *(from G2)*. «Может ли AI agent сгенерировать корректный артефакт с одной попытки или после fail-fast feedback'а?» Структурированный JSON-Schema, codified error codes, deterministic validation. Out-of-band знание для корректности → smell.

**F6 · Repeatability check** *(from G1)*. «Identical blueprint inputs → identical running system?» Никаких runtime-only флагов, dynamic discovery, side-effects при boot которых нет в blueprint. Зависимость от чего-то вне blueprint = либо явный input (env, secret), либо bug.

**F7 · Pre-stable bias** *(from G6, stage-conditional)*. «Это backwards-compat tax или forward optimization?» Сейчас: backwards-compat откладывается до design partners. Renames/removals/breaking changes — free; deprecation paths не строим. Когда G6 отменится, этот filter тоже.

**F8 · Leverage existing standards and libraries** *(from G4 + G5)*. Прежде чем писать своё — используй существующее. Два слоя:
- *Внешние протоколы/стандарты* (BPMN, CloudEvents, gRPC, OAuth, OpenTelemetry, JSON Schema, ...) — для интерфейсов, обмена, наблюдаемости.
- *Популярные актуальные проекты внутри rntme кода* — например **Bun** (заменяет pnpm + tsc + esbuild + test runner одним тулом), **JSON-driven UI rendering** библиотеки (вместо рукописного движка в ui-runtime), и т.д.

Critique: maintained, broad adoption, не abandonware. Custom код обосновывает себя против existing solution. Hand-roll'инг hashmap'а, парсера, schema-validator'а, DB клиента, дифферa, retry-логики, миграционного движка — smell. Меньше custom code → легче onboard, проще патчить security, устойчивее к bus-factor.

### 4.4 Locked-in bets — domain groups

Format per row: `**<name>** — <one-line what> · Filter: <Fx/Gx> · Status: <status> · <optional ref>`.

#### 3.1 Strategy
- **OSS-only Apache 2.0** — нет commercial layer; identity / constraint, не daily filter · `locked`
- **Blueprint folder = authoring/versioning/deploy unit** · G1, F6 · `locked`
- **AI agent = primary author** — humans review · G2, F5 · `locked`
- **Pre-stable: change is free** · G6, F7 · `locked-conditional` (до first design partners)

#### 3.2 Storage / persistence
- **SQLite as default service store** — упрощает deploy (no provisioned DB), избегает db-per-service Postgres-zoo. Альтернативы (ClickHouse/DuckDB для аналитики, Postgres где обоснованно) — по делу с обоснованием. · F8, G5 · `current-default`
- **Single-writer event log** — event_store = единственный write path; load-bearing для optimistic concurrency и monotonic publish cursor · G1 · `locked` · ADR `docs/adr/2026-04-15-event-driven-architecture.md`
- **No outbox table; event log IS the outbox** — + delivery_tracking для метрик · F2 · `locked` · ADR D1

#### 3.3 Eventing & messaging
- **Kafka-compat protocol для inter-service eventing** · F8 · `locked`
- **Redpanda как broker (current default)** — самый простой путь к Kafka (single-node, без Zookeeper); provisioned per project. Engine — pragmatic default, не вечная привязка. · F8, G5 · `current-default`
- **CloudEvents 1.0 envelope end-to-end** · F8 · `locked` · spec `2026-04-17-cloudevents-envelope-design.md`
- **Kafka topic = `rntme.{svc}.{agg}` (no version suffix)** — breaking change → new eventType · F5 · `locked`
- **BPMN as standard для cross-service async; choreography forbidden** · F8, G3, G4 · `locked`
- **Operaton как BPMN engine (current default)** — самый быстрый путь к BPMN runtime; engine — pragmatic default, BPMN — locked bet · F8 · `current-default` · spec `2026-05-05-provisioned-bpmn-operaton-design.md`

#### 3.4 API & contracts
- **gRPC между service'ами** · F8 · `locked`
- **HTTP entry через `@rntme/bindings-http`** · F8 · `locked`
- **Leaf contracts в `packages/contracts/<category>/v1/`** — каждый contract отдельный package; modules/runtime/blueprint импортируют contracts, не друг друга · F3, G4 · `locked`
- **JSON-only authoring** — AI agents лучше делают structured output в JSON чем в YAML/TOML/custom DSL · F5, G2 · `locked`
- **4-layer validation: parse → structural → references → consistency** · F5 · `locked`

#### 3.5 Modules & integrations
- **Vendor capabilities → modules под canonical contracts** — identity, AI/LLM, storage, CRM, email, notifications, seed · F1, F3, G4 · `locked`
- **Module shape: `module.json` + `@rntme/contracts-module-v1`** · F3 · `locked`
- **Browser module contract `@rntme/contracts-client-runtime-v1`** · F3 · `locked`
- **Provisioner contract `@rntme/contracts-provisioner-v1`** · G4 · `locked`
- **Auth0 как первый identity module** · F8 · `locked` · spec `2026-04-29-notes-demo-auth0-design.md`
- **OpenRouter как первый AI/LLM module** · F8 · `locked` · spec `2026-05-06-ai-llm-openrouter-module-design.md`
- **S3 как первый storage module** · F1, F8 · `locked` · spec `2026-05-06-storage-s3-module-design.md`
- **Seed как module (не часть core)** · F1, G4 · `locked-pending` (имплементация TBD)

#### 3.6 Conventions
- **`Result<T>` everywhere — no exceptions в validation/compile** · F5, G2 · `locked`
- **Branded `Validated*` types только через свои validators** · F5 · `locked`
- **Error code format `<PKG>_<LAYER>_<KIND>`** · F5, G2 · `locked`
- **Layering enforced by dependency-cruiser** — modules → contracts only; contracts — leaves; artifacts/deploy не импортируют runtime; no cycles · F3, G4 · `locked`
- **No backwards-compat shims** — pre-stable · F7, G6 · `locked-conditional`

#### 3.7 Tooling
- **pnpm + Node 20 + tsc + vitest + esbuild** · F8 · `current-default` · *in-flight migration to Bun planned (see §6 Open questions)*
- **dependency-cruiser** для layering · F8 · `locked`
- **Dokploy** для deploy · F8 · `current-default`

> **Note on coverage.** This list is the seed extracted from CLAUDE.md, AGENTS.md, ADR `2026-04-15-event-driven-architecture.md`, recent specs (mainly the modules-monorepo, CloudEvents-envelope, drizzle-adoption, provisioned-BPMN-Operaton, AI-LLM-openrouter, storage-s3, project-first), and `MEMORY.md`. During implementation a final pass mines the same sources to catch anything missed; new bets surfaced go into `current-default` or `locked` depending on whether explicit alternatives have been considered.

### 4.5 Status meanings (verbatim content)

| Status | Meaning | Change protocol |
|---|---|---|
| `locked` | Decision settled. Reversal requires update protocol §5.A.4 escalation. | Goes to `superseded` via path A.4 or C.3 — never silently re-decided. |
| `current-default` | Pragmatic current pick; alternatives possible with justification. | Swap freely with spec rationale (no contradiction escalation). |
| `locked-conditional` | Locked while a stated condition holds. The condition is the trigger. | When condition flips, becomes `locked` permanently or removed. |
| `locked-pending` | Decided but not yet implemented. | Becomes `locked` once implementation lands. |
| `superseded` | Replaced by a newer bet. Stays in file with strikethrough + link to replacement, for traceability. | Never re-activated; if needed again, a new bet is added. |

Superseded rows stay in the file (struck through, with a link to their replacement) so the history of "почему мы так не делаем" is preserved alongside "что мы делаем".

### 4.6 Update protocol (verbatim content)

Three contradiction types. Each has a distinct flow.

#### 5.A · Bet contradiction (most common)

Decision contradicts an existing row in the bets table.

1. Identify which bet and its status.
2. Check filters — is the new decision better-derived from existing filters than the old bet? If yes, the old bet was already weakly grounded; update.
3. **For `current-default`**: replacement is normal — update the row with new rationale; no escalation. The status exists for this case.
4. **For `locked`**: escalate. Either (a) `locked` → `superseded` with inline marker and link to the new bet, or (b) reject the new decision if its grounding is weaker. User decides explicitly. The superseded row stays in place for traceability.
5. **For `locked-pending`**: implementation has not landed — update freely as if `current-default`.

#### 5.B · Filter gap (new kind of reasoning)

A decision is justified by an argument no existing filter expresses.

1. Extract the principle from the argument. Is it a special case of an existing filter, or a new axis?
2. **Special case** — extend an existing filter with one line (example, edge case). Do not create duplicates.
3. **New axis** — propose a new filter `Fn`, link it to the goal it derives from. If no goal supports it, escalate to §5.C.
4. The filter add/extend lands in `decision-system.md` **inside the same spec** that surfaced the decision — not in a separate PR.

#### 5.C · Goal violation (most serious)

A decision directly contradicts a goal.

1. **Stop.** Do not implement the decision and do not edit the goal without explicit user authorization.
2. **Surface the conflict** with structured options: "Decision X violates G_n because [reason]. Options: (a) goal needs refinement/replacement — what reality shifted?, (b) decision is wrong — reject, (c) exception is justified — record as documented exception in bets with inline rationale."
3. **User chooses explicitly** which path.
4. If the goal changes, **re-examine all filters and bets** that derive from it. This is not optional.

### 4.7 Authorization matrix (verbatim content)

| Change | Initiator | Approver |
|---|---|---|
| Bet (`current-default` swap) | Claude or user | User in spec |
| Bet (`locked` → `superseded`) | Through path 5.A.4 | User explicitly |
| Filter add/extend | Claude proposes | User in spec |
| Goal text refinement | User | User |
| Goal add/remove | User | User |

Claude **never** edits goals without explicit user authorization. Filters and bets — Claude proposes edits as part of the brainstorming spec output.

### 4.8 Open questions section (initial content)

The file ships with three open questions seeded from this spec. Each carries a `re-evaluate when:` trigger:

1. **Adopt Drizzle ORM in service runtime?** — Was considered in spec `2026-04-18-drizzle-adoption-design.md`. Implemented in the platform but the platform is being rewritten. Re-evaluate when: a service-layer migration tool is needed beyond raw SQL files.
2. **Migrate toolchain to Bun?** — Replaces pnpm + tsc + esbuild + test runner. Re-evaluate when: a dedicated migration spec is started.
3. **Promote `Operaton` and `Redpanda` from `current-default` to `locked`?** — Currently pragmatic defaults. Re-evaluate when: a second project has shipped with the same engines and no friction has surfaced that points at a different choice.

## 5. Brainstorming integration

### 5.1 Read points

**Step 1 (Explore project context, brainstorming skill).** `docs/decision-system.md` is read in full. Token cost: ~1.5-2k tokens (target file size 400-600 lines). This is compensation for what was previously scattered.

**Before each clarifying question (Step 3).** Claude checks:
- Does an existing **bet** answer this? → state, do not ask.
- Does the answer follow from **filters**? → derive, do not ask.
- Only if no bet and no filter applies — ask the user.

This is the primary mechanism for **reducing question count**.

**Before proposing approaches (Step 4).** Each candidate approach is evaluated against filters. Approaches violating filters are flagged or rejected.

**During implementation (outside brainstorm).** Architecturally significant choices read the relevant section on demand. Driven by the pointer paragraph in `CLAUDE.md` (§5.3).

### 5.2 Write points

**End of brainstorm (Step 6 — Write design doc).** If contradictions surfaced (any type from the update protocol in §4.6 — bet, filter gap, or goal violation), the spec includes a dedicated section: *"Updates to decision-system.md"*. Contents:
- Bets being updated and how
- Filters being added or extended
- Any proposed goal edit with rationale (§5.C only)

When the user approves the spec, the same edits land in `decision-system.md` **in the same PR** as the spec. Atomicity matters for consistency — no decoupling.

**On feature merge.** `locked-pending` → `locked` happens when the implementation lands. Trigger: final feature-spec merge. The transition is a manual edit today; a post-merge automation is left for later (not in scope).

### 5.3 Hooks in CLAUDE.md and AGENTS.md

Both files gain an identical paragraph (this spec lands the paragraphs; the broader shrinking of those files is a follow-up):

```markdown
## Decision system

For any strategic, architectural, or convention-level decision: read
`docs/decision-system.md` first. It contains goals, decision filters,
and locked-in bets. Before asking the user a decision question, check
whether the system already answers it. If a decision contradicts an
existing bet or violates a goal, follow the Update protocol (§5 of
that file).
```

This triggers the read through project-context-loading without modifying the `superpowers:brainstorming` skill.

### 5.4 What does NOT move into `decision-system.md`

- **Episodic state** (deploy IDs, infra context, vendor-specific gotchas) — stays in `MEMORY.md`.
- **Per-package internals** — stay in per-package READMEs.
- **Research map / where to find things** — stays in `AGENTS.md`.
- **Recent project state / git history** — observed via `git log`, not duplicated.

The boundary:
- `decision-system.md`: *how we decide* + *what we decided* (rationale-bearing)
- `AGENTS.md`: *where things live* (navigation)
- `CLAUDE.md`: *what this project is, what commands run* (entry point)
- `MEMORY.md`: episodic facts, gotchas, contextual notes
- `specs/`: per-feature designs (may modify decision-system through update protocol)

## 6. Migration / cascading changes

### 6.1 In scope for this spec

1. Create `docs/decision-system.md` with the content described in §4.
2. Add the `## Decision system` paragraph to `CLAUDE.md` and `AGENTS.md` (paragraph from §5.3, identical in both files).
3. No deletions, no shrinking, no edits to `docs/architecture.md`.
4. No edits to per-package READMEs, historical specs, or `MEMORY.md`.

### 6.2 Out of scope (recorded as follow-up specs)

These are intentionally separate so this spec's PR stays small and reviewable, and so each cascading change can be discussed on its own merits:

1. **`docs/architecture.md` deletion.** The 1669-line C4 doc with `Cutoff: 2026-04-26` is rotting. Architectural rationale moves into `decision-system.md` bets; structural state is observable from `.dependency-cruiser.cjs` + per-package READMEs + `README.md` hero. Follow-up spec: `delete-architecture-md-design.md`.
2. **`CLAUDE.md` radical shrink.** After `decision-system.md` lands, CLAUDE.md becomes a thin entry point: project name + commands + pointer to AGENTS.md and decision-system.md. The "Non-obvious conventions" section is absorbed into `decision-system.md` filters/bets. Follow-up spec: `claude-md-shrink-design.md`.
3. **`AGENTS.md` selective shrink.** The research map (where things live) stays; convention prose moves to decision-system. Follow-up spec: `agents-md-shrink-design.md`.

These follow-ups depend on this spec landing first (the canonical home must exist before content can move into it).

### 6.3 What this spec does NOT do for existing files

- Does not delete `docs/architecture.md` (follow-up).
- Does not edit "Non-obvious conventions" or "Architecture in one paragraph" sections of `CLAUDE.md` (follow-up).
- Does not edit `AGENTS.md` §3 / §6 / §10 prose (follow-up).
- Does not edit ADR `docs/adr/2026-04-15-event-driven-architecture.md`. The ADR is referenced from bets; its prose remains as the in-depth analysis.
- Does not edit `MEMORY.md` entries that overlap with bets. They remain as episodic context; if drift between memory and decision-system surfaces, decision-system wins (it is canonical).

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| File grows beyond 400-600 line target as bets accumulate. | Cap enforced by review discipline: bets that are vendor-specific go to specs, not the file. Conventions consolidated rather than enumerated when patterns emerge. |
| Claude does not actually read the file at brainstorm start. | Pointer paragraph in `CLAUDE.md` — primary mechanism. If unreliable in practice, follow-up: extend `superpowers:brainstorming` skill via plugin (not in scope here). |
| User starts editing goals without protocol §5.C. | Authorization matrix in §4.7 is normative. Skill prompts catch the deviation. Final backstop: PR review. |
| Drift between bets and the underlying specs. | Bets link to specs; when a spec changes a bet, its update lands in the same PR (per §5.2). |
| Filters too abstract to apply mechanically. | Filters carry concrete examples and "this is a smell when…" patterns. Filter gaps surface as §5.B contradictions and force articulation. |
| Pre-stable G6 / F7 stays past stage flip. | G6 carries `expires at first design partners` annotation. When the stage flips, a dedicated spec retires G6 and F7 together. |

## 8. Acceptance criteria

This spec is complete when:

1. `docs/decision-system.md` exists with the structure of §4.1, populated with goals (§4.2), filters (§4.3), bets (§4.4), status meanings (§4.5), update protocol (§4.6), authorization matrix (§4.7), and the seeded open questions (§4.8).
2. `CLAUDE.md` contains the `## Decision system` paragraph from §5.3.
3. `AGENTS.md` contains the same paragraph.
4. The file is committed; CI passes (`build → typecheck → test → lint → depcruise → vendor:check`); no other files in this PR.
5. The three follow-up specs from §6.2 are listed in `docs/superpowers/specs/` planning notes (or as TODO comments in the relevant files) so they are not lost.

## 9. References

- ADR `docs/adr/2026-04-15-event-driven-architecture.md` — source for several Eventing/Storage bets (D1, D-series).
- Spec `done/2026-05-07-vision-deletion-readme-rework-design.md` — establishes OSS-only / Apache 2.0 strategic posture, retires the OSS-vs-commercial frame, broadens the wedge.
- Spec `2026-04-17-cloudevents-envelope-design.md` — CloudEvents 1.0 envelope bet.
- Spec `2026-04-18-drizzle-adoption-design.md` — origin of the Drizzle open question.
- Spec `2026-04-26-modules-monorepo-structure-design.md` — vendor module shape and contract layering.
- Spec `2026-04-29-notes-demo-auth0-design.md` — Auth0 module bet.
- Spec `2026-05-05-provisioned-bpmn-operaton-design.md` — Operaton current-default bet.
- Spec `2026-05-06-ai-llm-openrouter-module-design.md` — OpenRouter module bet.
- Spec `2026-05-06-storage-s3-module-design.md` — S3 module bet.
- `MEMORY.md` — `project_platform_vision.md`, `rntme_vision_framing.md`, `rntme_market_positioning.md`, `rntme_pre_stable_stage.md`, `rntme_orchestration_only.md`, `rntme_topic_no_version_suffix.md` — sources of strategic framing inputs.
- `CLAUDE.md` "Non-obvious conventions" — source of convention bets.
- `AGENTS.md` (current) — source of layering rules and anti-patterns.
