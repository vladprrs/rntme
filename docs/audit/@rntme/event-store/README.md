# Architecture audit — `@rntme/event-store`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-204` (`f7dda0e3-9f7a-4121-9b53-017ac4facd7b`) |
| **Issue title** | Audit: package architecture — @rntme/event-store |
| **Package / scope** | `@rntme/event-store` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `e9d1a653-d747-41fa-8504-26688d175c78` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: @rntme/event-store

**Verdict: needs cleanup** — архитектура зрелая и спецификациям соответствует, но есть операционные риски и debt, которые нужно закрыть до production.

---

### Сводка проблем

| Severity | Проблема | Evidence | Impact | Рекомендация |
|----------|----------|----------|--------|--------------|
| **high** | ActorRef дублируется локально без гарантии синхронизации с @rntme/pdm | `src/types/actor.ts:8-14` — локальная копия union типа | Расхождение с PDM при расширении actor модели сломает wire-формат и row-mapper | Либо shared `@rntme/core-types` пакет, либо CI-проверка байт-эквивалентности |
| **high** | `serviceName` меняет семантику существующих событий при rename | `src/store/row-mapper.ts:15-17` — `source`/`type`/`dataSchema` деривируются runtime от `serviceName` | Rename сервиса = разные CE `source`/`type` для старых событий; consumers ломаются | Зафиксировать `serviceName` в `manifest.json` и добавить assert при старте, что БД не содержит событий с другим `serviceName` |
| **medium** | Нет runtime-валидации `data` (payload = `unknown`) | `src/types/envelope.ts:23` — `data: TPayload`, но append принимает `unknown` | Можно записать невалидный JSON в `payload_json`; downstream consumers получат runtime error | Либо JSON Schema check на append (из `@rntme/pdm deriveEventTypes`), либо явно задокументировать, что валидация — ответственность `graph-ir-compiler` |
| **medium** | SQLite single-writer — нет runtime enforcement | `src/store/sqlite.ts:27` — `journal_mode = WAL`, но нет file-lock check | Два процесса на одном файле = silent corruption | Добавить advisory file lock или explicit `PRAGMA lock_status` check в конструкторе |
| **medium** | `appendRaw` позволяет non-contiguous versions без warning | `test/append-raw.test.ts:17-21` — versions 5, 7 принимаются | Семантически валидно для seed, но для replay/rebuild может создать «дыры» в event log | Добавить `strictMode` опцию или `warnOnGaps` флаг в `AppendRawOptions` |
| **low** | Нет coverage reporting | `vitest.config.ts` — нет `@vitest/coverage-v8` | Невозможно измерить coverage критичных путей (relay, DLQ, concurrency) | Добавить `@vitest/coverage-v8` в devDeps и CI gate |
| **low** | `getDbHandle()` — footgun для db-studio | `src/store/interface.ts:44-49` + `src/store/sqlite.ts:45-52` | Write через raw handle bypasses все инварианты (cursor, OCC, relay ordering) | Ограничить `getDbHandle()` read-only через `db.prepare` wrapper или `Object.freeze` с proxy |
| **low** | Версия пакета `0.0.0` | `package.json:3` + `src/index.ts:1` | Невозможно отследить breaking changes через semver | Начать версионирование; первый stable — `1.0.0` |
| **low** | Нет snapshot/replay tooling | README §Out of scope | При больших aggregates `readStream(subject)` на каждую команду будет дорогим | Добавить `createSnapshot`/`restoreSnapshot` API или вынести в отдельный пакет `@rntme/snapshot` |

---

### Quick wins (можно сделать без продуктового решения)

1. Добавить `@vitest/coverage-v8` и CI gate на >80% покрытие критичных файлов (`sqlite.ts`, `loop.ts`, `wire-codec.ts`).
2. Версионировать пакет (`1.0.0`).
3. Добавить `no-console: error` в production build config (сейчас `warn`).
4. Заменить `console.error` в relay на structured logger interface (даже если default = console).

---

### Требуют продуктового/архитектурного решения Влада

1. **ActorRef sharing**: Создать `@rntme/core-types` или оставить локальную копию с CI-проверкой?
2. **Event payload validation**: Где проводить границу — в `event-store` (strict) или в `graph-ir-compiler` (lenient)?
3. **Multi-writer strategy**: Оставить SQLite forever (single-node) или invest в Turso/Postgres адаптер?
4. **Snapshotting**: Встроить в `event-store` или отдельный пакет?
5. **Schema evolution**: `rntSchemaVersion` хранится, но upcasting не реализован. Нужен ли `EventUpcaster` интерфейс?

---

### Соответствие product vision

Пакет точно соответствует vision («safe runtime for AI-generated business workflow apps»):
- Event-sourced write-side с OCC — core invariant для consistency.
- CloudEvents 1.0 end-to-end — стандартизация wire-формата для интеграций.
- DLQ + delivery tracking — operational safety.
- Zero internal deps — пакет можно использовать автономно.

### Соответствие specs

- `2026-04-17-cloudevents-envelope-design.md` §3.1-3.3 — ✅ полное соответствие.
- `2026-04-17-relay-dlq-delivery-tracking-design.md` §D-CURSOR, D-DLQ-RETRY — ✅ реализовано.
- `2026-04-14-mutations-design.md` §1.2 — ✅ архитектура слоёв соблюдена.
- `2026-04-15-runtime-packaging-design.md` §3.4 — пакет готов к plugin seam (`DbDriver`, `EventBus`).

### Тестовая база

- **96 tests**, 16 файлов, все ✅.
- Покрыты: append (single/multi/subject), concurrency, cursor, schema, delivery tracking, relay (happy path/DLQ/restart), wire codec roundtrip, poison events, smoke E2E.
- **Gap**: нет property-based тестов для `fromCloudEventWire(toCloudEventWire(env)) === env` (спека требует property-tested, но только unit есть).
- **Gap**: нет performance/benchmark тестов для append throughput.

### Итог

Пакет архитектурно зрелый, спецификациям соответствует, тесты проходят. Основные риски — **ActorRef drift**, **serviceName immutability**, и **отсутствие runtime enforcement single-writer**. Рекомендуется закрыть quick wins в ближайшем спринте, а architectural decisions вынести на обсуждение перед production deploy.
