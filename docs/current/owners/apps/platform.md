# @rntme/platform

Platform-as-blueprint authoring surface for the rntme control plane. The source
of truth lives under `apps/platform/blueprint` and is loaded with
`@rntme/blueprint`.

## Role in the system

- Depends on rntme artifact packages through validation and composition.
- Consumed by future platform runtime cutover work.
- Does not replace `apps/platform-http` until the cutover plan lands.

## Blueprint layout

- `project.json`
- `pdm/pdm.json` and `pdm/entities/*.json`
- `services/organizations`
- `services/projects`
- `services/tokens`
- `services/audit`

## Services

| Entity | Owner service | Purpose |
| --- | --- | --- |
| `Organization` | `organizations` | Tenant identity and display metadata. |
| `Account` | `organizations` | Human or machine principal mirror. |
| `Membership` | `organizations` | Account-to-organization role/scopes mirror. |
| `Project` | `projects` | Project metadata and lifecycle state. |
| `ProjectVersion` | `projects` | Immutable published bundle metadata. |
| `ApiToken` | `tokens` | Machine token metadata, prefix, scopes, revocation state. |
| `AuditEvent` | `audit` | Append-only inspectable audit stream. |

## Deployments

The platform blueprint has a `deployments` domain service that owns deploy
targets, deployment records, project operations, sanitized log lines, and
execution evidence. The first implementation uses an internal adapter seam to
call the existing Dokploy deploy path. A public deploy-adapter module contract
is intentionally deferred.

## Identity

The platform blueprint uses `@rntme/identity-auth0` as its first identity
provider through the canonical identity contract. Platform API mounts use the
project `auth` middleware with Auth0 edge introspection. Graphs receive the
`Authorization` header through binding `inputFrom.authorization` and call
`identity-auth0.IntrospectSession` for canonical session data.

WorkOS remains a legacy hosted-platform integration until a future provider
parity plan adds canonical session/edge introspection support.

### Known gaps (resolved in the runtime cutover slice)

- The `${auth.audience}` placeholder in graph `IntrospectSession` calls is not
  yet resolved by any graph-IR pass — at runtime every session call will fail
  audience validation until a resolver is added.
- `organizations.listOrganizations` filters only by `status = active`. Once
  the session result is consumed it must scope by membership; today it would
  return every tenant's orgs to any authenticated caller.
- The `session` call result is not consumed by downstream nodes. Actor
  derivation from the session is deferred to the cutover plan.

## Local commands

```bash
pnpm -F @rntme/blueprint test -- ../../apps/platform/blueprint/test/platform-blueprint.test.ts
```

## Invariants

- This app owns authoring artifacts only in the foundation slice.
- `apps/platform-http` remains the active hosted platform until cutover.
- Deployment entities are intentionally absent until the deployments-service plan.

## Where to look first

- `apps/platform/blueprint/project.json`
- `apps/platform/blueprint/test/platform-blueprint.test.ts`

## Specs

- [`../../superpowers/specs/2026-05-09-platform-as-blueprint-design.md`](/docs/superpowers/specs/2026-05-09-platform-as-blueprint-design.md)
