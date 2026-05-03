# notes-demo restoration runbook (2026-05-02)

## Pre-flight

- Plans 1-4 are merged to `main`.
- `platform.rntme.com` is running a build that includes Plan 4.
- Local CLI is built with `pnpm -F @rntme/cli build`.
- Platform token is present: `./scripts/agent-env-check.sh platform`.
- Auth0 SPA application "notes-demo" has `https://notes-demo.rntme.com/` in Allowed Callback URLs, Allowed Logout URLs, and Allowed Web Origins.
- The production Auth0 SPA client id is available without printing it to logs.

## Confirm CLI and target state

```bash
node apps/cli/dist/bin/cli.js --version
node apps/cli/dist/bin/cli.js whoami --json
node apps/cli/dist/bin/cli.js target list --org test-organization
node apps/cli/dist/bin/cli.js target show dokploy-demos --org test-organization
```

Expected:

- CLI version is `0.1.0` or newer, not `0.0.0`.
- `whoami` confirms access to `test-organization`.
- `target list` includes `dokploy-demos`.
- `target show` is redacted by default. Do not use unredacted output in issue, PR, or run logs.

## Prepare target config

Create the config file locally and replace the placeholder before applying it:

```bash
cat > /tmp/dokploy-demos-config.json <<'EOF'
{
  "auth": {
    "auth0": {
      "domain": "demo-rntme.us.auth0.com",
      "clientId": "<PRODUCTION_AUTH0_CLIENT_ID>",
      "audience": "https://notes-demo.rntme.com/api",
      "redirectUri": "https://notes-demo.rntme.com/"
    }
  }
}
EOF
```

The target keys satisfy `demo/notes-blueprint/project.json#vars`:

- `auth.auth0.clientId`
- `auth.auth0.domain`
- `auth.auth0.audience`
- `auth.auth0.redirectUri`

## Apply target config

```bash
node apps/cli/dist/bin/cli.js target set-config dokploy-demos \
  --org test-organization \
  --json /tmp/dokploy-demos-config.json

node apps/cli/dist/bin/cli.js target show dokploy-demos --org test-organization
```

Expected: the command exits 0 and the redacted target view still shows the Auth0 config shape.

## Publish and deploy

```bash
node apps/cli/dist/bin/cli.js project publish \
  --org test-organization \
  --project notes-demo \
  demo/notes-blueprint
```

Capture the published version sequence, then deploy it:

```bash
node apps/cli/dist/bin/cli.js project deploy \
  --org test-organization \
  --project notes-demo \
  --version <seq> \
  --target dokploy-demos \
  --wait
```

Expected: deployment exits 0 with terminal status `succeeded`. If it exits 10, inspect the deployment record and logs:

```bash
node apps/cli/dist/bin/cli.js project deployment show <deployment-id> \
  --org test-organization \
  --project notes-demo
```

## Smoke checks

```bash
curl -i https://notes-demo.rntme.com/health
curl -i https://notes-demo.rntme.com/config.json
curl -i https://notes-demo.rntme.com/api/notes
curl -i -H 'Authorization: Bearer fake.token.here' https://notes-demo.rntme.com/api/notes
curl -i -H 'Authorization: Bearer fake' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"title":"x","body":"y"}' \
  https://notes-demo.rntme.com/api/notes
curl -i https://notes-demo.rntme.com/_rntme_auth_test
```

Expected:

- `/health` returns 200.
- `/config.json` returns 200 JSON with `@rntme/identity-auth0` public config, including the Auth0 domain, client id, audience, and redirect URI.
- `GET /api/notes` without bearer returns 401 JSON: `{"code":"RUNTIME_AUTH_TOKEN_INVALID","message":"authentication required"}`.
- `GET /api/notes` with `Bearer fake.token.here` returns the same canonical 401 body and does not include `reason`.
- `POST /api/notes` with `Bearer fake` returns the same canonical 401 body.
- `/_rntme_auth_test` returns 404, not SPA HTML.

## Manual login round trip

1. Open `https://notes-demo.rntme.com/`.
2. Click login and complete Auth0 Universal Login.
3. Confirm the app returns to `/` and renders the authenticated notes UI.
4. Create a note with title and body only.
5. Confirm the note appears in the list.
6. Log out and confirm the anonymous login screen returns.

## Rollback and caveats

- If deploy fails with `DEPLOY_PLAN_TARGET_VAR_MISSING`, reapply target config with the missing `auth.auth0.*` key.
- If a forged bearer reaches the backend or returns a body containing `reason`, the edge gateway is still not enforcing canonical auth rejection. Redeploy the same version after confirming the platform build includes Plan 3 and Plan 4.
- If login fails with callback/logout mismatch, update the Auth0 SPA application URLs and redeploy only if `/config.json` had incorrect values.
- Roll back by redeploying the last known good project version to `dokploy-demos` with `--wait`.
- Do not paste target config, Auth0 client id, platform tokens, or unredacted target output into Multica comments or PRs.

## Evidence to record

- Branch, commit, PR.
- Published blueprint version sequence and digest.
- Deployment id, target slug, and final status.
- Smoke command results, especially canonical forged-bearer 401 and `/_rntme_auth_test` 404.
- Browser login/create-note/logout result.
