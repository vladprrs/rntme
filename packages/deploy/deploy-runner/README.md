# @rntme/deploy-runner

Pure deploy orchestrator library for rntme. Used by both the platform `deployments` service and the CLI direct-mode.

Current documentation: [docs/current/owners/packages/deploy/deploy-runner.md](../../../docs/current/owners/packages/deploy/deploy-runner.md)

Local commands:
- `bun test`
- `bun run typecheck`
- `bun run build`
- `bun run lint`

Notes:
- No HTTP, no DB, no BPMN, no Operaton, no filesystem state. Side effects only on deploy targets.
- Caller supplies all inputs already-fetched / already-decrypted; persistence happens through hooks.
