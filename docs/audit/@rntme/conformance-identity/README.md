# Architecture audit — `@rntme/conformance-identity`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-220` (`9af5a326-37f2-466d-b062-f0658e5d48e1`) |
| **Issue title** | Audit: package architecture — @rntme/conformance-identity |
| **Package / scope** | `@rntme/conformance-identity` |
| **Verdict (summary)** | architectural risk |
| **Audit comment id** | `bc059423-818b-4cc5-a198-1acfe859e57a` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Архитектурный аудит: @rntme/conformance-identity

**Verdict: architectural risk** — пакет structurally sound, но обнаружен критический рассогласованный типовой контракт между тремя conformance-пакетами, который заблокирует интеграцию с `@rntme/conformance-framework`.

---

### 1. BLOCKER: Типовой контракт conformance-пакетов различается

**Evidence:**
- `modules/identity/conformance/src/types.ts:34-37` — `contractVersion: 'v1'` (camelCase), `scenariosByRpc: Readonly<Record<string, ReadonlyArray<Scenario>>>`
- `modules/crm/conformance/src/types.ts:59-62` — `contract_version: 'v1'` (snake_case), `scenarios: Record<string, Scenario[]>`
- `modules/ai-llm/conformance/src/types.ts:34-37` — совпадает с identity

**Impact:** Когда `@rntme/conformance-framework` опубликует единый `CategoryConformanceSuite`, CRM-пакет не сможет импортировать shared types без ломающего изменения. Три пакета претендуют на совместимость с одним фреймворком, но реализуют несовместимые контракты.

**Recommendation:**
1. Выбрать canonical shape (identity/ai-llm выглядят правильнее: camelCase + `scenariosByRpc` + `Readonly`)
2. Мигрировать CRM в том же PR, где лендится фреймворк, или создать отдельный sync-issue
3. Зафиксировать canonical shape в `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` §7.1 явно, с типовой сигнатурой TypeScript

---

### 2. HIGH: Отсутствует fixtures-sanity.test.ts

**Evidence:**
- CRM: `modules/crm/conformance/test/fixtures-sanity.test.ts` (проверяет JSON/webhook fixtures)
- AI-LLM: `modules/ai-llm/conformance/test/fixtures-sanity.test.ts` (проверяет бинарные fixtures на magic bytes + size ≤100KB)
- Identity: директория `test/` содержит только `drift.test.ts` и `suite-shape.test.ts`

**Impact:** Фикстуры (User, Organization, Invitation) создаются через `proto.rntme.contracts.identity.v1.*.create()`, но нет теста, который ловит runtime protobuf validation errors (например, missing required fields или type mismatches при обновлении контракта).

**Recommendation:** Добавить `test/fixtures-sanity.test.ts` с проверками:
- Каждый fixture из `fixtures/users.ts`, `fixtures/organizations.ts`, `fixtures/invitations.ts` проходит `User.verify()`, `Organization.verify()`, `Invitation.verify()`
- Все `CanonicalRef` внутри fixtures имеют заполненные `canonical_id`, `vendor_id`, `module_name`, `contract_version`

---

### 3. HIGH: Отсутствуют Session-фикстуры

**Evidence:**
- `packages/contracts/identity/v1/proto/identity.proto` определяет `message Session` + RPC `GetSession`, `ListSessions`, `RevokeSession`, `IntrospectSession`
- `modules/identity/conformance/src/fixtures/` содержит только `users.ts`, `organizations.ts`, `invitations.ts`
- Нет `fixtures/sessions.ts`

**Impact:** Когда начнётся наполнение сценариев для Session-RPC, разработчик будет вынужден создавать фикстуры ad-hoc вместо использования shared canonical seeds. Это нарушает invariant «vendor-agnostic scenarios reference canonical fixtures only» (README §Invariants).

**Recommendation:** Добавить `src/fixtures/sessions.ts` с 2-3 canonical Session objects (active, expired, revoked) в том же стиле, что `fixtureUsers`.

---

### 4. MEDIUM: Неконсистентное именование экспорта suite

**Evidence:**
- Identity: `export { identityConformanceSuite }` (`src/index.ts:1`)
- AI-LLM: `export { aiLlmConformanceSuite }` (`src/index.ts:1`)
- CRM: `export { suite }` (`src/index.ts:1`) — generic name

**Impact:** Потребители (vendor modules) используют разные naming conventions: `import { suite }` для CRM vs `import { identityConformanceSuite }` для Identity. Это создаёт ненужный cognitive load и усложняет шаблонизацию в документации.

**Recommendation:** Переименовать CRM export в `crmConformanceSuite` для единообразия. Это non-breaking для внутренних модулей, т.к. vendor modules ещё не существуют.

---

### 5. MEDIUM: README не содержит секции "Out of scope"

**Evidence:**
- AI-LLM README (`modules/ai-llm/conformance/README.md:66-68`) явно декларирует: «Actual scenario implementations, live-vendor mode, and the framework runner itself — separate packages and plans.»
- Identity README не имеет эквивалентной секции.

**Impact:** Новый разработчик/agent может не понять границу между scaffolding и реализацией, что приведёт к scope creep при PR.

**Recommendation:** Добавить секцию «Out of scope» в Identity README, mirroring AI-LLM.

---

### 6. LOW: Отсутствует registry файл capabilities.ts

**Evidence:**
- AI-LLM: `src/capabilities.ts` экспортирует `AI_LLM_CANONICAL_RPCS`, `AI_LLM_CANONICAL_EVENTS`, `AI_LLM_CAPABILITY_FIELDS` и т.д.
- Identity: нет аналогичного registry-файла. RPC-список получается только через `Object.keys(identityConformanceSuite.scenariosByRpc)` или рефлексию `IdentityModule.prototype`.

**Impact:** Vendor modules и blueprint validator не имеют typed source-of-truth для списка canonical RPCs/events без runtime reflection.

**Recommendation:** Добавить `src/capabilities.ts` с:
- `IDENTITY_CANONICAL_RPCS: readonly string[]` (24 entries)
- `IDENTITY_CANONICAL_EVENTS: readonly string[]` (17 events из `identity-events.proto`)
- Optional: `IDENTITY_ERROR_CODE_LAYERS`, `IDENTITY_ENTITY_TYPES`

---

### 7. LOW: Нет тестового покрытия error codes и events

**Evidence:**
- `test/drift.test.ts` проверяет только RPC ↔ file ↔ suite mapping (3 теста)
- `test/suite-shape.test.ts` проверяет category, version, array length (3 теста)
- 6 тестов суммарно, все structural, ни одного semantic

**Impact:** Нет automated guard против случайного удаления/переименования error code или event в контракте без обновления conformance-пакета.

**Recommendation:**
- Добавить тест: «каждый error code из `error-codes.json` упоминается хотя бы в одном scenario stub» (или завести placeholder-assertion)
- Добавить тест: «каждый event из `identity-events.proto` имеет хотя бы один referencing scenario»
- До появления реальных сценариев достаточно structural checks (наличие ключей), чтобы обеспечить modules-monorepo §7.2

---

### 8. LOW: package.json#version = "0.0.0"

**Evidence:**
- Все три conformance-пакета имеют `"version": "0.0.0"`
- Это workspace-private packages (`"private": true`), но версия используется в fixture-данных (`module_version: '0.0.0'`)

**Impact:** При обновлении contract version (v1 → v2) fixture metadata устареет незаметно.

**Recommendation:** Либо синхронизировать `package.json#version` с `contractVersion` (например, `"version": "1.0.0"`), либо использовать `${contractVersion}.0.0` pattern в fixtures. Не критично, но уменьшает confusion.

---

### Quick wins (можно сделать без архитектурного решения)

1. Добавить `test/fixtures-sanity.test.ts` с `.verify()` на каждом fixture
2. Добавить `src/fixtures/sessions.ts` (2-3 объекта)
3. Добавить секцию «Out of scope» в README
4. Добавить `src/capabilities.ts` с константами RPC/event списков

### Требуют решения Влада / архитектурного обсуждения

1. **BLOCKER**: Единый canonical `CategoryConformanceSuite` shape — нужно выбрать между identity/ai-llm и CRM вариантами и зафиксировать в spec
2. **Naming convention**: Переименовать CRM `suite` → `crmConformanceSuite`?
3. **Versioning strategy**: Как версионировать conformance-пакеты относительно contract versions?

---

### Соответствие product vision и specs

- ✅ Структура `modules/<category>/conformance/` соответствует modules-monorepo §7.1
- ✅ 24 scenario-файла покрывают все 24 RPC из `IdentityModule`
- ✅ Drift test реализует invariant modules-monorepo §7.2
- ⚠️ Типовой контракт не зафиксирован в spec явно (§7.1 описывает layout, но не TypeScript interface)
- ⚠️ Нет enforcement для «каждый error code и event покрыт сценарием» (§9.2 требует assertions на negative branches и CloudEvents, но stubs их не содержат — это ожидаемо, но не задокументировано как временное)

### Definition of done для этого audit

- [x] Полный обзор публичного API, internal boundaries, dependencies, types, build/test setup
- [x] Сравнение с sibling-пакетами (CRM, AI-LLM)
- [x] Проверка alignment с `docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md` §9 и `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` §7
- [x] Конкретные рекомендации с severity, evidence и impact

**Сводка:** Пакет structurally sound и выполняет свою роль scaffolding, но требует sync по типовому контракту с CRM-пакетом перед тем, как `@rntme/conformance-framework` начнёт интеграцию. Без этого миграция CRM будет ломающей.
