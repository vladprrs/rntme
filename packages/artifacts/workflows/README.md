# @rntme/workflows

Project-level workflow artifact parser and validator for BPMN/Operaton mappings.

## Role in the system

- Depends on: `zod`.
- Consumed by: `@rntme/blueprint` for project composition; `@rntme/deploy-core` for deployment planning.
- Position in pipeline: `workflows/workflows.json` + BPMN files -> parse -> structural validation -> cross-reference validation -> `ValidatedWorkflows`.

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

## Specs

- `../../../docs/superpowers/specs/2026-05-05-provisioned-bpmn-operaton-design.md`
