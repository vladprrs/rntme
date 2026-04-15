# Gaps: Bindings

Thematic gap analysis comparing rntme's HTTP-binding emitter (`@rntme/bindings` + `@rntme/bindings-http`) against Medusa's HTTP/OpenAPI surface (survey C), filtered through the commerce-class demo case and the platform vision (per-service runtime behind LLM-authored DDD + Zeebe-orchestrated cross-service sagas).

Inputs:
- Survey C: `docs/superpowers/reports/2026-04-14-medusa-survey-c-http-openapi.md`
- rntme emit: `packages/bindings/src/openapi/emit.ts`
- rntme shapes: `packages/bindings/src/openapi/shapes.ts`
- rntme runtime: `packages/bindings-http/src/router.ts`, `packages/bindings-http/src/runtime/command-handler.ts`

## What rntme has today

- **OpenAPI 3.1 emit** from a declarative artifact: paths + operations + JSON-Schema components generated in `packages/bindings/src/openapi/emit.ts:108`. Per-operation `deepMerge` passthrough for `openapi` overrides (`emit.ts:102`).
- **Shape → JSON-Schema** covering scalars, arrays, nullability, and configurable decimal encoding (`packages/bindings/src/openapi/shapes.ts:39`).
- **Standard error responses** injected per operation: `400 / 422 / 500` plus `409` for commands, all pointing at a single `ErrorResponse` schema (`packages/bindings/src/openapi/errors.ts:34`). The schema carries `{ code, message, details? }` but does **not** enumerate the code values.
- **Hono + Zod runtime** (`packages/bindings-http/src/router.ts:30`): compiles the artifact to Hono routes, dispatches to query handler or command handler, maps Zod validation failures and `CommandExecutionError` to the declared error body (`packages/bindings-http/src/runtime/command-handler.ts:72`).
- **Per-request concurrency semantics for commands**: `COMMAND_CONCURRENCY_CONFLICT` → 409, other `CommandExecutionError` codes → 422 (`packages/bindings-http/src/errors.ts:54`).
- **OpenAPI passthrough** per operation/parameter for hand-authored hints (tags, summary, description, ad-hoc openapi keys), but no first-class support for content-negotiation, multipart, callbacks, or discriminators.

## How Medusa handles it

- **File-based routing** with per-route auth and CORS flags (`research/medusa/packages/core/framework/src/http/routes-loader.ts:48`).
- **No native OpenAPI generation.** TypeScript types (`HttpTypes.AdminOrderListResponse`) are the contract; OpenAPI is not auto-emitted and there is no decorator/annotation pipeline (survey C §3).
- **No API-level idempotency.** The `/admin/*` conflict error message still refers to `Idempotency-Key`, but the framework does not parse or persist the header; correctness is delegated to workflow compensation steps (`research/medusa/packages/core/framework/src/http/middlewares/error-handler.ts:51`).
- **Standardized error envelope** `{ code, type, message }` with a small enum of codes emitted by `MedusaError` (`research/medusa/packages/core/framework/src/http/middlewares/error-handler.ts:36`).
- **Multipart uploads** via Multer in-memory storage for admin routes (`research/medusa/packages/medusa/src/api/admin/uploads/middlewares.ts:14`), handed off to a workflow for final persistence (`research/medusa/packages/medusa/src/api/admin/uploads/route.ts:9`).
- **Webhooks inbound only** (`/hooks/payment/:provider`) with `preserveRawBody: true` for signature verification (`research/medusa/packages/medusa/src/api/hooks/middlewares.ts:3`). No OpenAPI `callbacks`/`webhooks` documentation, no outbound-webhook registration API.
- **HTTP-only.** No gRPC surface in the framework at all.

## Gaps for commerce-class case

### [P0] [demo-blocker] Idempotency-Key middleware + storage

**Why critical / DX impact.** A commerce demo (place-order, charge-payment, submit-issue) cannot ship without retry-safe POST semantics: any network hiccup on a command can produce duplicates. Medusa's own 409 message promises `Idempotency-Key` but the framework never implements it; rntme inherits the same gap and will hit it on the first retry test. This is also an authoring concern — the LLM must emit the same artifact for commands regardless of whether they are retry-safe, and today there is nothing to declare.

**Pain point in rntme today** (concrete pattern/line). Command dispatch is header-agnostic: `makeCommandHandler` reads only path/query/body and runs `executeCommand` with no cache lookup keyed by request identity — `packages/bindings-http/src/runtime/command-handler.ts:63`. The 409 mapping (`packages/bindings-http/src/errors.ts:54`) surfaces concurrency conflicts but will not dedupe a replayed request, so a client retry after a transient 500 becomes a second write.

**Medusa reference** (how they solve it). They don't. Survey C §4 documents the absence; the error handler string at `research/medusa/packages/core/framework/src/http/middlewares/error-handler.ts:51` reads `"You may retry the request with the provided Idempotency-Key."` as forward-compat text while the middleware is unimplemented. rntme has the same gap to close; no ready-made solution to port.

**Authorability / visualization** — how closing this gap affects what the LLM can author and what the business-user UI shows.
Once idempotency is an artifact-level declaration (e.g. `entry.http.idempotency: { scope: 'per-actor' | 'per-key', ttlSeconds }`), the LLM author can mark every state-mutating command retry-safe by default, and the business-user viz can render a "retry-safe ✓" badge on each command card plus a TTL slider. Without this, the UI must either hide retry behavior or lie about it, and the LLM has no lever to pull when a customer asks "make POST /orders idempotent".

### [P0] [non-blocker] gRPC/protobuf binding emit

**Why critical / DX impact.** Platform vision: rntme is one per-service runtime inside an LLM-agent-driven DDD platform where Zeebe owns cross-service sagas and **gRPC is the sync inter-service call surface**. Today `@rntme/bindings` only knows how to emit OpenAPI 3.1 + Hono; a sibling service calling this one has to scrape REST. Shipping gRPC emit lets every rntme-authored service expose the same operations over both transports with one artifact as source of truth.

**Pain point in rntme today** (concrete pattern/line). `generateOpenApi` is the only emit target (`packages/bindings/src/openapi/emit.ts:108`) and it is hard-coded to return `openapi: '3.1.0'`. The resolver/plan pipeline assumes an HTTP method + path and builds `PathItem` objects (`packages/bindings/src/openapi/emit.ts:122`) — there is no transport-neutral operation model that could be projected to a `.proto` service/method.

**Medusa reference** (how they solve it). No direct Medusa analogue — Medusa is HTTP-only. Rationale from platform vision (inter-service gRPC transport).

**Authorability / visualization** — how closing this gap affects what the LLM can author and what the business-user UI shows.
With a dual-transport artifact, the LLM authors one operation (e.g. `AssignIssue`) and both `openapi.json` and `service.proto` fall out. The business viz then shows a single "capability" card with two transport chips (`HTTP POST /v1/issues/:id/assign`, `gRPC IssueService/Assign`) instead of two disjoint surfaces the user has to correlate by hand. A generated artifact also eliminates drift between the sync-call surface consumed by peer services and the external REST surface consumed by SPAs.

### [P1] [demo-blocker] Error catalog with stable codes in OpenAPI

**Why critical / DX impact.** Clients (and Zeebe saga compensators) need to branch on `err.code`, not on human-readable `message`. rntme already has a closed set of codes in `CommandExecutionError` + HTTP runtime, but the OpenAPI document advertises `code: { type: 'string' }` with no enum, so generated SDK types on the consumer side cannot narrow. For the commerce demo this matters the moment the LLM is asked to author a "retry on COMMAND_CONCURRENCY_CONFLICT, surface COMMAND_GUARD_REJECTED to the user" flow.

**Pain point in rntme today** (concrete pattern/line). The `ErrorResponse` schema is a bare string/string record at `packages/bindings/src/openapi/errors.ts:5`: `code: { type: 'string' }` with no `enum`, no `x-error-codes` catalog, and no cross-reference to the runtime source of truth (`packages/graph-ir-compiler/src/command-runtime/errors.ts:1`). The runtime sends codes like `COMMAND_CONCURRENCY_CONFLICT` / `VALIDATION_ERROR` / `INVALID_BODY` (`packages/bindings-http/src/errors.ts:32`) that nothing in the emitted spec lists.

**Medusa reference** (how they solve it). Medusa ships a small fixed enum of codes (`invalid_state_error`, `invalid_request_error`, `api_error`) in its error handler at `research/medusa/packages/core/framework/src/http/middlewares/error-handler.ts:43` and documents them only via JSDoc (line 107-123) — also non-machine-readable, but at least centralized. rntme should go further and emit the enum into OpenAPI.

**Authorability / visualization** — how closing this gap affects what the LLM can author and what the business-user UI shows.
A typed code enum turns error handling into a checklist: the LLM can be required to author a branch per code, the compiler can warn on unhandled codes, and the business viz can render each operation's error pills with colored chips ("409 CONCURRENCY" amber, "422 GUARD" red, "422 ILLEGAL_TRANSITION" red). Without the enum, the UI can only show "4xx happens, see logs" and the LLM has no structured lever to target.

### [P1] [non-blocker] Multipart / file upload handling

**Why critical / DX impact.** Commerce-class demos routinely need product images, import CSVs, attachment uploads on tickets. Today rntme has no representation for `multipart/form-data` in the artifact or runtime, so every file-accepting endpoint must be hand-written outside the binding pipeline — which means it escapes both the LLM authoring loop and the viz.

**Pain point in rntme today** (concrete pattern/line). `collectRequestBody` in `packages/bindings/src/openapi/emit.ts:83` assembles only JSON request bodies from declared body parameters; there is no `content: multipart/form-data` branch, no file-shape primitive in `packages/bindings/src/openapi/shapes.ts:8`, and the command handler assumes JSON at `packages/bindings-http/src/runtime/command-handler.ts:44` (`c.req.json()`).

**Medusa reference** (how they solve it). Admin uploads register per-route `multer({ storage: multer.memoryStorage() })` middleware (`research/medusa/packages/medusa/src/api/admin/uploads/middlewares.ts:14`) and route handlers read `req.files as Express.Multer.File[]` (`research/medusa/packages/medusa/src/api/admin/uploads/route.ts:9`). In-memory is called out as a production TODO but is the shipped default.

**Authorability / visualization** — how closing this gap affects what the LLM can author and what the business-user UI shows.
Adding a `file` shape primitive + multipart content type lets the LLM author `POST /v1/products/:id/images` from a single operation spec, and the viz can render a per-operation upload affordance (drag-drop zone, accepted MIME list, size cap) next to the JSON-body editor. Until then, any file-accepting endpoint is invisible to the platform and must be documented out-of-band.

### [P1] [non-blocker] Discriminator / oneOf in responses

**Why critical / DX impact.** Polymorphic responses are endemic to commerce (`Order.items: (PhysicalLineItem | DigitalLineItem | SubscriptionLineItem)[]`, `Product.variants`, payment methods). Without `oneOf` + `discriminator`, the generated SDK collapses these into loose records and client code pattern-matches on string fields defensively. This also blocks the LLM from authoring correct type narrowing in consumers.

**Pain point in rntme today** (concrete pattern/line). `fieldTypeToJsonSchema` at `packages/bindings/src/openapi/shapes.ts:43` only knows `scalar` and `array` field kinds; there is no `union` / `tagged-variant` case, and `shapeToJsonSchema` emits a flat `{ type: 'object', required, properties }` at `packages/bindings/src/openapi/shapes.ts:58` with no `oneOf` or `discriminator` hook. Even with `openapi` passthrough, there is no shape-level discriminator to drive.

**Medusa reference** (how they solve it). No direct Medusa analogue — Medusa does not emit OpenAPI at all (survey C §3) and leans on TypeScript discriminated unions in `HttpTypes.*` for compile-time narrowing only. rntme needs a first-class solution beyond what Medusa ships.

**Authorability / visualization** — how closing this gap affects what the LLM can author and what the business-user UI shows.
A tagged-variant shape primitive lets the LLM describe "line item is one of these three" once and get both typed SDK narrowing and a viz that renders a segmented tab per variant with its own field editor. Without it, the LLM must inline enum-plus-optional-fields workarounds that the viz cannot disambiguate.

### [P2] [non-blocker] Webhooks/callbacks emit in OpenAPI 3.1

**Why critical / DX impact.** OpenAPI 3.1 has both `webhooks` (top-level, for inbound events a server will receive) and per-operation `callbacks` (for operations that register a callback URL). Neither is emitted today. For commerce this matters once the demo integrates with payment providers or external fulfillment — but it sits behind idempotency + error catalog + multipart on the critical path.

**Pain point in rntme today** (concrete pattern/line). `generateOpenApi` at `packages/bindings/src/openapi/emit.ts:139` builds the doc as `{ openapi, info, paths, components, servers? }` — no `webhooks` key, no `callbacks` per operation. The artifact type has no `webhook` kind alongside `query`/`command`.

**Medusa reference** (how they solve it). Inbound payment webhooks are mounted manually at `/hooks/payment/:provider` with raw-body preservation for signature verification (`research/medusa/packages/medusa/src/api/hooks/middlewares.ts:3`); there is no OpenAPI documentation of the callback shape and no registration API (survey C §7).

**Authorability / visualization** — how closing this gap affects what the LLM can author and what the business-user UI shows.
Emitting webhooks/callbacks in OpenAPI lets the LLM declare "this operation delivers `order.paid` to a registered URL" and the viz can render arrows between operations and webhook receivers in the same graph — completing the call diagram. Until then, inbound hooks exist only in prose.

## Intersections with out-of-scope

- **gRPC transport layer is not rntme.** The connection lifecycle, service mesh, retry policy, deadline propagation, and load balancing for gRPC live in the platform infra (Envoy/Istio/linkerd + Zeebe's job workers). rntme emits the `.proto` contract and a thin server stub per operation; it does not own the wire.
- **Workflow-level sagas are not rntme.** Multi-service compensation (Medusa's workflow engine analogue) lives in Zeebe; rntme's command bindings must surface enough error codes for saga compensators to branch, but they do not themselves coordinate cross-service rollback.
- **Object storage is not rntme.** Multipart handling stops at "extract file bytes + MIME and hand to a resolver". Actual blob persistence (S3, local, CDN) is a separate module.
- **Idempotency store backing.** The middleware + artifact declaration are in scope; the durable dedup store (Redis? SQLite table? Turso?) is a runtime concern for `@rntme/bindings-http` and should not leak into the transport-neutral artifact.
- **Auth.** Authentication/authorization middleware (bearer, session, publishable key) is adjacent but tracked in a separate gap doc; bindings only emit the `security` references.

## Open questions

- **Separate artifact file `grpc-bindings.json` or merge into existing bindings artifact with transport: 'grpc'|'http' discriminator?** Trade-off: a single artifact keeps the "capability" mental model clean and lets the viz group transports per operation, but couples HTTP and gRPC schema evolution. Two artifacts let each transport evolve independently at the cost of duplication and drift.
- **Idempotency scope default.** Per-key only (client-supplied `Idempotency-Key`) vs per-actor+body-hash (automatic). Commerce convention (Stripe) is per-key; rntme could default to per-key and let the artifact opt in to stricter body-hash binding.
- **Error code enum source of truth.** Should the enum be hand-maintained in the artifact, or derived from `CommandErrorCode` + runtime validation codes at build time? Derivation avoids drift but couples bindings to `@rntme/graph-ir-compiler` at emit time.
- **Tagged-variant encoding.** OpenAPI `discriminator` + `oneOf` vs `anyOf` + `const` tags. The former has better SDK ergonomics but stricter parser requirements; the latter is more portable.
- **Webhook delivery semantics.** If rntme ever emits outbound webhooks, who owns retry/DLQ — the bindings runtime, the projection-consumer, or a dedicated delivery service? Likely the latter, which would push this gap further down the priority list.
- **Multipart storage target.** In-request streaming to an object-store resolver vs buffered-then-passed (Medusa's choice). Streaming is better for large files but requires a different handler contract than the current JSON-body path.
