# @rntme/workflows

Project-level workflow artifact parser and validator for BPMN/Operaton mappings.

## Role in the system

- Depends on: `zod`.
- Consumed by: `@rntme/blueprint` for project composition; `@rntme/deploy-core` for deployment planning.
- Position in pipeline: `workflows/workflows.json` + BPMN files -> parse -> structural validation -> cross-reference validation -> `ValidatedWorkflows`.

## Artifact shape

`workflows/workflows.json` is a project-level artifact. It declares:

- `definitions[]` — BPMN files under `workflows/`, each with an rntme id and BPMN `processId`.
- `messageStarts[]` — event-envelope subscriptions that start BPMN process instances.
- `serviceTasks[]` — BPMN service task ids mapped to project-routed action bindings.

The artifact contains only mapping metadata. The BPMN XML remains in separate
`.bpmn` files so deploy planning can mount the exact process definitions into
the BPMN worker.

## Public API

- `parseWorkflowArtifact(raw)`
- `validateWorkflowStructural(artifact)`
- `validateWorkflowCrossRef(artifact, ctx)`
- `validateWorkflows(artifact, ctx)`
- `ERROR_CODES`, `ok`, `err`, `isOk`, `isErr`

## Where to look first

- `src/parse/schema.ts`
- `src/validate/structural.ts`
- `src/validate/cross-ref.ts`
- `test/unit/`

## Validation

Structural validation enforces unique ids, safe relative `.bpmn` paths, known
definition references, and mapping-expression shape. Cross-reference validation
is context-driven: `@rntme/blueprint` supplies project services, PDM event
types, project-routed binding refs, and BPMN file existence under
`workflows/`.

## Specs

- `../../../docs/superpowers/specs/done/2026-05-05-provisioned-bpmn-operaton-design.md`
