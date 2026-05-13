# @rntme/deploy-bundle-input

Lifts a materialized blueprint bundle (`ComposedBlueprint`) into the
`ComposedProjectInput` shape that `@rntme/deploy-core`'s plan/render functions
expect. Reads runtime files (UI, workflows, gRPC proto) off the materialized
bundle directory; bundles a virtual UI entry via `Bun.build` when present.

Used by:

- `apps/cli/src/deploy-engine/load-blueprint.ts` — direct-mode deploy.
- `packages/deploy/deploy-runner/src/handlers/compose-handler.ts` — BPMN
  compose stage handler.

Owner doc: [docs/current/owners/packages/platform/deploy-bundle-input.md](../../../docs/current/owners/packages/platform/deploy-bundle-input.md)
