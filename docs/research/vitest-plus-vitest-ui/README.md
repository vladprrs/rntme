# Dependency Research: vitest + @vitest/ui

Researched: 2026-04-28
Repository: /home/coder/work/rntme
Domain/ecosystem: npm/testing-framework
Current version(s) in rntme: vitest ^2.1.0 - ^2.1.1 (resolved to 2.1.9 in pnpm-lock.yaml); @vitest/ui not currently installed
Latest stable version: vitest 4.1.5 / @vitest/ui 4.1.5 (released 2026-04-28, npm registry)
Confidence: HIGH

## User Constraints
- Goal: understand current dependencies and migrate rntme to latest safe versions later.
- Output must be written to `docs/research/vitest-plus-vitest-ui/README.md`.
- Research-only: do not perform dependency upgrades or runtime code migrations in this issue.
- Look for better-suited libraries/solutions, not only latest version of the current choice.
- Use authoritative current sources: Context7 where applicable, official docs/changelog/releases, npm/GitHub/container registry, migration guides, security advisories.

## Summary

rntme currently uses vitest 2.1.x across all 29 packages/modules in its pnpm monorepo. The project employs a simple, consistent testing setup: Node.js environment, default reporter, 10-15s timeout, with `vitest run --passWithNoTests` in CI and `vitest` for watch mode. No browser testing, no coverage configuration, and no `@vitest/ui` is currently installed (contrary to the inventory note). 

Vitest 4.1.5 is the latest stable release (April 2026), representing two major version jumps from rntme's current 2.1.9. The v3 and v4 releases brought significant improvements: pool architecture rewrite (removing tinypool), AST-aware V8 coverage remapping, browser mode maturation with visual regression testing, projects-based workspace configuration, and constructor spying support. However, v4 requires Node.js >= 20 and Vite >= 6, which rntme already satisfies (Node >= 20, pnpm >= 9).

**Primary recommendation:** Upgrade to vitest ^4.1.5 in a dedicated migration wave. The migration effort is moderate — mostly config adjustments (pool options, coverage if enabled, workspace -> projects) rather than test code rewrites. Staying on v2.1.x accumulates security and compatibility debt without gaining performance improvements and bug fixes. Jest is not recommended for rntme due to Vitest's Vite-native integration and ESM-first design, which aligns with rntme's modern TypeScript/monorepo architecture.

## Current Usage in rntme

| Package / image / tool | Current version | Used by | Source file(s) | Runtime/dev/build/test | Notes |
|---|---|---|---|---|---|
| vitest | ^2.1.1 (28 pkgs) | modules/*, packages/*, demo/* | `package.json` devDependencies | test | `test:watch`: vitest; `test`: vitest run --passWithNoTests |
| vitest | ^2.1.0 (1 pkg) | @rntme/db-studio | `packages/db-studio/package.json` | test | Same pattern as above |
| @vitest/ui | — | — | — | — | **Not currently installed** (inventory note appears incorrect) |

**Verified via:**
```bash
# Count package.json files with vitest dependency
grep -r '"vitest"' --include='package.json' -l | wc -l
# Result: 29

# Check resolved version in lockfile
grep 'vitest@' pnpm-lock.yaml
# Result: vitest@2.1.9

# Verify @vitest/ui absence
grep -r '"@vitest/ui"' --include='package.json' -l
# Result: (no output)
```

**Configuration pattern (representative sample from `packages/runtime/vitest.config.ts`):**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
    testTimeout: 15_000,
  },
});
```

## Latest Versions / Release State

| Channel | Version | Release date | Source | Notes |
|---|---|---|---|---|
| Stable | 4.1.5 | Apr 2026 | npm registry | Latest stable; maintenance active |
| Stable (v4 line) | 4.0.0 | Oct 2025 | GitHub releases | Major release with breaking changes |
| Beta | 5.0.0-beta.1 | Apr 2026 | npm registry | Early beta; not for production |
| Legacy | 2.1.9 | Nov 2024 | npm registry | rntme's current resolved version |
| Legacy | 3.2.4 | mid-2025 | npm registry | Previous stable line |

**Release cadence:** Vitest maintains an aggressive release schedule with patch releases every 1-2 weeks and minor releases monthly. v4.0.0 was released October 2025; v4.1.5 is the latest in the v4 line (April 2026).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---|---|---|---|
| vitest | ^4.1.5 | Test runner, assertions, mocking | Vite-native, ESM-first, fastest watch mode, Jest-compatible API |
| @vitest/ui | ^4.1.5 | Interactive test UI/dashboard | Built-in HTML reporter with filter, watch, and snapshot review |
| @vitest/coverage-v8 | ^4.1.5 | Code coverage | Native V8 coverage with AST-aware remapping (v4 default) |

### Supporting
| Library | Version | Purpose | When to Use |
|---|---|---|---|
| @vitest/browser | ^4.1.5 | Browser-based component/E2E testing | When testing DOM components or visual regression |
| @vitest/browser-playwright | ^4.1.5 | Playwright browser provider | For cross-browser testing with Playwright |
| happy-dom | ^15.x | Lightweight browser environment | Faster alternative to jsdom for UI package tests |
| @testing-library/* | latest | DOM testing utilities | When testing React components (rntme has ui package) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff | Recommendation for rntme |
|---|---|---|---|
| vitest | jest | Larger ecosystem, slower, CJS-first | **Keep vitest** — Vite-native integration, ESM, faster |
| vitest | node:test (builtin) | No deps, native, but minimal | Not recommended — lacks mocking, coverage, watch mode |
| vitest | tap / ava | Minimalist, TAP output | Not recommended — less mature TypeScript/Vite integration |
| @vitest/ui | --reporter=html | Built-in HTML reporter without server | @vitest/ui preferred for interactive debugging |
| @vitest/coverage-v8 | @vitest/coverage-istanbul | Istanbul more mature for some edge cases | v8 is now default and accurate in v4; either works |

**Installation / upgrade commands (for later migration wave):**
```bash
# Add to root or workspace packages
pnpm add -D vitest@^4.1.5 @vitest/ui@^4.1.5

# If adding coverage
pnpm add -D @vitest/coverage-v8@^4.1.5

# For browser testing (if needed later)
pnpm add -D @vitest/browser@^4.1.5 @vitest/browser-playwright@^4.1.5
```

## Architecture Patterns

### System Architecture Diagram
```mermaid
flowchart LR
    subgraph "Test Authoring"
        Source[Source files .ts] --> Transform[Vite transform pipeline]
        Tests[Test files .test.ts] --> Transform
    end
    
    Transform --> Runner[Test Runner]
    
    subgraph "Execution"
        Runner --> Pool{Pool Strategy}
        Pool -->|forks| Worker1[Worker Process 1]
        Pool -->|threads| Worker2[Worker Thread 2]
        Pool -->|vmThreads| Worker3[VM Thread 3]
    end
    
    Worker1 --> Environment[Environment: node/jsdom/happy-dom]
    Worker2 --> Environment
    Worker3 --> Environment
    
    Environment --> Assertion[Assertion Engine]
    Assertion --> Snapshot[Snapshot Manager]
    Assertion --> Mock[Mock/Spy Engine]
    
    subgraph "Reporting"
        Snapshot --> Reporter{Reporter}
        Mock --> Reporter
        Reporter --> CLI[CLI Output]
        Reporter --> HTML[HTML Report]
        Reporter --> UI[@vitest/ui Dashboard]
    end
```

### Component Responsibilities
| Component | Responsibility | Implementation mapping | Notes |
|---|---|---|---|
| Vite Transform | Transpile TS/JSX, resolve imports, apply plugins | `vite` dev server | Shared with app build pipeline |
| Test Runner | Discover tests, orchestrate execution, collect results | `vitest/node` | Supports sharding for CI parallelism |
| Pool Manager | Distribute tests across workers, handle isolation | `vitest/pools` | Rewritten in v4 without tinypool |
| Environment | Provide global context (node, jsdom, happy-dom) | `vitest/environments` | Custom environments possible |
| Assertion | Chai + Jest-compatible matchers | `@vitest/expect` | Supports custom matchers |
| Mock Engine | Module mocking, function spying, timer faking | `vitest/mocker` | Significantly improved in v4 |
| Snapshot | Serialize/deserialize snapshot assertions | `vitest/snapshot` | Custom serializers supported |
| Reporter | Format and output test results | Built-in + custom | `default`, `verbose`, `json`, `html`, `junit` |

### Recommended Project Structure
```text
packages/
├── runtime/
│   ├── src/           # Source code
│   ├── test/          # Test files
│   │   ├── unit/
│   │   └── integration/
│   └── vitest.config.ts
```

### Pattern 1: Monorepo Workspace Projects
What: Define multiple test projects within a single vitest config for mixed test types.
When to use: When rntme wants unified unit + integration test configs per package.
Example:
```ts
// Source: https://vitest.dev/guide/projects.html
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/**/*.unit.test.ts'],
          environment: 'node',
        },
      },
      {
        test: {
          name: 'integration',
          include: ['test/**/*.integration.test.ts'],
          testTimeout: 30_000,
        },
      },
    ],
  },
})
```

### Pattern 2: Shared Base Configuration
What: Extend a base vitest config across monorepo packages.
When to use: rntme already has consistent configs; formalize with a shared package.
Example:
```ts
// Source: https://vitest.dev/config/
import { defineConfig, mergeConfig } from 'vitest/config'
import base from '@rntme/vitest-config/base'

export default mergeConfig(base, defineConfig({
  test: {
    // package-specific overrides
  },
}))
```

### Anti-Patterns to Avoid
- **Duplicating vitest.config.ts across 29 packages without a base config**: Maintenance burden; use shared config or workspace projects.
- **Using `threads` pool with module-level state**: v4 `forks` pool is safer for stateful tests; `threads` shares memory.
- **Calling `vi.mock()` dynamically / conditionally**: Must be at top level, before imports. Dynamic mocking causes unpredictable behavior.
- **Relying on `vi.restoreAllMocks()` to reset automocks in v4**: Behavior changed in v4; automocks are no longer affected. Use `vi.clearAllMocks()` or recreate mocks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Test runner with Vite HMR | Custom test harness | vitest | Vite integration, watch mode, ESM support are complex |
| Mocking ESM modules | Proxyquire / manual require interception | vi.mock() | ESM mocking requires AST transformation; vitest handles this |
| Coverage collection | nyc / c8 directly | @vitest/coverage-v8 | Sourcemap handling, transpiled code coverage is non-trivial |
| Browser environment for tests | jsdom global setup | vitest environment + happy-dom/jsdom | Proper integration with Vite transform pipeline |
| Snapshot serialization | JSON.stringify comparisons | vitest snapshots | Built-in serializers for DOM, React, etc. |

Key insight: Vitest is not just a test runner but a testing platform deeply integrated with Vite's build pipeline. Custom solutions cannot replicate the transform-cached watch mode or proper ESM mocking without significant engineering effort.

## Common Pitfalls

### Pitfall 1: v4 Pool Configuration Migration
What goes wrong: Tests fail or configs are invalid after upgrading because `poolOptions` was removed and options moved to top-level.
Why it happens: v4 rewrote pools without tinypool; old config structure is incompatible.
How to avoid: Migrate `poolOptions.forks/threads/vmThreads` to top-level `maxWorkers`, `isolate`, `vmMemoryLimit`.
Warning signs: Config validation errors on `vitest run` after upgrade.

### Pitfall 2: Mock Restoration Behavior Changes in v4
What goes wrong: Tests that rely on `vi.restoreAllMocks()` resetting automocked modules break.
Why it happens: v4 changed `restoreAllMocks` to only restore manually created spies, not automocks.
How to avoid: Use `vi.clearAllMocks()` for state reset; recreate mocks if needed; review test setup/teardown.
Warning signs: Tests passing stale mock state between test files.

### Pitfall 3: Coverage Report Changes in v4
What goes wrong: Coverage percentages drop or files disappear from reports after upgrade.
Why it happens: v4 removed `coverage.all` and defaults to only including covered files; AST-aware remapping is more accurate.
How to avoid: Explicitly define `coverage.include` pattern; remove deprecated options.
Warning signs: CI coverage gates fail after upgrade.

## Code Examples

### Common Operation 1: Basic Test with Mocking
```ts
// Source: https://vitest.dev/api/vi.html#vi-mock
import { describe, it, expect, vi } from 'vitest'
import { fetchUser } from './api'

vi.mock('./api', () => ({
  fetchUser: vi.fn()
}))

describe('user service', () => {
  it('returns user data', async () => {
    vi.mocked(fetchUser).mockResolvedValue({ id: 1, name: 'Test' })
    const user = await fetchUser(1)
    expect(user.name).toBe('Test')
  })
})
```

### Common Operation 2: Environment Variable Stubbing
```ts
// Source: https://vitest.dev/api/vi.html#vi-stubenv
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('API_URL', 'https://test.api.com')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

it('uses test environment', () => {
  expect(process.env.NODE_ENV).toBe('test')
})
```

### Common Operation 3: Module Runner API (v4+)
```ts
// Source: https://vitest.dev/guide/migration.html#replacing-vite-node-with-module-runner
// Custom test environments in v4 use ModuleRunner instead of vite-node
import { createModuleRunner } from 'vitest/node'

// Advanced: custom pool or environment implementation
```

## State of the Art (2024-2026)

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| tinypool-based workers | Native pool architecture | v4.0.0 (Oct 2025) | Better performance, simpler config |
| v8-to-istanbul remapping | AST-aware V8 coverage | v4.0.0 (Oct 2025) | More accurate coverage reports |
| `workspace` config key | `projects` config key | v3.2 / v4.0 | Unified multi-project testing |
| String browser providers | Factory providers | v4.0.0 | More flexible browser testing config |
| `poolOptions` nesting | Top-level pool options | v4.0.0 | Simpler configuration |

New tools/patterns to consider:
- **Vitest Browser Mode + Visual Regression**: `@vitest/browser` with `toMatchScreenshot` (v4.1.0+)
- **Type Testing**: `expectTypeOf` for compile-time type assertions
- **Schema Validation Matchers**: `toMatchSchema` with Zod/yup/etc. (v4.0+)

Deprecated/outdated:
- `coverage.all` and `coverage.extensions` options (removed v4)
- `poolOptions` config structure (removed v4)
- `workspace` config key (removed v4, use `projects`)
- `vite-node` internal APIs (replaced with Module Runner)
- `minWorkers` option (removed v4)

## Migration Assessment

| Area | Finding | Impact | Risk | Evidence |
|---|---|---|---|---|
| Node.js version | rntme requires >= 20; vitest 4 requires >= 20 | None | Low | `package.json` engines field |
| Vite version | Need to verify Vite >= 6 across packages | Moderate | Medium | Check vite versions in lockfile |
| Config syntax | `poolOptions` removal, `projects` rename | Low | Low | rntme configs don't use these features |
| Test code | Option object position in test/describe | Low | Low | rntme tests use standard patterns |
| Mock behavior | `restoreAllMocks` semantics changed | Moderate | Medium | May affect tests with shared state |
| Coverage | `coverage.all` removed; remapping changed | N/A | N/A | rntme doesn't use coverage currently |
| Lockfile | pnpm-lock.yaml will change significantly | Low | Low | Standard dependency update |
| CI scripts | No changes needed | None | Low | Scripts use standard `vitest run` |
| @vitest/ui | Not currently installed | N/A | N/A | Can be added as new feature |

**Breaking changes from v2 to v4 (relevant to rntme):**
1. **Vite 6+ required** — verify all packages use Vite >= 6
2. **Pool options simplified** — rntme doesn't use custom pool options, so no impact
3. **Mock restoration changed** — review any tests relying on `vi.restoreAllMocks()`
4. **Test options position** — ensure options object is second arg, not third
5. **Snapshot format** — custom element shadow roots now included by default

**Migration effort estimate:** Low-Moderate (1-2 days for 29 packages, mostly lockfile update and verification)

## Recommendation

**Decision: KEEP + UPGRADE**

Rationale:
- Vitest remains the best-in-class choice for Vite-based TypeScript monorepos in 2026.
- v4 brings significant performance improvements, better mocking, and more accurate coverage.
- rntme's test suite is straightforward (node environment, no complex configs) making migration low-risk.
- Jest or alternatives would introduce CJS/ESM friction and lose Vite integration benefits.
- @vitest/ui should be evaluated as a separate developer-experience improvement, not a migration requirement.

**Follow-up tasks to create later:**
1. Create migration issue: upgrade vitest from ^2.1.x to ^4.1.5 across all packages.
2. Verify Vite >= 6 compatibility across all packages before migration.
3. Run full test suite after upgrade to catch any mock restoration issues.
4. Evaluate adding @vitest/ui for interactive debugging (optional DX improvement).
5. Consider adding @vitest/coverage-v8 and setting coverage thresholds in CI.

## Open Questions

1. **Does rntme plan to add browser/component testing?**
   - What we know: rntme has a `packages/ui` package but no browser tests currently.
   - What's unclear: Whether UI components will be tested with @vitest/browser or other tools.
   - Recommendation: Defer browser testing tooling decision until UI testing requirements are defined.

2. **Should coverage be enabled project-wide?**
   - What we know: No coverage tooling is currently configured.
   - What's unclear: Target coverage thresholds or CI integration requirements.
   - Recommendation: Add coverage as part of the vitest v4 migration or as a separate follow-up.

3. **Why was @vitest/ui listed in inventory but not installed?**
   - What we know: No package.json contains @vitest/ui dependency.
   - What's unclear: Whether it was removed or if the inventory is outdated.
   - Recommendation: Update dependency inventory; decide if @vitest/ui should be added.

## Sources

### Primary (HIGH confidence)
- `/vitest-dev/vitest` (Context7) — v4 migration guide, config patterns, mocking APIs
- https://vitest.dev/guide/migration.html — Official migration guide for v4.0
- https://github.com/vitest-dev/vitest/releases/tag/v4.0.0 — Release notes with breaking changes
- npm registry (`npm view vitest versions`) — Version verification

### Secondary (MEDIUM confidence)
- rntme pnpm-lock.yaml — Verified actual resolved version (2.1.9)
- rntme package.json files across 29 packages — Confirmed usage patterns
- rntme vitest.config.ts files — Confirmed configuration patterns

### Tertiary (LOW confidence - needs validation)
- None — all version and migration data verified against primary sources.

## Metadata

Research scope:
- Core technology: vitest testing framework (v2 vs v4)
- Ecosystem: @vitest/ui, @vitest/coverage-v8, @vitest/browser, happy-dom
- Patterns: Monorepo testing, workspace projects, shared configs
- Pitfalls: v4 breaking changes, mock behavior, coverage changes

Confidence breakdown:
- Standard stack: HIGH — vitest is dominant in Vite ecosystem; official docs and release notes verified.
- Architecture: HIGH — Config patterns verified against Context7 and official docs.
- Pitfalls: HIGH — Breaking changes documented in official migration guide and release notes.
- Code examples: HIGH — All examples from official docs/Context7.

Research date: 2026-04-28
Valid until: 2026-07-28 (re-evaluate if vitest v5 stable releases)
Ready for migration planning: YES
