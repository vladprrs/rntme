# `@rntme/conformance-crm` — CRM conformance scaffolding

Conformance scenarios for the CRM canonical contract `@rntme/contracts-crm-v1`. Consumed by every `modules/crm/<vendor>/` module via the (future) shared conformance runner.

## Layout

- `src/types.ts` — local `Scenario` / `CategoryConformanceSuite` stubs until `@rntme/conformance-framework` exists.
- `src/suite.ts` — `suite` with 34 RPC keys.
- `src/scenarios/*.scenarios.ts` — one file per `CrmModule` RPC.
- `src/fixtures/*` — aggregate and webhook sample payloads.
- `test/drift.test.ts` — ensures RPC list matches scenario files and proto `CrmModule`.
- `test/suite-shape.test.ts` — pending scaffold invariants.
- `test/fixtures-sanity.test.ts` — JSON / URL-encoded webhook checks.

## Commands

```bash
bun run build
bun run typecheck
bun test
bun run lint
```

## Specs

- `docs/history/specs/historical/2026-04-27-crm-canonical-contract-design.md` §11
- `docs/history/plans/historical/crm-canonical-contract/02-crm-conformance-skeleton.md`
