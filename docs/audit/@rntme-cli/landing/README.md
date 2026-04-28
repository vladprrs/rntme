# Architecture audit — `@rntme-cli/landing`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-223` (`e68b7679-9e94-4267-aa40-d32e6a18b986`) |
| **Issue title** | Audit: package architecture — @rntme-cli/landing |
| **Package / scope** | `@rntme-cli/landing` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `3a3ff012-cc4f-4646-82d8-b06080857458` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


## Audit Report: `@rntme-cli/landing`

**Verdict: needs cleanup**

Пакет хорошо соответствует product vision (`vision.md` §1, §7) и фреймингу `CLAUDE.md` (market vs internal framing разделены корректно). Архитектура в целом здоровая для маркетингового лендинга, но есть конкретные риски drift, dead code и ручной синхронизации, которые стоит устранить до масштабирования.

---

### Обнаруженные проблемы

#### HIGH

**1. Коллизии `data-section-num` / `id` между живыми и мёртвыми компонентами**
- **Evidence:** `Problem.astro` (`data-section-num="02"`) и `MicroJobs.astro` (`data-section-num="02"`) оба претендуют на §02. `AhaSection.astro` (`04`) и `LiveDemoCard.astro` (`04`). `HowItWorks.astro` (`05`) и `SnowflakeToRuntime.astro` (`05`).
- **Impact:** `MicroJobs`, `SnowflakeToRuntime`, `LiveDemoCard` не импортированы в `index.astro` сейчас, но если любой из них будет активирован (например, `LiveDemoCard` при установке `DEMO_URL`), SideRail сломается — два элемента с одинаковым `data-section-num`, якоря `id="s04"` дублируются.
- **Recommendation:** Либо удалить мёртвые компоненты, либо привести их номера в соответствие с актуальной последовательностью. Ввести единый registry секций.

**2. Метаданные секций размазаны по ~15 файлам**
- **Evidence:** `data-section-num` + `id="sNN"` захардкожены в каждом `.astro`-компоненте; `SideRail.tsx` дублирует список секций; `index.astro` задаёт порядок; `CONTENT.md` документирует порядок отдельно.
- **Impact:** Смена порядка секций требует 5+ ручных правок. Высокий риск рассинхронизации SideRail, якорей, CONTENT.md и фактического рендера.
- **Recommendation:** Создать `src/sections.ts` с единым массивом `{ id, num, label, component }`, откуда генерировать `index.astro`, SideRail и CONTENT.md.

**3. Тестовое покрытие критически тонкое**
- **Evidence:** 3 тест-файла (`env.test.ts`, `AhaReveal.test.tsx`, `LiveDemoCard.test.ts`) — всего ~100 строк. Нет тестов на Astro-компоненты, нет интеграционных тестов сборки, нет accessibility-автоматизации, нет проверки что все секции рендерятся без ошибок.
- **Impact:** Dead code и коллизии секций не ловятся на CI. Регрессии в Astro-шаблонах пройдут незамеченными.
- **Recommendation:** Добавить интеграционный тест, который импортирует `index.astro`, рендерит его с mock-окружением и проверяет уникальность `data-section-num` / `id`. Добавить `astro check` в CI (есть в `package.json`, но проверить что он запускается).

#### MEDIUM

**4. `loadEnv()` вызывается на уровне модуля в 6+ компонентах**
- **Evidence:** `BaseLayout.astro`, `StatusBar.astro`, `Hero.astro`, `Footer.astro`, `LiveDemoCard.astro`, `PilotForm.astro` — каждый делает `const env = loadEnv()` в frontmatter.
- **Impact:** Дублирование работы parseEnv на каждый импорт. Невозможно подменить env для unit-тестов Astro-компонентов без monkey-patching `process.env`.
- **Recommendation:** Вычислять `env` один раз в `BaseLayout.astro` и передавать через `Astro.props` / Astro.locals, либо использовать Astro context.

**5. Мёртвый код в `src/components/`**
- **Evidence:** `MicroJobs.astro`, `SnowflakeToRuntime.astro`, `LiveDemoCard.astro` не импортированы ни в одну страницу.
- **Impact:** Увеличивает размер репозитория, вводит в заблуждение при чтении, риск активации с неправильными `data-section-num` (см. п.1).
- **Recommendation:** Удалить или перенести в `src/_drafts/`. Если `LiveDemoCard` нужен как feature-flag, вынести его в `src/features/demo/` с явным условием рендера в `index.astro`.

**6. `CONTENT.md` — ручная копия компонентов**
- **Evidence:** `CONTENT.md` дублирует весь копирайт, структуру секций и env-зависимости, но не генерируется из кода.
- **Impact:** При изменении копи в компонентах CONTENT.md устареет. Это source of truth для `impeccable:*` skill — drift здесь = некорректные подсказки агентам.
- **Recommendation:** Либо генерировать CONTENT.md из компонентов/MDX (скриптом), либо явно задокументировать в README, что CONTENT.md является source of truth, а компоненты — его реализация.

#### LOW

**7. Отсутствует автоматизированная accessibility-проверка**
- **Evidence:** `.impeccable.md` декларирует "Lighthouse 95+ on all four axes", но в CI и тестах нет `pa11y`, `axe-core` или `lighthouse-ci`.
- **Impact:** Декларация не верифицируется автоматически. Регрессии a11y возможны.
- **Recommendation:** Добавить `lighthouse-ci` или `pa11y-ci` в CI для `dist/index.html` после сборки.

**8. Отсутствуют sitemap и structured data**
- **Evidence:** Нет `sitemap-index.xml`, нет JSON-LD разметки для Organization/Product/FAQ.
- **Impact:** SEO не максимизирован для маркетингового сайта.
- **Recommendation:** Добавить `@astrojs/sitemap` и базовый JSON-LD в `BaseLayout`.

**9. `.impeccable.md` ссылается на отсутствующий `SHAPE-BRIEF.md`**
- **Evidence:** "Design tokens — transcribed from SHAPE-BRIEF.md §4", "Do not edit individual values here. If a token needs to change, update SHAPE-BRIEF.md first".
- **Impact:** Новый разработчик/agent будет искать несуществующий файл.
- **Recommendation:** Либо добавить `SHAPE-BRIEF.md` в репо, либо заменить ссылку на `.impeccable.md` как source of truth для дизайн-токенов.

**10. `package.json#version: "0.0.0"` — бессмысленный**
- **Evidence:** Версия не отражает реальные deploy-ы, пакет private.
- **Recommendation:** Установить версию в соответствии с датой деплоя (например, `0.1.0`) или использовать `0.0.0-managed` с комментарием.

---

### Quick wins (можно сделать без продуктовых решений)

1. Удалить или отделить мёртвые компоненты (`MicroJobs`, `SnowflakeToRuntime`).
2. Проверить и устранить коллизии `data-section-num` / `id`.
3. Добавить интеграционный тест на уникальность секционных ID.
4. Запускать `astro check` в CI явно для `@rntme-cli/landing`.
5. Исправить ссылку на `SHAPE-BRIEF.md` в `.impeccable.md`.
6. Установить осмысленную версию в `package.json`.

### Изменения, требующие решения Влада

1. **Стратегия управления секциями:** Централизовать метаданные секций или оставить текущую схему с ручной синхронизацией?
2. **CONTENT.md как source of truth:** Генерировать из кода или поддерживать руками?
3. **LiveDemoCard:** Когда и как активировать `DEMO_URL`? Нужна ли отдельная страница demo вместо inline-секции?
4. **Accessibility CI:** Инвестировать в Lighthouse CI / pa11y для лендинга?
5. **SnowflakeToRuntime:** Это замена `Problem.astro` или отдельная секция? Если не используется — удалить?

---

### Что сделано хорошо (чтобы не сломать)

- Отличная документация: `.impeccable.md`, `CONTENT.md`, `DEPLOY.md` — лучший onboarding для агентов/разработчиков в обоих репо.
- Правильный выбор стека: Astro 5 + static output для маркетингового сайта; React только для интерактивных кусков (`AhaReveal`, `SideRail`).
- `env.ts` с жёсткой валидацией и fail-fast на билде — надёжно.
- `Dockerfile` с sanity-check (`test -f dist/index.html`) и `nginx -t`.
- `nginx.conf` с правильным кэшированием `_astro/` и явным `=404` (не fallback на index.html).
- Доступность: `skip-link`, `prefers-reduced-motion`, `focus-visible`, семантические заголовки и `aria-labelledby`.
- Разделение контента (MDX exports) от презентации.

---

**Файлы, упомянутые в аудите:**
- `apps/landing/src/pages/index.astro`
- `apps/landing/src/components/SideRail.tsx`
- `apps/landing/src/components/Problem.astro`, `MicroJobs.astro`, `AhaSection.astro`, `LiveDemoCard.astro`, `HowItWorks.astro`, `SnowflakeToRuntime.astro`
- `apps/landing/src/env.ts`
- `apps/landing/CONTENT.md`
- `apps/landing/.impeccable.md`
- `apps/landing/package.json`
- `apps/landing/Dockerfile`
- `.github/workflows/ci.yml` (в родительском репо)
