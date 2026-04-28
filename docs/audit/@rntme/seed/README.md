# Architecture audit — `@rntme/seed`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-211` (`a156d2c5-ef6d-4a4b-bdc1-0a447f24aa4c`) |
| **Issue title** | Audit: package architecture — @rntme/seed |
| **Package / scope** | `@rntme/seed` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `ab11ffce-ddc1-4c6c-a023-d116109a71b3` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


Аудит `@rntme/seed` завершён. Ниже полный отчёт.

## Verdict: needs cleanup

Пакет хорошо структурирован, тесты проходят (65/65), lint/typecheck зелёные. Но есть spec drift, проблемы производительности и edge cases в обработке ошибок, которые стоит закрыть до того, как пакет станет основой для массового seed-авторинга.

---

## Проблемы

### High

#### 1. applySeed — спецификация говорит opts?, реализация требует serviceName
- Evidence: src/apply.ts:21 сигнатура opts: ApplySeedOptions (required), но спецификация §5.1: opts?: { mode?: ApplyMode }.
- Impact: Типизация обманывает: компилятор не заставит передать opts, а в рантайме будет reject.
- Рекомендация: Либо сделать opts обязательным в спецификации, либо добавить sensible default для serviceName.

#### 2. ValidateCtx требует serviceName, которого нет в спецификации
- Evidence: src/validate.ts:13-17 тип ValidateCtx включает serviceName: string. Спецификация §5: ctx: { pdm: PdmResolver; events: readonly EventTypeSpec[] }.
- Impact: Спецификация неполная — любой, кто реализует по спеке, получит SEED_SYNTAX_INVALID с сообщением validateSeed: ctx.serviceName is required.
- Рекомендация: Обновить спецификацию §5 или вынести CE-деривацию из validateSeed в отдельный шаг.

#### 3. countEvents читает до 1 млн записей вместо COUNT(*)
- Evidence: src/apply.ts:72-74 store.readRecordsFrom({ afterId: 0, limit: 1_000_000 }).length.
- Impact: В strict mode на большом event-store seed будет непропорционально медленным.
- Рекомендация: Добавить EventStore.countEvents() в интерфейс @rntme/event-store, реализовать через SELECT COUNT(*) FROM event_log.

#### 4. CLI buildCtx глотает ошибки PDM
- Evidence: src/bin/cli.ts:148-161 при ошибке parsePdm или validatePdm возвращает null, а runValidate/runApply печатают generic cannot read or validate pdm.json.
- Impact: Пользователь CLI не видит, что именно сломано в PDM.
- Рекомендация: Пробрасывать parsed.errors / validated.errors в emitErrors и выходить с exit 1 с деталями.

### Medium

#### 5. isAlreadyWrapped хрупкая проверка
- Evidence: src/wrap-payloads.ts:45-49 проверяет ровно 2 ключа (before + after). Объект с лишними ключами будет повторно wrapped.
- Рекомендация: Проверять наличие before/after без жёсткого length === 2, либо добавить branded type WrappedPayload.

#### 6. mapApplyError обрабатывает ConcurrencyConflict, который appendRaw никогда не кидает
- Evidence: src/apply.ts:84-96 branch err instanceof ConcurrencyConflict. SqliteEventStore.appendRaw кидает raw SQLite ошибки.
- Рекомендация: Добавить комментарий defensive, for future EventStore impls, либо удалить.

#### 7. validateSeed использует randomUUID() — недетерминировано для тестов
- Evidence: src/validate.ts:40 const seedCorrelationId = seed:${randomUUID()}.
- Рекомендация: Добавить опциональный correlationId в ValidateCtx для тестового control.

#### 8. SEED_SYNTAX_INVALID используется для отсутствующего serviceName
- Evidence: src/validate.ts:23-33 при !ctx.serviceName возвращает код SEED_SYNTAX_INVALID.
- Impact: Неверный layer: SYNTAX_INVALID — layer 1 (Zod), а отсутствие serviceName — layer 2/3.
- Рекомендация: Добавить код SEED_CONTEXT_INVALID или задокументировать исключение.

#### 9. Отсутствует negative test для SEED_APPLY_IO
- Evidence: apply-strict.test.ts и apply-upsert.test.ts не эмулируют SQLite failure.
- Рекомендация: Добавить unit test с моком EventStore.appendRaw с throw new Error('SQLITE_IOERR').

#### 10. Спецификация использует legacy имена полей, реализация — CloudEvents-aligned
- Evidence: Спецификация §4.1: stream, aggregateType, payload, occurredAt, actor. Реализация: subject, rntAggregateType, data, time, rntActorKind/rntActorId.
- Impact: Новые разработчики читают спеку и пишут seed с неверными ключами.
- Рекомендация: Обновить спецификацию §4.1 до актуальных имён полей.

### Low

#### 11. scaffold.test.ts — пустой placeholder
- Рекомендация: Удалить или заменить на smoke-test сборки.

#### 12. Двойное stamped correlationId
- Evidence: builder.ts stamps correlationId при event(), validate.ts stamps ещё один при отсутствии.
- Рекомендация: Задокументировать в README, что builder — authoring-time, validate — runtime normalization.

#### 13. postbuild script — inline Node one-liner
- Evidence: package.json "postbuild": "node -e ...".
- Рекомендация: Вынести в scripts/add-shebang.mjs с assert-ами.

#### 14. DEFAULT_SERVICE_NAME = 'rntme-seed' — неожиданный fallback
- Evidence: src/bin/cli.ts:16.
- Рекомендация: Сделать fallback явным warning-ом в stderr, или потребовать --service-name / manifest.json.

---

## Quick wins

1. Fix countEvents -> EventStore.countEvents() / SELECT COUNT(*) — 1 файл, ~3 строки.
2. CLI error propagation — buildCtx возвращает Result вместо null — ~10 строк.
3. Add SEED_APPLY_IO test — mock EventStore.appendRaw с throw — ~15 строк.
4. Fix isAlreadyWrapped — убрать length === 2 — 1 строка.
5. Удалить/обновить scaffold.test.ts — 1 файл.

## Требуют продуктового решения Влада

1. Spec drift naming: обновить 2026-04-15-runtime-seed-design.md §4.1 до актуальных имён полей?
2. applySeed opts contract: сделать opts обязательным в спеке или добавить default serviceName?
3. ValidateCtx.serviceName: включить в спеку или вынести CE-деривацию?
4. Нужен ли EventStore.countEvents() в интерфейсе @rntme/event-store?

---

## Покрытие тестами

| Сценарий | Покрытие |
|----------|----------|
| Parse (layer 1) | 13 тестов, все error codes |
| Semantic validation (layer 2) | 12 тестов |
| Intra-file invariants (layer 3) | 4 теста |
| Apply strict | 4 теста |
| Apply upsert | 4 теста |
| Builder | 6 тестов |
| Wrap payloads | 6 тестов |
| CE integration | 2 теста |
| CLI validate/apply | 8 тестов |
| SEED_APPLY_IO | отсутствует |
| Large-store strict mode | отсутствует |

---

Итог: пакет готов к использованию, но перед масштабированием seed-авторинга стоит закрыть high-severity items (spec drift + countEvents + CLI errors). Остальное — medium/low cleanup, который можно делать по ходу.
