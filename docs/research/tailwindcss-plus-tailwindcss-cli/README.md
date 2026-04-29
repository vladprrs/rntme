# Dependency Research: tailwindcss + @tailwindcss/cli

Researched: 2026-04-28
Repository: /home/coder/work/rntme
Domain/ecosystem: npm/css-tooling
Current version(s) in rntme: tailwindcss ^4.2.2 (resolved 4.2.2); @tailwindcss/cli ^4.0.0 (resolved 4.2.2) (packages/ui-runtime package.json; UI CSS build/config)
Latest stable version: tailwindcss 4.2.4 (2026-04-21); @tailwindcss/cli 4.2.4 (2026-04-21)
Confidence: HIGH

## User Constraints
- Goal: understand current dependencies and migrate rntme to latest safe versions later.
- Output must be written to `docs/research/tailwindcss-plus-tailwindcss-cli/README.md`.
- Research-only: do not perform dependency upgrades or runtime code migrations in this issue.
- Look for better-suited libraries/solutions, not only latest version of the current choice.
- Use authoritative current sources: Context7 where applicable, official docs/changelog/releases, npm/GitHub/container registry, migration guides, security advisories.

## Summary

Tailwind CSS v4 is a ground-up rewrite of the framework built on the Oxide engine (Rust-powered). rntme is already on v4 (4.2.2), which is a strong position — the project avoided the major v3→v4 migration pain. The latest stable release (4.2.4, April 2026) is a patch release with minor fixes; the last feature release was v4.1 (April 2025) which added text-shadow, mask utilities, `@source inline()`, `@source not`, and improved Safari 15 fallbacks.

For rntme's use case — a build-time SPA CSS bundler inside `@rntme/ui-runtime` that powers shadcn/ui-themed declarative UIs — Tailwind CSS v4 remains the industry standard. The only peer dependency constraint comes from `@json-render/shadcn@0.17.0`, which requires `tailwindcss ^4.0.0`.

The main architectural decision to revisit is whether `npx @tailwindcss/cli` (shelling out via `execSync` in `build.ts`) is the right long-term build integration, or whether a programmatic API (e.g. `@tailwindcss/postcss` or the Vite plugin) would be more robust. For now, the CLI approach is simple and works, but the audit finding U-351 (no timeout on `execSync`) should be addressed.

Primary recommendation: **KEEP + UPGRADE** to 4.2.4 (patch bump, zero breaking changes) and **add timeout to `execSync`**; evaluate programmatic API migration as a separate build-system improvement.

## Current Usage in rntme

| Package / image / tool | Current version | Used by | Source file(s) | Runtime/dev/build/test | Notes |
|---|---:|---|---|---|---|
| tailwindcss | ^4.2.2 (resolved 4.2.2) | @rntme/ui-runtime | `packages/ui-runtime/package.json` | dev | Peer dep of `@json-render/shadcn`; CSS framework |
| @tailwindcss/cli | ^4.0.0 (resolved 4.2.2) | @rntme/ui-runtime | `packages/ui-runtime/package.json` | dev | CLI invoked in `build.ts` via `execSync` |
| @json-render/shadcn | ^0.17.0 | @rntme/ui-runtime | `packages/ui-runtime/package.json` | prod | Peer-requires `tailwindcss ^4.0.0` |

Verified via:
```bash
grep -A2 -B2 "tailwindcss@" pnpm-lock.yaml        # shows 4.2.2
grep -A2 -B2 "@tailwindcss/cli@" pnpm-lock.yaml  # shows 4.2.2
cat packages/ui-runtime/package.json
```

Usage patterns observed:
- `packages/ui-runtime/src/build.ts` runs esbuild first (JS bundle → `build/main.js`), then invokes `@tailwindcss/cli` to scan the bundle for class names and generate `build/main.css`.
- `packages/ui-runtime/src/client/styles.css` is the entrypoint: `@import "tailwindcss"; @source "../../build/main.js";` plus shadcn theme tokens in `@theme inline`.
- The build falls back to an empty stub CSS if Tailwind CLI fails (`catch` block in `build.ts:35`).
- **Audit finding U-351**: `execSync` call has no `timeout`, risking indefinite hangs during build.

## Latest Versions / Release State

| Channel | Version | Release date | Source | Notes |
|---|---:|---|---|---|
| Stable (tailwindcss) | 4.2.4 | 2026-04-21 | [GitHub releases](https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.2.4) | Latest patch; fixes Vite alias resolution in `@import`/`@plugin` |
| Stable (@tailwindcss/cli) | 4.2.4 | 2026-04-21 | [GitHub releases](https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.2.4) | Bundled with tailwindcss; same version lockstep |
| Feature release | 4.1.0 | 2025-04-03 | [Blog post](https://tailwindcss.com/blog/tailwindcss-v4-1) | text-shadow, mask utilities, `@source inline/not`, Safari 15 compat |
| Prerelease | v4.3.0-alpha.x | 2026-Q2 | GitHub branches | Alpha track; not strategically relevant yet |

Version gap: rntme is on 4.2.2; latest is 4.2.4 — a **2-patch delta** with no breaking changes.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---|---:|---|---|
| tailwindcss | 4.2.4 | Utility-first CSS framework | Industry standard; required by shadcn/ui ecosystem; zero-config in v4 |
| @tailwindcss/cli | 4.2.4 | Standalone CLI for CSS generation | Official build tool; works without Vite/PostCSS bundler |
| @tailwindcss/postcss | 4.2.4 | PostCSS plugin alternative | Use when integrating with existing PostCSS pipelines |
| @tailwindcss/vite | 4.2.4 | Vite plugin | Use for Vite-based projects; faster HMR than CLI |

### Supporting
| Library | Version | Purpose | When to Use |
|---|---:|---|---|
| prettier-plugin-tailwindcss | ^0.6.0 | Auto-sort Tailwind classes in Prettier | Dev-only; recommended for DX |
| @tailwindcss/typography | ^0.5.0 | Prose styling plugin | Only if rendering markdown/rich text content |
| tailwind-merge | ^3.0.0 | Deduplicate/conflict-resolve Tailwind classes | When merging dynamic class strings in React components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff | Recommendation for rntme |
|---|---|---|---|
| tailwindcss + @tailwindcss/cli | UnoCSS | Faster build (~5x claim), smaller footprint, but smaller ecosystem, no shadcn/ui support | **Not recommended** — `@json-render/shadcn` locks us into Tailwind |
| tailwindcss + @tailwindcss/cli | Linaria / vanilla-extract | CSS-in-JS with zero-runtime, but completely different mental model; no utility-class ecosystem | **Not recommended** — would require rebuilding UI component layer |
| tailwindcss + @tailwindcss/cli | Windi CSS | Tailwind-compatible, but **deprecated** (project archived) | **Not recommended** — dead project |
| tailwindcss + @tailwindcss/cli | Bootstrap / Bulma | Component-first frameworks; heavier, less customizable, not utility-first | **Not recommended** — conflicts with shadcn/ui atomic approach |
| @tailwindcss/cli | @tailwindcss/postcss | Programmatic integration; eliminates shell-out | **Recommended for evaluation** — removes `execSync` timeout risk, enables build pipeline composition |
| @tailwindcss/cli | @tailwindcss/vite | Native Vite integration; fastest HMR | **Not applicable** — rntme uses esbuild, not Vite |

Installation / upgrade commands, if eventually recommended:
```bash
# Upgrade in ui-runtime package (research-only; do not run now)
cd packages/ui-runtime
pnpm add -D tailwindcss@^4.2.4 @tailwindcss/cli@^4.2.4

# If migrating to PostCSS plugin (future spike)
pnpm add -D @tailwindcss/postcss@^4.2.4
```

## Architecture Patterns

### System Architecture Diagram
```mermaid
flowchart LR
  Input[UI artifact JSON] -->|@rntme/ui compiles| A[React components]
  A -->|esbuild bundle| B[build/main.js]
  B -->|@source directive| C[@tailwindcss/cli]
  C -->|scans for class names| D[build/main.css]
  E[styles.css + @theme inline] -->|Tailwind v4 config| C
  D -->|served by Hono| F[Browser / SPA]
```

### Component Responsibilities
| Component | Responsibility | Implementation mapping | Notes |
|---|---|---|---|
| esbuild | Bundle React/TSX entry point to ESM | `build.ts` lines 13-25 | `loader: { '.css': 'empty' }` ignores CSS imports in JS |
| @tailwindcss/cli | Scan JS bundle for utility classes, generate CSS | `build.ts` lines 30-33 | Called via `execSync` with `{ stdio: 'inherit' }` |
| styles.css | Tailwind entry + shadcn theme tokens | `src/client/styles.css` | `@import "tailwindcss"`, `@source "../../build/main.js"`, `@theme inline` |
| build/main.css | Generated utility CSS | `build/` (gitignored) | Minified output; fallback stub on failure |
| @json-render/shadcn | Render shadcn components using Tailwind classes | `package.json` dependency | Peer-requires `tailwindcss ^4.0.0` |

### Recommended Project Structure
```text
packages/ui-runtime/
├── src/
│   ├── client/
│   │   ├── entry.tsx          # React app entry point
│   │   ├── styles.css         # Tailwind entry + theme
│   │   └── ...                # Components
│   ├── build.ts               # esbuild + Tailwind CLI orchestration
│   └── server/                # Hono serving logic
├── build/                     # Generated bundle (gitignored)
│   ├── main.js
│   └── main.css
└── package.json
```

### Pattern 1: JS-first Bundle + CLI Scan (Current)
What: Build JS bundle first, then run `@tailwindcss/cli` pointing at the bundle via `@source`.
When to use: esbuild-based pipelines without Vite/PostCSS integration.
Example:
```ts
// Source: packages/ui-runtime/src/build.ts
await build({
  entryPoints: [join(__dirname, 'client', 'entry.tsx')],
  outfile: join(buildDir, 'main.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  loader: { '.css': 'empty' },
});

execSync(
  `npx @tailwindcss/cli -i ${join(__dirname, 'client', 'styles.css')} -o ${join(buildDir, 'main.css')} --minify`,
  { stdio: 'inherit' },
);
```

### Pattern 2: PostCSS Plugin Integration (Recommended for Evaluation)
What: Use `@tailwindcss/postcss` as a PostCSS plugin, eliminating the shell-out.
When to use: When you already have or can add a PostCSS step to the build pipeline.
Example:
```ts
// Source: https://tailwindcss.com/docs/installation/using-postcss
// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```
Then process `styles.css` through PostCSS programmatically in `build.ts` instead of shelling out.

### Pattern 3: Vite Plugin (Not Applicable to rntme)
What: Use `@tailwindcss/vite` for native Vite integration.
When to use: Vite-based projects.
Example:
```ts
// Source: https://tailwindcss.com/docs/installation/using-vite
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
});
```

### Anti-Patterns to Avoid
- **Shelling out without timeout**: `execSync` without `timeout` can hang indefinitely; always set `timeout: 60_000`.
- **Dynamic class name construction**: Tailwind scans plain text; `className={\`bg-${color}-500\`}` will not work. Use static maps instead.
- **CSS modules + Tailwind**: Tailwind v4 docs explicitly discourage using CSS modules alongside Tailwind; styles are naturally scoped by utility classes.
- **Using Sass/Less with Tailwind v4**: Tailwind v4 is designed to replace preprocessors; Lightning CSS handles nesting, imports, and prefixing natively.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Utility-class CSS generation | Custom class scanner | `tailwindcss` + `@tailwindcss/cli` | Oxide engine is Rust-optimized, handles edge cases (arbitrary values, variants, composable masks) |
| CSS minification/bundling | Custom CSS pipeline | Tailwind v4 built-in (uses Lightning CSS) | Tailwind v4 bundles imports, adds prefixes, and minifies automatically |
| Theme token system | Custom CSS variables | `@theme inline` in Tailwind v4 | Native integration with utilities; supports `oklch`, opacity modifiers, dark mode |
| Component styling | Custom CSS per component | shadcn/ui + Tailwind utilities | Standardized, accessible, themable; `@json-render/shadcn` provides this for rntme |

Key insight: Tailwind v4's Oxide engine subsumes most of what you'd need a separate CSS build tool for (import bundling, nesting, prefixing, minification). Adding another layer (Sass, PostCSS plugins, custom scripts) is usually unnecessary and adds build-time overhead.

## Common Pitfalls

### Pitfall 1: execSync Hang Without Timeout (U-351)
What goes wrong: `@tailwindcss/cli` invoked via `execSync` with no `timeout` can block the build pipeline indefinitely.
Why it happens: `child_process.execSync` defaults to no timeout; a stuck process (e.g. file watcher bug, infinite loop in scanning) will freeze CI/local builds.
How to avoid: Add `timeout: 60_000` to the `execSync` options, or migrate to programmatic API.
Warning signs: Build jobs hanging at the CSS generation step.
Evidence: [rntme audit U-351](/docs/audit/00-waves.md) — "build.ts execSync of @tailwindcss/cli without timeout"

### Pitfall 2: Dynamic Class Names Not Detected
What goes wrong: Utility classes constructed dynamically (e.g. `bg-${color}-500`) are not generated because Tailwind scans source files as plain text.
Why it happens: Tailwind does not parse/execute JS; it looks for static tokens that match utility patterns.
How to avoid: Always use complete static class names; map dynamic values to static class name objects.
Warning signs: Missing styles in production build but visible in development (if dev uses different scan behavior).
Evidence: [Tailwind docs: Detecting classes in source files](https://tailwindcss.com/docs/detecting-classes-in-source-files)

### Pitfall 3: Version Mismatch Between tailwindcss and @tailwindcss/cli
What goes wrong: `tailwindcss` and `@tailwindcss/cli` are released in lockstep; mixing versions can cause subtle bugs.
Why it happens: `@tailwindcss/cli` bundles its own `tailwindcss` dependency; npm/pnpm may resolve different versions.
How to avoid: Pin both to the same exact version in `package.json` (e.g. `^4.2.4`).
Warning signs: CSS generated with missing utilities, or `@theme` variables not resolving correctly.
Evidence: `@tailwindcss/cli` package.json declares `tailwindcss: "4.2.4"` as a direct dependency.

### Pitfall 4: @source Path Resolution in Monorepos
What goes wrong: `@source "../../build/main.js"` is relative to the CSS file location; moving files breaks the build.
Why it happens: Tailwind resolves `@source` relative to the stylesheet, not the build script.
How to avoid: Use `source()` function in the import statement (`@import "tailwindcss" source("../src")`) for explicit base paths, or generate the CSS entry dynamically.
Warning signs: Build succeeds but CSS is empty (no utilities generated).
Evidence: [Tailwind docs: Setting your base path](https://tailwindcss.com/docs/detecting-classes-in-source-files#setting-your-base-path)

### Pitfall 5: Browser Compatibility Assumptions
What goes wrong: Tailwind v4 uses modern CSS (`@property`, `color-mix()`, `oklch()`) that fails in Safari < 16.4, Chrome < 111, Firefox < 128.
Why it happens: v4 is explicitly designed for modern browsers; older browsers may show broken colors/missing features.
How to avoid: v4.1+ improved fallbacks for Safari 15, but full support still requires modern browsers. Document browser requirements if end users may use older devices.
Warning signs: Gradients, shadows, or transforms not rendering in older browsers.
Evidence: [Tailwind docs: Browser compatibility](https://tailwindcss.com/docs/compatibility)

## Code Examples

### Verified patterns from official sources.

### Theme Configuration (v4 CSS-first)
```css
/* Source: https://tailwindcss.com/docs/theme */
@import "tailwindcss";

@theme inline {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  --color-primary: oklch(0.205 0 0);
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
}
```

### Safelisting Utilities
```css
/* Source: https://tailwindcss.com/docs/detecting-classes-in-source-files#safelisting-specific-utilities */
@import "tailwindcss";
@source inline("{hover:,focus:,}bg-red-{50,{100..900..100},950}");
```

### Ignoring Paths
```css
/* Source: https://tailwindcss.com/docs/detecting-classes-in-source-files#ignoring-specific-paths */
@import "tailwindcss";
@source not "./src/components/legacy";
```

### Build with Timeout (Fix for U-351)
```ts
// Source: rntme audit recommendation + Node.js docs
import { execSync } from 'node:child_process';

execSync(
  `npx @tailwindcss/cli -i ./styles.css -o ./main.css --minify`,
  { stdio: 'inherit', timeout: 60_000 },
);
```

## State of the Art (2024-2026)

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| tailwind.config.js (JS config) | CSS-first `@theme inline` | v4.0 (Jan 2025) | Simpler theming; no JS config needed for most projects |
| PostCSS + autoprefixer + postcss-import | Built-in Lightning CSS | v4.0 (Jan 2025) | Faster builds; fewer dependencies |
| `@tailwind` directives | `@import "tailwindcss"` | v4.0 (Jan 2025) | Standard CSS import syntax |
| PurgeCSS-style scanning | Oxide engine (Rust) | v4.0 (Jan 2025) | 10x+ faster scanning; no config needed |
| `safelist` in JS config | `@source inline()` | v4.1 (Apr 2025) | CSS-native safelisting |
| `content` array in config | Automatic + `@source` | v4.0 (Jan 2025) | Zero-config by default; explicit opt-in for edge cases |

New tools/patterns to consider:
- **@tailwindcss/postcss plugin**: Programmatic integration for custom build pipelines (replaces shell-out).
- **@source inline() / @source not**: Fine-grained control over what gets scanned (v4.1).
- **text-shadow utilities**: Finally available in v4.1 after years of community requests.
- **mask-* utilities**: Composable gradient/image masking (v4.1).
- **pointer-fine / pointer-coarse variants**: Input-device-aware styling (v4.1).

Deprecated/outdated:
- `tailwindcss` v3.x (still maintained for legacy browser support, but v4 is the forward path).
- `tailwind.config.js` as the primary configuration method (still supported via `@config`, but not idiomatic in v4).
- `@tailwind base; @tailwind components; @tailwind utilities;` directives (replaced by `@import "tailwindcss"`).
- Windi CSS (project archived).

## Migration Assessment

| Area | Finding | Impact | Risk | Evidence |
|---|---|---|---|---|
| **Version gap** | 4.2.2 → 4.2.4 (2 patches) | LOW | **VERY LOW** | No breaking changes; patch release notes show only Vite alias fix |
| **Build reliability** | `execSync` without timeout | MEDIUM | MEDIUM | Audit U-351; trivial fix (`timeout: 60_000`) |
| **Peer dependency** | `@json-render/shadcn@0.17.0` requires `tailwindcss ^4.0.0` | LOW | LOW | `npm view @json-render/shadcn@0.17.0 peerDependencies` |
| **Security** | No known CVEs for tailwindcss 4.x | NONE | NONE | `npm audit` returned no tailwindcss vulnerabilities |
| **Performance** | Oxide engine already in use | NONE | NONE | rntme already on v4; benefits already realized |
| **Browser compat** | Modern browsers required (Safari 16.4+) | LOW | LOW | rntme targets modern runtimes; no legacy browser requirement |
| **Lockstep deps** | `@tailwindcss/cli` pins exact `tailwindcss` version | LOW | LOW | Ensures compatibility but requires coordinated upgrades |

**Migration path/effort:**
1. Update `packages/ui-runtime/package.json`: bump `tailwindcss` and `@tailwindcss/cli` to `^4.2.4`.
2. Run `pnpm install` and verify lockfile updates.
3. Run `pnpm -F @rntme/ui-runtime build` to confirm CSS generation still works.
4. Add `timeout: 60_000` to `execSync` in `build.ts` (or create separate issue).
5. Run full test suite (`pnpm -r run test`).

**Test strategy:**
- Unit tests for `@rntme/ui-runtime` (already in place).
- Visual regression of demo/issue-tracker-api UI (if available).
- Build smoke test: confirm `build/main.css` is generated and non-empty.

**Compatibility:**
- Node.js: Tailwind v4 requires Node 20+ (rntme uses Node 20+).
- React: No direct dependency; works with any React version.
- esbuild: Compatible; esbuild ignores `.css` imports with `loader: { '.css': 'empty' }`.

## Recommendation

**Decision: KEEP + UPGRADE** (patch bump)

Rationale:
- Tailwind CSS v4 is the correct choice for rntme's architecture: required by `@json-render/shadcn`, industry standard, actively maintained by Tailwind Labs.
- The version gap is tiny (4.2.2 → 4.2.4) with no breaking changes; upgrade is safe and trivial.
- Alternatives (UnoCSS, Linaria, etc.) are incompatible with the shadcn/ui ecosystem that rntme depends on.
- The only real issue is the `execSync` timeout (audit U-351), which is a one-line fix.

**Phased plan:**

**Phase A (Immediate — this issue's follow-up):**
- Upgrade `tailwindcss` and `@tailwindcss/cli` to `^4.2.4` in `packages/ui-runtime`.
- Add `timeout: 60_000` to `execSync` call in `build.ts`.
- Run build and tests.

**Phase B (Short-term — build-system improvement):**
- Spike: Replace `@tailwindcss/cli` shell-out with `@tailwindcss/postcss` programmatic API.
- Benefits: Removes subprocess overhead, enables better error handling, integrates cleanly with esbuild watch mode.
- Risk: Low; PostCSS plugin is officially supported and documented.

**Phase C (Medium-term — DX):**
- Evaluate `prettier-plugin-tailwindcss` for consistent class ordering in generated/marketplace UI code.
- Evaluate `tailwind-merge` if dynamic class composition becomes common in the UI runtime.

**Follow-up tasks to create later:**
1. `[DEV]` Upgrade `tailwindcss` and `@tailwindcss/cli` to `^4.2.4` in `packages/ui-runtime`.
2. `[DEV]` Add `timeout: 60_000` to `execSync` in `packages/ui-runtime/src/build.ts`.
3. `[DEV]` Spike: Replace `@tailwindcss/cli` with `@tailwindcss/postcss` in build pipeline.
4. `[DEV]` Add build smoke test: assert `build/main.css` is non-empty after build.

## Open Questions

1. **Should rntme migrate from `@tailwindcss/cli` to `@tailwindcss/postcss`?**
   - What we know: The CLI shell-out works but has no timeout and adds subprocess overhead.
   - What's unclear: Whether esbuild's plugin API can cleanly compose with PostCSS in the current build pipeline.
   - Recommendation: Create a spike issue (Phase B) to prototype the PostCSS integration; keep CLI as fallback.

2. **How will `@json-render/shadcn` evolve its Tailwind version requirements?**
   - What we know: Current peer dependency is `tailwindcss ^4.0.0`, which is permissive.
   - What's unclear: Whether future `@json-render/shadcn` versions will require v4.3+ features or drop v4 support.
   - Recommendation: Monitor `@json-render/shadcn` release notes; the `^4.0.0` range gives flexibility.

3. **Should rntme adopt `prettier-plugin-tailwindcss` for generated/marketplace code?**
   - What we know: Class sorting improves readability and reduces merge conflicts.
   - What's unclear: Whether generated code (from UI artifacts) can benefit from Prettier integration, or if it should be handled at the generator level.
   - Recommendation: Evaluate after UI artifact generation stabilizes; low priority.

## Sources

### Primary (HIGH confidence)
- [tailwindlabs/tailwindcss GitHub releases](https://github.com/tailwindlabs/tailwindcss/releases) — Official release notes for v4.0, v4.1, v4.2.x
- [Tailwind CSS official docs](https://tailwindcss.com/docs) — Installation, compatibility, detecting classes, upgrade guide
- [Tailwind CSS v4.1 blog post](https://tailwindcss.com/blog/tailwindcss-v4-1) — Feature overview for v4.1
- [npm registry](https://www.npmjs.com/package/tailwindcss) (queried via `npm view`) — Version metadata, peer dependencies
- `@json-render/shadcn@0.17.0` peerDependencies — Verified via `npm view`

### Secondary (MEDIUM confidence)
- [rntme audit U-351](/docs/audit/00-waves.md) — Build reliability finding
- [rntme packages/ui-runtime source](/packages/ui-runtime/src/build.ts) — Current integration pattern
- [UnoCSS documentation](https://unocss.dev/) — Alternative evaluation

### Tertiary (LOW confidence - needs validation)
- Community benchmarks comparing Tailwind v4 Oxide vs UnoCSS performance — General ecosystem sentiment
- GitHub issues in tailwindlabs/tailwindcss for edge cases with `@source` in monorepos

## Metadata

Research scope:
- Core technology: tailwindcss + @tailwindcss/cli
- Ecosystem: @json-render/shadcn, shadcn/ui, Lightning CSS, PostCSS, Vite
- Patterns: Build-time CSS generation, esbuild integration, CSS-first theming, programmatic API alternatives
- Pitfalls: Build hangs, dynamic class detection, version lockstep, browser compatibility

Confidence breakdown:
- Standard stack: **HIGH** — Clear ecosystem consensus; Tailwind is the dominant utility-first framework
- Architecture: **HIGH** — Directly observable in rntme codebase + official docs
- Pitfalls: **HIGH** — Documented in official docs and rntme audit
- Code examples: **HIGH** — Verified against official docs and current codebase

Research date: 2026-04-28
Valid until: 2026-10-28 (recommend biannual review for a mature, stable dependency)
Ready for migration planning: **YES**
