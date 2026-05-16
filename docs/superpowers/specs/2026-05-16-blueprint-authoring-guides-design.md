# Blueprint Authoring Guides Design

## Goal

Turn `docs/current/guides` into a practical guide set for an external coding agent
that needs to author a working rntme blueprint for a product task.

The guide set should answer the agent's authoring questions:

- which blueprint files to create;
- which artifacts own which behavior;
- which JSON shapes and validation constraints matter while authoring;
- which existing examples to copy from;
- which local verification commands prove the blueprint composes.

Owner docs under `docs/current/owners/**` remain the current-state source of
truth for package internals, APIs, invariants, and where-to-look-first pointers.
The guides are task-oriented authoring playbooks, not replacement package
reference docs.

## Scope

The guide set covers third-party blueprint authoring only:

- project directory structure;
- `project.json` routing and service declarations at authoring level;
- project-level PDM entities, fields, relations, keys, state machines, and
  event-type consequences;
- service-level QSM entity-mirror projections and QSM `relations`;
- Graph IR read/query graphs;
- Graph IR action/operation graphs;
- HTTP bindings over Graph IR operations;
- JSON UI artifacts;
- project workflows that map BPMN service tasks to action bindings;
- seed artifacts when useful for local data;
- runnable examples and local composition checks.

The guide set explicitly excludes:

- deploy planning, deploy execution, Dokploy, targets, and production rollout;
- module authoring. Guides may mention that identity, storage, AI/LLM, CRM, and
  other capabilities exist as modules behind canonical contracts, but they do not
  teach how to build modules;
- native service handlers as an authoring path for third-party blueprints.

## Native Handler Stance

External blueprints must not use `operations.json`, `handlers/*.ts`, or bindings
with `target.engine: "native"`.

Native handlers currently exist as an internal/platform escape hatch. They are
implemented as TypeScript functions referenced from `operations.json`, loaded by
the runtime, and dispatched by `NativeOperationExecutor`. This path bypasses the
main artifact-first model:

- behavior lives in arbitrary code instead of Graph IR;
- the binding validator synthesizes a placeholder signature instead of resolving
  a real graph;
- Graph IR effect validation, ownership checks, node inspection, and operation
  compile-time guarantees do not describe the real behavior;
- missing handlers are runtime failures rather than normal artifact validation
  failures.

This conflicts with the decision-system direction for AI-authorable,
inspectable, repeatable blueprints. The guides should mention native handlers
only in a short "Do not use" section and point readers to owner docs if they are
working on platform internals.

Workflow native tasks follow the same policy for external blueprints: author
workflow service tasks that call action bindings; do not document `nativeTasks`
as a third-party authoring mechanism.

## Guide Set

Use the compact guide-set approach: one entrypoint plus narrow guides for each
authoring surface.

### `blueprint-authoring.md`

Primary entrypoint for external agents. It should define the recommended
authoring order:

1. restate the product task as domain entities, user-facing screens, and
   operations;
2. create the project shell and service layout;
3. author PDM;
4. author QSM mirrors and relations;
5. author Graph IR read and action operations;
6. expose operations through bindings;
7. author UI screens and actions when the task needs UI;
8. add workflows or seed only when the task needs them;
9. run local composition checks.

It should also contain the cross-cutting rules:

- artifacts are JSON;
- source of truth is the blueprint folder;
- Graph IR operations are the behavior path;
- no native handlers;
- modules are mentioned but not taught;
- deploy is out of scope;
- prefer existing demo blueprints and tests as examples.

### `project-structure-authoring.md`

Explains the file layout a third-party agent should create:

- `project.json`;
- `pdm/pdm.json` and `pdm/entities/*.json`;
- `services/<svc>/service.json`;
- optional `services/<svc>/qsm/qsm.json` and `qsm/projections/*.json`;
- optional `services/<svc>/graphs/shapes.json` and `graphs/*.json`;
- optional `services/<svc>/bindings/bindings.json`;
- optional `services/<svc>/ui/...`;
- optional `services/<svc>/seed/seed.json`;
- optional project-level `workflows/workflows.json` and BPMN files.

This guide should show the smallest useful domain-service skeleton and link to
current demo blueprints for fuller examples.

### `pdm-authoring.md`

Task-oriented PDM authoring guide:

- entity-per-file layout;
- scalar fields and SQL columns;
- keys;
- relations;
- generated fields;
- state-machine authoring;
- event-type consequences of transitions;
- common validator failures and how to repair them.

It should steer authors toward explicit state machines for mutable domain
entities and explain that QSM entity-mirror projections require state-machine
entities.

### `qsm-authoring.md`

Task-oriented QSM authoring guide:

- `entity-mirror` projections;
- `keys`, `grain`, `exposed`, `table`;
- current `relations` map, not the removed `relationRoles` field;
- relation parity with PDM;
- dot-navigation prerequisites for Graph IR;
- `many` cardinality caveat: it can parse/validate but cannot be lowered for
  SQL dot-nav.

### `graph-ir-query-authoring.md`

Read/query Graph IR guide for data retrieval:

- one graph per compile/runtime operation;
- signatures, inputs, outputs, shapes;
- `findMany`, `findOne`, `filter`, `map`, `reduce`, `sort`, `limit`;
- expression grammar and dot paths;
- `predicate_optional`, `defaulted`, `nullable`, and parameter ordering;
- result cardinality expectations for read bindings.

This guide replaces the stale broad `graph-ir-authoring.md` query portions.

### `graph-ir-operation-authoring.md`

Action/operation Graph IR guide for behavior:

- `result` node requirement;
- `call` nodes for module/service operations;
- `branch` with exactly one default case;
- `uuid`;
- `emit` and PDM state-machine transitions;
- `$param`, `$ref`, `$node`, and `$literal` usage;
- exposure/effect constraints;
- local read + emit patterns;
- no native handlers.

The guide should use current operation tests and demos as source examples.

### `bindings-authoring.md`

Update the existing guide to current binding reality:

- each binding declares `exposure: "read" | "action"`;
- `graph` points to a Graph IR operation;
- `target` remains present, but external authoring uses Graph IR targets, not
  `engine: "native"`;
- `http.parameters` for path/query/body;
- `inputFrom` for headers/query/body/form/bodyBytes when appropriate;
- `response` for custom JSON or redirects;
- output supports `row<Shape>` and `rowset<Shape>`;
- action bindings normally use POST; GET actions are reserved for redirect-style
  callbacks;
- action bindings cannot bind graph inputs from query parameters.

Existing examples should be refreshed so they include `exposure` and real
operation-era behavior.

### `ui-authoring.md`

Task-oriented UI authoring guide:

- `manifest.json`;
- `layouts/*.spec.json` + `layouts/*.screen.json`;
- `screens/*.spec.json` + `screens/*.screen.json`;
- fragments and `$param` binding;
- data bindings to read bindings;
- command actions to action bindings;
- navigation and refetch actions;
- state-path coverage rules.

The guide should stay renderer-agnostic and avoid documenting product-specific
platform UI internals.

### `workflows-authoring.md`

Project workflow guide limited to external-safe workflows:

- `workflows/workflows.json`;
- BPMN definitions;
- message starts from PDM event types;
- service task mapping to project-routed action bindings;
- no workflow `nativeTasks` for third-party blueprint authoring.

### `seed-authoring.md`

Small guide for seed artifacts:

- when seed is appropriate;
- service-local `seed/seed.json`;
- seed event types must correspond to service-owned PDM event types;
- composition catches invalid event references.

### `blueprint-examples.md`

Guide-level examples index:

- minimal read-only service;
- state-machine-backed CRUD-like service;
- authenticated service pattern by reference to existing module-backed demo,
  without teaching module implementation;
- UI screen with read data and command action;
- workflow calling action bindings.

Examples should point to current files in `demo/notes-blueprint`,
`demo/order-fulfillment-blueprint`, and `demo/cv-extract-blueprint` where the
pattern is already present. If a pattern is not present, the guide should either
include a compact valid JSON snippet or avoid claiming it is available.

## Existing File Treatment

The current files should not remain as stale parallel references:

- split `graph-ir-authoring.md` into query and operation guides, or replace it
  with a short compatibility redirect to the two new files;
- update `graph-ir-examples.md` into `blueprint-examples.md` or a focused
  query examples file if the implementation plan chooses to preserve it;
- update `bindings-authoring.md` in place because existing links likely target
  it;
- update `bindings-examples.md` or fold the examples into
  `blueprint-examples.md`, depending on the final implementation plan.

No guide should duplicate long owner-doc inventories. Each guide should include
only the authoring rules and local examples needed for an external agent to
produce valid artifacts.

## Verification

The implementation should verify the guide set against current code and fixtures:

- source links and examples resolve to real files;
- no guide recommends `target.engine: "native"`, `operations.json`,
  `handlers/*.ts`, or workflow `nativeTasks` as external authoring;
- no guide describes removed QSM `relationRoles` as current;
- binding examples include `exposure`;
- Graph IR operation guidance includes `result` nodes and current operation
  nodes;
- local composition command examples use `loadComposedBlueprint` rather than
  deploy commands.

Recommended final checks after editing guides:

```bash
rg -n "relationRoles|target\\.engine.*native|operations\\.json|handlers/|nativeTasks" docs/current/guides
rg -n "exposure" docs/current/guides/bindings-authoring.md
bun -e "import { loadComposedBlueprint } from './packages/artifacts/blueprint/src/index.js'; const r = loadComposedBlueprint('demo/notes-blueprint'); if (!r.ok) { console.error(JSON.stringify(r.errors, null, 2)); process.exit(1); } console.log('OK');"
```

The first `rg` is expected to find only explicit "do not use" warnings, not
examples or recommended paths.

## Documentation Touch Evaluation

This change targets `docs/current/guides/**`.

No `docs/decision-system.md` update is intended because the guide set follows
existing decisions: blueprint as unit of truth, AI-agent authoring,
inspectability, canonical contracts, and entropy minimization.

No root `README.md`, `AGENTS.md`, or local package README updates are intended
unless implementation discovers a changed navigation rule or package command.

Owner docs should be edited only if the guide work uncovers a current-state
owner-doc error. Otherwise, owner docs are linked as source references and not
rewritten.

## Success Criteria

The guide set is successful when an external coding agent can read
`docs/current/guides/blueprint-authoring.md`, follow links to the narrow guides,
author a small domain blueprint with Graph IR-backed HTTP endpoints and optional
UI/workflow/seed surfaces, and verify it with local composition checks without
using deploy, native handlers, or module authoring internals.
