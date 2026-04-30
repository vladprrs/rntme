# @rntme/contracts-identity-v1

Canonical Identity contract v1: `service IdentityModule` (24 RPCs), six entities, seventeen CloudEvents payloads, and `IDENTITY_<LAYER>_<KIND>` error codes.

## Layout

- `proto/identity.proto` — entities, enums, RPCs, request/response messages.
- `proto/identity-events.proto` — event payloads (compiled together via `identity-events` import chain).
- `scripts/gen.mjs` — `proto-deps/` symlinks for `rntme/contracts/common/v1` + `identity`, then `pbjs`/`pbts`.
- `src/proto.gen.{js,d.ts}` — generated (committed).
- `src/error-codes.ts` — typed view of `error-codes.json`.
- `src/index.ts` — `proto`, error codes, and direct exports for identity-owned runtime primitives (`User`, `IdentityModule`, `SessionStatus`, …). Shared common-v1 primitives remain under the `proto.rntme.contracts.common.v1` namespace.
- `test/` — entities, events, service RPC list, error-code lint.

## Usage

```ts
import { User, UserStatus, proto, errorCodes, type IdentityErrorCode } from '@rntme/contracts-identity-v1';

const ref = proto.rntme.contracts.common.v1.CanonicalRef.create({
  canonical_id: 'u-1',
  vendor_id: 'v',
  module_name: 'identity-clerk',
  module_version: '0.0.0',
  contract_version: 'v1',
});
const user = User.create({ ref, email: 'ada@example.com', status: UserStatus.USER_STATUS_ACTIVE });
const buf = User.encode(user).finish();

const code: IdentityErrorCode = 'IDENTITY_REFERENCES_USER_NOT_FOUND';
console.log(errorCodes.references.includes(code));
```

## Commands

- `pnpm run proto:gen`
- `pnpm run build` / `test` / `lint` / `typecheck`

## Session Introspection

`IntrospectSession` returns the canonical `Session` entity, not a vendor-specific response wrapper. `IntrospectSessionRequest.audience` is optional for backward compatibility but required by OIDC/JWT vendor modules such as Auth0; those modules validate it against the JWT `aud` claim.

Invalid-token outcomes should not throw for ordinary user-token failures. They return a canonical `Session` with `status != SESSION_STATUS_ACTIVE` and `vendor_raw.deactivation_reason` set to one of `TOKEN_EXPIRED`, `INVALID_SIGNATURE`, `INVALID_ISSUER`, `INVALID_AUDIENCE`, `MALFORMED`, or `UNKNOWN`.

## Spec

`docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md`
