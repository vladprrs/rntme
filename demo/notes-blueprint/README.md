# notes-demo blueprint

Production-shape project-first blueprint for the Notes deploy-flow walkthrough.

## Contents

The project has one domain service (`app`) and one integration module service
(`identity-auth0`). The app service owns the `Note` entity, two commands
(`createNote`, `deleteNote`), two queries (`listNotes`, `getNote`), one UI screen
at `/`, HTTP bindings mounted under `/api`, and one system seed note.

The `/api` route mounts `request-context` and `auth` middleware. Every binding
runs `pre[] -> identity-auth0.IntrospectSession`, and the graph receives the
canonical `Session` result as `$pre.session`.

## Auth and ownership

- `createNote` ignores any client-supplied owner and writes `ownerSub` from
  `$pre.session.user_id`.
- `listNotes` and `getNote` require a valid Auth0 access token but intentionally
  read all active notes.
- `deleteNote` first filters `NoteView` by both `id` and
  `$pre.session.user_id`; missing notes and notes owned by another user both
  return 404.
- The seed note uses `ownerSub: "system"`, so it is visible to signed-in users
  but cannot be deleted by a real Auth0 subject.

## Local validation

```bash
pnpm install --frozen-lockfile
pnpm --filter @rntme/blueprint... build
pnpm --filter @rntme/blueprint exec node --input-type=module -e "import { loadComposedBlueprint } from '@rntme/blueprint'; \
  const r = loadComposedBlueprint('../../demo/notes-blueprint'); \
  if (!r.ok) { console.error(JSON.stringify(r.errors, null, 2)); process.exit(1); } \
  console.log('OK:', r.value.project.services.join(','));"
```

Expected output starts with `OK:`.

## Deploy inputs

Auth0 and Redpanda Cloud values are supplied by deploy target configuration and
Dokploy secrets, not by this blueprint. Public Auth0 browser config is rendered
to `/config.json`; secret values stay in Dokploy environment variables.

Spec: `docs/superpowers/specs/2026-04-29-notes-demo-auth0-design.md`
