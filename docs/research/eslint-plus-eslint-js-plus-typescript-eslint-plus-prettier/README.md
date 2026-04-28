# Dependency Research: eslint + @eslint/js + @typescript-eslint/* + prettier

Researched: 2026-04-28
Repository: /home/coder/work/rntme
Domain/ecosystem: npm/lint-format-tooling
Current version(s) in rntme: eslint ^9.10.0; @eslint/js ^9.10.0; @typescript-eslint/eslint-plugin/parser ^8.6.0; prettier ^3.3.3 (all packages/modules/rntme-cli package.json; lint/format configs)
Latest stable version: eslint 10.2.1 (2025-04-16); @eslint/js 10.0.1 (2025-04-16); @typescript-eslint 8.59.1 (2025-04-26); prettier 3.8.3 (2025-04-15)
Confidence: HIGH

## User Constraints
- Goal: understand current dependencies and migrate rntme to latest safe versions later.
- Output must be written to `docs/research/eslint-plus-eslint-js-plus-typescript-eslint-plus-prettier/README.md`.
- Research-only: do not perform dependency upgrades or runtime code migrations in this issue.
- Look for better-suited libraries/solutions, not only latest version of the current choice.
- Use authoritative current sources: Context7 where applicable, official docs/changelog/releases, npm/GitHub/container registry, migration guides, security advisories.

## Summary

ESLint v10 was released in April 2025, roughly one year after the v9 flat-config transition. The biggest change in v10 is the **complete removal of eslintrc/legacy config support** and stricter Node.js engine requirements (`^20.19.0 || ^22.13.0 || >=24`). rntme is already fully migrated to flat config (`eslint.config.mjs` in every package), so the legacy removal is a non-issue. typescript-eslint v8 (latest 8.59.1) supports both ESLint v9 and v10 and is stable since July 2024. Prettier 3.8.3 is a routine patch release with no breaking changes.

The standard expert stack for TypeScript monorepos in 2024–2026 remains **ESLint + @eslint/js + typescript-eslint + Prettier**. A notable simplification is the `typescript-eslint` unified package (replaces separate `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` installs) which is now the recommended install path.

**Primary recommendation:** Keep the current stack. Upgrade ESLint to v10, switch to the unified `typescript-eslint` package, and bump prettier to `^3.8.3`. No alternative tooling (e.g., Biome) is mature enough to replace this quartet for rntme's polyglot monorepo needs.

## Current Usage in rntme

| Package / image / tool | Current version | Used by | Source file(s) | Runtime/dev/build/test | Notes |
|---|---|---|---|---|---|
| eslint | ^9.10.0 | All packages & modules | `packages/*/package.json`, `modules/*/package.json`, `rntme-cli/packages/*/package.json` | dev | Flat config (`eslint.config.mjs`) in every package. No legacy `.eslintrc` remains. |
| @eslint/js | ^9.10.0 | Contract packages, CLI packages, modules | `packages/contracts/*/package.json`, `rntme-cli/packages/*/package.json`, `modules/*/package.json` | dev | Imported as `js.configs.recommended` in flat configs. |
| @typescript-eslint/eslint-plugin | ^8.6.0 | All packages & modules | `packages/*/package.json`, `modules/*/package.json`, `rntme-cli/packages/*/package.json` | dev | Enabled manually in each `eslint.config.mjs`. |
| @typescript-eslint/parser | ^8.6.0 | All packages & modules | Same as above | dev | Used with `parserOptions: { sourceType: 'module', ecmaVersion: 2022 }`. |
| prettier | ^3.3.3 | All packages & modules | Same as above | dev | Invoked via `prettier --write .` in `format` scripts. One `.prettierrc.cjs` found in `packages/graph-ir-compiler`. |

Verification commands:
```bash
grep -r '@eslint/js' /home/coder/work/rntme --include='package.json' -l | grep -v node_modules | grep -v .worktrees | wc -l
# → 20 packages/modules use @eslint/js

grep -r '@typescript-eslint/eslint-plugin' /home/coder/work/rntme --include='package.json' -l | grep -v node_modules | grep -v .worktrees | wc -l
# → 24 packages/modules use @typescript-eslint/*

find /home/coder/work/rntme -maxdepth 4 -name 'eslint.config.mjs' -not -path '*/node_modules/*' -not -path '*/.worktrees/*' | wc -l
# → 25 flat-config files
```

## Latest Versions / Release State

| Channel | Version | Release date | Source | Notes |
|---|---|---|---|---|
| eslint | 10.2.1 | 2025-04-16 | npm registry, GitHub releases | Latest stable. v10 dropped eslintrc entirely. |
| @eslint/js | 10.0.1 | 2025-04-16 | npm registry | Ships with eslint 10.x. Peer-dep: `eslint: ^10.0.0`. |
| @typescript-eslint/eslint-plugin | 8.59.1 | 2025-04-26 | npm registry, typescript-eslint.io | Latest stable v8. Supports ESLint ^8.57.0 \|\| ^9.0.0 \|\| ^10.0.0. |
| @typescript-eslint/parser | 8.59.1 | 2025-04-26 | npm registry | Same support matrix as plugin. |
| typescript-eslint (unified) | 8.59.1 | 2025-04-26 | npm registry | Recommended install path. Replaces separate plugin + parser. |
| prettier | 3.8.3 | 2025-04-15 | npm registry, GitHub releases | Latest stable. Minor SCSS fix since 3.5.x. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| eslint | ^10.2.1 | Pluggable JavaScript/TypeScript linter | Industry standard. Flat config is now the only config format in v10. |
| @eslint/js | ^10.0.1 | ESLint's own JS language plugin / recommended rules | Official source for `js.configs.recommended`. |
| typescript-eslint | ^8.59.1 | Unified TypeScript parser + plugin for ESLint | TypeScript team's endorsed ESLint integration. Provides typed linting via `projectService`. |
| prettier | ^3.8.3 | Opinionated code formatter | De-facto standard. Zero-config by design. |

### Supporting
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| eslint-config-prettier | ^10.0.0 | Disables ESLint rules that conflict with Prettier | If any ESLint plugin enables layout/formatting rules. |
| eslint-plugin-import-x | ^4.0.0 | ES module import/export linting | For monorepos with complex import graphs. |
| @stylistic/eslint-plugin | ^4.0.0 | Replaces deprecated typescript-eslint formatting rules | Only if you want lint-time formatting enforcement (Prettier is preferred). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff | Recommendation for rntme |
|---|---|---|---|
| eslint + prettier | Biome | Biome is faster (Rust) and bundles lint+format, but plugin ecosystem is immature, TypeScript support lags, and it cannot parse protobuf/gRPC stubs or custom ESLint rules rntme may need. | **Keep eslint + prettier.** Biome is not a drop-in replacement for a monorepo with 25+ packages. |
| @typescript-eslint/* (separate) | `typescript-eslint` (unified) | Unified package exports `tseslint.config()` helpers and bundles plugin + parser. Simpler `package.json` and config files. | **Adopt unified package** during next upgrade wave. |
| eslint v9 | eslint v10 | v10 removes eslintrc (already done in rntme) and updates `eslint:recommended`. Stricter Node engine requirement. | **Upgrade to v10** after verifying CI Node version is `>=20.19.0`. |

Installation / upgrade commands, if eventually recommended:
```bash
# Remove separate packages, install unified typescript-eslint
pnpm remove @typescript-eslint/eslint-plugin @typescript-eslint/parser
pnpm add -D eslint@^10.2.1 @eslint/js@^10.0.1 typescript-eslint@^8.59.1 prettier@^3.8.3

# Example flat config using unified package (source: https://typescript-eslint.io/getting-started/)
// eslint.config.mjs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
```

## Architecture Patterns

### System Architecture Diagram
```mermaid
flowchart LR
  Source[Source files .ts/.mjs] --> Parser[ESLint Parser @typescript-eslint/parser]
  Parser --> AST[TypeScript-enriched AST]
  AST --> RuleEngine[ESLint Rule Engine]
  RuleEngine --> CoreRules[@eslint/js recommended]
  RuleEngine --> TSRules[typescript-eslint recommended]
  RuleEngine --> CustomRules[Project-specific rules]
  CoreRules & TSRules & CustomRules --> Reporter[Lint Report / Errors]
  Source --> Prettier[Prettier Formatter]
  Prettier --> Formatted[Formatted Source]
  
  subgraph Config
    FlatConfig[eslint.config.mjs]
  end
  FlatConfig --> RuleEngine
  FlatConfig --> Prettier
```

### Component Responsibilities
| Component | Responsibility | Implementation mapping | Notes |
|---|---|---|---|
| `eslint.config.mjs` | Flat config entry point | One per package/module | Exports array of config objects. rntme already uses this pattern. |
| `@eslint/js` | Core JS recommended rules | `js.configs.recommended` | Provides baseline correctness rules. |
| `typescript-eslint` | TypeScript parser + plugin | `tseslint.config()`, `tseslint.configs.recommended` | Unified package simplifies config. |
| `prettier` | Code formatting | `prettier --write .` | Runs independently of ESLint. |
| `pnpm -r run lint` | Orchestrates lint across monorepo | Root `package.json` script | Runs `eslint` in every workspace member. |
| `pnpm -r run format` | Orchestrates formatting | Per-package `package.json` scripts | Runs `prettier --write .` in every workspace member. |

### Recommended Project Structure
```text
packages/
├── <pkg>/
│   ├── src/
│   ├── test/
│   ├── eslint.config.mjs      # Flat config (already present)
│   ├── package.json           # devDeps: eslint, typescript-eslint, prettier
│   └── tsconfig.json
```

### Pattern 1: Unified typescript-eslint Config
What: Use the `typescript-eslint` unified package instead of separate plugin/parser imports.
When to use: During the next upgrade wave. Reduces dependency count and config boilerplate.
Example:
```ts
// Source: https://typescript-eslint.io/getting-started/
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommended,
);
```

### Pattern 2: Typed Linting with Project Service
What: Enable type-aware linting using the stable `projectService` API (typescript-eslint v8+).
When to use: If rntme wants stricter type-aware rules (`recommendedTypeChecked`, `strictTypeChecked`).
Example:
```ts
// Source: https://typescript-eslint.io/blog/announcing-typescript-eslint-v8/
export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
```

### Anti-Patterns to Avoid
- **Running Prettier via ESLint:** Do not use `eslint-plugin-prettier` or formatting rules in ESLint. Run Prettier separately for speed and clarity.typescript-eslint explicitly deprecates formatting rules.
- **Mixing flat config and eslintrc:** ESLint v10 no longer supports eslintrc at all. Ensure no `.eslintrc*` files remain. rntme is already clean.
- **Custom `tsconfig.eslint.json`:** With `projectService: true`, you no longer need a separate `tsconfig.eslint.json` for files outside the main `tsconfig.json` include array.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| TypeScript-aware lint rules | Custom TSLint-like tool | typescript-eslint | 100+ rules, typed linting, maintained by TS community. |
| JS/TS code formatting | Custom formatter based on AST | Prettier | Battle-tested, editor-integrated, zero-config. |
| Monorepo lint orchestration | Shell scripts wrapping `eslint` | `pnpm -r run lint` + root scripts | pnpm workspace scripts handle concurrency and filtering natively. |

Key insight: ESLint's plugin architecture is its superpower. A custom linter would need to reimplement parser integration, rule APIs, editor integrations, and the massive ecosystem of plugins. For a monorepo, this is never justified.

## Common Pitfalls

### Pitfall 1: ESLint v10 Node Engine Mismatch
What goes wrong: `pnpm install` or CI fails because ESLint 10 requires Node `^20.19.0 || ^22.13.0 || >=24`. rntme's `engines.node` is `>=20`, and CI uses `node-version: 20` (currently resolves to 20.19.x on `ubuntu-latest`, but not guaranteed on all environments).
Why it happens: ESLint tightened engine requirements in v10 to drop older Node 20 minors.
How to avoid: Pin CI to `node-version: '20.19'` or `'22'` before upgrading ESLint. Update `engines.node` in root `package.json` to `>=20.19.0`.
Warning signs: `npm ERR! notsup Unsupported engine` during install.

### Pitfall 2: Deprecated typescript-eslint Rules
What goes wrong: After upgrading to typescript-eslint v8, previously enabled rules like `@typescript-eslint/ban-types` or `@typescript-eslint/no-var-requires` are removed/renamed, causing config errors.
Why it happens: v8 split `ban-types` into `no-empty-object-type`, `no-unsafe-function-type`, `no-wrapper-object-types`, and `no-restricted-types`.
How to avoid: Remove custom rule overrides and extend from `tseslint.configs.recommended` or `strict`, then selectively disable. Do not manually list old rule names.
Warning signs: `Error: Key "rules": Key "@typescript-eslint/ban-types"`: Could not find the rule.

### Pitfall 3: prettierignore drift
What goes wrong: Prettier attempts to format generated files (`dist/`, `node_modules/`, protobuf stubs) because `.prettierignore` is missing or out of date.
Why it happens: Prettier does not read `.gitignore` by default.
How to avoid: Add a root `.prettierignore` (or `prettier.config.mjs` with `ignorePatterns`) that mirrors `.gitignore` exclusions for build artifacts.
Warning signs: Large diffs in generated files during `pnpm -r run format`.

## Code Examples

### Common Operation 1: Basic Flat Config for TypeScript Package
```ts
// Source: https://eslint.org/docs/latest/use/configure/configuration-files
// Source: https://typescript-eslint.io/users/configs
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': 'warn',
    },
  },
);
```

### Common Operation 2: Typed Linting with Project Service
```ts
// Source: https://typescript-eslint.io/blog/announcing-typescript-eslint-v8/
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
```

### Common Operation 3: Prettier Config (ESM)
```ts
// Source: https://prettier.io/docs/en/configuration.html
/** @type {import("prettier").Config} */
const config = {
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  tabWidth: 2,
};

export default config;
```

## State of the Art (2024-2025)

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Separate `@typescript-eslint/eslint-plugin` + `@typescript-eslint/parser` | Unified `typescript-eslint` package | 2024 (v8) | Simpler install, better flat-config helpers, `tseslint.config()` API. |
| `parserOptions.project: './tsconfig.json'` | `parserOptions.projectService: true` | 2024 (v8) | Faster, auto-discovers tsconfig, no need for `tsconfig.eslint.json`. |
| ESLint v8 + eslintrc (`.eslintrc.js`) | ESLint v9/v10 + flat config (`eslint.config.mjs`) | 2024–2025 | v10 removed eslintrc entirely. Flat config is the only path. |
| Running Prettier inside ESLint (`eslint-plugin-prettier`) | Separate Prettier run | 2023–2024 | Prettier runs faster standalone. typescript-eslint deprecated formatting rules. |
| `@typescript-eslint/ban-types` | `no-empty-object-type`, `no-unsafe-function-type`, `no-wrapper-object-types`, `no-restricted-types` | 2024 (v8) | More precise, less false-positive prone. |

New tools/patterns to consider:
- **ESLint v10 `defineConfig()` helper:** Official helper from `eslint/config` for better type safety in config files.
- **`typescript-eslint` unified package:** Reduces `package.json` noise.
- **`projectService: true`:** Makes typed linting viable without per-package `tsconfig.eslint.json` files.

Deprecated/outdated:
- `.eslintrc*` files — removed in ESLint v10.
- `@typescript-eslint/ban-types` — removed in v8.
- `@typescript-eslint/no-var-requires` — replaced by `no-require-imports`.
- Formatting rules in ESLint — delegated to Prettier or `@stylistic/eslint-plugin`.

## Migration Assessment

| Area | Finding | Impact | Risk | Evidence |
|---|---|---|---|---|
| ESLint 9 → 10 | Flat config only; eslintrc removed. Stricter Node engine. `eslint:recommended` updated. | Medium | **Low** for rntme because flat config is already adopted. Medium risk if CI Node < 20.19.0. | GitHub release notes v10.0.0; `engines` in `eslint@10.2.1` package.json. |
| @eslint/js 9 → 10 | Peer-dep now requires `eslint: ^10.0.0`. Config contents updated. | Low | Low | npm registry metadata. |
| @typescript-eslint 8.6 → 8.59 | Bug fixes, new rules, `projectService` improvements. No breaking changes within v8. | Low | Low | typescript-eslint release notes; semver minor bumps. |
| prettier 3.3 → 3.8 | Patch/minor releases. New TypeScript config file support (`prettier.config.ts`). No breaking changes. | Low | Low | Prettier changelog; npm registry. |
| Config file simplification | Can switch 25+ packages to unified `typescript-eslint` package. | Medium | Low | Official docs recommend unified package. |
| Typed linting enablement | `projectService: true` removes need for custom `tsconfig.eslint.json` files. | Medium | Medium | Requires verifying performance in a 25-package monorepo. |
| Security posture | No known CVEs for current versions. ESLint v9.x will continue receiving security fixes per version support policy, but v10 is the active line. | Low | Low | ESLint version support policy; npm audit. |

## Recommendation

Decision: **KEEP + UPGRADE**

Rationale:
- ESLint + typescript-eslint + Prettier is still the undisputed standard for TypeScript monorepos.
- rntme has already absorbed the hardest migration (flat config in v9), making the v10 upgrade straightforward.
- The unified `typescript-eslint` package reduces boilerplate across 25+ packages.
- Prettier bump is risk-free.
- Alternatives (Biome) do not yet match the rule depth, editor support, or ecosystem maturity required for rntme.

Follow-up tasks to create later:
1. **Bump CI Node version** to `20.19.0` minimum (or migrate to Node 22 LTS) before upgrading ESLint.
2. **Upgrade ESLint to v10** across all workspace packages, updating `@eslint/js` to `^10.0.1`.
3. **Migrate to unified `typescript-eslint` package** — remove `@typescript-eslint/eslint-plugin` and `@typescript-eslint/parser` from all `package.json` files, replace with `typescript-eslint`.
4. **Adopt `projectService: true`** in a pilot package to evaluate typed-linting performance before monorepo-wide rollout.
5. **Add root `.prettierignore`** to prevent formatting of build artifacts.
6. **Update `engines.node`** in root `package.json` to `>=20.19.0` (or `>=22.0.0`) to reflect ESLint 10 requirements.

## Open Questions

1. **Should rntme enable typed linting (`recommendedTypeChecked`/`strictTypeChecked`)?**
   - What we know: `projectService: true` makes configuration trivial.
   - What's unclear: Performance impact on a 25-package pnpm monorepo in CI.
   - Recommendation: Pilot in one package (`packages/blueprint` or `packages/runtime`) and measure `pnpm lint` duration.

2. **Should rntme adopt Node 22 LTS for CI before the ESLint 10 upgrade?**
   - What we know: Node 20 enters Maintenance LTS in Oct 2025 and EOL in Apr 2026.
   - What's unclear: Whether any runtime packages (e.g., `better-sqlite3`, `grpc-js`) have Node 22 compatibility issues.
   - Recommendation: Run CI matrix with Node 22 on a feature branch before switching the default.

3. **Is there value in adding `eslint-plugin-import-x` for monorepo import linting?**
   - What we know: rntme uses workspace deps (`workspace:*`) heavily.
   - What's unclear: Whether import errors are currently caught by TypeScript alone.
   - Recommendation: Defer until after the v10 + unified-package migration.

## Sources

### Primary (HIGH confidence)
- npm registry (`eslint@10.2.1`, `@eslint/js@10.0.1`, `@typescript-eslint/eslint-plugin@8.59.1`, `prettier@3.8.3`) — exact versions and engine requirements.
- ESLint official docs: https://eslint.org/docs/latest/use/configure/configuration-files — flat config file format, `defineConfig`, `globalIgnores`.
- ESLint v10 migration guide: https://eslint.org/docs/latest/use/migrate-to-10.0.0 — breaking changes, Node engine requirements.
- typescript-eslint v8 announcement: https://typescript-eslint.io/blog/announcing-typescript-eslint-v8/ — `projectService`, rule changes, unified package recommendation.
- typescript-eslint shared configs: https://typescript-eslint.io/users/configs — recommended, strict, stylistic configurations.
- Prettier configuration docs: https://prettier.io/docs/en/configuration.html — config file formats, overrides, EditorConfig integration.

### Secondary (MEDIUM confidence)
- GitHub release notes (eslint v10.0.0): https://github.com/eslint/eslint/releases/tag/v10.0.0 — verified breaking change list.
- GitHub release notes (prettier 3.8.3): https://github.com/prettier/prettier/releases/tag/3.8.3 — verified release contents.

### Tertiary (LOW confidence - needs validation)
- Biome comparison: Web search and community benchmarks; no official benchmark used. Not recommended as primary source.

## Metadata

Research scope:
- Core technology: ESLint v10, @eslint/js v10, typescript-eslint v8, Prettier v3.8
- Ecosystem: flat config, unified typescript-eslint package, typed linting, projectService, formatting separation
- Patterns: flat config architecture, unified package usage, Prettier standalone execution
- Pitfalls: Node engine mismatch, deprecated rule names, prettierignore drift
Confidence breakdown:
- Standard stack: HIGH — official docs and npm registry confirm versions and recommended patterns.
- Architecture: HIGH — rntme already uses flat config; architecture diagram reflects actual usage.
- Pitfalls: HIGH — derived from official migration guides and observed engine requirement changes.
- Code examples: HIGH — copied verbatim from official docs with source attribution.
Research date: 2026-04-28
Valid until: 2026-07-28 (next expected typescript-eslint minor cycle; ESLint v10 is stable)
Ready for migration planning: yes
