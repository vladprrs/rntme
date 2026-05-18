> Status: retired.
> Date: 2026-04-27.
> Current source: docs/current/owners/demo/notes-blueprint.md, docs/history/specs/active-rationale/2026-04-29-notes-demo-auth0-design.md, docs/decision-system.md, and current code/tests.
> Why retained: Execution checklist for the superseded no-auth preview deploy; use the current Notes owner doc and Auth0/ownership rationale instead.

# Notes Demo E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Прогнать первый сквозной деплой через `platform.rntme.com` против реального Dokploy на Hetzner, на минимальном Notes blueprint, с активацией merged project-deploy-flow в проде по пути.

**Architecture:** Phase 1 — авторинг блюпринта `demo/notes-blueprint/` локально + гейт через `loadComposedBlueprint`. Phase 2 — активация платформы (encryption key → submodule bump → push → auto-deploy → smoke). Phase 3 — CLI publish → UI deploy-target create → click Deploy → hard-gate проверки.

**Tech Stack:** Node 20+, pnpm 9.12+, TypeScript, `@rntme/blueprint` (validation), `@rntme/cli` (publish), `@rntme/platform-http` (control plane), `@rntme/deploy-core` + `@rntme/deploy-dokploy` (libraries used by executor), Dokploy MCP, Postgres + rustfs (existing на Hetzner).


**Out of scope for this plan:** Реализация платформенного кода (он merged), production-mode деплои, agent-browser smoke, очистка orphan rustfs blobs.

---

## File Structure

### New files (Phase 1 — Notes blueprint)

```
demo/notes-blueprint/
├── README.md                                          # описание demo
├── project.json                                       # project root
├── pdm/
│   ├── pdm.json                                       # PDM manifest
│   └── entities/
│       └── Note.json                                  # Note entity + state machine
└── services/
    └── app/
        ├── service.json                               # { kind: "domain" }
        ├── qsm/
        │   ├── qsm.json                               # QSM manifest
        │   └── projections/
        │       └── NoteView.json                      # Note projection
        ├── graphs/
        │   ├── shapes.json                            # custom output shapes used by bindings
        │   ├── createNote.json                        # command graph
        │   ├── deleteNote.json                        # command graph
        │   ├── listNotes.json                         # query graph
        │   └── getNote.json                           # query graph
        ├── bindings/
        │   └── bindings.json                          # HTTP bindings
        ├── ui/
        │   ├── manifest.json                          # UI manifest
        │   ├── layouts/
        │   │   ├── main.spec.json                     # layout spec
        │   │   └── main.screen.json                   # layout screen (empty data)
        │   └── screens/
        │       ├── home.spec.json                     # home screen elements
        │       └── home.screen.json                   # home screen data + actions
        └── seed/
            └── seed.json                              # 1 welcome event
```

### Modified files (Phase 2)

- `merged CLI/platform packages` (gitlink) — bump pointer `5d36a09` → `f9712825e414ba009738dbe8f9919fa95fcc67b5`.

### New files (Phase 3 — memory record)

- `~/.claude/projects/-home-coder-project/memory/notes_demo_deployed.md` — deployment id, edge URL, дата.
- `~/.claude/projects/-home-coder-project/memory/MEMORY.md` — pointer на новый memory.

---

## Phase 1 — Blueprint local

### Task 1.1: Project skeleton + `project.json`

**Files:**
- Create: `demo/notes-blueprint/project.json`
- Create: `demo/notes-blueprint/services/app/service.json`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p demo/notes-blueprint/{pdm/entities,services/app/{qsm/projections,graphs,bindings,ui/{layouts,screens},seed}}
```

- [ ] **Step 2: Write `project.json`**

```json
{
  "name": "notes-demo",
  "services": ["app"],
  "routes": { "ui": { "/": "app" }, "http": {} },
  "middleware": { "requestContext": { "kind": "request-context" } },
  "mounts": [{ "target": "ui:/", "use": ["requestContext"] }]
}
```

- [ ] **Step 3: Write `services/app/service.json`**

```json
{ "kind": "domain" }
```

- [ ] **Step 4: Verify directory tree**

Run: `find demo/notes-blueprint -type d`
Expected: directories listed in File Structure above.

### Task 1.2: PDM — `Note` entity with state machine

**Files:**
- Create: `demo/notes-blueprint/pdm/pdm.json`
- Create: `demo/notes-blueprint/pdm/entities/Note.json`

- [ ] **Step 1: Write `pdm/pdm.json`**

```json
{ "version": "1" }
```

- [ ] **Step 2: Write `pdm/entities/Note.json`**

```json
{
  "ownerService": "app",
  "kind": "owned",
  "table": "notes",
  "fields": {
    "id": { "type": "string", "nullable": false, "column": "id" },
    "title": { "type": "string", "nullable": false, "column": "title" },
    "body": { "type": "string", "nullable": false, "column": "body" },
    "status": { "type": "string", "nullable": false, "column": "status" },
    "createdAt": { "type": "datetime", "nullable": false, "column": "created_at", "generated": "createdAt" }
  },
  "keys": ["id"],
  "stateMachine": {
    "stateField": "status",
    "initial": null,
    "states": ["active", "deleted"],
    "transitions": {
      "create": {
        "from": null,
        "to": "active",
        "affects": ["title", "body"]
      },
      "delete": { "from": "active", "to": "deleted" }
    }
  }
}
```

### Task 1.3: QSM — `NoteView` projection

**Files:**
- Create: `demo/notes-blueprint/services/app/qsm/qsm.json`
- Create: `demo/notes-blueprint/services/app/qsm/projections/NoteView.json`

- [ ] **Step 1: Write `qsm/qsm.json`**

```json
{ "version": "1", "relations": {} }
```

- [ ] **Step 2: Write `qsm/projections/NoteView.json`**

```json
{
  "backing": "entity-mirror",
  "source": { "entity": "Note" },
  "keys": ["id"],
  "grain": ["id"],
  "exposed": ["title", "body", "status", "createdAt"]
}
```

### Task 1.4: Command and query graphs

**Files:**
- Create: `demo/notes-blueprint/services/app/graphs/shapes.json`
- Create: `demo/notes-blueprint/services/app/graphs/createNote.json`
- Create: `demo/notes-blueprint/services/app/graphs/deleteNote.json`
- Create: `demo/notes-blueprint/services/app/graphs/listNotes.json`
- Create: `demo/notes-blueprint/services/app/graphs/getNote.json`

- [ ] **Step 1: Write `graphs/shapes.json`**

`loadComposedBlueprint` requires `graphs/shapes.json` whenever a service has bindings. `NoteView` is declared here because the bindings resolver resolves output shapes from custom shapes or PDM entities, not directly from QSM projection names.

```json
{
  "NoteView": {
    "fields": {
      "id": { "type": "string", "nullable": false },
      "title": { "type": "string", "nullable": false },
      "body": { "type": "string", "nullable": false },
      "status": { "type": "string", "nullable": false },
      "createdAt": { "type": "datetime", "nullable": false }
    }
  }
}
```

- [ ] **Step 2: Write `graphs/createNote.json`**

```json
{
  "id": "createNote",
  "signature": {
    "inputs": {
      "id": { "type": "string", "mode": "required" },
      "title": { "type": "string", "mode": "required" },
      "body": { "type": "string", "mode": "required" }
    },
    "output": { "type": "row<CommandResult>", "from": "emit" }
  },
  "nodes": [
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Note",
        "aggregateId": { "$param": "id" },
        "transition": "create",
        "payload": {
          "title": { "$param": "title" },
          "body": { "$param": "body" }
        }
      }
    }
  ]
}
```

- [ ] **Step 3: Write `graphs/deleteNote.json`**

```json
{
  "id": "deleteNote",
  "signature": {
    "inputs": {
      "id": { "type": "string", "mode": "required" }
    },
    "output": { "type": "row<CommandResult>", "from": "emit" }
  },
  "nodes": [
    {
      "id": "emit",
      "type": "emit",
      "config": {
        "aggregate": "Note",
        "aggregateId": { "$param": "id" },
        "transition": "delete",
        "payload": {}
      }
    }
  ]
}
```

- [ ] **Step 4: Write `graphs/listNotes.json`**

```json
{
  "id": "listNotes",
  "signature": {
    "inputs": {
      "limit": { "type": "integer", "mode": "defaulted", "default": 100 }
    },
    "output": { "type": "rowset<NoteView>", "from": "paged" }
  },
  "nodes": [
    { "id": "items", "type": "findMany", "config": { "source": { "projection": "NoteView" } } },
    {
      "id": "filtered",
      "type": "filter",
      "config": {
        "input": "items",
        "expr": { "eq": ["noteView.status", "active"] }
      }
    },
    {
      "id": "sorted",
      "type": "sort",
      "config": {
        "input": "filtered",
        "by": [{ "field": "noteView.createdAt", "dir": "desc", "nulls": "last" }]
      }
    },
    {
      "id": "paged",
      "type": "limit",
      "config": { "input": "sorted", "count": { "$param": "limit" } }
    }
  ]
}
```

- [ ] **Step 5: Write `graphs/getNote.json`**

Query bindings currently support `rowset<...>` outputs only, so `getNote` is intentionally a singleton rowset instead of `row<...>`.

```json
{
  "id": "getNote",
  "signature": {
    "inputs": {
      "id": { "type": "string", "mode": "required" }
    },
    "output": { "type": "rowset<NoteView>", "from": "one" }
  },
  "nodes": [
    { "id": "items", "type": "findMany", "config": { "source": { "projection": "NoteView" } } },
    {
      "id": "filtered",
      "type": "filter",
      "config": {
        "input": "items",
        "expr": { "eq": ["noteView.id", { "$param": "id" }] }
      }
    },
    {
      "id": "one",
      "type": "limit",
      "config": { "input": "filtered", "count": 1 }
    }
  ]
}
```

### Task 1.5: HTTP bindings

**Files:**
- Create: `demo/notes-blueprint/services/app/bindings/bindings.json`

- [ ] **Step 1: Write `bindings/bindings.json`**

```json
{
  "version": "1.0",
  "graphSpecRef": "../graphs",
  "pdmRef": "../../pdm",
  "qsmRef": "../qsm",
  "bindings": {
    "createNote": {
      "kind": "command",
      "graph": "createNote",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "POST",
        "path": "/notes",
        "parameters": [
          { "name": "id", "in": "body", "bindTo": "id", "required": true },
          { "name": "title", "in": "body", "bindTo": "title", "required": true },
          { "name": "body", "in": "body", "bindTo": "body", "required": true }
        ]
      }
    },
    "deleteNote": {
      "kind": "command",
      "graph": "deleteNote",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "POST",
        "path": "/notes/{id}/actions/delete",
        "parameters": [{ "name": "id", "in": "path", "bindTo": "id", "required": true }]
      }
    },
    "listNotes": {
      "kind": "query",
      "graph": "listNotes",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "GET",
        "path": "/notes",
        "parameters": [{ "name": "limit", "in": "query", "bindTo": "limit", "required": false }]
      }
    },
    "getNote": {
      "kind": "query",
      "graph": "getNote",
      "target": { "engine": "sqlite", "dialect": "sqlite" },
      "http": {
        "method": "GET",
        "path": "/notes/{id}",
        "parameters": [{ "name": "id", "in": "path", "bindTo": "id", "required": true }]
      }
    }
  }
}
```

### Task 1.6: UI — manifest, layout, home screen

**Files:**
- Create: `demo/notes-blueprint/services/app/ui/manifest.json`
- Create: `demo/notes-blueprint/services/app/ui/layouts/main.spec.json`
- Create: `demo/notes-blueprint/services/app/ui/layouts/main.screen.json`
- Create: `demo/notes-blueprint/services/app/ui/screens/home.spec.json`
- Create: `demo/notes-blueprint/services/app/ui/screens/home.screen.json`

- [ ] **Step 1: Write `ui/manifest.json`**

```json
{
  "version": "2.0",
  "pdmRef": "../../pdm",
  "qsmRef": "../qsm",
  "graphSpecRef": "../graphs",
  "bindingsRef": "../bindings",
  "metadata": { "title": "Notes" },
  "layouts": {
    "main": "layouts/main"
  },
  "routes": {
    "/": {
      "layout": "main",
      "screen": "screens/home"
    }
  }
}
```

- [ ] **Step 2: Write `ui/layouts/main.spec.json`**

```json
{
  "root": "shell",
  "elements": {
    "shell": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "lg" },
      "children": ["header"]
    },
    "header": {
      "type": "Heading",
      "props": { "level": 1, "text": "Notes" }
    }
  }
}
```

- [ ] **Step 3: Write `ui/layouts/main.screen.json`**

```json
{}
```

- [ ] **Step 4: Write `ui/screens/home.spec.json`**

```json
{
  "root": "page",
  "elements": {
    "page": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "lg" },
      "children": ["create-section", "delete-section", "list-section"]
    },
    "create-section": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "md" },
      "children": ["create-heading", "field-id", "field-title", "field-body", "submit-btn"]
    },
    "create-heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "New note" }
    },
    "field-id": {
      "type": "Input",
      "props": { "label": "ID", "name": "id", "value": { "$bindState": "/form/id" } }
    },
    "field-title": {
      "type": "Input",
      "props": { "label": "Title", "name": "title", "value": { "$bindState": "/form/title" } }
    },
    "field-body": {
      "type": "Input",
      "props": { "label": "Body", "name": "body", "value": { "$bindState": "/form/body" } }
    },
    "submit-btn": {
      "type": "Button",
      "props": { "label": "Add", "variant": "primary" },
      "on": { "press": { "action": "dispatch", "params": { "name": "createNote" } } }
    },
    "delete-section": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "md" },
      "children": ["delete-heading", "field-delete-id", "delete-btn"]
    },
    "delete-heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "Delete note" }
    },
    "field-delete-id": {
      "type": "Input",
      "props": { "label": "ID", "name": "deleteId", "value": { "$bindState": "/form/deleteId" } }
    },
    "delete-btn": {
      "type": "Button",
      "props": { "label": "Delete", "variant": "secondary" },
      "on": { "press": { "action": "dispatch", "params": { "name": "deleteNote" } } }
    },
    "list-section": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "md" },
      "children": ["list-heading", "notes-list"]
    },
    "list-heading": {
      "type": "Heading",
      "props": { "level": 2, "text": "All notes" }
    },
    "notes-list": {
      "type": "Stack",
      "props": { "direction": "vertical", "gap": "sm" },
      "children": ["note-card"],
      "repeat": { "statePath": "/data/notes" }
    },
    "note-card": {
      "type": "Card",
      "props": { "title": { "$item": "title" } },
      "children": ["note-row"]
    },
    "note-row": {
      "type": "Stack",
      "props": { "direction": "horizontal", "gap": "sm" },
      "children": ["note-id", "note-body", "note-date"]
    },
    "note-id": {
      "type": "Badge",
      "props": { "text": { "$item": "id" }, "variant": "outline" }
    },
    "note-body": {
      "type": "Text",
      "props": { "text": { "$item": "body" } }
    },
    "note-date": {
      "type": "Badge",
      "props": { "text": { "$item": "createdAt" }, "variant": "secondary" }
    }
  }
}
```

- [ ] **Step 5: Write `ui/screens/home.screen.json`**

```json
{
  "metadata": { "title": "Home" },
  "data": {
    "/data/notes": {
      "binding": "listNotes",
      "refetchOn": ["mount"]
    }
  },
  "actions": {
    "createNote": {
      "kind": "command",
      "binding": "createNote",
      "paramsFromState": {
        "id": "/form/id",
        "title": "/form/title",
        "body": "/form/body"
      },
      "onSuccess": { "refetchData": ["/data/notes"] },
      "onError": { "showAlert": true }
    },
    "deleteNote": {
      "kind": "command",
      "binding": "deleteNote",
      "paramsFromState": { "id": "/form/deleteId" },
      "onSuccess": { "refetchData": ["/data/notes"] },
      "onError": { "showAlert": true }
    }
  }
}
```

This deliberately follows the existing issue-tracker UI fixtures: `paramsGenerated`, `paramsFromArgs`, and `refetchOn: ["after:<action>"]` are not current UI-runtime contracts. Per-row delete buttons can be a follow-up after item-bound action args exist; this e2e still proves create/delete commands through the declarative UI by entering the note id.

### Task 1.7: Seed event

**Files:**
- Create: `demo/notes-blueprint/services/app/seed/seed.json`

- [ ] **Step 1: Write `seed/seed.json`**

```json
{
  "seedVersion": 1,
  "events": [
    {
      "id": "seed:Note:welcome:v1",
      "subject": "Note-00000000-0000-0000-0000-000000000001",
      "rntAggregateType": "Note",
      "rntAggregateId": "00000000-0000-0000-0000-000000000001",
      "rntVersion": 1,
      "eventType": "NoteCreate",
      "data": {
        "title": "Welcome",
        "body": "First note from seed"
      },
      "time": "2026-04-27T00:00:00.000Z",
      "rntSchemaVersion": 1
    }
  ]
}
```

- [ ] **Step 2: Verify `eventType` convention**

Current convention is `PascalCase(entity) + PascalCase(transition)`, implemented by `packages/artifacts/pdm/src/derive/event-types.ts` and mirrored in `packages/artifacts/graph-ir-compiler/src/emit/event-type.ts`, so transition `create` on `Note` is `NoteCreate`. Do not use `NoteCreated`; seed validation will reject it.

### Task 1.8: README for the demo

**Files:**
- Create: `demo/notes-blueprint/README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# notes-demo blueprint

Минимальный project-first blueprint для e2e прогона deploy-flow в проде.

## Что внутри

Один сервис `app` с одной сущностью `Note`. Две команды (`createNote`, `deleteNote`), две query (`listNotes`, `getNote`), один UI screen на `/` с формой и списком.

## Локальная валидация

```bash
pnpm install --frozen-lockfile
pnpm --filter @rntme/blueprint... build
pnpm --filter @rntme/blueprint exec node --input-type=module -e "import { loadComposedBlueprint } from '@rntme/blueprint'; \
  const r = loadComposedBlueprint('../../demo/notes-blueprint'); \
  if (!r.ok) { console.error(JSON.stringify(r.errors, null, 2)); process.exit(1); } \
  console.log('ok:', Object.keys(r.value));"
```

Должно вывести `ok: [...]`.

## Spec

```

### Task 1.9: Local validation gate

**Files:**
- Run: `loadComposedBlueprint('demo/notes-blueprint')`

- [ ] **Step 1: Run the loader**

```bash
cd /home/coder/work/rntme
pnpm install --frozen-lockfile
pnpm --filter @rntme/blueprint... build
pnpm --filter @rntme/blueprint exec node --input-type=module -e "import { loadComposedBlueprint } from '@rntme/blueprint'; \
  const r = loadComposedBlueprint('../../demo/notes-blueprint'); \
  if (!r.ok) { console.error('FAIL:', JSON.stringify(r.errors, null, 2)); process.exit(1); } \
  console.log('OK:', Object.keys(r.value));"
```

Expected: `OK: [<list of composed-model keys>]` and exit 0.

- [ ] **Step 2: If FAIL — fix and re-run**

Прочитать `r.errors`, найти соответствующий JSON в `demo/notes-blueprint/`, поправить (типичные причины: опечатка в ref-пути; отсутствие обязательного поля; несовпадение `rowset<Note>` vs реальное имя проекции/сущности; невыставленный `target.engine` на query binding). Повторить Step 1, пока не зелёное.

**Гейт:** не идти к Task 1.10 (commit), и тем более к Phase 2, пока этот шаг не вернул `OK`.

### Task 1.10: Commit Phase 1

- [ ] **Step 1: Stage and commit**

```bash
cd /home/coder/work/rntme
git add demo/notes-blueprint/
git status --short
git commit -m "feat(demo): add notes-blueprint for e2e deploy walkthrough

Minimal project-first blueprint: 1 service, 1 entity (Note), 2
commands, 2 queries, 1 UI screen. Validated locally via
loadComposedBlueprint. Prepared for Phase 2 (platform activation)
and Phase 3 (e2e walkthrough) per spec

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 2: Verify**

```bash
git log -1 --stat
```

Expected: commit added with all `demo/notes-blueprint/**` files.

---

## Phase 2 — Platform activation

### Task 2.1: Generate encryption key

- [ ] **Step 1: Generate**

```bash
openssl rand -hex 32
```

Output: 64 hex chars on a single line. **Не вставлять в shared контексты, не записывать в файлы внутри репозитория, не сохранять в claude memory.**

- [ ] **Step 2: Save offline**

Сохранить ключ в личной заметке вне репозитория (например, password manager) с меткой `rntme platform.rntme.com PLATFORM_SECRET_ENCRYPTION_KEY key_version=1, generated 2026-04-27`.

- [ ] **Step 3: Hold key in current shell only**

```bash
export RNTME_KEY=<paste-key-here>
echo "${#RNTME_KEY}"   # must print 64
```

Expected: `64`.

### Task 2.2: Set env var on platform-http via Dokploy MCP

**Files:**
- Resource: platform-http application in Dokploy (id from `~/.claude/projects/-home-coder-project/memory/project_platform_deployed.md`).

- [ ] **Step 1: Look up app id**

Read `~/.claude/projects/-home-coder-project/memory/project_platform_deployed.md` и достать app id для `platform-http`.

- [ ] **Step 2: Obtain the complete current env block**

Context7 check (`/dokploy/mcp`, 2026-04-27) and the installed MCP tool list confirm `application.saveEnvironment`, but this workspace does **not** expose a safe `application.one` / env-read tool. `application.saveEnvironment` writes the env block; using it with only the new key can wipe existing secrets.

Get the full existing `platform-http` env block from a secure source before continuing:
- preferred: Dokploy UI, copied locally only;
- acceptable: a local private memory file if it already contains the complete env;
- not acceptable: reconstructing env from chat, terminal logs, or partial guesses.

If the full current env cannot be obtained without exposing secrets, stop and ask Vlad for a secure handoff. Do **not** call `application.saveEnvironment` with a partial env.

- [ ] **Step 3: Append `PLATFORM_SECRET_ENCRYPTION_KEY` к существующим env**

Через Dokploy MCP `application.saveEnvironment` / installed tool `application_saveEnvironment`:

```json
{
  "applicationId": "<platform-http-app-id>",
  "env": "<complete-existing-env>\nPLATFORM_SECRET_ENCRYPTION_KEY=${RNTME_KEY}",
  "buildArgs": null,
  "buildSecrets": null,
  "createEnvFile": false
}
```

Существующие env-vars должны остаться.

- [ ] **Step 4: Verify (без выводa самого ключа)**

```bash
# через Dokploy UI проверить наличие имени переменной (не значения)
# не печатать env block в терминал или комментарии
```

Expected: переменная присутствует. **Не печатать значение в чат.**

### Task 2.3: Bump submodule merged CLI/platform packages

- [ ] **Step 1: Fetch and checkout target SHA**

```bash
cd /home/coder/work/rntme
git fetch origin
git checkout f9712825e414ba009738dbe8f9919fa95fcc67b5
git log -1 --oneline
```

Expected: `f971282 Merge pull request #13 from vladprrs/fix/rnt153-stabilize-ci`.

- [ ] **Step 2: Stage submodule pointer in parent**

```bash
cd /home/coder/work/rntme
git add apps packages/deploy packages/platform
git diff --staged --stat
```

Expected: `1 file changed` showing `merged CLI/platform packages` gitlink update.

### Task 2.4: Commit submodule bump

- [ ] **Step 1: Commit**

```bash
cd /home/coder/work/rntme
git commit -m "chore: bump merged CLI/platform packages to f971282 (project deploy flow live)

Activates merged Track 1 + Track 2 (PR #9, #10 in merged CLI/platform packages)
plus stabilization fixes (#11, #12, #13). Pre-stable platform,
single submodule bump in main per spec

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
git log -2 --oneline
```

Expected: two recent commits — Phase 1 demo blueprint + this bump.

### Task 2.5: Push parent main and observe Dokploy auto-deploy

**Action:** push triggers Dokploy watchPaths → `platform-http` redeploy.

- [ ] **Step 1: Push**

```bash
cd /home/coder/work/rntme
git push origin main
```

- [ ] **Step 2: Watch Dokploy auto-deploy**

Через доступный Dokploy surface смотреть последний deployment. В этом workspace MCP exposes `application.deploy`, `application.redeploy`, `project.*`, `application.saveEnvironment`, но не documented/readable `application_deployments` или `application_readLogs`; если таких инструментов нет в клиенте, использовать Dokploy UI для статуса/логов и записать fallback в финальном комментарии. Дождаться статуса `done` / `success` (или эквивалент). Таймаут — не более ~5 минут.

- [ ] **Step 3: Если деплой failed — read container logs**

Через Dokploy UI или доступный MCP logs tool, если он есть в конкретном клиенте. Искать в логах:
- `parseEnv` errors → env var проблема. Чинить через Task 2.2 повторно.
- `runMigrations` errors → FK / ad-hoc fix через psql. Затем `application.redeploy` / installed tool `application_redeploy({ "applicationId": "<...>" })`.
- Hono port bind / ENOENT → читать stack trace, диагностировать конкретно.

Экспонента возврата: чиним → повторный auto-deploy (или ручной `application_redeploy`) → Step 2.

**Гейт:** не идти к Task 2.6 пока deployment не `success` И в логах есть `Listening on :<port>` (или эквивалент Hono startup-сигнал).

### Task 2.6: Smoke check 1 — `/v1/auth/whoami` returns 401

- [ ] **Step 1: Curl без токена**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://platform.rntme.com/v1/auth/whoami
```

Expected: `401`.

- [ ] **Step 2: Если не 401**

- `200` → Hono не валидирует токен (баг).
- `502/503/504` → upstream не доступен; вернись к Task 2.5 Step 3.
- Другое → диагностируй и не двигайся дальше.

### Task 2.7: Smoke check 2 — new tables present, legacy absent

- [ ] **Step 1: Open psql via Dokploy MCP shell on postgres container**

Через Dokploy MCP `database_one` найти Postgres container id, затем shell:

```bash
psql $DATABASE_URL -c "\dt" 
```

Или, если MCP даёт `database_query`-эндпоинт:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

- [ ] **Step 2: Assertions**

Expected:
- Присутствуют: `project_version`, `deploy_target`, `deployment`, `deployment_log_line`.
- Отсутствуют: `service`, `artifact_version`, `artifact_tag`.

Если хоть одно расхождение — Task 2.5 Step 3.

### Task 2.8: Smoke check 3 — UI Deploy Targets renders

- [ ] **Step 1: Login as test user**

Открыть `https://platform.rntme.com/login` в браузере, нажать «Sign in», ввести `test@rntme.com` + пароль (предоставлен пользователем в чате — не сохранять в репо/memory).

- [ ] **Step 2: Navigate to Deploy Targets page**

URL: `https://platform.rntme.com/{org}/deploy-targets` (где `{org}` — slug органзации, виден в шапке после логина).

Expected:
- Страница рендерится без ошибок.
- Видна пустая таблица или плейсхолдер «no targets yet».
- Если у юзера scope `deploy:target:manage` — кнопка `[+ New target]` присутствует.

- [ ] **Step 3: Если test user не имеет scope `deploy:target:manage`**

Это блокер для Task 3.8 (создание deploy-target). Реакция:
- Через psql добавить test user'у admin role в org (только pre-stable; если бы был prod — отдельный спек). SQL: `UPDATE membership_mirror SET role='admin' WHERE account_id = (SELECT id FROM account WHERE email='test@rntme.com');` (имена таблиц проверять `\d` перед update).
- ИЛИ использовать основной admin-аккаунт пользователя для Phase 3, но это уже не «через test юзера».

Решение принять по факту, записать в memory если пришлось править роль.

### Task 2.9: Smoke check 4 — OpenAPI lists deploy-targets

- [ ] **Step 1: Curl `/openapi.json`**

```bash
curl -s https://platform.rntme.com/openapi.json | jq '.paths | keys[] | select(test("deploy-targets|deployments|project.*versions"))'
```

Expected: видны строки вида:
- `/v1/orgs/{slug}/deploy-targets`
- `/v1/orgs/{slug}/deploy-targets/{tslug}`
- `/v1/projects/{slug}/versions`
- `/v1/projects/{slug}/deployments`

Если ни одной из них не вернулось — старый код всё ещё в проде; вернись в Task 2.5.

**Гейт Phase 2:** все 4 smoke checks (2.6–2.9) зелёные → переход к Phase 3.

---

## Phase 3 — E2E walkthrough

### Task 3.1: Build CLI

- [ ] **Step 1: Install + build**

```bash
cd /home/coder/work/rntme
pnpm install --frozen-lockfile
pnpm -F @rntme/cli build
```

Expected: успешный install, успешный build (`tsc` без ошибок).

- [ ] **Step 2: Setup alias**

```bash
alias rntme="node /home/coder/work/rntme/apps/cli/dist/bin/rntme.js"
rntme --version
```

Expected: версия выводится без ошибок.

### Task 3.2: `rntme login`

- [ ] **Step 1: Run login**

```bash
rntme login
```

Expected: prompt типа «paste token from /tokens» или «open URL для WorkOS». Если URL — открыть в браузере, залогиниться через test@rntme.com или admin аккаунт; вернуться в CLI и paste-нуть код/токен.

- [ ] **Step 2: Verify**

```bash
rntme whoami
cat ~/.rntme/credentials.json | jq 'keys'
```

Expected: `whoami` показывает email + org slug + scopes; credentials.json содержит ключи `token`, `org`, `email` (или эквивалент).

### Task 3.3: Create project on platform

- [ ] **Step 1: Run create**

```bash
rntme project create notes-demo
```

Expected: вывод вида `Created project: notes-demo (id <uuid>)`.

- [ ] **Step 2: Verify in UI**

Открыть `https://platform.rntme.com/{org}/projects` — проект `notes-demo` присутствует в списке.

### Task 3.4: Re-validate blueprint locally (freshness)

- [ ] **Step 1: Re-run loader**

```bash
cd /home/coder/work/rntme
pnpm --filter @rntme/blueprint... build
pnpm --filter @rntme/blueprint exec node --input-type=module -e "import { loadComposedBlueprint } from '@rntme/blueprint'; \
  const r = loadComposedBlueprint('../../demo/notes-blueprint'); \
  if (!r.ok) { console.error('FAIL:', JSON.stringify(r.errors, null, 2)); process.exit(1); } \
  console.log('OK:', Object.keys(r.value));"
```

Expected: `OK: [...]`. Если FAIL — тот же fix-loop что в Task 1.9. Не идти к Task 3.5 пока зелёное.

### Task 3.5: `rntme project publish`

- [ ] **Step 1: Run publish**

```bash
cd /home/coder/work/rntme
rntme project publish --folder demo/notes-blueprint
```

Expected: вывод вида `Published as version #1, digest sha256:<short>`.

- [ ] **Step 2: Verify в UI**

Открыть `https://platform.rntme.com/{org}/projects/notes-demo` — секция Versions содержит запись `#1` с digest и timestamp.

- [ ] **Step 3: Idempotency check**

```bash
rntme project publish --folder demo/notes-blueprint
```

Expected: `Already published as version #1` (или эквивалент). Это проверка что server-side идемпотентность по digest работает.

### Task 3.6: Create Dokploy `rntme-demos` project via MCP

- [ ] **Step 1: Create via MCP**

Через Dokploy MCP `project.create` / installed tool:

```json
{
  "name": "rntme-demos",
  "description": "Sandbox for rntme demo deployments",
  "env": ""
}
```

**Этот project отдельный от того, где хостится `platform-http` сам — изоляция blast radius.**

- [ ] **Step 2: Capture project id**

Сохранить `dokployProjectId` локально в текущей сессии (не в memory, не в файлы репо).

### Task 3.7: Generate Dokploy API token for the new project

- [ ] **Step 1: Через Dokploy UI или MCP создать новый API token**

Scope — минимальный: создание/правка apps + databases в `rntme-demos` project. **Не реюзаем токен от `application-one` или от platform-http auto-deploy.**

- [ ] **Step 2: Capture token**

Сохранить локально в текущей сессии. Не вставлять в чат, не сохранять в memory или репо. Этот токен сейчас потребуется для Task 3.8.

### Task 3.8: Create deploy-target in platform UI

- [ ] **Step 1: Navigate**

`https://platform.rntme.com/{org}/deploy-targets` → `[+ New target]`.

- [ ] **Step 2: Fill form**

| Поле | Значение |
|---|---|
| `slug` | `dokploy-demos` |
| `displayName` | `Demos Dokploy (Hetzner)` |
| `kind` | `dokploy` |
| `dokployUrl` | `https://<dokploy-host>` (без `/api`, по `dokploy_mcp_url_gotcha.md`) |
| `dokployProjectId` | `<id from Task 3.6>` |
| `allowCreateProject` | false |
| `apiToken` | `<token from Task 3.7>` |
| `eventBus` | `{ "kind": "kafka", "brokers": ["redpanda:9092"], "topicPrefix": "rntme-notes-demo" }` |
| `policyValues` | `{ "rateLimit": { "default": { "requestsPerMinute": 60, "burst": 20 } }, "bodyLimit": { "default": { "maxBodySize": "2m" } }, "timeout": { "default": { "upstreamTimeoutMs": 30000 } } }` |
| `isDefault` | true |

- [ ] **Step 3: Submit**

Expected: 201, появилась строка в списке, `apiToken: ***` (редактирована).

- [ ] **Step 4: Verify**

Открыть detail page `dokploy-demos`: все поля кроме токена видны.

### Task 3.9: Trigger deployment from UI

- [ ] **Step 1: Navigate to project version**

`https://platform.rntme.com/{org}/projects/notes-demo/versions/1`.

- [ ] **Step 2: Click `[Deploy]`**

В форме:
- `target`: предзаполнен `dokploy-demos`.
- `configOverrides`: `{}`.

Submit.

Expected: `303 Redirect` на `https://platform.rntme.com/{org}/projects/notes-demo/deployments/<deployment-id>`.

### Task 3.10: Watch deployment to terminal — assert `succeeded`

- [ ] **Step 1: Stay on deployment detail page**

Страница автоматически делает `htmx polling` `/logs?sinceLineId=` каждые 2 сек. Видны записи с шагами `init` → `plan` → `render` → `apply` → `verify` → `finalize`.

- [ ] **Step 2: Wait for terminal status**

Дождаться status badge один из: `succeeded`, `succeeded_with_warnings`, `failed`, `failed_orphaned`.

- [ ] **Step 3: Hard gate — must be `succeeded`**

| Финальный статус | Реакция |
|---|---|
| `succeeded` | переход к Task 3.11 |
| `succeeded_with_warnings` | **провал hard gate**. Прочитать `warnings` секцию, открыть follow-up issue, остановиться. |
| `failed` | прочитать `error_code` + `error_message` + `errors[]`. Открыть follow-up issue. Остановиться. |
| `failed_orphaned` | смотреть логи `platform-http` в Dokploy — реальный stack trace там. Открыть follow-up. |

### Task 3.11: Open edge URL — verify Notes UI renders

- [ ] **Step 1: Read `urls.publicRoutes` в Apply result section**

В UI deployment detail, скопировать первую строку из `urls.publicRoutes` (это edge URL, пробрасываемый nginx'ом до сервиса `app`).

- [ ] **Step 2: Open in fresh browser tab**

Открыть скопированный URL.

Expected:
- HTML грузится, нет 5xx.
- Видно `<h1>Notes</h1>`.
- Видна форма создания с полями `ID`, `Title`, `Body` и кнопкой `Add`.
- Видна форма удаления с полем `ID` и кнопкой `Delete`.
- Видна одна заметка из seed: `Welcome / First note from seed / 2026-04-27...`.
- В DevTools Console — нет красных ошибок.

- [ ] **Step 3: Если HTML рендерится но fetch-и падают**

DevTools → Network → проверить запросы к `/notes` (или `/api/notes`). Возможные причины:
- 404 → bindings не маршрутизируются edge-nginx'ом. Реакция: добавить `routes.http: { "/api": "app" }` в `project.json`, обновить bindings paths на `/api/notes`, перепаблишить новую версию (Task 3.5), повторить Task 3.9 + 3.11.
- 500 → читать platform/app логи через Dokploy MCP. Открыть follow-up.
- CORS / no response → проверить nginx config через Dokploy.

### Task 3.12: UI test — create new note

- [ ] **Step 1: Fill form and submit**

В UI ввести `id=e2e-note-1`, `title=Test note`, `body=Hello from e2e`, нажать `Add`.

Expected:
- DevTools Network: `POST /notes` (или `/api/notes`) → 2xx.
- После success: вызывается `GET /notes` (refetch) → 2xx с массивом.
- В UI новая заметка появилась в списке (она же — первая по сортировке, так как `createdAt desc`).
- В списке виден id `e2e-note-1`.

- [ ] **Step 2: Если что-то не сработало**

- POST 4xx → читать body, возможно невалидный payload. Проверить bindings shape и UI action.
- POST 2xx но рефетч не пришёл → проверить `onSuccess.refetchData` в `home.screen.json`.
- Refetch 2xx но в списке нет — значит проекция NoteView не подобрала событие. Смотреть platform/app логи (projection-consumer step). Открыть follow-up.

### Task 3.13: UI test — delete welcome note

- [ ] **Step 1: Enter welcome id and click Delete**

В поле удаления ввести `00000000-0000-0000-0000-000000000001`, нажать `Delete`.

Expected:
- DevTools Network: `POST /notes/00000000-0000-0000-0000-000000000001/actions/delete` (или `/api/...`) → 2xx.
- После success: `GET /notes` → массив без welcome.
- Welcome пропадает из списка.

- [ ] **Step 2: Если не пропадает**

- 2xx но не пропадает → проверить filter `noteView.status='active'` в `listNotes` graph; возможно проекция не отметила event как `delete`. Логи projection-consumer.
- 4xx/5xx — читать тело ответа.

### Task 3.14: UI test — reload page persists state

- [ ] **Step 1: Reload (Cmd+R / F5)**

Expected: страница перезагружается, в списке только заметка из Task 3.12 (welcome удалён, новая заметка осталась). Состояние сохранилось через event store + projection.

- [ ] **Step 2: Если состояние «забылось»**

- Если списка нет вообще → проверить что `listNotes` биндинг резолвится после reload (network tab).
- Если список содержит welcome обратно — это значит state не пишется (event store не fsynced или crash) или не читается (проекция reset на каждый старт). Открыть follow-up.

### Task 3.15: Hard-gate evaluation + memory record

- [ ] **Step 1: Verify all hard-gate items**

Перепроверить (из `5.3` спека):
1. `deployments.status = 'succeeded'`. ✓ из Task 3.10.
2. `verification_report.checks` все `ok=true`, `partialOk=false`. — открыть deployment detail, секция Verification report.
3. Edge URL отдаёт UI без console errors. ✓ из Task 3.11.
4. Создание заметки → POST 2xx → видна в `listNotes`. ✓ из Task 3.12.
5. Удаление → 2xx → пропадает. ✓ из Task 3.13.
6. Reload — состояние сохранилось. ✓ из Task 3.14.

Все 6 истинны → e2e ПРОЙДЕН. Любой пункт false → e2e НЕ пройден.

- [ ] **Step 2: Save memory record (если пройден)**

Создать `~/.claude/projects/-home-coder-project/memory/notes_demo_deployed.md`:

```markdown
---
name: Notes demo e2e deploy live
description: First end-to-end deploy run on platform.rntme.com — Notes demo, Dokploy rntme-demos project, succeeded gate
type: project
---

Notes demo развёрнут через `platform.rntme.com` 2026-04-27.

- Deployment id: `<id-from-task-3.10>`
- Project version: `#1`, digest `sha256:<short>`
- Deploy target: `dokploy-demos` (Hetzner Dokploy, project `rntme-demos`)
- Edge URL: `<url-from-task-3.11>`
- Hard gate: PASSED (succeeded, не succeeded_with_warnings)

**Why:** первый успешный сквозной прогон активированного project-deploy-flow в проде; служит примером и доказательством работоспособности стека.

**How to apply:** при необходимости показать «вот так выглядит работающий рантайм» — открывать edge URL. При диагностике регрессий — стартовая точка для сравнения. Деплой оставлен живым специально.
```

- [ ] **Step 3: Add pointer in MEMORY.md**

В `~/.claude/projects/-home-coder-project/memory/MEMORY.md` добавить строку:

```
- [notes_demo_deployed.md](notes_demo_deployed.md) — Notes demo e2e живёт на Hetzner Dokploy с 2026-04-27, edge URL/deployment id для регрессий
```

- [ ] **Step 4: (Optional) Screenshot for landing/PR**

Снять скриншот UI (форма + список с одной заметкой), положить как PNG для будущих маркетинговых материалов. Опционально — не блокер.

---

## Self-Review Checklist (для исполнителя плана)

После прохождения всех задач:
1. **Phase 1 gate:** `loadComposedBlueprint('demo/notes-blueprint')` returned `ok: true`. ✓
2. **Phase 2 gate:** все 4 smoke checks (2.6–2.9) зелёные. ✓
3. **Phase 3 hard gate:** все 6 пунктов из 5.3 спека истинны. ✓
4. Memory `notes_demo_deployed.md` обновлён. ✓
5. Submodule pointer на `f9712825e414ba009738dbe8f9919fa95fcc67b5`, parent main pushed. ✓
6. Encryption key сохранён офлайн. ✓
7. Dokploy `rntme-demos` project виден в Dokploy MCP, deploy-target `dokploy-demos` виден в platform UI. ✓

Любой пункт false → деплой не считается «прошедшим e2e», открыть follow-up issue, не записывать «успех» в memory/landing.
