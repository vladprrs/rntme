# Decision System

> Canon for rntme strategic and architectural decisions.
> When a decision is needed, start here.
> If a decision does not fit, update Goals/Filters, not Bets.
> Update protocol: section 5.

---

## 1. North-Star Goals

Six goals. They are stable and change only deliberately through the update protocol in section 5.C.

**G1 - Blueprint = unit of truth.** The project blueprint folder is the canonical unit of authoring, versioning, and deploy. Identical inputs produce an identical running system. Authoring, review, and rollback operate at the blueprint level.

**G2 - AI agents author, humans decide.** The primary artifact author is an AI agent solving a human problem. Optimize for structured artifacts that can be validated, codified errors that an LLM can correct, canonical conventions that an LLM can compose, and fail-fast validation. Humans **do not read artifacts directly**; they review through inspection surfaces (see G3).

**G3 - Inspectable runtime.** Human understanding of the system comes through UI and observability surfaces (routes, events, ownership, state, traces), **not by reading JSON**. The UI can be built later, but the runtime must provide the data for it now. Every architectural decision either enables or preserves inspectability.

**G4 - Compose via canonical contracts; keep core lean.** Business processes and optional capabilities are assembled from vendor modules behind canonical contracts (BPMN, CloudEvents, gRPC, leaf contracts). Vendor SDKs stay behind the contract boundary. Blueprint core contains **only universally required artifacts**: the pieces without which a service does not exist. Anything needed only by some services is a module. Default bias: prefer a new module under an existing contract over a new core artifact or concept. File storage, AI/LLM, identity, CRM, email, and seed are modules, not core.

**G5 - Minimize entropy.** One canonical way per concept. Convention over flexibility. A new abstraction must justify itself against existing ones; "another way to do X" is a smell.

**G6 - Pre-stable: change is free** *(stage-conditional, expires at first design partners)*. With no users, backwards-compatibility discussions are premature. Renames, removals, and breaking changes are free when the motivation is clear. This will be replaced by stability discipline at the next stage; then this goal is removed or inverted.

---

## 2. Decision Filters

Eight filters. Each derives from one or more goals. Filters answer "why?" for any decision; if none applies, see section 5.B.

**F1 - Lean-core check** *(from G4)*. "Is this needed by every service/project, or only by some?" Only by some means a module under an existing contract, not a core extension.

**F2 - Canonical-way check** *(from G5)*. "Does this do the same thing as an existing mechanism, but differently?" If yes, explain why the existing mechanism does not fit; otherwise use the existing one.

**F3 - Contract-boundary check** *(from G4)*. Two-step check:
1. *If contract exists* - vendor SDK types and behavior live only in the module implementation. The contract is a leaf and has no vendor dependencies. A decision that changes the contract for one vendor is a smell.
2. *If contract is being shaped* - derive it from (a) behavior the runtime actually needs and (b) common capabilities across multiple vendors you plan to support. A contract is the smallest common denominator required by the runtime, not a single vendor. As vendors are added, the contract evolves; one vendor's quirks do not dictate the shape.

**F4 - Inspectability check** *(from G3)*. "Can a future UI show what this functionality does at runtime?" If the answer requires "read the code/artifact", it is a violation. Runtime emits events, state, ownership, and traces into well-known surfaces (CloudEvents, OpenTelemetry).

**F5 - LLM-authorability check** *(from G2)*. "Can an AI agent generate a correct artifact on the first attempt or after fail-fast feedback?" Structured JSON Schema, codified error codes, deterministic validation. Out-of-band knowledge required for correctness is a smell.

**F6 - Repeatability check** *(from G1)*. "Do identical blueprint inputs produce an identical running system?" No runtime-only flags, dynamic discovery, or boot-time side effects that are absent from the blueprint. Any dependency outside the blueprint is either an explicit input (env, secret) or a bug.

**F7 - Pre-stable bias** *(from G6, stage-conditional)*. "Is this a backwards-compatibility tax or a forward optimization?" Today, backwards compatibility is deferred until design partners. Renames, removals, and breaking changes are free; do not build deprecation paths. When G6 is removed, this filter goes with it.

**F8 - Leverage existing standards and libraries** *(from G4 + G5)*. Before writing custom code, use what already exists. Two layers:
- *External protocols/standards* (BPMN, CloudEvents, gRPC, OAuth, OpenTelemetry, JSON Schema, ...) for interfaces, exchange, and observability.
- *Popular, current projects inside rntme code* - for example **Bun** (covers package management, bundling, standalone test running, and runtime roles while retaining scoped `tsc` for typecheck and declaration emit), **JSON-driven UI rendering** libraries (instead of a hand-written engine in ui-runtime), and so on.

Applicability criteria: maintained, broadly adopted, not abandonware. Custom code must justify itself against an existing solution. Hand-rolling a hashmap, parser, schema validator, DB client, differ, retry logic, or migration engine is a smell. Less custom code means easier onboarding, simpler security patching, and lower bus-factor risk.

---

## 3. Locked-In Bets

Line format: `**<name>** - <one-line what> · Filter: <Fx/Gx> · Status: <status> · <optional ref>`. Status meanings: section 4.

### 3.1 Strategy

- **OSS-only Apache 2.0** - no commercial layer; identity/constraint, not a daily filter · `locked`
- **Blueprint folder = authoring/versioning/deploy unit** · G1, F6 · `locked`
- **AI agent = primary author** - humans review · G2, F5 · `locked`
- **Pre-stable: change is free** · G6, F7 · `locked-conditional` (until first design partners)
- **Platform as blueprint** - The rntme control plane is authored, reviewed, deployed, and evolved as a rntme project blueprint rooted at `apps/platform/blueprint`. Hand-written launchers may host or bridge the platform during migration, but domain/API/UI source of truth moves to artifacts. · G1, G2, G3, G5, F2, F4, F5, F6 · `locked-pending` · spec `docs/superpowers/specs/2026-05-09-platform-as-blueprint-design.md`
- **Deployments service + adapter boundary** - Platform deployment lifecycle is owned by a rntme `deployments` service. Target-neutral planning and provider-specific apply details sit behind an adapter seam. Dokploy remains the first adapter; a public deploy-adapter module contract is deferred until the service boundary stabilizes or a second backend exists. · G3, G4, F1, F3, F4, F8 · `locked-pending` · spec `docs/superpowers/specs/2026-05-09-platform-as-blueprint-design.md`
- **CLI universal deploy front** - The rntme CLI is the single user-facing deploy entry point and works in three modes (direct, platform-client, platform-bootstrap) over the same deploy engine. Direct mode never requires a running platform. · G1, G3, G5, F2, F4, F8 · `current-default` · spec `docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`
- **Deploy orchestrator library** - Deploy stage orchestration lives in `packages/deploy/deploy-runner` as a pure library with no HTTP/DB/BPMN dependency. CLI direct-mode and platform `services/deployments` workflow both depend on it; the platform side wraps it in a BPMN process for durability and inspectability. · G3, G4, G5, F1, F4, F8 · `current-default` · spec `docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`
- **BPMN-orchestrated deploy** - Inside the deployed platform, deploy is run as a BPMN process (`run-deployment.bpmn` in `services/deployments/workflows/`) with six native task handlers backed by `@rntme/deploy-runner`'s `stages.*`. CLI direct-mode remains synchronous and BPMN-free. · G3, G4, F1, F4 · `current-default` · spec `docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`, plan `docs/superpowers/plans/2026-05-10-bpmn-orchestrated-deploy-services-deployments.md`
- **No `apps/platform-http`** - The rntme platform is served exclusively by `@rntme/runtime` reading `apps/platform/blueprint`. There is no per-app launcher or hand-written HTTP server in the platform path. Project-delete orchestration is preserved as `runProjectDelete` in `@rntme/deploy-runner`; BPMN wiring for it is a follow-up. · G1, G2, G5, F1, F2, F6 · `current-default` · spec `docs/superpowers/specs/2026-05-10-cli-universal-deploy-and-platform-http-removal-design.md`, plan `docs/superpowers/plans/2026-05-10-platform-http-deletion.md`

### 3.2 Storage / Persistence

- **SQLite as default service store** - simplifies deploy (no provisioned DB) and avoids a db-per-service Postgres zoo. Alternatives (ClickHouse/DuckDB for analytics, Postgres where justified) are allowed when there is a concrete reason. · F8, G5 · `current-default`
- **RustFS as provisioned object storage (current default)** - target-local S3-compatible storage for preview Dokploy targets; external S3-compatible storage remains supported. · F8, G5 · `current-default` · spec `docs/superpowers/specs/2026-05-08-provisioned-rustfs-storage-design.md`
- ~~**Single-writer event log** - `event_store` is the only write path; load-bearing for optimistic concurrency and the monotonic publish cursor · G1 · `superseded` · superseded by `Project event log + DWH own replay truth` in spec `docs/superpowers/specs/2026-05-08-project-lifecycle-init-design.md`~~
- ~~**No outbox table; event log IS the outbox** - plus delivery tracking for metrics · F2 · `superseded` · superseded by `Project event log + DWH own replay truth` in spec `docs/superpowers/specs/2026-05-08-project-lifecycle-init-design.md`~~
- **Project event log + DWH own replay truth** - Kafka-compatible project topics are the operational event log; DWH is the long-retention replay/audit source. Service-local event stores are allowed as transactional outbox/write buffers, not as the durable replay boundary. QSM is serving state and must not be treated as replay truth. Events must carry the domain facts needed to rebuild owned projections; projection logic must not depend on unrecorded point-in-time external state. · G1, G3, F4, F6, F8 · `locked-pending` · spec `docs/superpowers/specs/2026-05-08-project-lifecycle-init-design.md`

### 3.3 Eventing & Messaging

- **Kafka-compatible protocol for inter-service eventing** · F8 · `locked`
- **Redpanda as broker (current default)** - simplest path to Kafka (single-node, no ZooKeeper); provisioned per project. The engine is a pragmatic default, not a permanent binding. · F8, G5 · `current-default`
- **CloudEvents 1.0 envelope end-to-end** · F8 · `locked` · spec `done/2026-04-17-cloudevents-envelope-design.md`
- **Kafka topic = `rntme.{svc}.{agg}` (no version suffix)** - breaking change means new eventType · F5 · `locked`
- **BPMN as the standard for cross-service async; choreography forbidden** · F8, G3, G4 · `locked`
- **Operaton as BPMN engine (current default)** - fastest path to a BPMN runtime; the engine is a pragmatic default, BPMN is the locked bet · F8 · `current-default` · spec `done/2026-05-05-provisioned-bpmn-operaton-design.md`

### 3.4 API & Contracts

- **gRPC between services** · F8 · `locked`
- **HTTP entry through `@rntme/bindings-http`** · F8 · `locked`
- **Leaf contracts in `packages/contracts/<category>/v1/`** - each contract is a separate package; modules/runtime/blueprint import contracts, not each other · F3, G4 · `locked`
- **JSON-only authoring** - AI agents produce structured JSON more reliably than YAML/TOML/custom DSLs · F5, G2 · `locked`
- **4-layer validation: parse -> structural -> references -> consistency** · F5 · `locked`

### 3.5 Modules & Integrations

- **Vendor capabilities -> modules under canonical contracts** - identity, AI/LLM, storage, CRM, email, notifications, seed · F1, F3, G4 · `locked`
- **Module shape: `module.json` + `@rntme/contracts-module-v1`** · F3 · `locked`
- **Browser module contract `@rntme/contracts-client-runtime-v1`** · F3 · `locked`
- **Provisioner contract `@rntme/contracts-provisioner-v1`** · G4 · `locked`
- **Auth0 as first identity module** · F8 · `locked` · spec `2026-04-29-notes-demo-auth0-design.md`
- **OpenRouter as first AI/LLM module** · F8 · `locked` · spec `done/2026-05-06-ai-llm-openrouter-module-design.md`
- **S3 as first storage module** · F1, F8 · `locked` · spec `2026-05-06-storage-s3-module-design.md`
- **`marketing-site` as a module category** — products attach externally-authored HTML landings as a first-class blueprint service · F1, G4 · `locked-pending` · spec `2026-05-07-product-landings-marketing-site-module-design.md`
- **`marketing-site-static` as first vendor** — HTML bundle pulled from S3, hosted via `nginx:alpine` · F8 · `locked-pending` · spec `2026-05-07-product-landings-marketing-site-module-design.md`
- **Seed as module (not part of core)** · F1, G4 · `locked-pending` (implementation TBD)
- **Module client surface owns product UI extension** - Product UI components, static browser assets, and reusable authoring fragments are contributed by module packages through `module.json#client.*`. `@rntme/ui-runtime` remains a generic host plus base catalog, and must not accumulate product-specific design systems. · G4, G5, F1, F2, F5, F6 · `locked-pending` · spec `docs/superpowers/specs/2026-05-12-module-client-ui-design-system-design.md`

### 3.6 Conventions

- **`Result<T>` everywhere - no exceptions across validation/compile boundaries** · F5, G2 · `locked`
- **Branded `Validated*` types only through their validators** · F5 · `locked`
- **Error code format `<PKG>_<LAYER>_<KIND>`** · F5, G2 · `locked`
- **Layering enforced by dependency-cruiser** - modules -> contracts only; contracts are leaves; artifacts/deploy do not import runtime; no cycles · F3, G4 · `locked`
- **No backwards-compatibility shims** - pre-stable · F7, G6 · `locked-conditional`

### 3.7 Tooling

- **Bun-first toolchain + scoped `tsc` exception** - Bun is the current default for package management, script running, tests, bundling, runtime, Docker runtime, and SQLite (`bun:sqlite`). `tsc` remains only for typecheck and `.d.ts` emit until the package-consumer contract intentionally moves to Bun-native raw TypeScript. · F8, G5 · `locked-pending` · spec `docs/superpowers/specs/2026-05-09-bun-first-toolchain-migration-design.md`
- **dependency-cruiser for layering** · F8 · `locked`
- **Dokploy for deploy** · F8 · `current-default`
- **Single Dokploy Compose per project deploy** - Dokploy preview deployments materialize one blueprint/project/environment as one Dokploy Compose resource with per-workload Compose services, not as multiple Dokploy Applications. This preserves blueprint-as-deploy-unit and a canonical Dokploy topology. · G1, G5, F6 · `locked-pending` · spec `docs/superpowers/specs/2026-05-09-dokploy-single-compose-deploy-design.md`

---

## 4. Status Meanings

| Status | Meaning | Change protocol |
|---|---|---|
| `locked` | Decision is fixed. Reversal goes through update protocol section 5.A.4. | Moves to `superseded` through 5.A.4 or 5.C.3 - never silently re-decided. |
| `current-default` | Current pragmatic choice; alternatives are allowed with rationale. | Changes freely with rationale in the spec, without contradiction escalation. |
| `locked-conditional` | Locked while the stated condition holds. The condition is the trigger. | When the condition no longer holds, becomes permanently `locked` or is removed. |
| `locked-pending` | Decided, but not implemented. | Becomes `locked` when implementation lands. |
| `superseded` | Replaced by a newer bet. Kept in the file with strikethrough plus a link to the replacement for traceability. | Never reactivated; if it is needed again, add a new bet. |

Superseded lines **stay** in the file (struck through, with a link to the replacement), otherwise the history of why we no longer do something is lost.

---

## 5. Update Protocol

Goal: every contradiction between a new decision and the decision system becomes an **intentional** edit to goals/filters/bets, not silent drift.

### 5.A - Bet Contradiction (Most Common)

A decision does not match an existing bet. Signal: either the bet is outdated or the decision is wrong.

1. Identify the bet and its status.
2. Check filters: does the new decision derive from existing filters better than the old bet? If yes, the old bet was weakly justified; update it.
3. **For `current-default`**: replacement is the normal path. Update the line with new rationale; no escalation. This status exists for exactly that.
4. **For `locked`**: escalate. Either (a) move `locked` -> `superseded` with an inline marker and a link to the new bet, or (b) reject the new decision if it is less justified. The user decides explicitly. The retired line stays for traceability.
5. **For `locked-pending`**: implementation has not landed yet; update freely like `current-default`.

### 5.B - Filter Gap (New Type of Rationale)

A decision is justified by an argument not covered by filters. Signal: "we do X because Y", and Y does not reduce to Fx/Gx.

1. **Extract the principle** from rationale Y. Is it a special case of an existing filter, or a new axis?
2. If it is a **special case**, extend the existing filter with one line (example, edge case). Do not duplicate filters.
3. If it is a **new axis**, propose a new filter `Fn` and tie it to an existing goal. If no goal exists, this is a section 5.C signal.
4. Filter add/extend = **edit `decision-system.md` in the same spec** that produced the decision. Do not use a separate PR.

### 5.C - Goal Violation (Most Serious)

A decision directly contradicts a goal. This is redesign-level.

1. **Stop.** Do not implement the decision or edit the goal without explicit user authorization.
2. **Surface the conflict**: "Decision X violates G_n because [reason]. Options: (a) the goal needs refinement/replacement - what reality changed? (b) the decision is wrong - reject it. (c) an exception is justified - record it as a documented exception in bets with inline rationale."
3. **The user explicitly chooses** one of the three paths.
4. If a goal changes, **re-examine every filter and bet** affected by that goal. This is not optional.

### 5.D - Status Transitions (Mechanical)

```text
locked-pending     -> locked              (implementation landed)
current-default    -> locked              (alternatives explored and rejected)
current-default    -> current-default     (replaced, no escalation, with spec)
locked             -> superseded          (through path 5.A.4 or 5.C.3)
locked-conditional -> locked              (condition fixed permanently)
locked-conditional -> removed             (condition resolved away)
```

### 5.E - Authorization Matrix

| Change | Initiator | Approver |
|---|---|---|
| Bet (`current-default` swap) | Claude or user | User in spec |
| Bet (`locked` -> `superseded`) | Through path 5.A.4 | User explicitly |
| Filter add/extend | Claude proposes | User in spec |
| Goal text refinement | User | User |
| Goal add/remove | User | User |

Claude **never** edits goals without explicit user authorization. Filters and bets are proposed by Claude as part of the brainstorming-session spec.

### 5.F - Audit Trail

Rely on git history for `docs/decision-system.md` plus links from bets/filters to specs that changed them. Do not maintain a separate changelog.

---

## 6. Open Questions

Unresolved forks. Each carries a `re-evaluate when:` trigger.

1. **Adopt Drizzle ORM in service runtime?** - Considered in spec `2026-04-18-drizzle-adoption-design.md`. Implemented in the platform, but the platform is being rewritten. *Re-evaluate when:* service-layer migration tooling is needed more than raw SQL files.

2. **Move from Bun-first + `tsc` exception to Bun-native raw TypeScript packages?** - Long-term target is raw `.ts` package consumption under Bun, removing `tsc` once rntme intentionally makes Bun the package-consumer contract. *Re-evaluate when:* Bun-first migration has landed and package publishing/consumer requirements are ready for a dedicated 2A spec.

3. **Promote `Operaton` and `Redpanda` from `current-default` to `locked`?** - They are pragmatic defaults today. *Re-evaluate when:* a second project ships on the same engines without friction pointing to another choice.
