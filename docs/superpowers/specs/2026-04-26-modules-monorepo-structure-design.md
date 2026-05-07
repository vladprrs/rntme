# modules monorepo structure & categorical contracts — design

**Status:** design
**Status update (2026-05-06):** References to domain blueprints calling modules through binding-level `pre[]` are historical. The categorical contract goals remain, but domain operation calls are authored as Graph IR `call` nodes per `docs/superpowers/specs/done/2026-05-06-graph-ir-effect-operations-design.md`.
**Author:** brainstorm 2026-04-26
**Related:**
- `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` (three-tier integration model, per-module proto, module skeleton, gRPC surface, pre-fetch, P2 callbacks; this spec sits *on top of* it and adds a categorical contract layer + repo-structure decisions)
- `docs/superpowers/specs/done/2026-04-17-cloudevents-envelope-design.md` (CloudEvents envelope used by emitted events; `type` namespacing convention used by capability claims)
- `docs/superpowers/specs/done/2026-04-19-platform-api-design.md` (control-plane registry; the long-term home of contract distribution)
- `rntme_orchestration_only`, `project_pre_stable_stage` memories

**Implementation locations:**
- Canonical contracts — new `packages/contracts/<category>/v<major>/` (one workspace package per major version)
- Vendor modules — new `modules/<category>/<vendor>/` (category-grouped)
- Conformance framework — new `packages/conformance-framework/`
- Per-category conformance suite — `modules/<category>/conformance/`
- module.json validator — new `packages/module-manifest-validator/` *or* fold into existing `@rntme/blueprint` (decision deferred to implementation plan)
- Implementation plans for this spec — `docs/superpowers/plans/modules-monorepo-structure/`

## 1. Problem

The platform-modules spec (`2026-04-19-platform-modules-integration-design.md`) gave us *one* shape for an integration module: code-based handlers behind a gRPC surface, vendor SDK inside, webhook receiver inside. Each module owns its own `.proto`, its own event-schema, its own everything.

This works for one or two modules. It does not work for an ecosystem. Three downstream problems become structural:

1. **Vendor lock-in by accident.** A domain service that wires `pre[]` to `payments-stripe.CreateCheckoutSession` cannot be re-pointed at a Paddle-backed module without rewriting its blueprint, even if "create checkout session" is a category-universal concept. The blueprint depends on a *vendor's proto shape*, not on a *category contract*.
2. **No reusable conformance.** Every new module reinvents how it tests itself against the platform's expectations (idempotency-replay, error-mapping, gRPC-status semantics). There is no shared way to say "this thing is a valid identity module".
3. **No story for external contributors.** Today's modules live in `packages/` next to runtime code. A community contributor who wants to add `identity-auth0` must clone the entire rntme runtime, learn the workspace, and submit a PR through the same review pipeline as graph-IR changes. The contribution path is heavy and the discovery surface is invisible.

We need to fix (1) and (2) now — they have technical-debt half-life, and the longer we ship without them, the more existing modules cement vendor-shaped contracts. (3) is staged: we structure the repo *as if* it were a separate modules-monorepo, but we do not extract until measured triggers fire.

## 2. Goal

Define the directory layout, contract-versioning model, conformance discipline, manifest schema, and extraction triggers for a multi-module ecosystem in rntme. Out of this spec, an external contributor (and, more importantly, an LLM agent generating modules from a vendor SDK + canonical contract) should know exactly:

- Where a new module's files live.
- Which canonical contract (proto + events + error codes) it implements.
- How it declares which subset of that contract it actually supports.
- How a domain blueprint references it without naming the vendor.
- Which conformance suite it must pass to claim category membership.
- When the modules tree extracts to its own repo.

**In scope:**
- Repo placement (modules stay in main rntme until measured triggers fire — option C).
- Directory layout (`modules/<category>/<vendor>/` grouped, `packages/contracts/<category>/v<n>/` permanent).
- Canonical contract versioning (proto major in directory + npm package per major).
- Capability-based conformance (β): UNION canon + per-module `capabilities[]` + blueprint-level capability check.
- Governance rule for canonical contract growth.
- Conformance framework split (shared harness vs per-category suite).
- Two-tier conformance execution (mock-default, live-optional).
- `module.json` schema and validation invariants.
- Extraction triggers (T1–T3) with explicit measurement rules.

**Explicitly out of scope:**
- Identity-category-specific RPCs, events, error codes — next brainstorm.
- Identity module skeleton & developer task template — next brainstorm.
- Other category contracts (Payments, CRM, AI/LLM, Analytics) — separate brainstorms each.
- Control-plane contract-registry distribution mechanism — covered by `2026-04-19-platform-api-design.md`.
- Live-conformance secret management & per-tenant credential rotation — separate spec.
- Module deploy/release pipeline & versioning policy after extraction — deferred until first extraction trigger fires.

## 3. Decisions matrix

| # | Question | Decision |
|---|---|---|
| Q1 | Separate repo for modules or stay in main rntme? | **Stay in main rntme** (option C); extract on measured trigger |
| Q2 | Directory layout under `modules/`? | **Category-grouped** (`modules/<category>/<vendor>/`) |
| Q3 | Where do canonical contracts live? | `packages/contracts/<category>/v<major>/` — **always in main rntme**, even after `modules/` extracts |
| Q4 | Canonical contract versioning model? | **Major-in-directory + separate npm package per major** (proto/gRPC convention) |
| Q5 | Conformance promise: hard (LCD) or soft (capabilities)? | **Soft / capabilities-based** — canonical is UNION, modules declare `capabilities[]`, blueprint validator enforces coverage |
| Q6 | What prevents canonical contract bloat? | **Promotion rule:** RPC enters canonical only on (≥2 vendor support) OR (maintainer-reviewed archetypal operation) |
| Q7 | Per-module proto kept? | Yes — vendor-extensions live in per-module `<vendor>-extensions.proto`, used only when canonical UNION rejects the operation |
| Q8 | Conformance suite location? | Two-tier: `packages/conformance-framework/` (shared harness) + `modules/<category>/conformance/` (per-category scenarios) |
| Q9 | Conformance execution model? | Mock-first (every PR, no secrets) + live-sandbox (release-only, vendor-owned secrets) |
| Q10 | Who writes conformance suites? | rntme team writes both framework and per-category suites; canon + suite land in same PR |
| Q11 | When do we extract to separate repo? | First-fire of T1, T2, or T3 (§13); marketing-aesthetic triggers explicitly excluded |

## 4. Repo placement (option C)

Modules and contracts live inside main rntme today. Extraction is conditional and measured. Rationale already debated and recorded:

- Pre-revenue stage; no external contributors waiting; no live deployments depending on module-release cadence.
- Canonical contract design is unproven — needs to be co-evolved with at least one vendor module before its shape stabilises. Splitting before stabilisation pays version-skew tax on every contract revision.
- Reverse cost is small: `git mv modules/* ../rntme-modules/categories/` plus a published-package bridge for the contracts (which stay in main repo).

§13 lists the explicit triggers that flip this decision.

## 5. Directory layout

### 5.1 Layout in main rntme (current state of (C))

```
rntme/
├── packages/
│   ├── contracts/
│   │   ├── identity/
│   │   │   ├── v1/                         # workspace package @rntme/contracts-identity-v1
│   │   │   │   ├── proto/
│   │   │   │   │   ├── identity.proto       # canonical service + RPCs
│   │   │   │   │   └── identity-events.proto # canonical event payloads
│   │   │   │   ├── src/                     # generated TS bindings + helpers
│   │   │   │   ├── error-codes.json         # canonical domain error codes
│   │   │   │   ├── package.json
│   │   │   │   └── README.md                # "what this category contract covers"
│   │   │   └── v2/                          # future major; coexists with v1
│   │   ├── payments/
│   │   │   └── v1/
│   │   └── ...                              # one dir per category
│   ├── conformance-framework/                # shared test harness
│   ├── module-manifest-validator/            # validates module.json against canonical contract
│   ├── runtime/                              # existing
│   ├── bindings-grpc/                        # existing
│   └── ...                                   # other existing packages unchanged
├── modules/                                  # NEW top-level dir
│   ├── identity/
│   │   ├── README.md                          # category-doc, contributor entry point
│   │   ├── conformance/                       # workspace package @rntme/conformance-identity
│   │   │   ├── src/
│   │   │   │   ├── scenarios/                  # one file per canonical RPC
│   │   │   │   ├── fixtures/
│   │   │   │   └── suite.ts
│   │   │   └── package.json
│   │   ├── clerk/                             # workspace package @rntme/identity-clerk
│   │   │   ├── proto/
│   │   │   │   └── identity-clerk-extensions.proto  # optional, vendor-only RPCs
│   │   │   ├── src/
│   │   │   │   ├── handlers.ts                 # implements canonical + extension
│   │   │   │   └── webhook.ts                  # signature verify + dedupe + emit
│   │   │   ├── test/
│   │   │   │   ├── unit/
│   │   │   │   └── conformance.test.ts          # imports @rntme/conformance-identity
│   │   │   ├── module.json
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── README.md
│   │   ├── auth0/                             # future vendor
│   │   └── workos/                            # future vendor
│   ├── payments/
│   └── ...
├── pnpm-workspace.yaml                        # extended to include modules/**
├── packages/                                  # ...
└── ...
```

### 5.2 Layout after extraction (target shape)

```
rntme/                                         # main repo
├── packages/contracts/                         # CONTRACTS STAY HERE forever
├── packages/conformance-framework/             # framework also stays (modules import from npm)
└── ...

rntme-modules/                                 # extracted repo
├── categories/
│   ├── identity/
│   │   ├── README.md
│   │   ├── conformance/                        # may be moved here or stay in main; decided at extract-time
│   │   ├── clerk/
│   │   ├── auth0/
│   │   └── workos/
│   ├── payments/
│   └── ...
├── pnpm-workspace.yaml
└── ...
```

The `git mv modules/<...> rntme-modules/categories/<...>` operation must be mechanical. To make it so, **package paths today (`modules/identity/clerk/`) and tomorrow (`categories/identity/clerk/`) keep the same npm `name` field** (`@rntme/identity-clerk`). Imports of `@rntme/contracts-identity-v1/*` resolve to workspace today and to the published npm package after extract — no source change in handlers.

### 5.3 Why category-grouped (β over flat)

- Conformance suite has a natural physical home next to all category implementations; flat layout (`modules/identity-clerk/`) leaves the suite homeless and culturally optional.
- Category README is the contributor's first stop; grouped puts it adjacent to all vendors of the category.
- Extraction is one move per category, not a regex over module names.

## 6. Canonical contracts

### 6.1 Versioning (Q4)

- One **proto major** per directory: `packages/contracts/identity/v1/`, `v2/`, …
- Each major is its own **workspace npm package**: `@rntme/contracts-identity-v1`, `@rntme/contracts-identity-v2`. They coexist; modules pick which they implement.
- Proto package declaration matches: `package rntme.contracts.identity.v1;`
- Within a major, additions of new RPCs / new event types / new optional fields are non-breaking and bump the npm package's **minor**. Bug fixes bump **patch**.
- Removals or signature changes are breaking → require a new major directory.

This matches gRPC ecosystem convention. Domain services and modules pin a major (`"@rntme/contracts-identity-v1": "^1.0.0"`).

### 6.2 Capability-based conformance (Q5)

The canonical contract for a category is a **UNION**, not a lowest-common-denominator. Every operation that any reasonable vendor in the category supports lives in canonical. A module declares which subset it implements via `module.json#capabilities[]`. Domain blueprints declare which operations they actually use (via `pre[]`, query handlers, projection consumers). The validator enforces, at blueprint build/deploy time:

```
binding.module.capabilities.rpcs   ⊇  blueprint.usedRpcs
binding.module.capabilities.events ⊇  blueprint.expectedEventTypes
```

If the inclusion fails, blueprint is rejected with `BLUEPRINT_CAPABILITY_MISSING { module, rpc | event, vendor, alternatives: [...] }`. The error includes alternative vendor modules in the same category whose capabilities cover the gap, when any exist.

**Vendor swap flow:**
1. Author edits `manifest.modules[].vendor` and `.address`.
2. Validator re-runs capability check on the new module.
3. If new vendor's capabilities cover blueprint usage → swap accepted.
4. If not → blueprint either trims usage (drop the unsupported feature) or stays on the old vendor.

### 6.3 Governance rule for canonical growth (Q6)

To prevent canonical contracts from drifting into an uncontrolled superset of every vendor's SDK, an RPC or event enters canonical only when:

> **(a)** at least two real or planned vendor modules in the category support a semantically equivalent operation, **or**
> **(b)** maintainer review confirms it is an *archetypal* operation for the category (e.g. `Authenticate` for identity, `CreateCheckoutSession` for payments) even though only one vendor exists today.

Vendor-specific operations that satisfy neither (a) nor (b) live in `<vendor>-extensions.proto` inside the module directory. Blueprints that consume vendor-extensions are explicitly locked to that vendor — the validator surfaces this as a warning in blueprint build summary (`BLUEPRINT_VENDOR_LOCKED_BY_EXTENSION`).

This rule is the structural force-function that keeps capability-based conformance honest. It is documented in every category README.

## 7. Conformance suite

### 7.1 Two-layer layout

```
packages/conformance-framework/                # shared, category-agnostic
├── src/
│   ├── runner.ts                               # boots target gRPC, runs scenarios, reports
│   ├── invariants/                             # idempotency-replay, gRPC status mapping, envelope shape
│   ├── reporter.ts                             # capability × vendor matrix
│   └── types.ts                                # CategoryConformanceSuite, Scenario, Invariant
└── package.json   →  @rntme/conformance-framework

modules/<category>/conformance/                 # per-category, category-specific
├── src/
│   ├── scenarios/
│   │   ├── <Rpc1>.scenarios.ts                 # one file per canonical RPC
│   │   └── ...
│   ├── fixtures/                                # canonical category test data
│   └── suite.ts                                 # exports CategoryConformanceSuite
└── package.json   →  @rntme/conformance-<category>
```

The canonical suite contract uses the camelCase shape below. Category packages
may export a package-specific name such as `identityConformanceSuite`, and may
also export `suite` as a compatibility alias, but the underlying object shape is
not category-specific.

```ts
export interface CategoryConformanceSuite {
  readonly category: string;
  readonly contractVersion: 'v1';
  readonly scenariosByRpc: Readonly<Record<string, ReadonlyArray<Scenario>>>;
}
```

### 7.2 Authorship rule (Q10)

rntme-team owns both layers. Critical discipline: **a PR that changes `packages/contracts/<category>/<v>/` MUST land matching changes in `modules/<category>/conformance/scenarios/` in the same PR.** A new canonical RPC without a conformance scenario does not get merged. This is what physically holds the (β) design honest — the canonical contract grows only as fast as its conformance suite.

### 7.3 Two-tier execution (Q9)

A vendor module has two conformance scripts:

- `pnpm test:conformance:mock` — runs canonical-conformance against the vendor's gRPC server, with vendor-side configured to hit a `mock-vendor` gRPC server (provided by `packages/conformance-framework/`) instead of the real vendor SDK. No secrets, no network, runs on every PR. Mandatory.
- `pnpm test:conformance:live` — same suite, vendor-side configured against vendor sandbox (Clerk dev tenant, Stripe test mode, Auth0 dev tenant). Requires CI secrets owned by module maintainer. Runs on release tag only. Mandatory at release, not at PR.

Both runs filter scenarios by the module's `capabilities[]`. Skipped scenarios are reported as `unsupported (declared)`. **Anti-conformance check** runs unconditionally: any RPC not in `capabilities` must return `UNIMPLEMENTED` — random domain errors fail anti-conformance.

### 7.4 Capability-coverage report

The runner emits a structured report per run:

```
identity / clerk            (claims 5 / 12 canonical RPCs)
  Authenticate              ✓
  GetUser                   ✓
  RevokeSession             ✓
  CreateOrganization        ✓
  InviteMember              ✓
  RevokeAllSessionsForUser  unsupported (declared)
  EnrollMFA                 unsupported (declared)
  ...
```

This report is the artefact that domain-service authors and LLM agents read when they pick a vendor for a category.

## 8. `module.json` schema

### 8.1 Schema

```jsonc
{
  // identity
  "name": "identity-clerk",
  "version": "0.3.1",
  "category": "identity",
  "contractVersion": "v1",
  "vendor": "clerk",

  // capability claims
  "capabilities": {
    "rpcs":   ["Authenticate", "GetUser", "RevokeSession", "CreateOrganization"],
    "events": ["UserAuthenticated", "SessionRevoked", "OrganizationCreated"]
  },

  // gRPC surface
  "grpcServiceName": "rntme.identity.v1.IdentityModule",
  "grpcExtensionServiceName": "rntme.identity.clerk.v1.IdentityClerkExtensions",  // optional

  // webhooks
  "webhookPath": "/webhooks/clerk",                 // optional
  "webhookSignatureScheme": "svix",                  // optional, free-form tag

  // operational
  "secrets": [
    { "name": "CLERK_SECRET_KEY",     "scope": "tenant" },
    { "name": "CLERK_WEBHOOK_SECRET", "scope": "tenant" }
  ],
  "healthPath": "/health",                           // default "/health"

  // metadata
  "description": "Clerk-backed identity module (auth, orgs, MFA)",
  "maintainers": [{ "name": "...", "email": "..." }],
  "homepage": "https://github.com/...",
  "license": "MIT"
}
```

### 8.2 Required vs optional

**Required (validator hard-fails on absence):**
`name`, `version`, `category`, `contractVersion`, `vendor`, `capabilities.rpcs`, `capabilities.events`, `grpcServiceName`, `secrets[]` (may be empty array, but field present).

**Optional (validator accepts absence):**
`grpcExtensionServiceName` (only when `<vendor>-extensions.proto` exists), `webhookPath`, `webhookSignatureScheme`, `healthPath` (defaults to `/health`), all metadata fields (`description`, `maintainers`, `homepage`, `license`).

### 8.3 Capability-string convention

- `capabilities.rpcs[i]` — *unqualified* RPC name as declared in the canonical `.proto` (e.g. `"Authenticate"`, NOT `"rntme.identity.v1.IdentityModule/Authenticate"`).
- `capabilities.events[i]` — *unqualified* CloudEvents `type` short-name (e.g. `"UserAuthenticated"`, NOT `"rntme.identity.v1.UserAuthenticated"`).

Fully-qualified forms are reconstructed by templates:

- RPC fully-qualified: `<grpcServiceName>/<rpc-short-name>` (e.g. `rntme.identity.v1.IdentityModule/Authenticate`).
- Event CloudEvents `type`: `rntme.<category>.<contractVersion>.<event-short-name>` (e.g. `rntme.identity.v1.UserAuthenticated`).

The unqualified form is what humans and LLMs author by hand; reconstruction is the validator's job.

### 8.4 Validation invariants (validator-enforced)

1. `category` matches the parent directory name (`modules/identity/clerk/module.json` → `category === "identity"`).
2. `vendor` matches own directory name (`modules/identity/clerk/` → `vendor === "clerk"`).
3. `contractVersion` exists in `packages/contracts/<category>/`.
4. Every RPC name in `capabilities.rpcs` exists in canonical `.proto` for `<category>/<contractVersion>`.
5. Every event name in `capabilities.events` exists in canonical events-schema for the same version.
6. `grpcServiceName` matches the `service` declaration in canonical `.proto` byte-for-byte.
7. `name` is unique across all modules in the repo.

Error codes follow the `<PKG>_<LAYER>_<KIND>` convention from CLAUDE.md:
`MODMANIFEST_STRUCTURAL_MISSING_FIELD`, `MODMANIFEST_REFERENCES_UNKNOWN_RPC`, `MODMANIFEST_CONSISTENCY_DIR_MISMATCH`, etc.

## 9. Domain blueprint references

A domain service's `manifest.json` references modules categorically, not by vendor proto:

```json
{
  "modules": [
    {
      "name": "identity",
      "category": "identity",
      "contractVersion": "v1",
      "vendor": "clerk",
      "address": "grpc://identity-clerk.platform.svc:50051"
    }
  ]
}
```

Vendor swap = change `vendor` and `address` fields; `category`, `contractVersion`, and downstream binding code remain identical, *provided the new vendor's capabilities cover the blueprint's usage*. The validator enforces the latter at blueprint build (§6.2).

This shape supersedes the inline-or-registry decision left open as `OQ1` in `2026-04-19-platform-modules-integration-design.md` for the intra-repo case. Registry-based resolution remains a control-plane concern, deferred.

## 10. What stays in main rntme vs what extracts

Even after the modules tree extracts, the boundary is firm:

| Lives in main rntme **forever** | Lives in `rntme-modules` after extraction |
|---|---|
| `packages/contracts/<category>/v<n>/` (canonical proto + events + error codes) | `categories/<category>/<vendor>/` (vendor implementations) |
| `packages/conformance-framework/` (shared test harness) | category-conformance suites *may* move to `categories/<category>/conformance/` (decided at extract-time) |
| `packages/module-manifest-validator/` | — |
| `packages/runtime/runtime/`, `packages/bindings-*/`, etc. | — |

This split is intentional: contracts and runtime co-evolve and must not version-skew. Vendor implementations are downstream and may release on independent cadences.

## 11. Decomposition into implementation plans

This spec decomposes into **3 implementation plans** in `docs/superpowers/plans/modules-monorepo-structure/`:

| # | Plan | Covers | Depends on |
|---|---|---|---|
| 1 | `01-directory-skeleton-and-validator.md` | Create `modules/` top-level; create `packages/contracts/` umbrella; create `packages/conformance-framework/` skeleton; create `packages/module-manifest-validator/`; extend `pnpm-workspace.yaml`; AGENTS.md + per-package READMEs (incl. existing `module-skeleton` README) updated for new layout | — |
| 2 | `02-blueprint-capability-check.md` | Extend `@rntme/blueprint` with capability-coverage validation against `module.json#capabilities`; add `BLUEPRINT_CAPABILITY_MISSING` and `BLUEPRINT_VENDOR_LOCKED_BY_EXTENSION` error codes; update existing demo (or new minimal demo) to exercise the path | Plan 1 |
| 3 | `03-extraction-trigger-tracker.md` | Automate T2 measurement only: a CI job in `tools/measure-runtime-pr-time.ts` computes the trailing-30-day average wall-clock time-to-merge for runtime-only PRs (path filter from §13) and opens a tracking issue when the threshold is crossed. T1 and T3 remain event-driven (no automation possible — they are inbound signals); plan 3 ships GitHub issue templates `extract-trigger-t1.yml` and `extract-trigger-t3.yml` so contributors and maintainers can file them in a structured form | Plan 1 |

Identity-category contract content (canonical RPCs, events, error codes) and the Identity module skeleton + developer task template are **not** part of these plans — they are the output of the next two brainstorms and will land as their own spec + plan pair.

Each plan must include a documentation-touch task per `CLAUDE.md`: at minimum AGENTS.md §3 (layering) and §10 (glossary) need entries for `modules/`, `packages/contracts/`, and `capabilities[]`; per-package READMEs for any new packages must follow the standard template; main `README.md` packages-table should list the new packages.

## 12. Testing model

- **Unit tests** for `module-manifest-validator`: every invariant from §8.4 has a positive case and at least one negative case.
- **Unit tests** for `conformance-framework` runner: scenario filtering by capabilities, anti-conformance detection, capability-matrix reporter output shape.
- **Integration test** for blueprint capability check: a fixture blueprint that uses RPC `X`, a fixture module declaring/withholding `X`, assertion that validator passes/fails accordingly with expected error code.
- **No vendor SDK touches** in this spec's tests — Identity-category test scenarios land with the Identity contract spec, not here.

## 13. Extraction triggers

Modules tree extracts to a separate `rntme-modules` repo when **any** of the following fires. The decision is mechanical: trigger fires → tracking issue opens → next sprint executes the extraction.

**T1 — External contributor signal.**
A concrete external contribution attempt arrives: GitHub issue, email, or PR PoC with the form *"I want to add `<category>-<vendor>` and need contributor flow"*. Aspirational interest (`"would be nice if..."`) does not count. One bona-fide attempt → trigger.

**T2 — Vendor SDK CI-cost threshold.**
Average wall-clock time-to-merge for a runtime-only PR (changes touching `packages/runtime/runtime/`, `packages/bindings-*/`, `packages/runtime/event-store/`, etc., NO changes under `modules/`) exceeds **2 minutes** measured over the last 30 days of merged PRs. Measurement is automated; tooling lands in plan 3.

**T3 — Module-only maintainer rights request.**
Someone (internal or external) needs merge rights on `modules/<category>/<vendor>/` without runtime review rights. Achievable in main repo via CODEOWNERS + branch-protection, but politically awkward. One such request → trigger.

**Excluded triggers (will NOT cause extraction):**
- "Marketplace aesthetic" / discoverability appearance.
- Vendor SDK lockfile size.
- "Canonical contracts have stabilised" — irrelevant; contracts stay in main rntme regardless.
- Generic DX preferences without one of T1–T3.

If none of T1–T3 fires within 6 months of the first vendor module shipping in `modules/`, this spec is revisited and (C) may be ratified as the permanent state.

## 14. Out of scope / future brainstorms

Direct continuations of this design that deserve their own specs:

1. **Identity canonical contract** — RPCs, events, error codes for `packages/contracts/identity/v1/`. Next brainstorm.
2. **Identity module skeleton + developer task template** — the contributor-facing artefact. Next brainstorm (paired with #1).
3. **Payments canonical contract** — same shape as Identity, after Identity validates the pattern.
4. **CRM, AI/LLM, Analytics canonical contracts** — one brainstorm each, ordered by demand.
5. **Live-conformance secret management** — how sandbox credentials are scoped, rotated, audited.
6. **Module deploy/release pipeline** — CI/CD for vendor modules; relevant only after extraction.
7. **Capability discovery surface** — runtime endpoint or registry view that lets a domain blueprint author (or LLM agent) browse `category × vendor × capability` matrix during authoring.

## 15. Open questions

Non-blocking for plans 1–3, must be closed before the second category contract lands:

- **OQ1.** Where exactly does `module-manifest-validator` live: standalone `packages/module-manifest-validator/`, or folded into `@rntme/blueprint` as a sub-validator? Affects import surface and deps. Lean: standalone package, called from blueprint validator. Decision in plan 1.
- **OQ2.** Proto codegen pipeline: `buf` (Buf Schema Registry style), `ts-proto`, or hand-written `.proto`-loader. Affects DX of contract package authors. Lean: `ts-proto` initially, simplest. Decision in plan 1.
- **OQ3.** Conformance suite location after extraction: stay in main rntme (so contract + suite remain in lockstep) or migrate to `rntme-modules/categories/<category>/conformance/` (so vendor-CI doesn't pull from another repo). Trade-off. Decision deferred to extraction-time.
- **OQ4.** `mock-vendor` server design: per-category implementation (inside `modules/<category>/conformance/`) or a generic gRPC method-replayer driven by canonical proto + scenario fixtures. Lean: generic. Decision in plan 1.
- **OQ5.** `BLUEPRINT_VENDOR_LOCKED_BY_EXTENSION` is a warning today — should it become an error when blueprint manifest declares an explicit `lockedTo: <vendor>` field? Keeps category-swap promise machine-checkable. Decision when first vendor-extension lands.

## 16. References

- `docs/superpowers/specs/done/2026-04-19-platform-modules-integration-design.md` — three-tier integration model, gRPC surface, pre-fetch, P2 callbacks; this spec extends §5 (module pattern) and §12 (module contract).
- `docs/superpowers/specs/done/2026-04-17-cloudevents-envelope-design.md` — envelope used by emitted events; capability event-names align with envelope `type` short-form.
- `docs/superpowers/specs/done/2026-04-19-platform-api-design.md` — control-plane registry, long-term home of contract distribution.
- `CLAUDE.md` — error-code convention, single-writer event log, Result<T> rule, Validated* type discipline, doc-touch obligation for plans.
- `AGENTS.md` — repository layout (§3), how-to recipes (§6), glossary (§10) — all need updates per plan 1.
- `rntme_orchestration_only`, `project_pre_stable_stage` memories — frame for "modules are wrappers, not orchestrators" and "renames are free at this stage" respectively.
