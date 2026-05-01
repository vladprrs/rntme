# Architecture audit — `@rntme/module-skeleton`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-206` (`7c6a99ea-6796-4b10-9922-89ac9e949c4d`) |
| **Issue title** | Audit: package architecture — @rntme/module-skeleton |
| **Package / scope** | `@rntme/module-skeleton` |
| **Verdict (summary)** | needs cleanup — architectural risk: low, but several gaps block it from being a production-ready module template. |
| **Audit comment id** | `fcbdfab7-deaf-4f3a-93a6-1f8c8596f87b` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: @rntme/module-skeleton

**Verdict:** needs cleanup — architectural risk: low, but several gaps block it from being a production-ready module template.

---

### Blocker

_None found._

---

### High

1. **`ModuleManifest` type is a stub that does not reflect the module contract (spec §12)**
   - **Evidence:** `src/manifest-shape.ts:7-10` — only `name`, `version`, `description?`.
   - **Impact:** Every module copy will need to redefine the manifest shape. Drift between copies is guaranteed.
   - **Recommendation:** Expand `ModuleManifest` to cover spec §12 required fields (`grpcServiceName`, `webhookPath`, `secrets`, `capabilities[]`, `contact`) and add a runtime validator (Zod) so that booting a module with an invalid manifest fails fast. If this is intentionally deferred, add a `TODO(#plan-ref)` comment in the source.

---

### Medium

2. **`VERSION` constant is not wired to `package.json#version`**
   - **Evidence:** `src/index.ts:1` hard-codes `'0.0.0'`; `package.json:3` also says `0.0.0`.
   - **Impact:** When a copied module bumps its package version, the runtime-exported `VERSION` will silently lie. This breaks observability and health-check contracts.
   - **Recommendation:** Either generate `src/version.ts` at build time (e.g. `genversion` or a pnpm prebuild script) or read `package.json` at runtime. For a template, a prebuild script is the least surprising.

3. **`exampleHandlers.echo` ignores input — poor teaching signal**
   - **Evidence:** `src/handlers.ts:4` — `_input` is unused; the handler always returns the same aggregateId.
   - **Impact:** New developers copy the pattern and may not realise the second argument carries the binding payload.
   - **Recommendation:** Make `echo` echo something from `input` (e.g. `aggregateId: input.message ?? 'echo'`) so the parameter is visibly used.

4. **`tsconfig.check.json` does not include `test/public-contract`**
   - **Evidence:** `tsconfig.check.json:10` — `"include": ["src/**/*.ts", "test/unit/**/*.test.ts"]`.
   - **Impact:** Contract tests (`test/public-contract/_smoke.test.ts`) are not type-checked by `pnpm typecheck`. Type errors there will only surface at test-run time.
   - **Recommendation:** Add `"test/public-contract/**/*.test.ts"` to the include array, or create a separate `tsconfig.contract.check.json`.

---

### Low

5. **`mkCtx()` stub duplicated in 3 test files**
   - **Evidence:** `test/unit/handlers.test.ts:6-15`, `test/unit/boot-skeleton.test.ts:7-16`, `test/public-contract/_smoke.test.ts` uses inline stub.
   - **Impact:** Maintenance noise; changing `CommandExecutionContext` shape requires 3 edits.
   - **Recommendation:** Extract to `test/helpers/ctx.ts` and import. This also demonstrates to module authors how to build test stubs.

6. **`test` script always runs `pnpm build` first**
   - **Evidence:** `package.json:21` — `"test": "pnpm build && vitest run --config vitest.contract.config.ts && vitest run"`.
   - **Impact:** Unit-test feedback loop is slow; every `test` invocation compiles the whole package even when only tests changed.
   - **Recommendation:** Split into `test:contract` (requires build) and `test:unit` (does not). Keep `test` as the union for CI. Most workspace packages already follow this pattern.

7. **No `integration/` or `e2e/` test directories**
   - **Evidence:** Only `test/unit/` and `test/public-contract/` exist.
   - **Impact:** For a template, this is acceptable, but real modules (plan 5) will need integration tests against mocked vendor SDKs.
   - **Recommendation:** Add `test/integration/` with a `README.md` placeholder explaining what goes there (vendor SDK stub + event-store assertions).

8. **Missing `.gitignore` for `dist/` in copied modules**
   - **Evidence:** No `.gitignore` file in the package.
   - **Impact:** When copied, `dist/` may be accidentally committed.
   - **Recommendation:** Add a `.gitignore` file containing `dist/` and `node_modules/`.

---

### Quick wins (can be done in a single PR)

- Fix #3 (echo handler uses input).
- Fix #5 (extract `mkCtx()` helper).
- Fix #6 (split test scripts).
- Fix #8 (add `.gitignore`).

### Changes requiring product/architectural decision

- Fix #1 (`ModuleManifest` expansion) — needs alignment with the current state of spec §12 and plan 2 (gRPC surface) / plan 5 (reference Stripe module). Recommend waiting until plan 5 lands so the manifest shape is validated by a real module.
- Fix #2 (VERSION wiring) — needs a workspace-wide decision on whether packages auto-generate version files or read package.json at runtime.

---

### Evidence commands

```bash
# Verify stub manifest shape
grep -A5 'export type ModuleManifest' packages/tooling/module-skeleton/src/manifest-shape.ts

# Verify VERSION hard-coding
grep "VERSION" packages/tooling/module-skeleton/src/index.ts

# Verify tsconfig.check.json excludes contract tests
cat packages/tooling/module-skeleton/tsconfig.check.json | jq '.include'

# Verify duplicated mkCtx
grep -n 'function mkCtx' packages/tooling/module-skeleton/test/**/*.test.ts
```

---

### Product fit assessment

The package correctly implements its intended role as a **scaffold/template** for plan 1 (`01-code-executor-seam.md`). It demonstrates `CodeCommandHandlerMap`, wires through `CodeCommandExecutor`, and has a smoke test that would catch breaking changes in the runtime executor contract.

The main gap is that it is still a **plan 1 artifact** in a world where plans 2–5 have been at least partially implemented (`bindings-grpc`, `pre[]` middleware, extended command binding). The README acknowledges this honestly, but the **source code has not been updated** to reflect the newer primitives. Once plan 5 (reference Stripe module) lands, `module-skeleton` should be refreshed to include:
- A minimal `module.json` manifest with the full shape.
- A stub `start-module.ts` that bootstraps an `HttpSurface` + `GrpcSurface`.
- A stub webhook handler file.
- A reference to the `pre[]` seam (even if modules don't use it, authors need to know it exists).

Until then, the package is **fit for purpose but aging**.
