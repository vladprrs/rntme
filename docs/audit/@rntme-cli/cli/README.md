# Architecture audit — `@rntme-cli/cli`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-224` (`09e692bc-df2a-415e-84e7-d22f45c0a921`) |
| **Issue title** | Audit: package architecture — @rntme-cli/cli |
| **Package / scope** | `@rntme-cli/cli` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `b5371c27-d3f7-4713-a3d7-2a227dee5da9` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


# Audit Report: @rntme-cli/cli

**Verdict: needs cleanup** — пакет имеет прочную архитектурную основу (Result<T>, harness pattern, typed API client, Zod schemas), но содержит несколько серьёзных расхождений между кодом, тестами и документацией.

---

## High

### 1. E2E-тест полностью сломан
**Evidence:** `test/e2e/skills-smoke.test.ts:18` вызывает `main(['validate'])`, но команда `validate` отсутствует в диспетчере `src/bin/cli.ts`. Тест также ожидает файлы `rntme.json` и `artifacts/pdm.json`, которые `init` не создаёт.
**Impact:** E2E-тест всегда падает на `validate`; CI невозможен без отключения e2e.
**Rec:** Удалить или переписать e2e-тест. Если `validate` нужен — реализовать как alias для `project publish --dry-run`. Если нет — удалить из e2e.

### 2. `init` не создаёт `rntme.json`
**Evidence:** `src/commands/init.ts` создаёт `project.json`, но `src/config/project.ts:57` ищет `rntme.json` при обходе дерева. `rntme.json` — это локальный конфиг сервиса (org/project/service/artifacts), отличный от `project.json`.
**Impact:** После `rntme init` команды, требующие `discoverProjectConfig` (publish, и потенциально deploy), не найдут конфигурацию.
**Rec:** Добавить создание `rntme.json` в `runInit`, либо явно документировать, что пользователь должен создать его вручную.

### 3. README документирует несуществующие команды `deploy`
**Evidence:** `README.md:62-64` описывает `deploy plan`, `deploy render dokploy`, `deploy apply dokploy`, но в `src/bin/cli.ts` нет ни одной `deploy`-ветки.
**Impact:** Документация вводит в заблуждение; пользователи ожидают функциональность, которой нет.
**Rec:** Либо реализовать deploy-команды (требует интеграции с `@rntme-cli/deploy-core`/`deploy-dokploy`), либо удалить из README и завести follow-up issue.

---

## Medium

### 4. `skills install` обходит harness pattern
**Evidence:** `src/commands/skills/install.ts` реализует собственный `writeOk`/`writeErr` вместо использования `runCommand` из `src/commands/harness.ts`.
**Impact:** Несогласованность обработки ошибок и вывода; `--json` флаг работает иначе, чем в других командах.
**Rec:** Рефакторить `skills install` на использование `runCommand` и `CommandHandler<T>`.

### 5. Версия зашита как "0.0.0"
**Evidence:** `package.json:3` и `src/api/client.ts:42` содержат `"0.0.0"`. `readVersion()` читает её из package.json.
**Impact:** User-Agent и `--version` всегда возвращают 0.0.0; невозможно определить версию CLI при отладке.
**Rec:** Настроить версионирование (semantic-release, или хотя бы ручной bump перед релизом).

### 6. Недостаточное тестовое покрытие команд
**Evidence:** Есть тесты для login, project create, project publish, whoami (integration), но нет тестов для: logout, project list, project show, project version list/show, token create/list/revoke, skills install (кроме сломанного e2e).
**Impact:** Регрессии в непокрытых командах не отлавливаются.
**Rec:** Добавить unit/integration тесты для всех команд.

### 7. `postbuild` скрипт с хрупкими путями
**Evidence:** `package.json:21` — скрипт ищет `package.json` по `../../package.json` относительно `dist/bin/cli.js`. Если структура сборки изменится, скрипт сломается.
**Impact:** Хрупкость сборки.
**Rec:** Использовать `import.meta.url` в runtime или копировать package.json в dist на этапе сборки.

### 8. `validate` удалён из CLI, но unit-тест называет его "legacy"
**Evidence:** `test/unit/cli.test.ts:72-78` проверяет, что `validate` отклоняется. E2E при этом ожидает, что он работает.
**Impact:** Противоречие между unit и e2e тестами.
**Rec:** Решить, нужна ли команда `validate`, и привести тесты в соответствие.

---

## Low

### 9. `init` принимает флаги `--org`/`--project`, но игнорирует их
**Evidence:** `test/e2e/skills-smoke.test.ts:13` передаёт `--org demo --project smoke`, но `runInit` не использует эти флаги. `parseArgs` с `strict: false` позволяет неизвестные флаги.
**Rec:** Либо добавить в `init` поддержку `--org`/`--project` для генерации `rntme.json`, либо убрать из e2e.

### 10. Cursor adapter бросает исключение вместо Result
**Evidence:** `src/skills/adapters/cursor.ts:14` — `throw new Error` при отсутствии frontmatter.
**Impact:** Необработанное исключение вместо graceful error.
**Rec:** Вернуть Result или выбросить структурированную ошибку с кодом.

### 11. Отсутствие команды `validate` в диспетчере
**Evidence:** README упоминает `rntme project publish --dry-run` как способ валидации, но отдельной команды `validate` нет.
**Rec:** Либо добавить `validate` как alias/sugar, либо обновить документацию.

---

## Quick Wins

1. Удалить/закомментировать сломанный e2e-тест.
2. Обновить README — убрать `deploy` команды или пометить как "coming soon".
3. Добавить `rntme.json` в вывод `rntme init`.
4. Добавить базовые тесты для `logout`, `project list`, `token list`.

## Требуют продуктового решения Влада

1. **Нужна ли отдельная команда `validate`?** Сейчас dry-run делается через `project publish --dry-run`, но e2e и интуиция пользователей ожидают `rntme validate`.
2. **Когда реализовывать `deploy` команды?** README их обещает, код — нет. Это блокер для документации или приоритетная фича?
3. **Какая семантика у `rntme init`?** Создаёт ли он только project blueprint, или и локальный `rntme.json` тоже? Сейчас оба файла нужны, но создаётся только один.

---

**Файлы, требующие изменений:**
- `src/commands/init.ts` — добавить `rntme.json`
- `src/bin/cli.ts` — добавить `validate` или удалить ожидания
- `README.md` — синхронизировать с реальным CLI surface
- `test/e2e/skills-smoke.test.ts` — исправить или удалить
- `src/commands/skills/install.ts` — перевести на harness pattern

**План готов к dev-реализации quick wins; продуктовые вопросы (validate/deploy) требуют ответа Влада.**
