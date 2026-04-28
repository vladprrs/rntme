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


Аудит \`@rntme/blueprint\` завершён. Результат: **needs cleanup** (несколько medium/high рисков, dead code, неполные stub-ы). Файлы не менялись.

## 1. Verdict

**needs cleanup**

Пакет реализует спецификацию \`2026-04-23-project-first-blueprint-design.md\` (Track A + Track B) корректно на уровне сценариев, но содержит архитектурный debt: неполную валидацию, dead code, широкую зависимость от 5 downstream-пакетов без чётких seam-ов, и stub-резолверы в UI-компиляции, которые обесценивают валидацию.

## 2. Проблемы по severity

### HIGH

**H1. Malformed \`service.json\` молча игнорируется при загрузке**
- Evidence: \`src/load/load-blueprint.ts:87-92\`
- Impact: если \`service.json\` существует, но не парсится \`ServiceDescriptorSchema\`, цикл делает \`continue\` без ошибки. Валидатор \`validateBlueprintStructural\` на line 42 увидит \`services[slug] === undefined\` и выдаст \`BLUEPRINT_STRUCT_SERVICE_JSON_MISSING\` — misleading error (файл есть, но он malformed).
- Fix: если \`service.json\` существует, но \`safeParse\` failed, нужно возвращать отдельный error code, например \`BLUEPRINT_STRUCT_SERVICE_JSON_MALFORMED\`, с cause из Zod issues.

**H2. Хардкод scalar-реестра в \`binding-resolvers.ts\`**
- Evidence: \`src/compose/binding-resolvers.ts:20-27\`
- Impact: \`SCALARS\` дублирует canonical scalar registry из \`@rntme/pdm\`. Если PDM добавит новый scalar (например, \`json\`, \`uuid\`), blueprint сломается, потому что binding resolver его не признает.
- Fix: импортировать \`ScalarPrimitive\` union или canonical scalar set из \`@rntme/pdm\`, а не дублировать строковой литерал.

**H3. Stub-резолверы в \`compileServiceUi\` обходят половину валидации UI**
- Evidence: \`src/compose/compile-service-ui.ts:39-40\`
- Impact: \`resolveComponent: () => ({ childrenModel: 'list' })\` и \`resolveRoute: () => true\` означают, что UI-валидатор никогда не отклонит неизвестный компонент или невалидный роут. Это противоречит цели blueprint — быть «rigorous enough that an agent cannot silently produce a broken service».
- Fix: требуется продуктовое решение — либо реальный component registry, либо явный список known components, либо отдельный validation pass после того, как UI package научится принимать component catalog.

### MEDIUM

**M1. \`ValidatedBlueprint\` — dead code (branded type без конструктора)**
- Evidence: \`src/types/artifact.ts:44-48\`, \`src/index.ts:35\`
- Impact: Тип экспортирован, но нигде не конструируется и не проверяется. Это нарушает соглашение рабочего пространства: «Branded \`Validated*\` types... Constructible only by running the validator». Сейчас любой потребитель может кастануть \`LoadedBlueprint as ValidatedBlueprint\`.
- Fix: либо удалить (YAGNI), либо добавить функцию \`validateBlueprint(...): Result<ValidatedBlueprint>\`, которая единственная может создать этот brand.

**M2. \`parseProjectBlueprint\` использует \`as ProjectBlueprint\` после Zod parse**
- Evidence: \`src/parse/parse.ts:26\`
- Impact: Zod \`safeParse\` возвращает \`unknown\`, а далее \`as ProjectBlueprint\` — это не type-safe. В codebase принят pattern: Zod parse → branded type, без \`as\`.
- Fix: убрать \`as ProjectBlueprint\`; Zod schema уже типизирована через \`.infer\`, достаточно \`return ok(parsed.data)\`.

**M3. Opportunistic seed loading нарушает декларативность**
- Evidence: \`src/compose/load-service-member.ts:117\`
- Impact: \`if (input.service.artifacts.hasSeed || existsSync(...))\` означает, что seed загрузится даже если \`discoverServiceArtifacts\` вернул \`hasSeed: false\` (например, файл появился после discovery, или discovery был вызван с другим cwd). Это делает behavior недетерминированным относительно artifact presence.
- Fix: либо полагаться только на \`hasSeed\` (declarative), либо явно документировать, что filesystem — source of truth, и \`hasSeed\` — лишь hint.

**M4. \`GraphJson.nodes: unknown[]\` — отсутствие структурной типизации**
- Evidence: \`src/types/artifact.ts:77\`
- Impact: Nodes — core часть Graph IR rc7, но типизированы как \`unknown[]\`. Это означает, что blueprint не валидирует граф на уровне TypeScript и пропускает любые malformed nodes. Graph-ir-compiler потом может упасть с непонятной ошибкой.
- Fix: добавить \`GraphNode\` union type (или импортировать из \`@rntme/graph-ir-compiler\` / \`@rntme/bindings\`), либо хотя бы runtime validation в \`readServiceGraphSpec\`.

**M5. \`validate/index.ts\` экспортирует только \`structural\`, а не оба валидатора**
- Evidence: \`src/validate/index.ts:1\`
- Impact: Публичный API package (\`src/index.ts\`) экспортирует \`validateBlueprintComposition\` напрямую из \`./validate/composition.js\`, обходя \`validate/index.ts\`. Это inconsistent — barrel file для валидации не используется.
- Fix: добавить \`export { validateBlueprintComposition } from './composition.js';\` в \`validate/index.ts\`, и в \`index.ts\` импортировать из \`validate/index.ts\`.

**M6. Недостаточное покрытие критичных edge cases в тестах**
- Evidence: 33 теста, 0 тестов на: (a) отсутствие \`project.json\`, (b) отсутствие \`pdm/\`, (c) malformed \`service.json\`, (d) QSM load failure в \`loadBlueprint\`, (e) empty \`services\` array.
- Impact: Нет уверенности, что error messages и error codes корректны для failure paths.
- Fix: добавить unit-тесты на каждый \`return err([...])\` в \`load-blueprint.ts\` и \`load-service-member.ts\`.

### LOW

**L1. \`Layer\` type не покрывает все используемые error codes**
- Evidence: \`src/types/result.ts:1\` defines \`Layer = 'load' | 'parse' | 'structural' | 'composition' | 'service'\`, но \`ERROR_CODES\` содержит \`BLUEPRINT_SERVICE_*\` codes, которые map-ятся на layer \`'service'\`.
- Impact: Логически несоответствие между типом и кодами — не blocker, но source of confusion.

**L2. \`ServiceDescriptorSchema\` не валидирует \`slug\`**
- Evidence: \`src/parse/schema.ts:6-10\`
- Impact: Schema валидирует только \`kind\`, хотя тип \`ServiceDescriptor\` требует \`slug\`. Это inconsistent — schema и type diverge.

**L3. Нет версионирования \`ServiceGraphSpec\` в runtime**
- Evidence: \`src/compose/service-graphs.ts:114\` hardcodes \`version: '1.0-rc7'\`, но нет проверки входящего version из JSON.
- Impact: Если shapes.json/graphs.json когда-либо получат поле \`version\`, blueprint его проигнорирует.

## 3. Quick wins (можно сделать без решения Влада)

1. **QW1.** Исправить \`load-blueprint.ts:87-92\` — возвращать отдельный error code для malformed \`service.json\`.
2. **QW2.** Экспортировать \`validateBlueprintComposition\` из \`validate/index.ts\`.
3. **QW3.** Убрать \`as ProjectBlueprint\` в \`parse.ts\`.
4. **QW4.** Добавить unit-тесты на missing \`project.json\`, missing \`pdm/\`, malformed \`service.json\`.
5. **QW5.** Добавить TODO-комментарий к stub-резолверам в \`compile-service-ui.ts\` с ссылкой на follow-up issue.
6. **QW6.** Удалить \`ValidatedBlueprint\` brand, если нет планов его использовать в ближайшем спринте, либо добавить конструктор.

## 4. Изменения, требующие продуктового/архитектурного решения Влада

1. **D1.** Что делать с \`resolveComponent\` / \`resolveRoute\` в UI-компиляции? Сейчас это заглушки, и UI-валидатор пропускает broken UI. Нужен ли отдельный component registry в blueprint? Или UI package должен принимать catalog извне?

2. **D2.** Seed loading: declarative (\`hasSeed\`) vs filesystem-driven (\`existsSync\`)? Это влияет на deterministic behavior при кешировании/CI.

3. **D3.** Нужен ли \`ValidatedBlueprint\` brand? Если да — кто его конструирует и где используется? Если нет — удалить, чтобы не путать downstream consumers.

4. **D4.** Blueprint сейчас orchestrates 5 downstream packages (pdm, qsm, bindings, seed, ui). Это by design, но создаёт broad dependency surface. Нужен ли internal «project loader» seam, чтобы тестировать blueprint без реальных downstream валидаторов? (Например, для CI скорости.)

## 5. Соответствие vision и specs

- Спецификация \`2026-04-23-project-first-blueprint-design.md\` реализована полностью для Track A и Track B.
- Track C (project runtime) explicitly deferred — в blueprint это отражено корректно.
- Нет отклонений от vision.md: blueprint остаётся «project-first parser/validator», не вторгается в runtime.

## 6. Test / build / lint

- \`pnpm test\`: 11 files, 33 tests — all pass.
- \`pnpm typecheck\`: clean.
- \`pnpm lint\`: clean.
- Coverage tool не установлен (\`@vitest/coverage-v8\` отсутствует). Рекомендуется добавить для objective coverage gates.
- Нет integration/e2e тестов — только unit + smoke. Для orchestrator package с 5 downstream deps это риск.

## 7. Рекомендация

Пакет функционален и соответствует spec, но перед тем как строить на нём downstream consumers (runtime intake, CLI, deploy pipeline), нужно закрыть H1–H3 и M1–M3. Это 2–3 дня работы. Остальное — backlog.
