# @rntme/deploy-core

Target-neutral project deployment planning for rntme.

## Role

`deploy-core` accepts an already validated/composed project model and produces a
`ProjectDeploymentPlan`. It does not read raw blueprint folders, collect
secrets, call Dokploy, or run browser verification.

On the platform path, `@rntme/platform-http` fetches and revalidates an
immutable project-version bundle, converts the saved deploy target into
`ProjectDeploymentConfig`, and then calls this package before handing the plan
to a target adapter.

## Public API

- `buildProjectDeploymentPlan(project, config)` — creates a preview deployment
  plan or returns `DEPLOY_PLAN_*` errors.
- `ProjectDeploymentConfig` — org/environment/mode, event bus,
  integration module image config, backend auth config, and policy values.
- `ComposedProjectInput` — deploy-relevant structural subset of the composed
  project model.

## Event bus modes, auth, and SASL

`ProjectDeploymentConfig.eventBus` supports two Kafka-compatible modes:

- `{ kind: "kafka", mode: "external", brokers, security? }` for an already provisioned Kafka/Redpanda endpoint. Omitted `mode` is normalized to `"external"` for backward compatibility.
- `{ kind: "kafka", mode: "provisioned", provider: "redpanda", image?, topicPrefix? }` for a target-local provisioned bus. The first implementation is Redpanda on Dokploy. The planner derives the internal broker address and persistent volume identity.

`ExternalEventBusConfig.security` is a discriminated union:

- `{ protocol: "plaintext" }` for unauthenticated Kafka-compatible endpoints.
- `{ protocol: "sasl_ssl", mechanism, secretRefs }` for managed Redpanda/Kafka.
  `mechanism` must be `scram-sha-256` or `scram-sha-512`; `secretRefs.username`
  and `secretRefs.password` are required and are secret names, not secret values.

Provisioned Redpanda is internal-only plaintext in this design. Cleanup/deprovisioning is a separate future workflow.

### Edge auth

`mounts: [...].use: ["auth"]` declares an `auth` middleware. Planning enforces:

- The middleware decl provides `provider`, `audience`, `moduleSlug`.
- An integration-module workload exists for `moduleSlug`.
- The module's `module.json#capabilities.edgeAuth` is present and describes an HTTP introspection endpoint (today only `kind: "introspection-sidecar"` is supported).
- For Auth0 modules, `AUTH0_DOMAIN` env is set on the workload.

If any of the above is missing, planning fails with one of:

- `DEPLOY_PLAN_AUTH_MIDDLEWARE_INCOMPLETE` — provider/audience/moduleSlug missing.
- `DEPLOY_PLAN_AUTH_MODULE_WORKLOAD_MISSING` — no integration-module workload for `moduleSlug`.
- `DEPLOY_PLAN_AUTH_MODULE_HTTP_INTROSPECT_MISSING` — module does not declare `capabilities.edgeAuth`.
- `DEPLOY_PLAN_AUTH_MODULE_ENV_INCOMPLETE` — Auth0 module missing `AUTH0_DOMAIN`.

The planned auth middleware carries `moduleIntrospectPort` (sourced from `capabilities.edgeAuth.port`) so the renderer can wire `auth_request` into the right port. Public SPA config comes from the composed project `publicConfigJson` sidecar, not from deployment auth settings.

```json
{
  "kind": "auth",
  "provider": "auth0",
  "audience": "https://notes.example.com/api",
  "moduleSlug": "identity-auth0"
}
```

On the platform executor path, composed project module aliases are mapped through the catalog's canonical module manifest name before planning. For example, a project package alias `rntme_identity_auth0` with catalog category `identity -> @rntme/identity-auth0` still provides `modules["identity-auth0"].edgeAuth` to the planner. Blueprint composition rejects mounted auth middleware before deploy if the canonical module manifest lacks `capabilities.edgeAuth`.

## Where to look first

- `src/plan.ts` — deployment plan and workload construction.
- `src/edge.ts` — route and middleware planning.
- `src/config.ts` — target-neutral deployment config types.

## Specs

- `docs/superpowers/specs/2026-04-24-project-deployment-pipeline-design.md`
- `docs/superpowers/specs/2026-04-29-notes-demo-auth0-design.md`
- `docs/superpowers/specs/2026-05-01-provisioned-event-bus-design.md`

## MVP limits

- Only `mode: "preview"` is supported.
- Only `environment: "default"` is supported.
- Production mode is rejected until persistence and deployment records are
  designed for the production path.
- Integration modules require explicit image config.
