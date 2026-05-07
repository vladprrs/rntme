# Architecture audit — `@rntme/bindings-grpc`

This document mirrors the read-only architecture audit posted on Multica so it can be reviewed offline and linked from the repo.

| | |
|---|---|
| **Multica issue** | `RNT-200` (`5c6a1616-3a84-4ecc-b88a-0f2e8d8ebab9`) |
| **Issue title** | Audit: package architecture — @rntme/bindings-grpc |
| **Package / scope** | `@rntme/bindings-grpc` |
| **Verdict (summary)** | needs cleanup |
| **Audit comment id** | `014b10cb-fd38-4238-bf0e-1c9c5dbfaba2` |
| **Audit comment date** | 2026-04-28 |

---

## Audit report

The sections below reproduce the audit comment body **verbatim** from Multica (formatting preserved).


The audit of `@rntme/bindings-grpc` has been completed. Verdict: **needs cleanup** - the package works for an MVP, but there are architectural risks that will grow as the platform expands.

## 1. Severity summary

| Severity | Count | Briefly |
|----------|-------|--------|
| blocker | 1 | `actor: null` breaks audit/actor-guard for all gRPC commands |
| high | 3 | Wrong direction of dependence; non-exhaustive switch; unfalsifiable E2E test |
| medium | 4 | No `pre[]`; hardcode `CommandResult`; manual serialization protobuf; unvalidated field name in response |
| low | 5 | No health/TLS; output shapes only; no own ERROR_CODES; coverage gaps |

## 2. Problems

### BLOCKER

**B1. `actor: null` in all gRPC commands**
Evidence: `packages/runtime/bindings-grpc/src/server/handler.ts:60`
Impact: Any command that comes via gRPC loses actor attribution. The audit trail and actor-based guard are broken. The HTTP surface in `bindings-http` passes `actor: deps.actorFromRequest(c)`. gRPC-surface does not accept `actorFromRequest` in options and always puts `null`.
Recommendation: add `actorFromRequest?: (metadata: grpc.Metadata) => ActorRef | null` in `GrpcServerOptions` and forward to handler.

### HIGH

**H1. `bindings-grpc` depends on `bindings-http` only for `executor-contract`**
Evidence: `src/server/handler.ts:3-8`, `src/server/errors.ts:3-5`, `src/types.ts:3-5` import `CommandExecutor` / `QueryExecutor` from `@rntme/bindings-http/executor-contract`.
Impact: Executor seam is a shared contract between HTTP and gRPC. grpc's dependency on http breaks layering and creates a loop risk when refactoring.
Recommendation: move `executor-contract.ts` to `@rntme/bindings` (or a separate `@rntme/executor-contract`). Requires Vlad's solution because it affects the public API of both packages.

**H2. Non-exhaustive `switch` without fallback-return**
Evidence: `src/emit/scalars.ts:3-11` and `src/emit/shapes.ts:5-16`.
Impact: If a new `ScalarPrimitive` or `FieldType.kind` is added to `@rntme/bindings`, the TypeScript compiler (`strict`) will throw an error, but the runtime behavior when `case` is omitted is `undefined`, and `.proto` will be generated with `undefined` instead of type.
Recommendation: add `default` with `throw new Error('unreachable')` after the exhaustive check `_exhaustive: never`.

**H3. Unfalsifiable assertion in demo E2E**
Evidence: `demo/issue-tracker-api/test/e2e/grpc.test.ts:49` — `expect(error !== null || typeof response === 'object').toBe(true)`.
Impact: This statement is always true for any gRPC response (even an error). Gives a false sense of coverage. Ultrareview (spec `2026-04-23-ultrareview-fixes-design.md`) already marked this as deferred.
Recommendation: replace with a specific check of response fields (`expect(response.rows).toBeDefined()`, etc.).

### MEDIUM

**M1. No support for `pre[]` middleware in gRPC surface**
Evidence: `README.md:57` — "Not yet supported: `pre[]` middleware (plan 3)".
Impact: gRPC teams cannot pre-fetch modules. This is a core feature of the platform, and its absence in gRPC makes surface second-rate.
Recommendation: either implement `pre[]` orchestration in `handler.ts` (difficult since there is no HTTP context), or explicitly document that gRPC surface is only for internal module-to-service calls without `pre[]`, and the validator should reject binding with `pre[]` + gRPC exposure. Vlad's decision.

**M2. Hardcode of the string `'CommandResult'` instead of the constant from `@rntme/bindings`**
Evidence: `src/emit/emit-proto.ts:28` filters by `name === 'CommandResult'`.
Impact: If the `COMMAND_RESULT_SHAPE_NAME` constant in `@rntme/bindings` changes, the filter will break and `CommandResult` will be duplicated.
Recommendation: Import `COMMAND_RESULT_SHAPE_NAME` from `@rntme/bindings`.

**M3. Manual implementation of serialization in `buildServiceDefinition`**
Evidence: `src/server/create-server.ts:8-26` manually builds `requestSerialize` / `requestDeserialize` via `protobufjs`.
Impact: Duplicate logic that `@grpc/proto-loader` does out of the box. Makes it more difficult to maintain (for example, adding `google.protobuf.Any` or `Timestamp`).
Recommendation: Consider switching to `@grpc/proto-loader` to load `.proto` into `grpc.Server` - this corresponds to the solution in spec `2026-04-19-platform-modules-integration-design.md` §6.2.

**M4. The field name in the query response is not validated to exist in shape**
Evidence: `src/server/handler.ts:99` — `{ [toSnakeCase(fromField)]: qout.value }`.
Impact: If `output.from` points to a non-existent field, the response will contain an arbitrary key. In HTTP-surface, this logic goes through `render-response`, which has additional checks.
Recommendation: validate `fromField` against `outputShape.fields` at compile time (in `createGrpcServer`) or at least assert at runtime.

### LOW

**L1. No `grpc.health.v1.Health` surface**
Evidence: `README.md:60`. For production, orchestrators (K8s, Dokploy) expect a health endpoint.
Recommendation: add the `Health` service to the emitted proto with the `healthCheck: true` option.

**L2. Only insecure credentials**
Evidence: `README.md:61` and `src/server/create-server.ts:58` - `grpc.ServerCredentials.createInsecure()`.
Impact: Intra-cluster traffic without mTLS.
Recommendation: roadmap item; For now, document it as a known limitation.

**L3. `collectShapesFromService` collects only output shapes**
Evidence: `packages/runtime/runtime/src/start/build-grpc-surface.ts:38-47` and inline TODO.
Impact: If the binding has a `row`/`rowset` input, the corresponding message will not end up in `.proto`.
Recommendation: implement a full shape registry when the first module with row-typed inputs (already tracked) appears.

**L4. No own registry `ERROR_CODES`**
Evidence: There is no `src/types/result.ts` with `ERROR_CODES` in the package. Errors are mapped from the executor contract.
Impact: Cannot add gRPC-specific errors (e.g. `GRPC_PROTO_LOAD_FAILED`).
Recommendation: add `ERROR_CODES` similar to other packages.

**L5. Gaps in test coverage**
Evidence: analysis of `test/`:
- There is no query test with real data (only `QUERY_NOT_FOUND` stub in `create-server.test.ts`).
- No test for metadata / correlation propagation.
- No test for `loadProtoFromString` with invalid proto.
- No test for empty bindings (`emitProto` with empty `validated.resolved`).
- No test for actor (always null).

## 3. Quick wins

1. Fix `actor: null` → forwarding `actorFromRequest` via `GrpcServerOptions`.
2. Add fallback `throw` to `scalarToProto` and `fieldTypeToProto`.
3. Replace the hardcode `'CommandResult'` with the import `COMMAND_RESULT_SHAPE_NAME`.
4. Fix assertion in `demo/issue-tracker-api/test/e2e/grpc.test.ts`.
5. Add a unit test for `loadProtoFromString` with an invalid proto.
6. Add `ERROR_CODES` registry for gRPC-specific errors.

## 4. Requires Vlad’s product/architectural solution

1. **Move `executor-contract` from `bindings-http` into a shared package.** This breaks the public `bindings-http` API.
2. **Support for `pre[]` in gRPC.** Implement or explicitly disable at validator level?
3. **Health-check proto and TLS/mTLS** - what is the priority?
4. **Switch to `@grpc/proto-loader`** instead of manual serialization?

## 5. Compliance with product vision

The package corresponds to vision: gRPC — declared transport for module/service communication. But the current scope (emit + server without `pre[]`, without health, without actor) is a “minimal viable gRPC”, not a production-ready surface. Blocker/high must be closed before the package becomes a publicly documented contract for module authors.

## 6. Definition of done for audit

- [x] Full review of sources, tests, specs, runtime integration
- [x] Dependencies and directions of imports have been checked
- [x] Build/test/lint checked (all green after `pnpm -r run build`)
- [x] Issues ranked by severity with evidence and recommendations
- [x] Highlighted quick wins vs solutions that require Vlad

Audit is ready for implementation tasks.
