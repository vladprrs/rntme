# Decision System

> Канон стратегических и архитектурных решений rntme.
> Если нужно принять решение — читай отсюда.
> Если решение не вписывается — правь Goals/Filters, не Bets.
> Update protocol — §5.

---

## 1. North-star goals

Шесть целей. Стабильны. Меняются осознанно через update protocol §5.C.

**G1 · Blueprint = unit of truth.** Project blueprint folder — каноническая единица authoring, versioning, deploy. Identical inputs → identical running system. Authoring, review, rollback оперируют на уровне blueprint.

**G2 · AI agents author, humans decide.** Основной автор артефактов — AI agent, решающий проблему человека. Оптимизируем под: structured artifacts (validatable), codified errors (LLM-correctable), canonical conventions (LLM-composable), fail-fast validation. Humans **не читают артефакты** — они review через inspection surfaces (см. G3).

**G3 · Inspectable runtime.** Понимание системы человеком идёт через UI / observability surfaces (routes, events, ownership, state, traces) — **не через чтение JSON**. UI можно строить позже, но runtime обязан поставлять данные для него уже сейчас. Каждое архитектурное решение либо обеспечивает, либо сохраняет inspectability.

**G4 · Compose via canonical contracts; keep core lean.** Бизнес-процессы и опциональные capabilities собираются из vendor modules под canonical contracts (BPMN, CloudEvents, gRPC, leaf contracts). Vendor SDK живут за contract boundary. Blueprint core содержит **только universally-required артефакты** (то, без чего service'а не существует). Всё что нужно лишь некоторым service'ам — module. Default bias: «скорее новый module под существующий contract, чем новый артефакт/концепт в core». File storage, AI/LLM, identity, CRM, email, seed — модули, не core.

**G5 · Minimize entropy.** One canonical way per concept. Convention over flexibility. Новая абстракция оправдывает себя против существующих; «ещё один способ делать X» — smell.

**G6 · Pre-stable: change is free** *(stage-conditional, expires at first design partners)*. Нет пользователей → backwards-compat обсуждения преждевременны. Renames/removals/breaking changes — free когда мотивация ясна. Заменится stability-дисциплиной на следующей стадии — и тогда этот goal удаляется или инвертируется.

---

## 2. Decision filters

Восемь фильтров. Каждый выводится из одной или нескольких целей. Filters отвечают на «почему?» для любого решения; если ни один не отвечает — см. §5.B.

**F1 · Lean-core check** *(from G4)*. «Нужно ли это каждому service'у/проекту, или только некоторым?» Только некоторым → module под существующий contract, не расширение core.

**F2 · Canonical-way check** *(from G5)*. «Делает ли это то же что уже существующий механизм, но иначе?» Если да — обоснуй почему существующий не подходит; иначе используй существующий.

**F3 · Contract-boundary check** *(from G4)*. Двухступенчатый:
1. *If contract exists* — vendor SDK типы и поведение живут только в module реализации. Contract — leaf, без vendor-зависимостей. Решение требует менять contract под одного vendor'а → smell.
2. *If contract is being shaped* — выводи его из (a) поведения которое runtime'у реально нужно, (b) общих capabilities у нескольких vendors которых ты планируешь поддержать. Contract — наименьший общий знаменатель под нужды runtime, не один vendor. По мере добавления vendors contract эволюционирует; квирки одного vendor'а не диктуют форму.

**F4 · Inspectability check** *(from G3)*. «Может ли будущий UI показать что эта функциональность делает в runtime?» Если ответ требует «прочитай код / артефакт» — нарушение. Runtime эмитит события, state, ownership, traces в общеизвестные surfaces (CloudEvents, OpenTelemetry).

**F5 · LLM-authorability check** *(from G2)*. «Может ли AI agent сгенерировать корректный артефакт с одной попытки или после fail-fast feedback'а?» Структурированный JSON-Schema, codified error codes, deterministic validation. Out-of-band знание для корректности → smell.

**F6 · Repeatability check** *(from G1)*. «Identical blueprint inputs → identical running system?» Никаких runtime-only флагов, dynamic discovery, side-effects при boot которых нет в blueprint. Зависимость от чего-то вне blueprint = либо явный input (env, secret), либо bug.

**F7 · Pre-stable bias** *(from G6, stage-conditional)*. «Это backwards-compat tax или forward optimization?» Сейчас: backwards-compat откладывается до design partners. Renames/removals/breaking changes — free; deprecation paths не строим. Когда G6 отменится, этот filter тоже.

**F8 · Leverage existing standards and libraries** *(from G4 + G5)*. Прежде чем писать своё — используй существующее. Два слоя:
- *Внешние протоколы/стандарты* (BPMN, CloudEvents, gRPC, OAuth, OpenTelemetry, JSON Schema, ...) — для интерфейсов, обмена, наблюдаемости.
- *Популярные актуальные проекты внутри rntme кода* — например **Bun** (заменяет pnpm + tsc + esbuild + test runner одним тулом), **JSON-driven UI rendering** библиотеки (вместо рукописного движка в ui-runtime), и т.д.

Критерии applicability: maintained, broad adoption, не abandonware. Custom код обосновывает себя против existing solution. Hand-roll'инг hashmap'а, парсера, schema-validator'а, DB клиента, дифферa, retry-логики, миграционного движка — smell. Меньше custom code → легче onboard, проще патчить security, устойчивее к bus-factor.

---

## 3. Locked-in bets

Формат строки: `**<name>** — <one-line what> · Filter: <Fx/Gx> · Status: <status> · <optional ref>`. Status meanings — §4.

### 3.1 Strategy

- **OSS-only Apache 2.0** — нет commercial layer; identity / constraint, не daily filter · `locked`
- **Blueprint folder = authoring/versioning/deploy unit** · G1, F6 · `locked`
- **AI agent = primary author** — humans review · G2, F5 · `locked`
- **Pre-stable: change is free** · G6, F7 · `locked-conditional` (до first design partners)

### 3.2 Storage / persistence

- **SQLite as default service store** — упрощает deploy (no provisioned DB), избегает db-per-service Postgres-zoo. Альтернативы (ClickHouse/DuckDB для аналитики, Postgres где обоснованно) — по делу с обоснованием. · F8, G5 · `current-default`
- **Single-writer event log** — event_store = единственный write path; load-bearing для optimistic concurrency и monotonic publish cursor · G1 · `locked` · ADR `docs/adr/2026-04-15-event-driven-architecture.md`
- **No outbox table; event log IS the outbox** — + delivery_tracking для метрик · F2 · `locked` · ADR D1

### 3.3 Eventing & messaging

- **Kafka-compat protocol для inter-service eventing** · F8 · `locked`
- **Redpanda как broker (current default)** — самый простой путь к Kafka (single-node, без Zookeeper); provisioned per project. Engine — pragmatic default, не вечная привязка. · F8, G5 · `current-default`
- **CloudEvents 1.0 envelope end-to-end** · F8 · `locked` · spec `done/2026-04-17-cloudevents-envelope-design.md`
- **Kafka topic = `rntme.{svc}.{agg}` (no version suffix)** — breaking change → new eventType · F5 · `locked`
- **BPMN as standard для cross-service async; choreography forbidden** · F8, G3, G4 · `locked`
- **Operaton как BPMN engine (current default)** — самый быстрый путь к BPMN runtime; engine — pragmatic default, BPMN — locked bet · F8 · `current-default` · spec `done/2026-05-05-provisioned-bpmn-operaton-design.md`

### 3.4 API & contracts

- **gRPC между service'ами** · F8 · `locked`
- **HTTP entry через `@rntme/bindings-http`** · F8 · `locked`
- **Leaf contracts в `packages/contracts/<category>/v1/`** — каждый contract отдельный package; modules/runtime/blueprint импортируют contracts, не друг друга · F3, G4 · `locked`
- **JSON-only authoring** — AI agents лучше делают structured output в JSON чем в YAML/TOML/custom DSL · F5, G2 · `locked`
- **4-layer validation: parse → structural → references → consistency** · F5 · `locked`

### 3.5 Modules & integrations

- **Vendor capabilities → modules под canonical contracts** — identity, AI/LLM, storage, CRM, email, notifications, seed · F1, F3, G4 · `locked`
- **Module shape: `module.json` + `@rntme/contracts-module-v1`** · F3 · `locked`
- **Browser module contract `@rntme/contracts-client-runtime-v1`** · F3 · `locked`
- **Provisioner contract `@rntme/contracts-provisioner-v1`** · G4 · `locked`
- **Auth0 как первый identity module** · F8 · `locked` · spec `2026-04-29-notes-demo-auth0-design.md`
- **OpenRouter как первый AI/LLM module** · F8 · `locked` · spec `done/2026-05-06-ai-llm-openrouter-module-design.md`
- **S3 как первый storage module** · F1, F8 · `locked` · spec `2026-05-06-storage-s3-module-design.md`
- **Seed как module (не часть core)** · F1, G4 · `locked-pending` (имплементация TBD)

### 3.6 Conventions

- **`Result<T>` everywhere — no exceptions в validation/compile** · F5, G2 · `locked`
- **Branded `Validated*` types только через свои validators** · F5 · `locked`
- **Error code format `<PKG>_<LAYER>_<KIND>`** · F5, G2 · `locked`
- **Layering enforced by dependency-cruiser** — modules → contracts only; contracts — leaves; artifacts/deploy не импортируют runtime; no cycles · F3, G4 · `locked`
- **No backwards-compat shims** — pre-stable · F7, G6 · `locked-conditional`

### 3.7 Tooling

- **pnpm + Node 20 + tsc + vitest + esbuild** · F8 · `current-default` · *in-flight migration to Bun planned (см. §6 Open questions)*
- **dependency-cruiser** для layering · F8 · `locked`
- **Dokploy** для deploy · F8 · `current-default`

---

## 4. Status meanings

| Status | Meaning | Change protocol |
|---|---|---|
| `locked` | Решение зафиксировано. Откат — через update protocol §5.A.4. | Уходит в `superseded` через 5.A.4 или 5.C.3 — никогда silently re-decided. |
| `current-default` | Текущий прагматичный выбор; альтернативы возможны при обосновании. | Меняется свободно с rationale в spec'е (без contradiction-эскалации). |
| `locked-conditional` | Locked пока действует stated условие. Условие — триггер. | Когда условие отпадает — становится `locked` permanently или удаляется. |
| `locked-pending` | Решено, но не имплементировано. | Становится `locked` когда имплементация landed. |
| `superseded` | Заменён более новым bet'ом. Остаётся в файле strikethrough + ссылка на replacement, для traceability. | Никогда не реактивируется; если нужно снова — добавляется новый bet. |

Superseded строки **остаются** в файле (вычеркнутые, с ссылкой на замену) — иначе теряется история «почему мы так не делаем».

---

## 5. Update protocol

Цель: каждое противоречие между новым решением и системой превращается в **намеренный** edit goals/filters/bets, а не silent drift.

### 5.A · Bet contradiction (наиболее частый)

Decision не совпадает с существующим bet'ом. Сигнал: либо bet устарел, либо decision неправильное.

1. Identify which bet и его status.
2. Check filters — выводится ли новое решение из существующих filters лучше чем старый bet? Если да — старый bet был слабо обоснован; обнови.
3. **For `current-default`**: замена — нормальный path. Обнови строку с новым rationale; без эскалации. Статус существует именно для этого.
4. **For `locked`**: эскалация. Либо (a) `locked` → `superseded` с inline-маркером и ссылкой на новый bet, либо (b) reject новое решение если оно слабее обоснованно. Решает user явно. Списанная строка остаётся для traceability.
5. **For `locked-pending`**: имплементация ещё не landed — обновляй свободно как `current-default`.

### 5.B · Filter gap (новый тип обоснования)

Decision обосновывается аргументом, не покрытым filters. Признак: «делаем X потому что Y», и Y не сводится к Fx/Gx.

1. **Извлечь принцип** из argumentации Y. Это частный случай существующего filter'а или новый axis?
2. Если **частный случай** — расширь существующий filter одной строкой (примером, edge-case'ом). Не плоди дубликаты.
3. Если **новый axis** — предложи новый filter `Fn`, привяжи к существующему goal. Если goal'а нет — это сигнал §5.C.
4. Filter add/extend = **edit `decision-system.md` в том же spec'е** что родил decision. Не отдельным PR.

### 5.C · Goal violation (самый серьёзный)

Decision напрямую противоречит goal'у. Это redesign-уровень.

1. **Stop.** Не имплементируй decision и не правь goal без явного user authorization.
2. **Surface the conflict**: «Decision X нарушает G_n потому что [reason]. Варианты: (a) goal нуждается в уточнении/замене — какая реальность сдвинулась? (b) decision неправильное — отклоняем. (c) исключение оправдано — записываем как documented exception в bets с inline-rationale».
3. **User решает явно** какой из трёх путей.
4. Если goal меняется — **переэкзаменуй все filters и bets** на которые goal влияет. Это не optional.

### 5.D · Status transitions (mechanical)

```
locked-pending     →  locked              (имплементация landed)
current-default    →  locked              (alternatives explored & rejected)
current-default    →  current-default     (replaced — без эскалации, со spec'ом)
locked             →  superseded          (через path 5.A.4 или 5.C.3)
locked-conditional →  locked              (condition fixed permanently)
locked-conditional →  removed             (condition resolved away)
```

### 5.E · Authorization matrix

| Change | Initiator | Approver |
|---|---|---|
| Bet (`current-default` swap) | Claude или user | User в spec'е |
| Bet (`locked` → `superseded`) | Через path 5.A.4 | User явно |
| Filter add/extend | Claude предлагает | User в spec'е |
| Goal text refinement | User | User |
| Goal add/remove | User | User |

Claude **никогда** не правит goals без явного user authorization. Filters и bets — Claude предлагает edit как часть spec'а brainstorming-сессии.

### 5.F · Audit trail

Полагаемся на git history `docs/decision-system.md` + ссылки в bets/filters на specs которые их меняли. Отдельный change-log не делаем.

---

## 6. Open questions

Незакрытые развилки. Каждая несёт `re-evaluate when:` триггер.

1. **Adopt Drizzle ORM in service runtime?** — Рассматривался в spec `2026-04-18-drizzle-adoption-design.md`. Имплементирован в платформе, но платформа переписывается. *Re-evaluate when:* нужен service-layer migration tool сильнее чем сырые SQL файлы.

2. **Migrate toolchain to Bun?** — Заменяет pnpm + tsc + esbuild + test runner одним тулом (F8, G5). *Re-evaluate when:* стартует dedicated migration spec.

3. **Promote `Operaton` и `Redpanda` из `current-default` в `locked`?** — Сейчас прагматичные defaults. *Re-evaluate when:* второй project отгружен на тех же engines без friction'а указывающего на другой выбор.
