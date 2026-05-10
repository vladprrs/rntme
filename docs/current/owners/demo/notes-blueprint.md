# notes-demo blueprint

Production-shape project-first blueprint for the Notes deploy-flow walkthrough.

## Contents

The project has one domain service (`app`) and one integration module service
(`identity-auth0`). The app service owns the `Note` entity, two commands
(`createNote`, `deleteNote`), two queries (`listNotes`, `getNote`), one UI screen
at `/`, HTTP bindings mounted under `/api`, and one system seed note.

The `/api` route mounts `request-context` and `auth` middleware. Protected
operation graphs call `identity-auth0.IntrospectSession`, with the
Authorization header bound through `inputFrom`, and read the canonical
`Session` result through the `session` call node.

The UI uses the module client path from `@rntme/identity-auth0`. The main
layout has an anonymous branch that renders `LoginScreen` when
`/auth/status == "anon"` and an authenticated topbar with `UserBadge` when
`/auth/status == "authed"`. The routed `home` screen is rendered by
`ui-runtime` as the sibling screen for `/`; there is no `Outlet` primitive in
the current renderer, so the screen root is gated separately on
`/auth/status == "authed"`.

The blueprint includes `node_modules/rntme_identity_auth0/{package.json,module.json}`
metadata so platform-side bundle validation can resolve the UI module from the
uploaded project version without depending on the monorepo workspace layout.
The embedded `module.json` still declares the canonical module name
`@rntme/identity-auth0`, so the generated UI imports the real package name. It
also mirrors the module's `capabilities.edgeAuth` declaration so deploy
planning can render nginx `auth_request` enforcement for `/api`.

## Auth and ownership

- `createNote` ignores any client-supplied owner and writes `ownerSub` from
  `{ "$ref": "session.result.user_id" }`.
- `listNotes` and `getNote` require a valid Auth0 access token but intentionally
  read all active notes.
- `deleteNote` first filters `NoteView` by both `id` and the session call
  result's `user_id`; missing notes and notes owned by another user both
  return 404.
- The seed note uses `ownerSub: "system"`, so it is visible to signed-in users
  but cannot be deleted by a real Auth0 subject.

## Local validation

```bash
bun install --frozen-lockfile
bun run -F @rntme/blueprint build
bun -e "import { loadComposedBlueprint } from './packages/artifacts/blueprint/src/index.js'; \
  const r = loadComposedBlueprint('demo/notes-blueprint'); \
  if (!r.ok) { console.error(JSON.stringify(r.errors, null, 2)); process.exit(1); } \
  console.log('OK:', r.value.project.services.join(','));"
```

Expected output starts with `OK:`.

## Deploy inputs

Auth0 and Redpanda Cloud values are supplied by deploy target configuration and
Dokploy secrets, not by this blueprint. Public Auth0 browser config is rendered
to `/config.json`; secret values stay in Dokploy environment variables.

The blueprint declares the Auth0 browser and edge-audience inputs in
`project.json#vars`:

```json
{
  "AUTH0_SPA_CLIENT_ID": { "from": "target.auth.auth0.clientId", "required": true },
  "AUTH0_DOMAIN": { "from": "target.auth.auth0.domain", "required": true },
  "AUTH0_AUDIENCE": { "from": "target.auth.auth0.audience", "required": true },
  "AUTH0_REDIRECT_URI": { "from": "target.auth.auth0.redirectUri", "required": true }
}
```

Required deploy target keys:

- `target.auth.auth0.clientId` substitutes `project.json#modules.identity.publicConfig.clientId`.
- `target.auth.auth0.domain` substitutes `project.json#modules.identity.publicConfig.domain`.
- `target.auth.auth0.audience` substitutes both
  `project.json#modules.identity.publicConfig.audience` and
  `project.json#middleware.auth.audience`.
- `target.auth.auth0.redirectUri` substitutes
  `project.json#modules.identity.publicConfig.redirectUri`.
- Auth0 backend audience must match `project.json#middleware.auth.audience`,
  every binding `IntrospectSession` audience, and the Auth0 API identifier:
  `https://notes-demo.rntme.com/api`.
- Backend Auth0 env uses `RNTME_AUTH_PROVIDER=auth0`,
  `RNTME_AUTH_AUDIENCE=https://notes-demo.rntme.com/api`,
  `RNTME_AUTH_MODULE_SLUG=identity-auth0`, and
  `RNTME_AUTH_MODULE_ENDPOINT=<identity-auth0-service>:50051`.
- The identity module also exposes HTTP introspection on port `50052`; the
  edge gateway uses it to reject missing or invalid `Authorization` before the
  app runtime sees the request.
- Redpanda Cloud deploy targets provide `RNTME_EVENT_BUS_BROKERS`,
  `RNTME_EVENT_BUS_PROTOCOL=sasl_ssl`,
  `RNTME_EVENT_BUS_MECHANISM=scram-sha-256` or `scram-sha-512`,
  `RNTME_EVENT_BUS_USERNAME`, `RNTME_EVENT_BUS_PASSWORD`, and topic prefix
  configuration as required by the target.

## Production deployment

The production `dokploy-demos` target must include the Auth0 SPA config used by
`project.json#vars`. Auth0 requires the redirect URI to be allowed by the SPA
application settings; the same origin should also be listed in Allowed Logout
URLs and Allowed Web Origins for the login/logout round trip.

Use this canonical config shape with `rntme target set-config`:

```json
{
  "auth": {
    "auth0": {
      "domain": "demo-rntme.us.auth0.com",
      "clientId": "<production SPA client id>",
      "audience": "https://notes-demo.rntme.com/api",
      "redirectUri": "https://notes-demo.rntme.com/"
    }
  }
}
```

After publishing a fresh project version, redeploy it with:

```bash
rntme project deploy --org test-organization --project notes-demo --version <seq> --target dokploy-demos --wait
```

User test after deploy:

1. Open `/` signed out; the login screen is visible and the notes page is not.
2. Click sign in, complete Auth0 Universal Login, and return to `/`.
3. Confirm the login screen hides, the topbar shows `UserBadge`, and the notes
   list loads.
4. Create a note; it returns 201 and appears in the list with ownership injected
   from the `IntrospectSession` call result.
5. Trigger a 401 or click logout; `/auth/status` returns to `anon` and the
   login screen is shown without exposing the access token in state.
6. Without an `Authorization` header, `GET /api/notes` and `POST /api/notes` return `401 application/json` with `RUNTIME_AUTH_TOKEN_INVALID`; `500 BINDINGS_RUNTIME_EXPRESSION_ERROR` is a failed deployment smoke check.

Spec: `docs/history/specs/active-rationale/2026-04-29-notes-demo-auth0-design.md`
