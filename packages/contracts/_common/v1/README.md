# @rntme/contracts-common-v1

Shared cross-category protobuf primitives for rntme canonical contracts. Imported by every category contract package (`@rntme/contracts-identity-v1`, future `@rntme/contracts-payments-v1`, …).

## Layout

- `proto/common.proto` — canonical source (hand-edited).
- `scripts/gen.mjs` — runs `protobufjs-cli` (`pbjs` + `pbts`) static-module codegen.
- `src/proto.gen.{js,d.ts}` — generated bindings (committed; linguist-generated).
- `src/index.ts` — re-exports `proto` and `Rntme` types.
- `error-codes.json` — empty `{}` (no domain errors in this package).
- `test/round-trip.test.ts` — vitest encode/decode coverage.

## Usage

```ts
import { proto } from '@rntme/contracts-common-v1';

const ref = proto.rntme.contracts.common.v1.CanonicalRef.create({
  canonical_id: '7b8c4f1e-0000-4000-8000-000000000001',
  vendor_id: 'user_2abc',
  module_name: 'identity-clerk',
  module_version: '0.3.1',
  contract_version: 'v1',
});
const buf = proto.rntme.contracts.common.v1.CanonicalRef.encode(ref).finish();
```

## Commands

- `pnpm run proto:gen` — regenerate `src/proto.gen.*` (do not edit generated files by hand).
- `pnpm run build` / `test` / `lint` / `typecheck` — package gates.

## Specs

- `docs/superpowers/specs/2026-04-26-identity-canonical-contract-design.md` §5 (`common.proto`).
- `docs/superpowers/specs/2026-04-26-modules-monorepo-structure-design.md` §5.1 (layout).
