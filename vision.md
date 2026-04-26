# rntme — Vision

> **We're building the safe runtime for AI-generated business workflow apps.**
>
> Coding agents can already help teams build a first app quickly, but every additional app tends to become a custom backend snowflake. rntme turns a validated project blueprint into working APIs and a UI on a standard runtime, so teams can create workflow-heavy business apps repeatably instead of reinventing architecture each time. We're starting with AI-native teams and agencies building lots of internal and business workflow apps, and expanding into the control plane for software written by agents.

## Table of contents

1. [Elevator pitches](#1-elevator-pitches)
2. [The problem](#2-the-problem)
3. [Product vision](#3-product-vision)
4. [Ideal customer profile](#4-ideal-customer-profile)
5. [Jobs to be done](#5-jobs-to-be-done)
6. [Competitive landscape](#6-competitive-landscape)
7. [Wedge and go-to-market](#7-wedge-and-go-to-market)
8. [The future platform](#8-the-future-platform)
9. [Why now](#9-why-now)
10. [Long-term thesis](#10-long-term-thesis)

---

## 1. Elevator pitches

Three canonical sizes — reuse verbatim.

**One-liner** (bio, header, email subject)

> We're building the safe runtime for AI-generated business workflow apps.

**30-second** (YC application, investor reply, demo intro, first cold email)

> Coding agents can already help teams build a first app quickly, but every additional app tends to become a custom backend snowflake. rntme turns a validated project blueprint into working APIs and a UI on a standard runtime, so teams can create workflow-heavy business apps repeatably instead of reinventing architecture each time. We're starting with AI-native teams and agencies building lots of internal and business workflow apps, and expanding into the control plane for software written by agents.

**Big-company / vision** (vision slide, long-form post, late-round deck — do *not* lead with this pre-traction)

> In the future, business software will increasingly be described in intent and assembled by agents. We believe the winning company will not just generate code, but provide the runtime and control plane that makes generated services consistent, reviewable, deployable, and governable. rntme starts as the per-service runtime and grows into that platform.

---

## 2. The problem

AI code generation made one class of software abundant — the first app a team builds with a coding agent. It also made something else scarce: architectural consistency across services built the same way.

Teams that adopted Cursor, Claude, Codex, or Copilot routinely ship their first AI-assisted workflow app fast. The second and the fifth rarely ride that speed, because:

- Each service becomes its own backend with its own conventions, event handling, data model, and UI scaffolding.
- Review burden compounds — every new AI diff lands in a differently-shaped codebase.
- Migration, observability, and deployment stop being shared; they get reinvented per service.
- The "agent speedup" ends up funding a growing operational tax.

The market has already noticed. Anthropic, OpenAI, and GitHub all now ship long-running background software agents. GitHub positions Spec Kit as a way to stop "vibe coding every piece from scratch." The next bottleneck is no longer code generation — it's **preserving intent and architectural consistency across many generated services.**

---

## 3. Product vision

rntme is a runtime.

A team — or an agent — describes a working app as a **validated project blueprint**: a single bounded project blueprint folder that captures `project.json`, the project-level domain model, one or more services with their query/command surfaces, HTTP/UI bindings, seed data, and integration modules. The rntme runtime validates the blueprint in layers and boots working APIs plus a declarative UI from it — **with zero service-specific code.**

The point isn't that the runtime is clever. The point is that the blueprint is the durable unit. Teams edit the blueprint; rntme keeps the service consistent. Agents author blueprints; the runtime enforces what's valid. The second service starts from a copy of the first blueprint, not from an empty repo.

**What we build**

- A standard runtime for stateful business workflow apps, with event-sourced command execution and declarative read models.
- A validation surface rigorous enough that an agent cannot silently produce a broken service.
- A control plane ([`platform.rntme.com`](https://platform.rntme.com)) for publishing, versioning, deploying, and governing blueprints and the services they run.

**What we deliberately do not build**

- A generic AI app builder competing with Lovable / Bolt / Firebase Studio on first-run magic.
- A backend-as-a-service competing with Supabase / Appwrite / Firebase on primitives.
- An internal-tools low-code platform competing with Retool / Appsmith / ToolJet / Budibase on UI speed.
- An agent runtime — rntme runs the services that agents describe, not the agents themselves.

**A note on framing.** Internally, the engineering identity of rntme is an artifact-driven runtime authored as a project blueprint and composed from validated JSON artifacts compiled in layers; see [`docs/architecture.md`](docs/architecture.md). Externally, buyers see one thing: a validated project blueprint. The artifact pipeline is the compiler IR, not the authoring UX.

---

## 4. Ideal customer profile

The value of rntme compounds on the **second, third, and tenth** service. That shape predicts who benefits.

### A-tier — targets for first 10 users and design partners

| ICP | User | Buyer | Core pain | Why rntme |
|---|---|---|---|---|
| **Agencies / studios / dev shops** | Tech lead / senior builder | Founder / delivery lead | Low margin from rebuilding similar client apps | Reuse a blueprint across client engagements; predictable delivery; higher margin per project. |
| **AI-native product teams (2–10 engineers)** | Engineering lead | Founding engineer / CTO | Agents accelerated code gen but didn't preserve architectural consistency | Bounded runtime, reviewable specs, one pattern for every new back-office or workflow service. |
| **Teams building many small apps / services** | Platform-minded tech lead | Engineering manager / CTO | Every new service becomes a snowflake | One runtime, one blueprint contract, less entropy. |

### B-tier — design partners, not first revenue engine

- Platform / dev-productivity teams at larger orgs — best long-term ACV; need much more auth, RBAC, policy, audit, and deploy surface before they'll buy.
- Early-stage startups with workflow-heavy modules.
- Vertical SaaS teams with ops-heavy, repeatable modules.

### Anti-ICP — explicitly out of scope

- **Solo builders / indie hackers.** Market is addicted to prompt-to-app magic; abstraction tax is too high for us there.
- **Generic "AI for internal tools" buyers.** Category already owned by Retool / Appsmith / ToolJet / Budibase.
- **"AI-native application platform for everything."** Too broad without traction; we lose to every narrower tool.

### Target distribution for first 10 users

| Archetype | Count | Why |
|---|---:|---|
| AI-native product teams with workflow pain | 4 | Best test of the core thesis (second-service reuse). |
| Agencies / studios / dev shops | 3 | Quickest path to paid value and template reuse. |
| Platform / dev-productivity teams | 2 | Best design partners for the control-plane roadmap. |
| Vertical SaaS team with ops-heavy modules | 1 | Tests expansion beyond internal tools. |

---

## 5. Jobs to be done

Strong JTBDs for rntme cluster around *managed repeatability*, not raw speed.

### The strongest job

> **Give the team a way to create many AI-generated business services so that the second and tenth service don't become new custom backends.**

This is the entropy-reduction job. If a team ships service #2 materially faster than service #1, with less review burden and fewer snowflakes, the core thesis is confirmed.

### The second strongest job

> **Give coding agents a structured, bounded target instead of an arbitrary codebase.**

Best long-term business story. Connects directly to where the market is already heading: Spec Kit, background agents, cloud agents, policy-gated execution.

### Full JTBD map

| Job | Primary segments | Pain | Frequency | Current alternative |
|---|---|---|---|---|
| Ship new services without architectural drift | AI-native teams, agencies, many-service teams | **High** | **High** | Coding agents + BaaS + manual discipline |
| Give agents a safe, bounded generation target | Platform teams, AI-native teams | **High** | **Medium–High** | Repo permissions, sandboxes, Spec Kit, Copilot/Codex policies |
| Build many similar services without hand-assembly | Agencies, workflow-heavy startups | **High** | **High** | Starter kits, custom templates |
| Fix architectural decisions once, then describe only the domain | AI-native teams, platform teams | **High** | **Medium–High** | Internal frameworks, in-house codegen |
| Keep AI-generated services production-friendly | Agencies, startups, internal-tools teams | **High** | **Medium–High** | Manual review, code rewrites |
| Reduce review burden on AI-generated code | AI-native teams, platform teams | **High** | **High** | Human review, pairing, tighter prompts |
| Enable semi-technical builders to ship internal tools | Enterprise innovation, SMB builders | **Medium** | **Medium** | Retool / Appsmith / low-code platforms |
| Give platform teams a standard for AI-assisted app creation | Internal platform teams | **High** | **Medium** | Internal templates, IDP patterns |

---

## 6. Competitive landscape

Direct architectural competitors are few. Cognitive competitors are strong, because buyers don't think in categories like "artifact runtime." They compare rntme to whatever ships software for them today.

### Categories rntme actually competes with

| Category | Examples | Why they get chosen | Where rntme wins |
|---|---|---|---|
| **AI app builders** | Lovable, Bolt, Replit Agent, Firebase Studio | Prompt-to-app magic, first-run wow | Repeatability, reviewability, governed service creation — not first-run wow. |
| **BaaS / backend platforms** | Supabase, Appwrite, Firebase, PocketBase | Mature primitives, familiar stack | Standard runtime across many services, not a menu of primitives. |
| **Internal tool builders** | Retool, Appsmith, ToolJet, Budibase | UI-over-data and connector depth | Teams that need generated services with state and workflow, not just UI over existing data. |
| **Coding agents + custom code** | Cursor, Claude, Codex, Copilot + any backend | Maximum flexibility and code ownership | Teams already tired of entropy, wanting a bounded contract. |
| **Spec-driven workflows without a runtime** | GitHub Spec Kit, repo instructions | Minimal category change | Where runtime-level consistency beats better prompts alone. |
| **Code-first higher-level frameworks** | Encore and similar | "Just write code, we'll do infra" | Where deterministic runtime beats code reuse. |
| **Workflow engines** | Temporal, Zeebe, Camunda | Durability and orchestration | Orthogonal — rntme punts cross-service orchestration to Zeebe. |
| **"Do nothing"** | Keep coding manually | Free, already works | Only wins against this when the pain of repetition is already sharp. |

### The real substitute — and the real competitor

The dangerous competitor isn't Retool and isn't Temporal. It's **Cursor / Claude / Codex + Supabase / Appwrite / Firebase + a little platform discipline.** That stack is flexible, familiar, and already paid for. For many teams it's good enough *until* the pain from repeated generated services gets acute.

rntme can't beat that combo on the first service. It beats it on the second, third, and tenth. Positioning flows from this: **value proves on repetition.** Demos, case studies, and pricing anchor around *time-to-second-service* and *review burden on generated changes* — not first-app wow.

### Positioning discipline

- Don't fight for the "AI internal tools" narrative — Retool / ToolJet / Budibase own it.
- Don't fight for the "first-app magic" narrative — Lovable / Bolt / Firebase Studio own it.
- Own the **"safe, repeatable runtime for AI-generated business workflow apps"** narrative. Narrow is a feature.

---

## 7. Wedge and go-to-market

### Primary wedge

**Backend and runtime for AI-generated business workflow apps.** Concrete classes:

- Approvals.
- Ticketing.
- Customer-ops / ops consoles.
- Onboarding flows.
- Internal admin / back-office services.

These are stateful, workflow-heavy, and repeatable — exactly where the honestly-narrow envelope of rntme (SQLite / Turso storage, JSON / GET / POST bindings, declarative UI, event-sourced state logic) is a feature, not a limitation.

### Secondary wedge

*Safe runtime for coding agents generating services.* Best investor and vision framing; more abstract for a first buyer conversation.

### Tertiary / future wedge

*Control plane for teams building many small apps / services safely.* Where long-term monetization lives — registry, policy, deploy, governance — but not the first headline.

### Go-to-market motion

Founder-led design partners with white-glove onboarding for the first 10 users. Not PLG-for-indie. Not enterprise-first. Productize through repetition.

| Motion | First touch | Activation event | First paid use case | Main risk |
|---|---|---|---|---|
| **Founder-led design partners** | Targeted outreach to AI-native teams with workflow pain | Team ships first real pilot | Paid pilot + support + early control-plane access | Founder bandwidth |
| **Agency / studio motion** | Margin-on-repetition pitch to delivery leads | One client app built on an rntme template | License + support + managed platform | Services trap |
| **Open-source bottom-up** | Public repo, demos, comparison content | Developer spins up a working service from a blueprint | Hosted registry, auth, deploy | Abstraction tax too high for self-serve |
| **Platform-team motion** | "Safe standard for coding agents" | One internal standard approved | Enterprise alpha of the registry and policy plane | Long cycle; features still maturing |

### Open source as trust engine, control plane as revenue

| Layer | What's in it | Why |
|---|---|---|
| **OSS** | Runtime, validator, starter packs, template blueprints, local-dev demo, agent integrations / prompts | Earn developer trust; make the standard adoptable. |
| **Commercial** (`platform.rntme.com`) | Registry, version / tag lifecycle, deploy workflows, auth / RBAC / policy, approvals, audit, artifact history / diff, org / project / service management, business-user review UI | What an organization actually pays for. |

### First twelve months

| Period | Goal | Key moves |
|---|---|---|
| **Months 0–3** | Narrow the wedge; prove first paid pain | Reframe README / landing; ship 2–3 outcome-shaped demos (approvals, customer-ops, ticketing); find 10 pilots; white-glove onboarding. |
| **Months 3–6** | Turn pilots into a repeatable motion | Auth / RBAC basics; hosted registry alpha; artifact diff / history; template packs; agent prompts. |
| **Months 6–12** | Experiments → concentrated product | Two repeatable use cases chosen; pricing published; private / cloud beta of the control plane. |

### Proof signals

Product-market pull looks like these, in order of strength:

1. A single customer ships **2+ services**, not just one demo.
2. Users ask for **auth, policy, approvals, deploy** — not new magic.
3. **Time-to-second-service** is materially lower than time-to-first-service.
4. A buyer is willing to pay for the **registry / control plane**, not only for setup help.
5. A team starts using rntme as a *standard*, not an *experiment*.

---

## 8. The future platform

Today, rntme is a per-service runtime. Tomorrow, it is the control plane around all of them. The commercial platform composes **four pillars**:

1. **Control plane.** Organizations, projects, services, environments, API tokens, RBAC, SSO. Multi-tenancy. *Partially live at `platform.rntme.com`.*
2. **Registry.** Publish and pull validated blueprints. Content-addressed artifact bundles. Versions, tags, history, diff, lineage. *Designed; partially live.*
3. **Deploy surface.** Promote a blueprint version onto managed infrastructure. Environments. Rollbacks. Preview deploys. The current deploy surface is built on `@rntme-cli/deploy-core` and `@rntme-cli/deploy-dokploy`; see `docs/superpowers/specs/2026-04-24-project-deployment-pipeline-design.md`.
4. **Governance layer.** Blueprint review UI for humans — including business users who never touch code. Approval workflows. Audit trail. Policy gates that block bad blueprints before deploy.

**Roadmap rule.** Every commercial feature should map to one of these four pillars. Anything that doesn't is probably the wrong feature.

**Growth arc.** rntme starts as the per-service runtime that proves repeatability at the team and agency level (the wedge). It grows into the platform that lets an organization safely run a *fleet* of AI-generated services — registry, deploy, and governance on top of the same runtime. Pre-traction, pitch the runtime. Post-traction, pitch the platform.

---

## 9. Why now

Three angles — pick by audience.

1. **Agents are no longer autocomplete.** Anthropic, OpenAI, and GitHub all ship long-running background software agents. Structured execution surfaces are newly valuable.
2. **Prompt-to-app proved the demand.** People clearly want to describe software in language. The missing layer is a production-friendly runtime that keeps those generated systems consistent.
3. **Spec-driven development is going mainstream.** Spec Kit, AI-led SDLC, "version control for thinking" — all emerging because "just prompt it" doesn't scale. rntme is what that structured intent can compile onto.

---

## 10. Long-term thesis

- In the agent era, code generation stops being scarce; **preserving intent and architectural consistency becomes the scarce asset.**
- Teams don't want less code. They want **fewer snowflake backends.**
- The durable unit of AI-built software is not a prompt and not a PR. It is a **validated project blueprint.**
- The winning company won't just generate code — it will own the **runtime and control plane** that make generated services consistent, reviewable, deployable, and governable.

rntme is the service runtime first. The platform is what it grows into.
