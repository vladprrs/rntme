# Dokploy deploy runbook — rntme.com landing

Current deploy (2026-04-20):

- **Project:** `runtime` (`RK4scgw5bryx2qolyzkSc`)
- **Environment:** `production` (`2HJhor6CZm0SX4vLDLI4q`)
- **Application:** `rntme-landing` (`M5WfXaxcgKVHppiTldEbD`)
- **Source:** GitHub `vladprrs/rntme`, branch `main`
- **Build type:** `dockerfile` at `apps/landing/Dockerfile`, build context = repo root, target stage = `runtime`
- **Watch paths:** `apps/landing/**`, `packages/**/package.json`, `bun.lock`, `package.json` (auto-deploy on matching push)
- **Domain:** `rntme.com` (apex), Let's Encrypt, port 80
- **Env/build args:** `TALLY_FORM_ID`, `GITHUB_URL`, `DOCS_URL`, `PLATFORM_URL`, `PLAUSIBLE_DOMAIN`, `DEMO_URL` (empty by default)

## Ongoing operations

### Update the pilot form ID

1. Edit env `TALLY_FORM_ID` on the Dokploy application (both Env and Build Args sections — the Dockerfile reads it at build time).
2. Trigger a rebuild (Dokploy → Deployments → Deploy).

### Turn on the live-demo section

1. Set `DEMO_URL` (both Env and Build Args) to the public demo URL, e.g. `https://demo.rntme.com`.
2. Redeploy. The `LiveDemoCard` section will render between the aha-moment and the snowflake vignette.

### Add a new domain

1. In Dokploy, open `rntme-landing` → Domains → Add.
2. Host (e.g. `www.rntme.com`), certificateType `letsencrypt`, port `80`, https on.
3. Update your DNS to point at the Dokploy host before saving (Let's Encrypt needs DNS to resolve).

### Rollback

Dokploy retains the last few images per application. Dashboard → `rntme-landing` → Deployments → pick a previous green deployment → Rollback.

## Re-create from scratch (MCP or admin UI)

If the application needs to be re-created (e.g. destructive config edit):

1. `application.create` in project `runtime`, environment `production` (see IDs above).
2. `application.saveBuildType` → `dockerfile`, file `apps/landing/Dockerfile`, context empty (defaults to repo root), build stage `runtime`.
3. `application.saveGithubProvider` → owner `vladprrs`, repo `rntme`, branch `main`, buildPath `/`, triggerType `push`, githubId from `github.githubProviders`, watchPaths as listed above.
4. `application.saveEnvironment` → paste the env block with real `TALLY_FORM_ID`. Set BOTH `env` AND `buildArgs` (the Dockerfile's ARGs pull from buildArgs).
5. `domain.create` → host `rntme.com`, port 80, https true, certificateType `letsencrypt`, domainType `application`, path `/`.
6. `application.deploy` to trigger the first build.

## First-deploy gotchas (observed 2026-04-20)

- `bun install --frozen-lockfile` runs inside the build stage from the repo-root workspace context. `.dockerignore` keeps local installs and generated output out of the image context.
- `oven/bun:1.3.13-alpine` is the build image; Astro 5 integrations (`@astrojs/react@^4`, `@astrojs/mdx@^4`) require a modern JS runtime compatible with Node ≥ 18.20 / 20.3 / 22 APIs.
- Fontshare CDN is an external dependency. If fontshare.com is ever down, the landing still renders in the fallback stack (ui-sans-serif/system-ui). Self-hosting is an open P2 item.
