# @rntme/landing

Marketing landing for `rntme.com`. See `docs/history/specs/historical/2026-04-20-landing-design.md` for the design and `SHAPE-BRIEF.md` for the UX direction.

## Dev

    bun install
    bun run dev

Required env (see `src/env.ts`):

- `TALLY_FORM_ID`
- `GITHUB_URL`
- `DOCS_URL`
- `PLATFORM_URL`
- `DEMO_URL` (optional — when set, the "Try the live demo" section renders)
- `PLAUSIBLE_DOMAIN` (optional)

## Build

    bun run build

## Gates

    bun test
    bun run typecheck
    bun run lint

Output: `dist/`. The Dockerfile in this directory wraps the `dist/` in an nginx:alpine image.
