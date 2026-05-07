# Architecture audit — `@rntme/landing`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-223` (`e68b7679-9e94-4267-aa40-d32e6a18b986`) |
| **Issue title** | Audit: package architecture — @rntme/landing |
| **Package / scope** | `@rntme/landing` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `3a3ff012-cc4f-4646-82d8-b06080857458` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: `@rntme/landing`

**Verdict: needs cleanup**

The package corresponds well to product vision (`vision.md` §1, §7) and `CLAUDE.md` framing (market vs internal framing are separated correctly). The architecture is generally healthy for a marketing landing page, but there are specific risks of drift, dead code and manual synchronization that should be addressed before scaling.

---

### Issues found

#### HIGH

**1. `data-section-num` / `id` collisions between living and dead components**
- **Evidence:** `Problem.astro` (`data-section-num="02"`) and `MicroJobs.astro` (`data-section-num="02"`) both claim §02. `AhaSection.astro` (`04`) and `LiveDemoCard.astro` (`04`). `HowItWorks.astro` (`05`) and `SnowflakeToRuntime.astro` (`05`).
- **Impact:** `MicroJobs`, `SnowflakeToRuntime`, `LiveDemoCard` are not imported into `index.astro` now, but if any of them are activated (for example `LiveDemoCard` when setting `DEMO_URL`), SideRail will break - two elements with the same `data-section-num`, `id="s04"` anchors are duplicated.
- **Recommendation:** Either remove dead components or bring their numbers into line with the current sequence. Introduce a single registry of sections.

**2. Section metadata is spread across ~15 files**
- **Evidence:** `data-section-num` + `id="sNN"` are hardcoded in each `.astro` component; `SideRail.tsx` duplicates the list of sections; `index.astro` specifies the order; `CONTENT.md` documents the order separately.
- **Impact:** Changing the order of sections requires 5+ manual edits. High risk of desynchronization of SideRail, anchors, CONTENT.md and actual rendering.
- **Recommendation:** Create `src/sections.ts` with a single array `{ id, num, label, component }`, from where to generate `index.astro`, SideRail and CONTENT.md.

**3. Test coating is critically thin**
- **Evidence:** 3 test files (`env.test.ts`, `AhaReveal.test.tsx`, `LiveDemoCard.test.ts`) - ~100 lines in total. There are no tests for Astro components, no assembly integration tests, no accessibility automation, no checking that all sections are rendered without errors.
- **Impact:** Dead code and section collisions are not caught by CI. Regressions in Astro templates will go unnoticed.
- **Recommendation:** Add an integration test that imports `index.astro`, renders it with a mock environment and checks the uniqueness of `data-section-num` / `id`. Add `astro check` to CI (it is in `package.json`, but check that it runs).

#### MEDIUM

**4. `loadEnv()` is called at module level in 6+ components**
- **Evidence:** `BaseLayout.astro`, `StatusBar.astro`, `Hero.astro`, `Footer.astro`, `LiveDemoCard.astro`, `PilotForm.astro` - each does `const env = loadEnv()` in frontmatter.
- **Impact:** Duplicate the work of parseEnv on each import. It is impossible to replace env for unit tests of Astro components without monkey-patching `process.env`.
- **Recommendation:** Calculate `env` once in `BaseLayout.astro` and pass through `Astro.props` / Astro.locals, or use Astro context.

**5. Dead code in `src/components/`**
- **Evidence:** `MicroJobs.astro`, `SnowflakeToRuntime.astro`, `LiveDemoCard.astro` are not imported into any page.
- **Impact:** Increases the size of the repository, is misleading when reading, risk of activation with incorrect `data-section-num` (see point 1).
- **Recommendation:** Delete or move to `src/_drafts/`. If `LiveDemoCard` is needed as a feature-flag, put it in `src/features/demo/` with an explicit rendering condition in `index.astro`.

**6. `CONTENT.md` - manual copy of components**
- **Evidence:** `CONTENT.md` duplicates all copyright, section structure and env dependencies, but is not generated from code.
- **Impact:** When you change the copy in the components, CONTENT.md will become obsolete. This is the source of truth for `impeccable:*` skill - drift here = incorrect hints to agents.
- **Recommendation:** Either generate CONTENT.md from components/MDX (with a script), or explicitly document in the README that CONTENT.md is the source of truth, and the components are its implementation.

#### LOW

**7. No automated accessibility check**
- **Evidence:** `.impeccable.md` declares "Lighthouse 95+ on all four axes", but there is no `pa11y`, `axe-core` or `lighthouse-ci` in CI and tests.
- **Impact:** The declaration is not automatically verified. Regressions a11y are possible.
- **Recommendation:** Add `lighthouse-ci` or `pa11y-ci` to CI for `dist/index.html` after build.

**8. No sitemap and structured data**
- **Evidence:** No `sitemap-index.xml`, no JSON-LD markup for Organization/Product/FAQ.
- **Impact:** SEO is not maximized for a marketing site.
- **Recommendation:** Add `@astrojs/sitemap` and base JSON-LD to `BaseLayout`.

**9. `.impeccable.md` refers to the missing `SHAPE-BRIEF.md`**
- **Evidence:** "Design tokens — transcribed from SHAPE-BRIEF.md §4", "Do not edit individual values here. If a token needs to change, update SHAPE-BRIEF.md first".
- **Impact:** The new developer/agent will look for a non-existent file.
- **Recommendation:** Either add `SHAPE-BRIEF.md` to the repo, or replace the link with `.impeccable.md` as the source of truth for design tokens.

**10. `package.json#version: "0.0.0"` - meaningless**
- **Evidence:** The version does not reflect real deployments, the package is private.
- **Recommendation:** Set the version according to the deployment date (for example, `0.1.0`) or use `0.0.0-managed` with a comment.

---

### Quick wins (can be done without product solutions)

1. Remove or separate dead components (`MicroJobs`, `SnowflakeToRuntime`).
2. Check and eliminate `data-section-num` / `id` collisions.
3. Add an integration test for the uniqueness of section IDs.
4. Run `astro check` in CI explicitly for `@rntme/landing`.
5. Correct the reference to `SHAPE-BRIEF.md` in `.impeccable.md`.
6. Set the meaningful version to `package.json`.

### Changes requiring Vlad's decision

1. **Partition management strategy:** Centralize partition metadata or keep current schema with manual synchronization?
2. **CONTENT.md as source of truth:** Generate from code or maintain by hand?
3. **LiveDemoCard:** When and how to activate `DEMO_URL`? Do I need a separate demo page instead of an inline section?
4. **Accessibility CI:** Invest in Lighthouse CI / pa11y for landing page?
5. **SnowflakeToRuntime:** Is this a replacement for `Problem.astro` or a separate section? If not used, should I delete it?

---

### What is done well (so as not to break)

- Excellent documentation: `.impeccable.md`, `CONTENT.md`, `DEPLOY.md` - best onboarding for agents/developers in both repos.
- Correct choice of stack: Astro 5 + static output for a marketing site; React is only for interactive chunks (`AhaReveal`, `SideRail`).
- `env.ts` with strict validation and fail-fast on the build - reliable.
- `Dockerfile` with sanity-check (`test -f dist/index.html`) and `nginx -t`.
- `nginx.conf` with proper `_astro/` caching and explicit `=404` (not fallback to index.html).
- Accessibility: `skip-link`, `prefers-reduced-motion`, `focus-visible`, semantic headers and `aria-labelledby`.
- Separation of content (MDX exports) from presentation.

---

**Files mentioned in the audit:**
- `apps/landing/src/pages/index.astro`
- `apps/landing/src/components/SideRail.tsx`
- `apps/landing/src/components/Problem.astro`, `MicroJobs.astro`, `AhaSection.astro`, `LiveDemoCard.astro`, `HowItWorks.astro`, `SnowflakeToRuntime.astro`
- `apps/landing/src/env.ts`
- `apps/landing/CONTENT.md`
- `apps/landing/.impeccable.md`
- `apps/landing/package.json`
- `apps/landing/Dockerfile`
- `.github/workflows/ci.yml` (in parent repo)
