# Architecture audit — `@rntme-cli/deploy-dokploy`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-226` (`79ce411d-fb7b-4976-9390-96519025de04`) |
| **Issue title** | Audit: package architecture — @rntme-cli/deploy-dokploy |
| **Package / scope** | `@rntme-cli/deploy-dokploy` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `55cfe0be-e015-4acb-91e2-96084d9384be` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Архитектурный аудит `@rntme-cli/deploy-dokploy`

**Verdict: needs cleanup** — пакет в целом спроектирован чисто (render/apply/client разделены, секреты не просачиваются), но есть конкретные архитектурные риски и пробелы, которые стоит закрыть до production.

---

### Блокеров не обнаружено

---

### High

1. **`resourceMatches` использует `JSON.stringify` для сравнения сложных объектов**  
   *Evidence:* `src/apply.ts:235` (`jsonEqual`), `src/apply.ts:209-233` (`resourceMatches`).  
   *Impact:* Ложные срабатывания на различиях в порядке ключей, `undefined` vs отсутствие ключа, вложенных объектах. Приводит к лишним `update` вызовам к Dokploy API или, наоборот, к пропуску реальных изменений.  
   *Рекомендация:* Заменить на структурное глубокое сравнение с явной схемой полей (или хеширование по нормализованному представлению).

2. **Отсутствие механизма rollback/cleanup при partial failure**  
   *Evidence:* `src/apply.ts:36-91` — при ошибке на N-м ресурсе уже созданные/обновлённые ресурсы остаются в Dokploy. `retrySafe: true` декларируется, но не гарантирует идемпотентность при изменениях внешнего состояния между ретраями.  
   *Impact:* Орфанные ресурсы, неконсистентное состояние деплоя, необходимость ручной чистки.  
   *Рекомендация:* Либо добавить явный rollback-шаг (удаление созданных ресурсов), либо документировать контракт "at-least-once apply" и добавить orphan-detect на уровне executor.

3. **`DokployClient` сильно связан с `RenderedDokployResource`**  
   *Evidence:* `src/client.ts:24-35` — все методы `createApplication`, `updateApplication`, `configureApplication` принимают полный `RenderedDokployResource`. `platform-http/src/deploy/dokploy-client-factory.ts` вынужден знать внутренности рендеринга.  
   *Impact:* Нарушение границы адаптера. Изменение полей `RenderedDokployResource` ломает реализацию клиента в другом пакете.  
   *Рекомендация:* Ввести DTO-типы для клиента (`CreateApplicationInput`, `UpdateApplicationInput`, `ConfigureApplicationInput`) и маппинг на уровне `apply.ts`.

4. **Последовательное применение ресурсов без concurrency**  
   *Evidence:* `src/apply.ts:45-71` — цикл `for...of` с `await` на каждой итерации.  
   *Impact:* Для проектов с 5+ ворклоадами деплой занимает линейно больше времени. Dokploy API позволяет параллельные операции.  
   *Рекомендация:* Добавить пулл конкурентности (например, `p-limit` или простой `Promise.all` с `batchSize`) с учётом зависимостей (edge-gateway должен деплоиться после upstream-сервисов, если есть health-check зависимости).

---

### Medium

5. **`build` поле в `RenderedDokployResource` объявлено, но никогда не заполняется рендерером**  
   *Evidence:* `src/render.ts:266-294` — для `domain-service` заполняется только `image`, `build` не трогается. `src/render.ts:64` — `build?: RenderedDomainArtifactBuild` в типе.  
   *Impact:* Мёртвый код/тип. Создаёт путаницу: ожидается ли билд-контекст для domain-service или нет?  
   *Рекомендация:* Либо удалить `build` из рендерера (если не нужен), либо реализовать генерацию билд-контекста. **Требуется решение Влада.**

6. **Нет валидации `publicBaseUrl` и `endpoint` в `DokployTargetConfig`**  
   *Evidence:* `src/config.ts` — простой тип, `src/render.ts:86-182` — прямое использование без проверок. `joinPublicUrl` бросит на невалидном URL.  
   *Impact:* Runtime ошибки на этапе рендера вместо раннего reject.  
   *Рекомендация:* Добавить runtime валидацию URL (через `new URL()`) в `renderDokployPlan` или ввести zod-схему для `DokployTargetConfig`.

7. **Переэкспорт `Result`-хелперов дублирует `deploy-core`**  
   *Evidence:* `src/result.ts` — собственная копия `ok/err/isOk/isErr`. `src/index.ts:27` — реэкспорт. `deploy-core` экспортирует идентичные символы.  
   *Impact:* Два источника правды. Риск рассинхронизации семантики (например, если в `deploy-core` добавят `Result.map`).  
   *Рекомендация:* Зависеть от `Result` из `deploy-core` напрямую, удалить `src/result.ts`.

8. **Недостаточное покрытие тестами edge cases**  
   *Evidence:* `test/unit/render.test.ts` — нет тестов на: пустой `workloads`[], несколько middleware одного типа на одном route, `integration-module` с `expose: true` и public routes, невалидный `endpoint`/`publicBaseUrl`.  
   *Impact:* Регрессии в нетривиальных сценариях будут проскакивать.  
   *Рекомендация:* Добавить тесты на вышеуказанные сценарии.

9. **`assertNever` в `render.ts` бросает plain Error**  
   *Evidence:* `src/render.ts:335-337`.  
   *Impact:* Нарушение контракта структурированных ошибок (`DokployDeploymentError`). Вызывающий код ожидает `Result<Err<...>>`, а получает throw.  
   *Рекомендация:* Вернуть `err([{ code: 'DEPLOY_RENDER_DOKPLOY_UNKNOWN_WORKLOAD', ... }])` вместо throw.

10. **`sanitizeCause` агрессивно редактирует ВСЕ сообщения об ошибках**  
    *Evidence:* `src/apply.ts:268-276` — любой `Error` превращается в `"redacted client error"`.  
    *Impact:* Потеря диагностики при отладке сетевых проблем Dokploy.  
    *Рекомендация:* Редактировать только известные паттерны секретов (Bearer, apiToken, password), оставляя остальной текст ошибки.

---

### Low

11. **README ссылается на несуществующий spec**  
    *Evidence:* `README.md:32` — `docs/superpowers/specs/2026-04-24-project-deployment-pipeline-design.md` отсутствует в репо.  
    *Рекомендация:* Исправить ссылку или удалить.

12. **Версия `0.0.0` в `package.json`**  
    *Evidence:* `package.json:3`.  
    *Impact:* Невозможно отследить breaking changes.  
    *Рекомендация:* Начать semver (`0.1.0`) и зафиксировать публичный API как стабильный.

13. **Отсутствие интеграционных тестов с реальным Dokploy client factory**  
    *Evidence:* Все тесты используют `FakeDokployClient`. Нет e2e/smoke тестов с `platform-http` client factory.  
    *Impact:* Несоответствия между `DokployClient` interface и фактической реализацией в `dokploy-client-factory.ts` выявляются только в production.  
    *Рекомендация:* Добавить контрактные тесты (contract tests) между interface и реализацией, либо интеграционные тесты с Dokploy dev instance.

---

### Quick wins (можно сделать без продуктового решения)

- Исправить ссылку в README.
- Добавить URL-валидацию в `renderDokployPlan`.
- Исправить `assertNever` на возврат `err()`.
- Смягчить `sanitizeCause`.
- Удалить/реэкспортировать `Result` из `deploy-core`.
- Поднять версию до `0.1.0`.
- Добавить unit-тесты на пустые workloads и множественные middleware.

---

### Требуют решения Влада

1. **Что делать с `build` полем?** Убрать или реализовать генерацию артефакт-билда для domain-service?
2. **Rollback при partial failure:** реализовать автоматический cleanup созданных ресурсов, или считать retry-safe достаточным?
3. **Рефакторинг `DokployClient` interface:** развязать от `RenderedDokployResource` через отдельные DTO?
4. **Конкурентность apply:** добавить параллельное применение ресурсов с учётом зависимостей?

---

### Итог

Пакет хорошо отвечает своей роли "Dokploy adapter" и правильно изолирует секреты. Основные риски — в хрупком сравнении состояний, отсутствии cleanup на ошибках, и сильной связности `DokployClient` с внутренними типами рендера. Все проблемы устранимы без изменения product vision.
