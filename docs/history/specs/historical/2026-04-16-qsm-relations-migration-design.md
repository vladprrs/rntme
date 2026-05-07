> Status: historical.
> Date: 2026-04-16.
> Current source: docs/current/**, docs/decision-system.md, and current code/tests.
> Why retained: Historical rationale and execution context retained for review; it is not current-state truth by itself.

# QSM relations migration — read-side relation metadata переезжает PDM → QSM

Date: 2026-04-16

## Problem

Демо `issue-tracker-api` подсветило, что `listIssues`, `listIssuesUi`, `searchIssues` возвращают сырые FK (`projectId`, `reporterId`, `assigneeId`, `sprintId`) вместо читаемых значений (`projectKey`, `reporterUsername`, и т.п.) — см. `demo_join_enrichment_todo.md`. Только `issueDetail` даёт обогащённый ответ через map-node с dot-nav (`issue.project.key`, `issue.reporter.username`).

Поверхностный fix — добавить `map` с dot-nav в три list/search graph-а — работает, но обнажает архитектурный долг: **структурная relation-метаданная для read-side живёт в PDM**, хотя по разделению ответственностей она должна жить в QSM.

Сейчас:
- compiler `packages/graph-ir-compiler/src/lower/sqlite/joins.ts` читает `pdm.entities[E].relations[R]` для построения SQL JOIN-цепочки из dot-nav;
- `QSM.relationRoles` существует как annotation-only поле (`"Entity.relation": "fact"|"dimension"`), но **никогда не консультируется** compiler-ом;
- JOIN-target — `pdm.entities[toEntity].table`, хотя read-side должен джойнить к `qsm.projections[toProj].table`; сейчас это совпадает случайно, потому что все projections — `entity-mirror` 1:1 с entity-именами;
- QSM `relationRoles` валидируется против PDM-relations на cross-ref стадии, но только как annotation-consistency проверка.

Долг:
- PDM overloaded: кроме доменной модели тащит структуру JOIN-ов для read-side compiler;
- дублирование знания: PDM описывает связи, QSM знает projections — но read-side compiler вынужден склеивать их implicit-но;
- невозможно расходить read-side relation graph от PDM relation graph (например, назвать read-side alias иначе, скрыть relation на read-side) — потому что единственный источник — PDM;
- скрытая зависимость: переименование projection table в QSM (`projection_issue` vs `issues`) молча сломает JOIN, потому что compiler всё ещё ходит в `pdm.entities[E].table`.

## Decision

**B2 — full structural relation metadata переезжает в QSM для read-side. PDM не меняется.**

QSM получает собственный top-level блок `relations` со структурой, достаточной для построения SQL JOIN-ов (`to`, `localKey`, `foreignKey`, `cardinality`, optional `role`). Read-side compiler читает **только** QSM; PDM касается исключительно для field→column резолва (единственная индирекция, которую не заменить без дублирования полного projection field list).

PDM остаётся источником истины для domain-relations (нужно для authoring, write-side, event schema, визуализации доменной модели). QSM-relations **cross-validated** против PDM на cross-ref стадии: одно и то же имя relation → одинаковые `to`, `localKey`, `foreignKey`, `cardinality`. Автор не может соврать — если врёт, cross-ref падает с error (PDM — канон).

## Non-goals

Фиксирую явно, чтобы обсуждение не утекало:

- **PDM не меняется.** Ни schema, ни артефакты.
- **Никаких новых node-типов в Graph IR.** Нет `join`, нет `expandMany`. Три существующих механизма (dot-nav, `lookupOne`, map.lookup) остаются единственным способом задать JOIN. Controlled fan-out — out of scope.
- **`cardinality: "many"` в QSM.relations** — легально объявить, но compiler отказывается lowerить. Зарезервировано под будущую миграцию.
- **Multi-hop shortcuts (`through`)** — out of scope, single-hop only.
- **`derived` projections** — out of scope. `to` в QSM-relation обязан указывать на `entity-mirror` projection.
- **ksqlDB / Zeebe / gRPC side-interactions** — off rntme's plate.

## Architecture

Единый спек, два чётких phase в плане.

```
┌─ Phase 1: Migration of read-side relation metadata ─────────────┐
│                                                                  │
│   QSM schema:    relations: {...} (new, replaces relationRoles)  │
│   QSM validate:  cross-ref QSM.relations ↔ PDM.relations (B2)    │
│   Compiler:      joins.ts/lower.ts читают QSM, не PDM            │
│   Demo QSM:      заполнена в minimal-form для issueDetail        │
│                                                                  │
│   Invariant:     SQL snapshot всех существующих graphs —         │
│                  byte-identical до и после миграции.             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─ Phase 2: Demo enrichment via new path ─────────────────────────┐
│                                                                  │
│   demo QSM:      relations на IssueView расширяются              │
│   demo graphs:   listIssues / listIssuesUi / searchIssues        │
│                  получают map с dot-nav (issue.project.key etc.) │
│   demo shapes:   IssueListItem shape для enriched output         │
│                                                                  │
│   Invariant:     issueDetail SQL не меняется (тот же путь)       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

Граница жёсткая: Phase 1 не меняет ни одного demo graph или binding; единственные изменения demo-артефактов на Phase 1 — `qsm.json` получает `relations` ровно под `issueDetail`. Любое изменение SQL-snapshot в Phase 1 — регрессия.

## Design

### 1. QSM schema

**Файлы:** `packages/qsm/src/parse/schema.ts`, `packages/qsm/src/types/artifact.ts`.

Новый top-level блок `relations` (flat map):

```ts
export type QsmRelation = {
  to: string;                           // имя projection в этой же QSM
  localKey: string;                     // field name на source entity (НЕ column)
  foreignKey: string;                   // field name на target projection source entity
  cardinality: 'one' | 'many';
  role?: 'fact' | 'dimension';
};

export type QsmArtifact = {
  projections: Readonly<Record<string, Projection>>;
  relations:   Readonly<Record<string, QsmRelation>>; // key: "<ProjectionName>.<relationName>"
};
```

**Пример (demo, Phase 1 minimal):**

```json
"relations": {
  "IssueView.project":  { "to": "project_mirror", "localKey": "projectId",  "foreignKey": "id", "cardinality": "one", "role": "dimension" },
  "IssueView.reporter": { "to": "user_mirror",    "localKey": "reporterId", "foreignKey": "id", "cardinality": "one", "role": "dimension" },
  "IssueView.assignee": { "to": "user_mirror",    "localKey": "assigneeId", "foreignKey": "id", "cardinality": "one", "role": "dimension" }
}
```

**Правила shape:**

1. **Key формат** — `"<ProjectionName>.<relationName>"`. `<relationName>` совпадает с relation name на source entity той projection (переименование не поддерживается).
2. **`to`** — имя projection, не entity.
3. **`localKey`/`foreignKey`** — field names (не columns). Column резолвится compiler-ом через `pdm.entities[sourceEntity].fields[fieldName].column`.
4. **Single-hop only.** Multi-hop dot-nav (`issue.project.lead.username`) строится compiler-ом через последовательный walk по QSM.relations; каждый hop должен быть объявлен отдельно.
5. **`cardinality`** — обязательное. `many` допустим в schema, но compiler падает `NAV_FAN_OUT_NOT_ALLOWED` при lowering.
6. **`role`** — optional. Compiler не консультирует, оставлено для визуализации и будущих оптимизаций.

**Фатальный для `relationRoles`:** поле удаляется из schema. Все фикстуры и demo `qsm.json` мигрируются (см. раздел «Files touched»).

### 2. QSM validate / cross-ref (B2 enforcement)

**Файлы:** `packages/qsm/src/validate/structural.ts`, `packages/qsm/src/validate/cross-ref.ts`, `packages/qsm/src/types/result.ts`.

**Structural layer (без PDM):**

| Проверка | Error code |
|---|---|
| Key имеет форму `"X.Y"` (ровно одна точка, обе части непустые) | `QSM_RELATION_KEY_MALFORMED` |
| `to` — непустая строка | `QSM_RELATION_TO_MISSING` |
| `localKey`, `foreignKey` — непустые строки | `QSM_RELATION_KEY_MISSING` |
| `cardinality` ∈ `{one, many}` | Zod enum |
| `role`, если задано, ∈ `{fact, dimension}` | Zod enum |

**Cross-ref layer (QSM ↔ PDM ↔ QSM) — для каждой `relations["<SP>.<R>"]`:**

1. **Резолв source projection.** `sp = qsm.projections[SP]`; если нет — `QSM_XREF_RELATION_UNKNOWN_SOURCE_PROJECTION`. `sourceEntity = pdm.resolveEntity(sp.source.entity)`.
2. **Резолв target projection.** `tp = qsm.projections[to]`; если нет — `QSM_XREF_RELATION_UNKNOWN_TARGET_PROJECTION`. `targetEntity = pdm.resolveEntity(tp.source.entity)`.
3. **Поиск PDM relation.** `pdmRel = sourceEntity.relations.find(r => r.name === R)`; если нет — `QSM_XREF_RELATION_NOT_IN_PDM` (hint: «add PDM relation or fix name»).
4. **Сравнение (B2):**

| Поле QSM | Ожидается | Error code |
|---|---|---|
| `to → tp.source.entity` | `=== pdmRel.to` | `QSM_XREF_RELATION_TO_MISMATCH` |
| `localKey` | `=== pdmRel.localKey` | `QSM_XREF_RELATION_LOCAL_KEY_MISMATCH` |
| `foreignKey` | `=== pdmRel.foreignKey` | `QSM_XREF_RELATION_FOREIGN_KEY_MISMATCH` |
| `cardinality` | `=== pdmRel.cardinality` | `QSM_XREF_RELATION_CARDINALITY_MISMATCH` |

5. **Sanity-проверки:**
   - `localKey` существует как field на `sourceEntity` → `QSM_XREF_RELATION_LOCAL_KEY_UNKNOWN_FIELD`
   - `foreignKey` существует как field на `targetEntity` И входит в `targetEntity.keys` → `QSM_XREF_RELATION_FOREIGN_KEY_NOT_A_KEY`

Старые коды `QSM_XREF_RELATION_ROLE_UNKNOWN_ENTITY` и `QSM_XREF_RELATION_ROLE_UNKNOWN_RELATION` удаляются — их случаи покрыты новыми `QSM_XREF_RELATION_*`.

### 3. Compiler changes

**Файлы:** `packages/graph-ir-compiler/src/lower/sqlite/joins.ts`, `packages/graph-ir-compiler/src/lower/sqlite/lower.ts`, `packages/graph-ir-compiler/src/validate/semantic/*.ts`, `packages/graph-ir-compiler/src/types/result.ts`.

**Сигнатуры:**

```ts
// Было:
expandChain(startAlias, startEntity, path, pdm: ValidatedPdm) → JoinChain
chainToSqlJoins(chain, pdm: ValidatedPdm) → SqlJoin[]

// Станет:
expandChain(startAlias, startProjection, path, qsm, pdm) → JoinChain
chainToSqlJoins(chain, qsm, pdm) → SqlJoin[]
```

QSM — источник relation graph и projection table names. PDM — только для field→column.

**`JoinChain` shape:**

```ts
type JoinChain = {
  from: string;
  fromProjection: string;         // NEW
  steps: Array<{
    relation: string;
    fromProjection: string;       // NEW
    toProjection: string;         // заменяет toEntity
    toAlias: string;
    localKey: string;             // уже column name
    foreignKey: string;           // уже column name
    cardinality: 'one' | 'many';  // NEW
  }>;
};
```

**Алгоритм `expandChain`:**

```ts
function expandChain(startAlias, startProjection, path, qsm, pdm): JoinChain {
  let curProjName = startProjection;
  const steps = [];
  for (let i = 1; i < path.length; i++) {
    const relName = path[i];
    const key = `${curProjName}.${relName}`;
    const rel = qsm.relations[key];
    if (!rel) throw new Error(`NAV_NOT_ALLOWED: relation "${key}" not declared in QSM`);
    if (rel.cardinality === 'many') {
      throw new Error(`NAV_FAN_OUT_NOT_ALLOWED: "${key}" is many-cardinality`);
    }
    const curProj   = qsm.projections[curProjName];
    const curEntity = pdm.entities[curProj.source.entity];
    const toProj    = qsm.projections[rel.to];
    const toEntity  = pdm.entities[toProj.source.entity];
    const localCol   = curEntity.fields[rel.localKey].column;
    const foreignCol = toEntity.fields[rel.foreignKey].column;
    steps.push({
      relation: relName,
      fromProjection: curProjName,
      toProjection: rel.to,
      toAlias: relName,
      localKey: localCol,
      foreignKey: foreignCol,
      cardinality: rel.cardinality,
    });
    curProjName = rel.to;
  }
  return { from: startAlias, fromProjection: startProjection, steps };
}
```

**`chainToSqlJoins`:**

```ts
function chainToSqlJoins(chain, qsm, pdm): SqlJoin[] {
  const joins = [];
  let fromAlias = chain.from;
  for (const step of chain.steps) {
    const toTable = qsm.projections[step.toProjection].table;
    joins.push({
      kind: 'left',
      table: toTable,
      alias: step.toAlias,
      on: { op: 'eq', args: [
        { kind: 'col', table: fromAlias, column: step.localKey },
        { kind: 'col', table: step.toAlias, column: step.foreignKey },
      ]},
    });
    fromAlias = step.toAlias;
  }
  return joins;
}
```

Структура идентична текущей — меняется только источник данных.

**Scan anchoring (`resolveSources`):** сейчас `scan.entity` резолвится либо к projection с таким именем, либо к entity-mirror projection, либо к голому `pdm.entities[E].table` (fallback). Phase 1 сохраняет все три пути, но добавляет gate:

- Если scan резолвится к projection (первые два пути) — её имя передаётся в `expandChain` как `startProjection`.
- Если scan попадает на PDM-fallback И graph содержит dot-nav из этого scan — compiler даёт `NAV_PROJECTION_REQUIRED: scan anchored to PDM entity "X" cannot participate in dot-navigation; declare a projection for "X"`.

Для всех существующих demo graph-ов и тестов scans резолвятся через projection, поэтому fallback не триггерится — Phase 1 invariant держится.

**Новые error codes:**

- `GRAPH_IR_NAV_NOT_ALLOWED`
- `GRAPH_IR_NAV_FAN_OUT_NOT_ALLOWED`
- `GRAPH_IR_NAV_PROJECTION_REQUIRED`

Эти ошибки — в semantic validate (ранняя фаза), lowering бросает `throw` только как поздняя страховка.

**Что compiler не делает:**

- Не читает `pdm.entities[E].relations` вообще.
- Не интерпретирует `role` — чистая аннотация.
- Не падает на scan-queries без dot-nav даже с пустым `qsm.relations` — `NAV_NOT_ALLOWED` только при попытке walk.

### 4. Phase 2: demo enrichment

**Convention (из `issueDetail`):** flat field names в `map.fields`, dot-nav справа, `nullable: true` в shape на enriched полях.

**Изменения в `demo/issue-tracker-api/artifacts/qsm.json` — блок `relations`:**

```json
"relations": {
  "IssueView.project":  { "to": "project_mirror", "localKey": "projectId",  "foreignKey": "id", "cardinality": "one", "role": "dimension" },
  "IssueView.reporter": { "to": "user_mirror",    "localKey": "reporterId", "foreignKey": "id", "cardinality": "one", "role": "dimension" },
  "IssueView.assignee": { "to": "user_mirror",    "localKey": "assigneeId", "foreignKey": "id", "cardinality": "one", "role": "dimension" },
  "IssueView.sprint":   { "to": "sprint_mirror",  "localKey": "sprintId",   "foreignKey": "id", "cardinality": "one", "role": "dimension" }
}
```

Phase 1 ставит первые три (покрывают `issueDetail` — `issue.project.key/name`, `issue.reporter.username`, `issue.assignee.username` — и `issuesByProject` — `issue.project.key`). Phase 2 добавляет `IssueView.sprint` под `sprintName` в `IssueListItem`.

**Три graph-а получают `map` node в конце:**

Паттерн (для `listIssues.json`):

```diff
- "output": { "type": "rowset<Issue>", "from": "paged" }
+ "output": { "type": "rowset<IssueListItem>", "from": "enriched" }
```

Новый node:

```json
{ "id": "enriched", "type": "map", "config": {
  "input": "paged", "into": "IssueListItem",
  "fields": {
    "id": "issue.id",
    "title": "issue.title",
    "status": "issue.status",
    "priority": "issue.priority",
    "storyPoints": "issue.storyPoints",
    "createdAt": "issue.createdAt",
    "resolvedAt": "issue.resolvedAt",
    "projectKey": "issue.project.key",
    "projectName": "issue.project.name",
    "reporterUsername": "issue.reporter.username",
    "assigneeUsername": "issue.assignee.username",
    "sprintName": "issue.sprint.name"
  }
}}
```

`listIssuesUi.json` и `searchIssues.json` получают тот же паттерн (same shape, same enriched node). `searchIssues` сохраняет `predicate_optional` chain до `paged`; map — последним.

**Новый shape `IssueListItem` в `shapes.json`:**

```json
"IssueListItem": {
  "fields": {
    "id":               { "type": "integer",  "nullable": false },
    "title":            { "type": "string",   "nullable": false },
    "status":           { "type": "string",   "nullable": false },
    "priority":         { "type": "string",   "nullable": false },
    "storyPoints":      { "type": "integer",  "nullable": false },
    "createdAt":        { "type": "datetime", "nullable": false },
    "resolvedAt":       { "type": "datetime", "nullable": true  },
    "projectKey":       { "type": "string",   "nullable": true  },
    "projectName":      { "type": "string",   "nullable": true  },
    "reporterUsername": { "type": "string",   "nullable": true  },
    "assigneeUsername": { "type": "string",   "nullable": true  },
    "sprintName":       { "type": "string",   "nullable": true  }
  }
}
```

Один shape на три endpoint-а. UI-специфичный расширенный shape — отдельной спекой по мере потребности.

**Риск `sort + limit + JOIN`.** Все три graph-а: `filter → sort → limit → map(enriched)`. SQL-корректное выражение требует subquery wrap: сначала `ORDER BY ... LIMIT`, затем снаружи `LEFT JOIN`. Иначе JOIN до LIMIT перепашет все строки.

Желаемый SQL:

```sql
SELECT limited.*, project.key AS projectKey, reporter.username AS reporterUsername, ...
FROM (
  SELECT * FROM projection_issue WHERE ... ORDER BY ... LIMIT ?
) AS limited
LEFT JOIN projects AS project  ON limited.project_id  = project.id
LEFT JOIN users    AS reporter ON limited.reporter_id = reporter.id
LEFT JOIN users    AS assignee ON limited.assignee_id = assignee.id
LEFT JOIN sprints  AS sprint   ON limited.sprint_id   = sprint.id
```

Умеет ли текущий lowering строить такую форму — проверяется TDD-порядком (см. Testing strategy, раздел «Phase 2»).

### 5. Testing strategy & invariants

**Phase 1 invariant: byte-identical SQL snapshots.**

| Точка контроля | Файл / действие |
|---|---|
| Golden SQL snapshots | `packages/graph-ir-compiler/test/golden/category-sales/` — baseline зафиксирован, diff ожидается пустым |
| Demo smoke | `demo/issue-tracker-api/test/smoke.test.ts` — все запросы, включая `issueDetail`, дают идентичный ответ |
| Compiler unit-tests | `packages/graph-ir-compiler/test/unit/lower/sqlite/` — все зелёные, фикстуры обновлены без изменения ожидаемого SQL |
| QSM validation tests | новые: по позитивному/негативному на каждый error code (`QSM_RELATION_*`, `QSM_XREF_RELATION_*`) |

Любой diff golden SQL в Phase 1 — регрессия миграции, либо требует явного коммит-обоснования.

**Phase 1 — фикстуры, требующие перегона:**

| Фикстура | Действие |
|---|---|
| `packages/graph-ir-compiler/test/unit/fixtures/issue-pdm.ts:49` (`RAW_ISSUE_QSM_EMPTY`) | `relationRoles: {}` → удалить поле (Zod default создаст пустой `relations`) |
| `packages/graph-ir-compiler/test/unit/command-runtime/execute-read-prelude.test.ts:29` | `relationRoles: {}` → удалить |
| `packages/graph-ir-compiler/test/unit/validate/semantic/sources.test.ts:78` | `relationRoles: {}` → удалить |
| `packages/projection-consumer/test/unit/compile-composite-key.test.ts:43` | `relationRoles: {}` → удалить |
| `packages/projection-consumer/test/fixtures/issue-tracker.qsm.json:22-25` | `Issue.project/reporter/assignee: "dimension"` → полная форма в `relations` (source PDM: `test/unit/fixtures/issue-pdm.ts`) |
| `packages/graph-ir-compiler/test/golden/category-sales/qsm.json:12-15` | `OrderItem.order: "fact"`, `OrderItem.product: "dimension"`, `Product.category: "dimension"` → полная форма в `relations` (source: `test/golden/category-sales/pdm.json`) |
| `demo/issue-tracker-api/artifacts/qsm.json:69` | `relationRoles: {}` → удалить, добавить `relations` на 3 записи для `issueDetail` |

Если при переносе `category-sales` или `issue-tracker` фикстуры обнаружится graph с dot-nav, relation для которого не была объявлена в `relationRoles` — это находка: compiler молча ходил в PDM без QSM-ratification. Каждая такая находка — добавить запись в `relations` в том же Phase 1.

**Phase 2 — TDD-порядок:**

1. Новый shape `IssueListItem` в `shapes.json`.
2. Написать e2e `demo/issue-tracker-api/test/list-enrichment-e2e.test.ts` (шаблон `smoke.test.ts`, port 3013). Assertions:
   - `GET /v1/issues?limit=5` — массив, каждый элемент имеет `projectKey`, `reporterUsername`, `assigneeUsername`, `sprintName` (nullable strings).
   - Для seeded issue 7001 — точные значения enriched полей (зависят от seed-данных; проверяется в implementation).
   - `GET /v1/issues/search?q=foo&limit=5` — то же (+ вариант с `priority=high`).
3. Тест падает (map-node нет, enrichment нет).
4. Добавить map-node в `listIssues.json`, прогнать. Если SQL неправильный (JOIN до LIMIT) — fix в `lower.ts` для `map-after-limit` (subquery wrap).
5. Повторить для `searchIssues`, `listIssuesUi`.
6. Обновить `smoke.test.ts` на новый output shape.

**Compiler unit-тест `map-after-limit`:** в `test/unit/lower/sqlite/lower.test.ts` — синтетический сценарий `filter → sort → limit → map(dot-nav)` с ожидаемым SQL в subquery-form. Пригвождается инвариант независимо от demo.

**Cross-phase invariant:** после Phase 2 `issueDetail` работает точно так же, как до миграции (SQL тот же, response тот же). Если `issueDetail` smoke упал в Phase 2 — откат Phase 2 commit до выяснения.

**Что не тестируем (YAGNI):**

- Multi-hop dot-nav в demo — unit-тест один синтетический, достаточно.
- `cardinality: "many"` в demo — unit-тест один синтетический (`NAV_FAN_OUT_NOT_ALLOWED`).
- Остальные MVP-graph-ы (`issuesByProject`, `sprintBurndown`) — покрыты Phase 1 golden-snapshot инвариантом, enrichment пока не требуется.

### 6. Spec (`graph_ir_rc_7.md`) update

Минимальная правка в двух местах.

**Section 2.2 (QSM layer description, line 60):**
- Было: `semantic relation roles`
- Станет: `read-side relation graph (structural + role annotation)`

**Новая под-секция под QSM-schema описание (~15-20 строк):**
- Формат ключа `"<ProjectionName>.<relationName>"`
- Поля: `to`, `localKey`, `foreignKey`, `cardinality`, optional `role`
- B2 cross-validation правила (PDM — канон)
- Single-hop constraint
- Removed: `relationRoles` top-level

Section 2.1 (PDM) не меняется — PDM остаётся источником истины для domain-relations.

### 7. Files touched

| Пакет | Файл | Phase | Изменение |
|---|---|---|---|
| `@rntme/qsm` | `src/parse/schema.ts` | 1 | Удалить `relationRoles`, добавить `relations` (Zod) |
| `@rntme/qsm` | `src/types/artifact.ts` | 1 | `QsmRelation` type, убрать `RELATION_ROLE_VALUES`/`RelationRole` export |
| `@rntme/qsm` | `src/validate/structural.ts` | 1 | Проверка формата ключа |
| `@rntme/qsm` | `src/validate/cross-ref.ts` | 1 | B2 cross-ref блок, удалить старые `RELATION_ROLE_*` |
| `@rntme/qsm` | `src/types/result.ts` | 1 | Новые коды `QSM_RELATION_*`, `QSM_XREF_RELATION_*` |
| `@rntme/qsm` | `src/resolvers/qsm-resolver.ts` | 1 | Метод `resolveRelation("SP.R")` |
| `@rntme/graph-ir-compiler` | `src/lower/sqlite/joins.ts` | 1 | `expandChain`/`chainToSqlJoins` — QSM-based |
| `@rntme/graph-ir-compiler` | `src/lower/sqlite/lower.ts` | 1 | Пробросить QSM в вызовы joins.ts |
| `@rntme/graph-ir-compiler` | `src/lower/sqlite/lower.ts` | 2 | Fix `map-after-limit` (subquery wrap), если нужен |
| `@rntme/graph-ir-compiler` | `src/validate/semantic/*.ts` | 1 | Gate `NAV_PROJECTION_REQUIRED` |
| `@rntme/graph-ir-compiler` | `src/types/result.ts` | 1 | `NAV_NOT_ALLOWED`, `NAV_FAN_OUT_NOT_ALLOWED`, `NAV_PROJECTION_REQUIRED` |
| Фикстуры/тесты | (см. раздел «Testing strategy») | 1 | Перегон `relationRoles` → `relations` или удаление |
| Demo | `demo/issue-tracker-api/artifacts/qsm.json` | 1 → 2 | Phase 1: 3 записи (issueDetail + issuesByProject). Phase 2: +`IssueView.sprint` (итого 4) |
| Demo | `artifacts/graphs/listIssues.json` | 2 | Map-node enriched, output → IssueListItem |
| Demo | `artifacts/graphs/listIssuesUi.json` | 2 | То же |
| Demo | `artifacts/graphs/searchIssues.json` | 2 | То же |
| Demo | `artifacts/shapes.json` | 2 | Новый shape `IssueListItem` |
| Demo | `test/list-enrichment-e2e.test.ts` | 2 | Новый e2e файл (port 3013) |
| Demo | `test/smoke.test.ts` | 2 | Обновить assertions на enriched ответ |
| Spec | `graph_ir_rc_7.md` | 1 | Section 2.2 edit + новая подсекция по QSM.relations |

### 8. Rollout

**Один PR, два логических коммита.**

- **Commit 1 (Phase 1):** schema + validate + compiler + все фикстуры + rc7 spec update + min demo `qsm.json`. Все тесты зелёные, golden SQL байт-в-байт.
- **Commit 2 (Phase 2):** demo graphs + shapes + full `qsm.json` + new e2e tests + compiler fix (если понадобился).

Bisectable история: если Phase 2 внесёт регрессию — откатывается только Commit 2, Commit 1 остаётся как чистый refactor.

## Open questions for review

Никаких открытых design-вопросов. Все решения приняты в обсуждении:
- B2 уровень независимости (cross-validated, не independent, не reference-mode);
- flat map shape в QSM;
- field name для localKey/foreignKey;
- single-hop only;
- `relationRoles` выпиливается полностью;
- scan fallback на PDM entity.table сохраняется под gate `NAV_PROJECTION_REQUIRED`;
- один PR с двумя коммитами.

Список ниже — напоминания для самопроверки при написании плана:

- Проверить при implementation: есть ли в golden `category-sales` или других фикстурах dot-nav, для которого relation не была в `relationRoles` (значит compiler молча ходил в PDM) — добавить запись в `relations`.
- `issuesByProject` использует `issue.project.key` в `group` — покрыт Phase 1 `IssueView.project`. `sprintBurndown` dot-nav не использует (проверено `grep` по `graphs/`). Enrichment в Phase 2 ни тому, ни другому не нужен.
- Точная позиция новой под-секции в `graph_ir_rc_7.md` — определяется при написании (скорее всего под существующей секцией QSM-описания).
