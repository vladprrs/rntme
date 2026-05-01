# Architecture audit — `@rntme/projection-consumer`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-208` (`36105912-7d0e-4f6a-bbee-47a6b96980e4`) |
| **Issue title** | Audit: package architecture — @rntme/projection-consumer |
| **Package / scope** | `@rntme/projection-consumer` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `b42e2e0c-835d-458b-91a2-254341d9dc03` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit verdict: needs cleanup

Пакет архитектурно sound для MVP: слои чёткие, idempotency реализована тремя уровнями, тесты проходят (75/75), lint/typecheck — зелёные. Однако есть документарные расхождения, один потенциально опасный rollback-path и несколько medium/low рисков, которые стоит закрыть до того, как пакет станет "production ready".

---

### Обнаруженные проблемы

| # | Severity | Проблема | Evidence | Impact | Рекомендация |
|---|----------|----------|----------|--------|--------------|
| 1 | **blocker** | README описывает результат `skipped-no-mirror`, но код и типы возвращают `skipped-no-handler` | `README.md:145`, `src/types/apply.ts:99-104`, `src/apply/apply-event.ts:62` | Потребители API будут писать логику обработки по неверному контракту | Либо обновить README под код, либо ввести отдельный дискриминатор `skipped-no-mirror` в `ApplyResult` |
| 2 | **high** | `ROLLBACK` в `consumer.ts` может затереть оригинальную ошибку | `src/consumer.ts:42-44` | Если `COMMIT` упадёт (диск, constraint), SQLite авто-откатит транзакцию, и `db.prepare('ROLLBACK').run()` бросит "no transaction is active", теряя root cause | Обернуть `ROLLBACK` в `try/catch`, сохраняя original error как `cause`; или проверять `db.inTransaction` |
| 3 | **high** | `getDbHandle()` — leaky abstraction, даёт write-доступ в обход всех гарантий | `src/consumer.ts:16,66-68`, `README.md:171` | Любой потребитель может писать в projection таблицы, нарушая ordering и idempotency | Убрать из public API; для `db-studio` передавать handle отдельно, либо обернуть в read-only proxy |
| 4 | **medium** | `VERSION` захардкожен `'0.0.0'` | `src/index.ts:1` | Невозможно отследить версию в production | Генерировать `VERSION` из `package.json` на этапе сборки |
| 5 | **medium** | Тяжёлая compile-зависимость от `@rntme/graph-ir-compiler` ради одного типа `DerivedColumnBinding` | `package.json:26`, `src/types/apply.ts:1`, `src/apply/bind.ts:2` | Увеличивает build graph и coupling; compiler-пакет тащится в read-side runtime | Вынести `DerivedColumnBinding` в shared `@rntme/core-types` (или структурный тип с проверкой) |
| 6 | **medium** | `stop()` может прокинуть unhandled rejection, если `onError` не задан | `src/consumer.ts:62-64` | Ошибка в Kafka-адаптере без `onError` приведёт к rejected promise из `stop()`, что в зависимости от версии Node может крашить процесс | Документировать, что `stop()` может reject, или добавить `onFatalError` callback |
| 7 | **medium** | Нет теста на rollback при ошибке на этапе `COMMIT` | `test/unit/consumer-rollback.test.ts` тестирует только apply-ошибки | Опасный путь из #2 не покрыт | Добавить тест, мокающий `db.prepare('COMMIT').run()` на throw, и проверяющий сохранность оригинальной ошибки |
| 8 | **low** | `bootstrapProjections` использует regex для rewrite DDL — хрупко к leading whitespace/comments | `src/store/bootstrap.ts:4-7` | Если QSM когда-либо сгенерирует комментарий перед `CREATE TABLE`, bootstrap сломает idempotency | Либо trim + regex, либо небольшой SQL-lexer; добавить тест с commented DDL |
| 9 | **low** | `InMemoryKafkaConsumer` экспортирован из главного index, хотя это test-only helper | `src/index.ts:17-18` | Засоряет production surface тестовыми символами | Перенести в subpath export (`/testing` или `/kafka-in-memory`) |
| 10 | **low** | `getAfter` молча дропает ключ `before` по эвристике, что может потерять данные при коллизии имён | `src/apply/bind.ts:83-93` | Если payload содержит поле `before` не как ES before/after, оно исчезнет без warning | Добавить runtime guard (проверить `before === null || typeof before === 'object'`) или задепрокейтить legacy support |
| 11 | **low** | `selectCurrentVersion` использует non-null assertion (`!`) на `find` | `src/apply/apply-event.ts:114` | При ручной конструкции `MirrorHandler` без `aggregateId` binding — runtime crash с непонятной ошибкой | Заменить `!` на явный check с descriptive error |

---

### Quick wins (можно сделать без решения Влада)
- Исправить README: `skipped-no-mirror` → `skipped-no-handler` (или наоборот, если считаем нужным).
- Обернуть `ROLLBACK` в `consumer.ts` в `try/catch` с сохранением `cause`.
- Автоматизировать `VERSION` из `package.json`.
- Перенести `InMemoryKafkaConsumer` в subpath export.
- Добавить тест на COMMIT-failure + rollback.
- Добавить guard в `getAfter`.
- Заменить `!` в `selectCurrentVersion` на explicit check.

### Требуют продуктового/архитектурного решения
- **Сохранять ли `getDbHandle()` в public API?** Если `db-studio` нужен read-only доступ, лучше дать его через отдельный канал, а не через projection-consumer.
- **Выносить ли `DerivedColumnBinding` в shared types?** Это касает `@rntme/graph-ir-compiler` и `@rntme/projection-consumer`.
- **Поддерживать ли legacy flat payloads?** Если все event-store уже мигрировали на `before/after`, `getAfter` можно упростить.

---

### Общая оценка
- **Product fit:** Хорошо. Пакет точно соответствует vision (event-sourced read-side, CQRS) и спеке D5 §6.
- **Scope:** Корректен для MVP. Отсутствие real Kafka adapter, DLQ и replay tooling — осознанные ограничения, задокументированные в README.
- **Готовность к [DEV]:** После закрытия #1 (документарное расхождение) и #2 (rollback path) пакет можно считать готовым к поддержке без изобретения продуктовых решений.

Файлы, на которые ссылается аудит:
- `packages/runtime/projection-consumer/src/consumer.ts`
- `packages/runtime/projection-consumer/src/apply/apply-event.ts`
- `packages/runtime/projection-consumer/src/apply/bind.ts`
- `packages/runtime/projection-consumer/src/store/bootstrap.ts`
- `packages/runtime/projection-consumer/src/types/apply.ts`
- `packages/runtime/projection-consumer/src/index.ts`
- `packages/runtime/projection-consumer/README.md`
- `packages/runtime/projection-consumer/test/unit/consumer-rollback.test.ts`
