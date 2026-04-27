# Design — rntme marketing landing page

**Status:** design approved in brainstorming, awaiting user review of this spec
**Location of code:** `rntme-cli/apps/landing/` (new directory in the `rntme-cli` submodule)
**Deploy target:** `rntme.com` via Dokploy, alongside `platform.rntme.com`
**Date:** 2026-04-20

---

## 1. Goal and scope

Build a single-page marketing landing at `rntme.com` that converts an AI-native product team's tech lead (or CTO) into a pilot applicant.

**Primary CTA:** Apply as a pilot team (Tally-hosted form).
**Secondary CTA:** GitHub (repo link).
**Docs** live on Mintlify at a separate subdomain and are out of scope here.

### In scope (v1)

- One static page with ten content sections (see § 3).
- A scroll-reveal aha-moment showing a JSON blueprint compiling into an API + UI.
- A feature-flagged "Try the live demo" section that stays hidden until the demo is publicly deployed.
- Tally-embedded pilot form.
- Minimal `/privacy` and `/terms` MDX stubs (required by any lead form).
- Dockerfile producing a static nginx image for Dokploy.

### Explicitly out of scope (v1)

- Any backend code (no lead-capture endpoint on `platform-http` yet).
- Blog, changelog, or deeper product pages.
- Authentication, analytics beyond Plausible-grade pageviews, A/B testing infra.
- Visual design tokens, palette, typography — handled in the implementation phase by `impeccable:shape`.
- Any in-browser blueprint editor or live compiler.

### Success criteria

- Page ships behind `rntme.com` and passes Lighthouse 95+/100 on Performance, Accessibility, Best Practices, SEO.
- Tally form submissions land in the configured inbox.
- An ICP A reader (tech lead at an AI-native product team) can answer these three questions from the page alone: what does rntme do, why is it different from "Cursor + Supabase", how do I join the pilot.
- `impeccable:audit` reports zero P0/P1 issues.
- `impeccable:critique` is run against two personas (one ICP A tech lead, one ICP B agency delivery lead); the numeric pass threshold for each score axis is set during `impeccable:shape` and recorded in the shape brief before implementation begins.

---

## 2. Audience and messaging decisions

**Primary ICP for the landing narrative:** AI-native product team, 2–10 engineers, tech lead or CTO (vision.md § 4 A-tier row 2). Agencies and many-service teams remain valid but are not the narrative focus of v1.

**One-liner:** `Stop reinventing a backend every time your agent builds you one.`

**Proof line under hero:** `Safe by construction · Validated blueprints · Zero service-specific code · Works with your agents`

**Content voice:** direct, engineer-first, no hype. Room for one playful line ("Make no mistakes") as the section-6 heading.

**Database/storage naming:** no mention of SQLite, Turso, SQL, or any specific DB on the landing page. Storage is described as "durable storage" / "the schema and migration plan your service needs". Rationale: triggers unnecessary defensive reads ("is SQLite production?") that we then have to argue with, and the runtime is the product.

---

## 3. Information architecture

The page has ten sections, in this order:

| # | Section | Role |
|---|---|---|
| 1 | Hero | One-liner, vibe-coder pain paragraph, primary + secondary CTAs, proof line |
| 2 | What you can do | Core Job + 3 Micro Jobs, each with its own value |
| 3 | See it compile | Scroll-reveal aha-moment: JSON blueprint → API endpoints + UI panels |
| 4 | Try the live demo | Feature-flagged; hidden until `DEMO_URL` env is set |
| 5 | From snowflake chaos to a standard runtime | Point A vignette → Point B pivot |
| 6 | How it works under the hood | "Make no mistakes." — five-step runtime pipeline |
| 7 | Objections we hear | Four expandable Q&A rows |
| 8 | Why not just… | Four competitor categories, with Cursor + Supabase as the first row |
| 9 | Pilot CTA | Copy + Tally form |
| 10 | Footer | Logo, nav links, privacy/terms, copyright |

### 3.1 Narrative ordering rationale

- Aha (§3) is placed **before** value (§2 is value-per-Micro-Job). The tech lead needs to understand what the thing IS before being willing to read why it matters.
- Self-recognition is **dissolved into section 5**, not placed as a standalone "you know this feeling" block. A separate self-recognition block reads as manipulative to a technical audience.
- Competitors (§8) are second-to-last. Leading with "competitors" gives them oxygen inside our own page.
- "How it works" (§6) is deliberately present. ICP A (tech lead) makes purchase decisions by understanding architecture, not by reading values.

---

## 4. Content

All copy is English. Final polish happens in the implementation phase via `impeccable:clarify`.

### 4.1 Hero

> **Stop reinventing a backend every time your agent builds you one.**
>
> Your first Cursor-built approval tool shipped in two days. The fourth one has a schema you've never seen, events that half-work, and a review queue nobody reads.
>
> rntme is a standard runtime for these services. One blueprint describes the domain, the data, the state, the API, and the UI. The runtime enforces it. Service #10 looks like service #1.
>
> `[Apply as a pilot team →]` `[GitHub]`
>
> *Safe by construction · Validated blueprints · Zero service-specific code · Works with your agents*

### 4.2 What you can do

**Core Job:** *Ship repeatable business workflow services without architectural drift.*

**Three Micro Jobs, rendered as three cards:**

| # | Micro Job | Value |
|---|---|---|
| 1 | **Describe a service once, in a single validated JSON blueprint.** Domain, data, state transitions, HTTP bindings, UI — one file, validated in layers. | No more per-service scaffolding. No "how is this one laid out" confusion on service #5. |
| 2 | **Boot it on a standard runtime — no service-specific code.** The runtime compiles the blueprint and serves an HTTP API + a declarative UI. Event-sourced state, durable storage, OpenAPI 3.1 out of the box. | You stop writing backends. You write blueprints. Service #10 looks like service #1. |
| 3 | **Let the agent edit the blueprint, not the codebase.** Validator enforces invariants before anything runs. Reviewable JSON diffs replace sprawling PRs. | Your agent cannot silently ship a broken service. You review intent, not implementation. |

No inline CTA link below (ruled out during brainstorming: would pull the reader off-site too early).

### 4.3 See it compile (aha-moment)

A scroll-driven reveal: on the left, a JSON blueprint (using `demo/issue-tracker` as the real source, trimmed for clarity). On the right, as the reader scrolls, three panels appear in order:

1. Generated HTTP endpoints (`POST /tickets`, `GET /tickets/{id}`, etc.), with OpenAPI-style summaries.
2. Declarative UI panels for the same service (list view, detail view, command forms).
3. A tiny state-machine visualization for the Ticket aggregate, derived from blueprint transitions.

Implemented as a single React island (`AhaReveal.tsx`). Content is baked, not live-compiled. No blueprint editor.

### 4.4 Try the live demo

Hidden by default. Rendered only when `DEMO_URL` environment variable is set at build time. Copy:

> **See a real service running.**
>
> The `issue-tracker` demo is a full rntme service — blueprint, API, UI, seed data. Every object you see was produced by the runtime from one JSON file.
>
> `[Open live demo →]`

The landing does not host the demo itself; it links to it.

### 4.5 From snowflake chaos to a standard runtime

**Point A vignette (open):**

> Your first Cursor-built **ticketing tool** took a weekend.
>
> The fourth — a **customer-ops console** — has a migration your team lead refuses to run. The **back-office dashboard** you built last month passes tests, but fires two events on every retry. You spent more time reviewing AI diffs last month than writing anything new.
>
> The agent didn't slow down. Your architecture did.

**Point B pivot (close):**

> A week from now, service #5 is a blueprint you edited in 40 minutes.
>
> The runtime is the same one #1 runs. The diff is 12 lines of JSON. Your team lead signs off in five minutes — the runtime didn't change, only the domain. You tell the agent "build an escalation flow" and it writes a blueprint, not a repo.

Visual direction (split composition — "many snowflake repos" on the left, "one repeating blueprint" on the right) is deferred to `impeccable:shape` in the implementation phase. No stock graphics.

### 4.6 How it works under the hood

**Heading:** `Make no mistakes.`

| # | Step | What happens |
|---|---|---|
| 1 | Author a blueprint | One JSON artifact: domain, data, state transitions, HTTP/UI bindings, seed. Written by hand or by an agent. |
| 2 | Validate in layers | Parse → structural → references → consistency. An agent cannot silently produce a broken service. Errors come with stable codes. |
| 3 | Compile & migrate | The runtime produces the schema, the migration plan, and the event log your service needs. No manual DBA work. |
| 4 | Boot the runtime | Same event log, same projection consumer, same HTTP surface, same UI surface — for every service. Zero service-specific code. |
| 5 | Fork for service #2 | Copy the blueprint. Change the domain. Ship. |

Accompanied by a single horizontal architecture diagram — rendering style, palette, and typography are decided by `impeccable:shape` during implementation.

### 4.7 Objections we hear

Expandable accordion with four Q&A rows:

| Objection | Answer |
|---|---|
| **"This looks like lock-in."** | Blueprint is plain JSON. Runtime is open source. Your data is in a standard format you can read with any tool. |
| **"Workflow apps only? That's narrow."** | Yes. Narrow is the feature. If your service is a Notion-competitor or a game backend, rntme is the wrong tool on purpose. |
| **"What if my logic doesn't fit the runtime?"** | If it doesn't, rntme is wrong for that service — not for every service your team builds. We'll tell you honestly at pilot intake. |
| **"Is this production-ready today?"** | We're onboarding pilot teams to answer exactly that. The runtime core is stable; the control plane is in beta; we'll tell you honestly which of your services fit today and which don't. |

### 4.8 Why not just…

Four rows. First row names the real competitor (`Cursor + Supabase + discipline`) directly, per vision.md § 6.

| Alternative | Why not |
|---|---|
| **Cursor + Supabase + discipline** | Works on service #1. Compounds entropy on service #5. |
| **Retool / Appsmith / ToolJet** | UI-over-data. rntme is state + workflow + UI from one artifact. Different shape of service. |
| **Lovable / Bolt / Firebase Studio** | Optimized for first-run wow. rntme is optimized for service #10 looking like service #1. |
| **Supabase / Firebase / PocketBase** | Menu of primitives. rntme is a standard runtime across many services. |

### 4.9 Pilot CTA

> **We're onboarding the first 10 teams personally.**
>
> Paid pilot. White-glove setup. A direct line to the founders. Tell us about your team and the second service you'd build on rntme.

Rendered below the lede as a four-item preview of the pilot intake, styled with the same numbered-steps pattern as §4.6. This lets the reader see the shape of the ask before clicking through, and keeps the page voice unbroken at the conversion gate (a Tally iframe inside the page would collapse the editorial voice into Tally's default styling).

| # | Question | Body |
|---|---|---|
| 01 | **Team** | Size, what you've shipped, your current stack. |
| 02 | **The second service** | What you'd build on rntme next — domain, scope, why this one. |
| 03 | **Timeline** | When you'd start; when it needs to be live. |
| 04 | **Contact** | Name, role, work email. |

Followed by a single primary CTA — `Apply on Tally →` — linking to `https://tally.so/r/{TALLY_FORM_ID}` in the same tab. A small muted meta line beside the button reads `Four questions · about 3 min` so the reader knows the shape of the commitment before clicking.

No iframe, no fake browser chrome. The `<noscript>` fallback is no longer required — the primary CTA is a plain `<a>` tag that works without JS.

### 4.10 Footer

Left: rntme logo.
Right: **GitHub · Docs *(→ Mintlify)* · Platform login *(→ platform.rntme.com)* · Privacy · Terms**
Bottom: copyright line; optional second home for the "Make no mistakes" tagline if it does not land well as the §6 heading.
No social media icons, no newsletter form in v1.

---

## 5. Architecture

### 5.1 Tech stack

- **Astro 4.x** with **static output**. React integration enabled for a single island. MDX integration for privacy/terms/content fragments.
- **React island** only in `AhaReveal.tsx`.
- **Styling:** CSS custom properties driven by `src/styles/tokens.css`; exact tokens (colors, spacing scale, type scale) produced by `impeccable:shape` in the implementation phase. Tailwind is not used; we keep styling lean to match the engineer-first audience.
- **No state libraries, no CSS-in-JS.** Scroll-reveal uses `IntersectionObserver` directly.
- **TypeScript** throughout.

### 5.2 Directory layout

```
rntme-cli/apps/landing/
├── package.json                  # @rntme-cli/landing, private
├── astro.config.mjs              # output: "static", React + MDX integrations
├── tsconfig.json
├── Dockerfile                    # multi-stage: node:20 build → nginx:alpine static
├── public/                       # favicons, og image, robots.txt
├── src/
│   ├── pages/
│   │   ├── index.astro           # composes all 10 sections
│   │   ├── privacy.mdx
│   │   └── terms.mdx
│   ├── components/
│   │   ├── Hero.astro
│   │   ├── MicroJobs.astro
│   │   ├── AhaReveal.tsx         # React island
│   │   ├── LiveDemoCard.astro    # conditionally rendered based on DEMO_URL
│   │   ├── SnowflakeToRuntime.astro
│   │   ├── HowItWorks.astro
│   │   ├── Objections.astro
│   │   ├── Competitors.astro
│   │   ├── PilotForm.astro       # Tally embed
│   │   └── Footer.astro
│   ├── content/                  # editable copy separated from layout
│   │   ├── micro-jobs.mdx
│   │   ├── objections.mdx
│   │   └── competitors.mdx
│   ├── styles/
│   │   └── tokens.css
│   └── assets/
│       └── logo.svg
└── README.md
```

### 5.3 Configuration (environment variables)

All resolved at build time.

| Variable | Required | Example | Purpose |
|---|---|---|---|
| `TALLY_FORM_ID` | yes | `abc123` | Embedded pilot form id |
| `GITHUB_URL` | yes | `https://github.com/vladprrs/rntme` | Secondary CTA + footer |
| `DOCS_URL` | yes | `https://docs.rntme.com` | Footer link |
| `PLATFORM_URL` | yes | `https://platform.rntme.com` | Footer link |
| `DEMO_URL` | no | *empty until demo ships* | Toggles §4.4 rendering |
| `PLAUSIBLE_DOMAIN` | optional | `rntme.com` | Pageview analytics; omitted if absent |

Astro config reads these from `import.meta.env` and **fails the build** if any required one is missing. This prevents a silently broken landing from reaching production.

### 5.4 Feature flag for the live demo

The `LiveDemoCard.astro` component checks `import.meta.env.DEMO_URL`. If empty or undefined, the component returns null, and the section is entirely absent from the static HTML (not merely hidden with CSS). When the demo ships, setting the env variable and rebuilding is the only change required.

---

## 6. Deploy

### 6.1 Workspace integration

- Update `rntme-cli/pnpm-workspace.yaml`:

  ```yaml
  packages:
    - "packages/*"
    - "apps/*"
  ```

- **Parent `pnpm-workspace.yaml` is not updated.** The landing is a marketing artifact, not a runtime package. Keeping it out of the parent's `pnpm -r` avoids accidentally coupling landing builds to runtime test runs.

### 6.2 Dockerfile

Multi-stage:

- Stage 1: `node:20-alpine`, `pnpm install --frozen-lockfile`, `pnpm -F @rntme-cli/landing build`.
- Stage 2: `nginx:alpine`, copy `dist/` into `/usr/share/nginx/html`, minimal nginx config with `gzip`, long cache for hashed assets, short cache for `index.html`, HTTP 200 fallback for the SPA routes Astro emits.

### 6.3 Dokploy

New Application under the existing `rntme-cli` project on Dokploy.

- Source: `rntme-cli` repo, branch `main`.
- Build pack: Dockerfile at `apps/landing/Dockerfile`.
- Domain: `rntme.com` (apex). `platform.rntme.com` and `docs.rntme.com` remain separate services.
- Env: all variables from § 5.3 configured in the Dokploy Application's env section.

---

## 7. Implementation phase commitments

The implementation plan (written after this spec is approved) **must** begin with these steps in order:

1. **`impeccable:shape`** — runs the structured UX interview against this spec to produce a design brief (tokens, tone, density, motion language, photography style).
2. Scaffold `rntme-cli/apps/landing/` according to § 5.2.
3. **`impeccable:impeccable craft`** — implements the components against the shape brief.
4. **`impeccable:clarify`** — polishes every string on the landing.
5. **`impeccable:audit`** — must report zero P0/P1 before moving on.
6. **`impeccable:critique`** — persona-based review (one ICP A tech lead, one ICP B agency delivery lead) with numeric scoring at or above the thresholds captured in the `impeccable:shape` brief in step 1.
7. Dockerfile, Dokploy configuration, DNS cutover.

Steps 1–6 are non-negotiable gates. The spec exists precisely so that `impeccable:shape` has a complete content and architecture context instead of starting from a blank prompt.

---

## 8. Out-of-scope follow-ups (post-v1)

Tracked here so they do not leak into v1.

- `/how-it-works` deep page (architecture long-form).
- `/for-agencies` deep page targeting ICP B.
- Migration of lead capture from Tally to a self-hosted endpoint on `platform-http`.
- Opening the live demo section when the `issue-tracker` demo is publicly deployed — a one-env-var change, not a redesign.
- `/blog` and `/changelog`.
- Second narrative variant under A/B test for ICP B.
