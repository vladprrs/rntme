# T102 Docker Proof Handoff

## Purpose

The Bun-first migration is blocked only on Docker image build proof. Local
Docker in this workspace cannot build even a minimal `FROM scratch` Dockerfile
because the host cannot mount or unshare build contexts. Run this handoff on a
capable Docker host or after an approved draft PR triggers the edited CI Docker
matrix.

## Required Builds

Run from the repository root containing the Bun migration worktree:

```bash
docker build -f Dockerfile.test -t rntme-test-bun:local .
docker build -f apps/platform-http/Dockerfile -t rntme-platform-http:local .
docker build -f apps/landing/Dockerfile -t rntme-landing:local .
docker build -f packages/runtime/runtime/Dockerfile -t rntme-runtime:local .
docker build -f packages/runtime/bpmn-worker/Dockerfile -t rntme-bpmn-worker:local .
docker build -f modules/identity/auth0/Dockerfile -t rntme-identity-auth0:local .
docker build -f modules/storage/s3/Dockerfile -t rntme-storage-s3:local .
docker build -f modules/marketing-site/static-html/Dockerfile -t rntme-marketing-site-static:local .
docker build -f modules/ai-llm/openrouter/Dockerfile -t rntme-ai-llm-openrouter:local .
```

## Success Evidence

For each image, capture:

- the exact command;
- exit code `0`;
- the final `naming to ...` or equivalent successful image tag line;
- Docker version and builder context, using `docker version`, `docker context ls`,
  and `docker buildx ls`.

Paste that evidence into the `T092` receipt or a follow-up PM/Judge receipt in
`state.yaml`, then run the final completion audit before calling `update_goal`.

## Failure Evidence

If a build fails after the build context mounts, the blocker has moved from host
Docker capability to a real Dockerfile or migration issue. Record:

- the first failing image;
- the failing Dockerfile step;
- the relevant log excerpt;
- whether earlier images built successfully.

Then create the next bounded Worker task for that Dockerfile instead of keeping
`T092` blocked on host capability.

If the build fails before Dockerfile execution with mount, unshare, or BuildKit
context errors, the existing `T092` host-capability blocker still applies.

## CI Path

The local edited `.github/workflows/ci.yml` contains a non-publishing Docker
build matrix for every required image. Remote `main` does not yet contain that
workflow, so existing remote CI runs are not valid proof for this migration.

The approved CI path is:

1. Stage the migration scope explicitly, excluding `.clone/**`.
2. Create branch `codex/bun-first-toolchain-migration`.
3. Commit `migrate repo to bun-first toolchain`.
4. Push the branch.
5. Open a draft PR titled `[codex] migrate repo to bun-first toolchain`.
6. Use the PR CI Docker matrix results as the Docker proof only if all matrix
   entries complete successfully against the migration branch.
