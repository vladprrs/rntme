# Architecture audit — `@rntme/blueprint`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-202` (`c2bc0b34-666a-46bf-92c7-e106259c0e6c`) |
| **Issue title** | Audit: package architecture — @rntme/blueprint |
| **Package / scope** | `@rntme/blueprint` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `3b959fe1-e6dc-427a-868a-aa741aac8325` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


The \`@rntme/blueprint\` audit has been completed. Result: **needs cleanup** (several medium/high risks, dead code, incomplete stubs). The files have not changed.

## 1. Verdict

**needs cleanup**

The package implements the specification \`2026-04-23-project-first-blueprint-design.md\` (Track A + Track B) correctly at the script level, but contains architectural debt: incomplete validation, dead code, wide dependence on 5 downstream packages without clear seams, and stub resolvers in UI compilation that devalue validation.

## 2. Problems by severity

### HIGH

**H1. Malformed \`service.json\` is silently ignored when loading**
- Evidence: \`src/load/load-blueprint.ts:87-92\`
- Impact: If \`service.json\` exists but \`ServiceDescriptorSchema\` is not parsed, the loop does \`continue\` without error. The \`validateBlueprintStructural\` validator on line 42 will see \`services[slug] === undefined\` and issue \`BLUEPRINT_STRUCT_SERVICE_JSON_MISSING\` - misleading error (the file exists, but it is malformed).
- Fix: if \`service.json\` exists, but \`safeParse\` failed, you need to return a separate error code, for example \`BLUEPRINT_STRUCT_SERVICE_JSON_MALFORMED\`, with cause from Zod issues.

**H2. Hardcode of the scalar registry in \`binding-resolvers.ts\`**
- Evidence: \`src/compose/binding-resolvers.ts:20-27\`
- Impact: \`SCALARS\` duplicates canonical scalar registry from \`@rntme/pdm\`. If PDM adds a new scalar (eg \`json\`, \`uuid\`), blueprint will break because the binding resolver doesn't recognize it.
- Fix: import \`ScalarPrimitive\` union or canonical scalar set from \`@rntme/pdm\` rather than duplicating the string literal.

**H3. Stub resolvers in \`compileServiceUi\` bypass half of UI validation**
- Evidence: \`src/compose/compile-service-ui.ts:39-40\`
- Impact: \`resolveComponent: () => ({ childrenModel: 'list' })\` and \`resolveRoute: () => true\` means that the UI validator will never reject an unknown component or an invalid route. This defeats the purpose of blueprint - to be “rigorous enough that an agent cannot silently produce a broken service”.
- Fix: a product solution is required - either a real component registry, or an explicit list of known components, or a separate validation pass after the UI package learns to accept the component catalog.

### MEDIUM

**M1. \`ValidatedBlueprint\` — dead code (branded type without constructor)**
- Evidence: \`src/types/artifact.ts:44-48\`, \`src/index.ts:35\`
- Impact: The type is exported, but is not constructed or checked anywhere. This violates the workspace convention: "Branded \`Validated*\` types... Constructible only by running the validator." Now any consumer can cast \`LoadedBlueprint as ValidatedBlueprint\`.
- Fix: either remove (YAGNI) or add the function \`validateBlueprint(...): Result<ValidatedBlueprint>\`, which is the only one that can create this brand.

**M2. \`parseProjectBlueprint\` uses \`as ProjectBlueprint\` after Zod parse**
- Evidence: \`src/parse/parse.ts:26\`
- Impact: Zod \`safeParse\` returns \`unknown\`, and then \`as ProjectBlueprint\` is not type-safe. The codebase adopted pattern: Zod parse → branded type, without \`as\`.
- Fix: remove \`as ProjectBlueprint\`; Zod schema is already typed via \`.infer\`, just \`return ok(parsed.data)\` is enough.

**M3. Opportunistic seed loading violates declarativeness**
- Evidence: \`src/compose/load-service-member.ts:117\`
- Impact: \`if (input.service.artifacts.hasSeed || existsSync(...))\` means that the seed will be loaded even if \`discoverServiceArtifacts\` returned \`hasSeed: false\` (for example, the file appeared after discovery, or discovery was called with a different cwd). This makes the behavior non-deterministic with respect to artifact presence.
- Fix: either rely only on \`hasSeed\` (declarative), or explicitly document that the filesystem is the source of truth, and \`hasSeed\` is just a hint.

**M4. \`GraphJson.nodes: unknown[]\` - lack of structural typing**
- Evidence: \`src/types/artifact.ts:77\`
- Impact: Nodes are the core part of Graph IR rc7, but are typed as \`unknown[]\`. This means that blueprint does not validate the graph at the TypeScript level and skips any malformed nodes. Graph-ir-compiler may then crash with an incomprehensible error.
- Fix: add \`GraphNode\` union type (or import from \`@rntme/graph-ir-compiler\` / \`@rntme/bindings\`), or at least runtime validation to \`readServiceGraphSpec\`.

**M5. \`validate/index.ts\` only exports \`structural\`, not both validators**
- Evidence: \`src/validate/index.ts:1\`
- Impact: Public API package (\`src/index.ts\`) exports \`validateBlueprintComposition\` directly from \`./validate/composition.js\`, bypassing \`validate/index.ts\`. This is inconsistent - the barrel file is not used for validation.
- Fix: add \`export { validateBlueprintComposition } from './composition.js';\` to \`validate/index.ts\`, and to \`index.ts\` import from \`validate/index.ts\`.

**M6. Insufficient coverage of critical edge cases in tests**
- Evidence: 33 tests, 0 tests for: (a) missing \`project.json\`, (b) missing \`pdm/\`, (c) malformed \`service.json\`, (d) QSM load failure in \`loadBlueprint\`, (e) empty \`services\` array.
- Impact: It is not certain that error messages and error codes are correct for failure paths.
- Fix: add unit tests for each \`return err([...])\` to \`load-blueprint.ts\` and \`load-service-member.ts\`.

### LOW

**L1. \`Layer\` type does not cover all used error codes**
- Evidence: \`src/types/result.ts:1\` defines \`Layer = 'load' | 'parse' | 'structural' | 'composition' | 'service'\`, but \`ERROR_CODES\` contains \`BLUEPRINT_SERVICE_*\` codes, which are mapped to layer \`'service'\`.
- Impact: Logically, the inconsistency between the type and the codes is not a blocker, but a source of confusion.

**L2. \`ServiceDescriptorSchema\` does not validate \`slug\`**
- Evidence: \`src/parse/schema.ts:6-10\`
- Impact: Schema only validates \`kind\`, although the \`ServiceDescriptor\` type requires \`slug\`. This is inconsistent - schema and type diverge.

**L3. No versioning of \`ServiceGraphSpec\` at runtime**
- Evidence: \`src/compose/service-graphs.ts:114\` hardcodes \`version: '1.0-rc7'\`, but there is no check of the incoming version from JSON.
- Impact: If shapes.json/graphs.json ever gets a \`version\` field, blueprint will ignore it.

## 3. Quick wins (can be done without Vlad's solution)

1. **QW1.** Fix \`load-blueprint.ts:87-92\` - return a separate error code for malformed \`service.json\`.
2. **QW2.** Export \`validateBlueprintComposition\` from \`validate/index.ts\`.
3. **QW3.** Remove \`as ProjectBlueprint\` from \`parse.ts\`.
4. **QW4.** Add unit tests for missing \`project.json\`, missing \`pdm/\`, malformed \`service.json\`.
5. **QW5.** Add a TODO comment to stub resolvers in \`compile-service-ui.ts\` with a link to the follow-up issue.
6. **QW6.** Remove the \`ValidatedBlueprint\` brand if there are no plans to use it in the next sprint, or add a constructor.

## 4. Changes requiring Vlad’s product/architectural solution

1. **D1.** What to do with \`resolveComponent\` / \`resolveRoute\` in UI compilation? Now these are stubs, and the UI validator passes broken UI. Is a separate component registry needed in blueprint? Or should the UI package accept catalog from the outside?

2. **D2.** Seed loading: declarative (\`hasSeed\`) vs filesystem-driven (\`existsSync\`)? This affects deterministic behavior when caching/CI.

3. **D3.** Is a \`ValidatedBlueprint\` brand required? If so, who designs it and where is it used? If not, delete it so as not to confuse downstream consumers.

4. **D4.** Blueprint now orchestrates 5 downstream packages (pdm, qsm, bindings, seed, ui). This is by design, but creates a broad dependency surface. Is an internal “project loader” seam needed to test blueprint without real downstream validators? (For example, for CI speed.)

## 5. Compliance with vision and specs

- Specification \`2026-04-23-project-first-blueprint-design.md\` has been fully implemented for Track A and Track B.
- Track C (project runtime) explicitly deferred - this is reflected correctly in the blueprint.
- No deviations from vision.md: blueprint remains “project-first parser/validator”, does not interfere with runtime.

## 6. Test / build / lint

- \`pnpm test\`: 11 files, 33 tests — all pass.
- \`pnpm typecheck\`: clean.
- \`pnpm lint\`: clean.
- Coverage tool is not installed (\`@vitest/coverage-v8\` is missing). It is recommended to add objective coverage gates.
- No integration/e2e tests - only unit + smoke. For an orchestrator package with 5 downstream deps this is a risk.

## 7. Recommendation

The package is functional and complies with the spec, but before building downstream consumers (runtime intake, CLI, deploy pipeline) on it, you need to close H1–H3 and M1–M3. This is 2–3 days of work. The rest is backlog.
