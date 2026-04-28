# Gaps: Bindings

This document tracks gaps in the binding layer after modules, gRPC, pre-fetch,
callback bindings, and HTTP idempotency landed. The old "bindings has no
idempotency/gRPC/callbacks" snapshot is no longer accurate.

## What rntme has today

- `packages/bindings` validates a declarative HTTP binding artifact and emits
  OpenAPI 3.1. Types now include `pre[]`, `inputFrom`, `response`, and
  `allowedRedirectHosts` in `packages/bindings/src/types/artifact.ts`.
- `packages/bindings/src/validate/structural.ts` enforces callback-oriented GET
  + redirect constraints and a `pre.length <= 2` gate for command bindings.
- `packages/bindings-http` mounts Hono routes, extracts inputs, maps command
  errors, runs pre-steps, caches idempotent HTTP command responses, emits
  correlation context, and can record metrics.
- `packages/bindings-http/src/idempotency/*` provides a SQLite-backed
  `idempotency_cache`; `router.ts` wires `Idempotency-Key` middleware for
  command routes.
- `packages/runtime/src/plugins/adapter-client/*` implements module RPC calls
  with retry/circuit-breaker/idempotency-key forwarding.
- `packages/bindings-grpc` emits protobuf from validated bindings and mounts a
  grpc-js server; `packages/runtime/src/plugins/grpc-surface.ts` exposes it as a
  runtime surface.
- OpenAPI still does not expose a first-class idempotency declaration, stable
  error-code enum, multipart content, or top-level webhook/callback docs.

## Closed or downgraded since the original gap doc

- **Idempotency-Key middleware/storage:** closed for HTTP response replay cache.
  Residual: contract exposure and non-HTTP/gRPC semantics.
- **gRPC/protobuf binding emit:** closed at package and runtime-surface level.
  Residual: shape coverage, docs, and project deployment integration.
- **Vendor callbacks / redirects:** partially closed by `inputFrom` and
  `response`/redirect support. OpenAPI `callbacks`/`webhooks` remain separate.
- **Pre-fetch module calls:** closed as a primitive. Remaining work is error
  catalog and production module packaging.

## Gaps

### [P1] Idempotency contract in artifacts, OpenAPI, and gRPC

**Why it matters.** Runtime HTTP replay cache exists, but the contract is still
implicit. Agents and generated clients need to know which operations require or
accept `Idempotency-Key`, how long replay is retained, and whether the same
semantics apply to gRPC/module calls.

**Current evidence.**

- `packages/bindings-http/src/idempotency/middleware.ts` reads the header and
  replays cached responses.
- `packages/bindings-http/src/idempotency/cache.ts` creates and manages the
  cache table.
- `packages/bindings/src/openapi/emit.ts` does not add an `Idempotency-Key`
  parameter to command operations.
- `packages/graph-ir-compiler/src/command-runtime/execute.ts` still accepts no
  idempotency option; dedupe is implemented at the HTTP binding layer.

**Target.**

- Add an artifact-level declaration for mutating operations, with a safe default
  for commands.
- Emit OpenAPI header parameters and document replay headers/status behavior.
- Decide whether gRPC command calls use metadata, a request field, or remain
  caller-managed.
- Keep module pre-step idempotency-key chaining aligned with the public command
  contract.

**Acceptance gate.** A generated OpenAPI/protobuf client can discover and use
idempotency without reading rntme source, and a retry of the same command
returns the original outcome on HTTP and the documented behavior on gRPC.

### [P1] Error catalog with stable codes in OpenAPI and protobuf

**Why it matters.** Agents, UI flows, and future Zeebe workers need to branch on
machine-readable error codes. Runtime code already returns stable strings such
as validation, guard, concurrency, pre-step, and adapter errors; generated
contracts still mostly describe error `code` as a string.

**Current evidence.**

- `packages/bindings/src/openapi/errors.ts` emits `ErrorResponse` with a string
  `code` but no enum/catalog.
- `packages/bindings-http/src/errors.ts` and
  `packages/graph-ir-compiler/src/command-runtime/errors.ts` contain runtime
  codes.
- `packages/bindings-grpc/src/server/errors.ts` maps runtime failures to gRPC
  status, but the emitted protobuf does not publish a complete domain error
  catalog.

**Target.**

- Define an append-only error catalog per generated service surface.
- Emit OpenAPI enum or `x-error-codes` and protobuf-compatible error metadata.
- Include pre-step/module errors and idempotency replay/conflict states.
- Document source of truth to avoid hand-maintained drift.

**Acceptance gate.** Generated clients can exhaustively switch on documented
error codes for commands and pre-step/module failures.

### [P2] Multipart/file upload and object storage

**Why it matters.** Attachments, imports, and media are common workflow
requirements, but not necessary to prove project-blueprint runtime value.

**Current evidence.**

- `packages/bindings/src/openapi/parameters.ts` and
  `packages/bindings/src/openapi/shapes.ts` emit JSON request/response shapes,
  not multipart forms or file primitives.
- `packages/bindings-http` command handling is JSON-oriented.
- There is no `@rntme/storage` package or project-level object-store binding.

**Target.**

- Add a file/blob input shape and multipart OpenAPI emission.
- Decide whether bytes stream to a module/storage driver or buffer locally for
  small files.
- Pair with object storage configuration in runtime/deploy docs.

**Acceptance gate.** A blueprint can declare an attachment upload route that
generates OpenAPI, runtime parsing, storage handoff, and UI affordance without a
custom route.

### [P2] Discriminated unions and richer response shapes

**Why it matters.** Workflow UIs and integration modules eventually need
variant responses (`pending | approved | rejected`, typed module results,
polymorphic activities). Today shapes are mostly flat object/scalar/array.

**Current evidence.**

- `packages/bindings/src/openapi/shapes.ts` has no first-class tagged union or
  OpenAPI discriminator support.
- `packages/bindings-grpc` shape emission is similarly constrained by the
  resolved shape registry.

**Target.** Add a tagged-variant shape that emits OpenAPI `oneOf`/discriminator
and a protobuf-compatible encoding with stable tags.

**Acceptance gate.** A generated UI/client can narrow response variants without
stringly typed optional-field conventions.

### [P2] OpenAPI webhooks/callbacks documentation

**Why it matters.** Runtime callback endpoints exist for vendor returns, but the
generated OpenAPI document still does not describe top-level `webhooks` or
operation `callbacks`. This matters for external providers and partner docs, not
for the next runtime slice.

**Current evidence.**

- `packages/bindings/src/openapi/emit.ts` builds `paths` and `components`, not
  `webhooks` or operation-level `callbacks`.
- Vendor-owned inbound webhooks remain module-owned per the modules integration
  spec, not generic rntme binding routes.

**Target.** Emit docs only for callback shapes rntme actually owns. Keep vendor
webhook verification inside modules.

## Boundaries

- **Bindings do not own business execution.** Graph IR or a code executor
  handles commands/queries; bindings own transport, inputs, responses, and
  contract generation.
- **Vendor webhook security belongs to modules.** rntme may document callback
  returns, but provider signature verification is module code.
- **Object storage is not the binding layer.** Multipart parsing should hand off
  to a storage/module seam.

## External API notes

- Context7 check against OpenAPI 3.1 confirmed header parameters, JSON
  Schema-based components, operation callbacks, top-level `webhooks`, and
  discriminators are native OAS concepts. The roadmap should use those standard
  constructs before adding rntme-specific extensions.
- Context7 check against `grpc-node` confirmed `@grpc/grpc-js` unary calls use
  `Metadata` for request/response metadata and standard gRPC status handling.
  That supports idempotency via metadata for platform callers, but rntme still
  needs to document the exact metadata key and error mapping.

## Open questions

1. Should command idempotency be an artifact property or implied for all command
   bindings? Recommended default: implied safe default with explicit override.
2. Should the error catalog be derived from package code or declared in binding
   artifacts? Recommended default: derived from package/runtime code plus
   per-binding extensions.
3. Should gRPC idempotency use metadata only or an explicit request field?
   Recommended default: metadata for platform calls, documented in emitted
   service docs.
