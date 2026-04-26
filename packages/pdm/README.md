# @rntme/pdm

Parser, validator, resolver, and event-type deriver for the Platform Domain Model — rntme's source of truth for entities, fields, relations, keys, and an optional per-entity finite-state machine that drives event-sourced mutations.

## Role in the system

- Depends on: `zod` (sole runtime dep). No `@rntme/*` dependencies.
- Consumed by:
  - `@rntme/qsm` — cross-validates projections against `PdmResolver`; entity-mirror projections require the source entity to declare a `stateMachine`.
  - `@rntme/projection-consumer` — uses the resolver to bind generated columns and primary keys when compiling apply plans.
  - `@rntme/graph-ir-compiler` — uses the resolver in query and command paths; the command runtime additionally consumes `stateMachine` to validate transitions and pick creation vs. update semantics. Re-exports a `deriveEventTypeName` helper that mirrors `deriveEventTypes`' `<AggregateType><TransitionPascal>` naming.
  - `@rntme/runtime`, `@rntme/seed` — accept a `ValidatedPdm` to bootstrap a service.
- Position in pipeline: authoring artifact (PDM JSON) → `parsePdm` → `validatePdm` (structural, then state-machine) → `createPdmResolver` / `deriveEventTypes`. Output feeds every downstream package.

## File map

```
src/
  index.ts                       (entry) Public re-exports; sole import surface.
  derive/
    event-types.ts               (entry) deriveEventTypes() — one EventTypeSpec per transition.
  parse/
    parse.ts                     (entry) parsePdm() — accepts object or JSON string; runs Zod.
    schema.ts                    (entry) PdmArtifactSchema (Zod, .strict()) and PdmArtifactParsed type.
  resolvers/
    pdm-resolver.ts              (entry) createPdmResolver() — pure-lookup facade over a ValidatedPdm.
  types/
    artifact.ts                  (entry) PdmArtifact + Entity/Field/Relation/StateMachine + branded validation states.
    index.ts                     (internal) Barrel for the types directory.
    resolvers.ts                 (entry) PdmResolver and Resolved* shapes returned by the resolver.
    result.ts                    (entry) Result<T>, ok/err/isOk/isErr, ERROR_CODES, PdmError, Layer, PdmErrorCode.
  validate/
    index.ts                     (entry) validatePdm() orchestrator; re-exports the layer functions.
    state-machine.ts             (entry) validateStateMachine() — state-machine-layer rules + reachability BFS.
    structural.ts                (entry) validateStructural() — keys + relation-endpoint rules.
```

## Quick start

```ts
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
  deriveEventTypes,
  isErr,
} from '@rntme/pdm';

const raw = {
  entities: {
    Issue: {
      table: 'issues',
      fields: {
        id:        { type: 'integer',  nullable: false, column: 'id' },
        title:     { type: 'string',   nullable: false, column: 'title' },
        status:    { type: 'string',   nullable: false, column: 'status' },
        createdAt: { type: 'datetime', nullable: false, column: 'created_at', generated: 'createdAt' },
      },
      keys: ['id'],
      stateMachine: {
        stateField: 'status',
        initial: null,
        states: ['draft', 'open', 'closed'],
        transitions: {
          report: { from: null,   to: 'draft',  affects: ['title'] },
          submit: { from: 'draft', to: 'open' },
          close:  { from: 'open',  to: 'closed' },
        },
      },
    },
  },
};

const parsed = parsePdm(raw);                       // also accepts a JSON string
if (isErr(parsed)) throw new Error(JSON.stringify(parsed.errors));

const validated = validatePdm(parsed.value);
if (isErr(validated)) throw new Error(JSON.stringify(validated.errors));

const resolver = createPdmResolver(validated.value);
const eventTypes = deriveEventTypes(validated.value);
// eventTypes.find(e => e.transition === 'report')!.eventType === 'IssueReport'
// resolver.resolveTransition('Issue', 'submit')!.affects // ['status']
```

## API

| Export | Signature | Purpose |
| ------ | --------- | ------- |
| `parsePdm` | `(input: unknown) => Result<PdmArtifact>` | Zod parse. If `input` is a string, JSON-parses first. Aggregates Zod issues. |
| `PdmArtifactSchema` | `z.ZodSchema` | Raw Zod schema; re-exported for embedding in larger schemas. |
| `validateStructural` | `(artifact: PdmArtifact) => Result<StructurallyValidPdm>` | Keys reference real fields; relation `to` / `localKey` / `foreignKey` resolve. |
| `validateStateMachine` | `(artifact: StructurallyValidPdm) => Result<ValidatedPdm>` | State-machine-layer rules; BFS reachability from creation transitions. |
| `validatePdm` | `(artifact: PdmArtifact) => Result<ValidatedPdm>` | Runs structural, then state-machine. Fail-fast across layers; aggregating within. |
| `createPdmResolver` | `(artifact: ValidatedPdm) => PdmResolver` | Pure lookup of entities, fields, relations, stateMachine, transitions. |
| `deriveEventTypes` | `(artifact: ValidatedPdm) => EventTypeSpec[]` | One spec per transition, across every entity that has a `stateMachine`. |
| `ok`, `err`, `isOk`, `isErr` | — | `Result<T>` constructors and discriminators. |
| `ERROR_CODES` | `Readonly<Record<PdmErrorCode, PdmErrorCode>>` | Stable machine-readable code registry. |
| `VERSION` | `string` | Package version (`'0.0.0'`). |

Type-only exports: `PdmArtifact`, `Entity`, `Field`, `Relation`, `RelationCardinality`, `StateMachine`, `Transition`, `ScalarPrimitive` (`'integer' | 'decimal' | 'string' | 'boolean' | 'date' | 'datetime'`), `GeneratedKind` (`'id' | 'createdAt' | 'updatedAt' | 'actor'`), `ActorRef`, `StructurallyValidPdm`, `ValidatedPdm`, `PdmArtifactParsed`, `PdmResolver`, `ResolvedEntity`, `ResolvedField`, `ResolvedRelation`, `ResolvedStateMachine`, `ResolvedTransition`, `EventTypeSpec`, `EventFieldSpec`, `Result`, `Ok`, `Err`, `Layer` (`'parse' | 'structural' | 'state-machine' | 'derive' | 'internal'`), `PdmError`, `PdmErrorCode`.

`StructurallyValidPdm` and `ValidatedPdm` are branded — only `validateStructural` / `validateStateMachine` (and `validatePdm`) construct them. Functions that take a `ValidatedPdm` parameter therefore prove at compile time that validation has run.

### Validation layers

`validatePdm` is fail-fast across layers (a structural failure short-circuits the state-machine layer) and aggregates errors within each layer.

| Layer | Enforced rules |
| ----- | -------------- |
| `parse` | Zod shape; `.strict()` rejects unknown keys; `ScalarPrimitive` and `GeneratedKind` enums; transition-name regex `/^[a-z][a-zA-Z0-9]*$/`; `keys` non-empty; `stateMachine.initial === null` literal; `stateMachine.states` non-empty. |
| `structural` | Keys reference declared fields (`PDM_STRUCT_KEY_UNKNOWN_FIELD`, `PDM_STRUCT_KEY_EMPTY`); relation endpoints resolve (`PDM_STRUCT_RELATION_UNKNOWN_ENTITY`, `PDM_STRUCT_RELATION_UNKNOWN_LOCAL_KEY`, `PDM_STRUCT_RELATION_UNKNOWN_FOREIGN_KEY`). |
| `state-machine` | `stateField` exists (`PDM_SM_STATE_FIELD_MISSING`) and is a non-nullable `string` (`PDM_SM_STATE_FIELD_TYPE_INVALID`); `states` non-empty (`PDM_SM_STATES_EMPTY`) and unique (`PDM_SM_STATES_DUPLICATE`); transition `from` / `to` reference declared states (`PDM_SM_UNKNOWN_STATE`); `affects` references declared fields (`PDM_SM_UNKNOWN_AFFECTED_FIELD`), excludes keys (`PDM_SM_AFFECTS_KEY`) and generated fields (`PDM_SM_AFFECTS_GENERATED`); creation transitions (`from: null`) declare `affects` explicitly (`PDM_SM_CREATION_MISSING_AFFECTS`); self-loops declare a non-empty `affects` (`PDM_SM_EMPTY_SELF_LOOP`); every state is reachable by BFS from a creation transition (`PDM_SM_UNREACHABLE_STATE`). |

### Error codes

Every `PdmError` carries `{ layer, code, message, path?, hint? }`. All codes are members of `ERROR_CODES` and the `PdmErrorCode` union.

- Parse: `PDM_PARSE_SCHEMA_VIOLATION`.
- Structural: `PDM_STRUCT_KEY_EMPTY`, `PDM_STRUCT_KEY_UNKNOWN_FIELD`, `PDM_STRUCT_RELATION_UNKNOWN_ENTITY`, `PDM_STRUCT_RELATION_UNKNOWN_LOCAL_KEY`, `PDM_STRUCT_RELATION_UNKNOWN_FOREIGN_KEY`.
- State-machine: `PDM_SM_STATE_FIELD_MISSING`, `PDM_SM_STATE_FIELD_TYPE_INVALID`, `PDM_SM_STATES_EMPTY`, `PDM_SM_STATES_DUPLICATE`, `PDM_SM_UNKNOWN_STATE`, `PDM_SM_UNKNOWN_AFFECTED_FIELD`, `PDM_SM_AFFECTS_KEY`, `PDM_SM_AFFECTS_GENERATED`, `PDM_SM_EMPTY_SELF_LOOP`, `PDM_SM_CREATION_MISSING_AFFECTS`, `PDM_SM_UNREACHABLE_STATE`.
- Internal: `PDM_INTERNAL`.
- Reserved (registered, not currently emitted): `PDM_STRUCT_DUPLICATE_ENTITY`, `PDM_STRUCT_DUPLICATE_FIELD`, `PDM_STRUCT_DUPLICATE_RELATION`, `PDM_STRUCT_UNKNOWN_FIELD_TYPE`, `PDM_STRUCT_UNKNOWN_GENERATED_KIND`, `PDM_SM_TRAPPED_STATE`, `PDM_SM_DUPLICATE_TRANSITION_NAME`. Their corresponding violations are caught at the parse layer (Zod) or made impossible by the `Record<string, …>` shape; the codes remain reserved so downstream switches stay enum-exhaustive if the structural layer takes them over.

## Invariants & gotchas

- `validatePdm` is fail-fast across layers, aggregating within. Structural failure short-circuits the state-machine layer entirely. Verified by `test/unit/validate.test.ts` — "fails-fast on structural errors — does not run state-machine layer". To collect both reports, call `validateStructural` and `validateStateMachine` separately.
- `stateField` MUST be a non-nullable `string` field. Integer / nullable state machines are rejected by `validateStateMachine` (`test/unit/validate-state-machine.test.ts` — "rejects when stateField is not string type" / "rejects when stateField is nullable").
- Transitions are a `Record` keyed by name; `Transition` itself has no `name` field. The key MUST match `/^[a-z][a-zA-Z0-9]*$/` at the parse layer (`test/unit/parse.test.ts` — "rejects stateMachine with invalid transition name").
- `stateMachine.initial` is the literal `null`, not `null | string`. Initial-state semantics are "no row yet" — creation transitions are the only way to reach the first state. See spec §3 on creation events.
- `affects` cannot list keys or generated fields (`PDM_SM_AFFECTS_KEY` / `PDM_SM_AFFECTS_GENERATED`). The resolver and `deriveEventTypes` then auto-prepend `stateField` to the resolved `affects`, so downstream code reads `affects` as the post-resolution list — which always contains `stateField` — not the author's literal list. Verified by `test/unit/derive-event-types.test.ts` — "affects always includes stateField (even when author omitted it)" and `test/unit/resolvers.test.ts` — "resolveTransition returns normalized transition with auto-included stateField in affects".
- Creation transitions (`from: null`) MUST declare `affects` explicitly, even if empty (`PDM_SM_CREATION_MISSING_AFFECTS`). Test: `test/unit/validate-state-machine.test.ts` — "rejects creation transition without affects". Reasoning per spec: creation events have no prior row to diff against, so the field manifest must be explicit.
- Self-loop transitions (`from === to`, non-null) MUST declare a non-empty `affects` (`PDM_SM_EMPTY_SELF_LOOP`). Test: "rejects self-loop without affects" / "rejects self-loop with empty affects". A self-loop with no field changes is a no-op event the system refuses to emit.
- For creation transitions, `EventTypeSpec.payloadFields` includes only the declared `affects`, NOT the auto-prepended `stateField`. The new state value comes from the transition's `to`, written by the projection-consumer INSERT binding (see comment in `derive/event-types.ts:buildSpec`).
- Reachability is BFS-from-creation. A state with no incoming creation/forward transition is rejected (`PDM_SM_UNREACHABLE_STATE`, `test/unit/validate-state-machine.test.ts` — "detects unreachable state"). Terminal sinks with no outgoing transitions are accepted; the reserved `PDM_SM_TRAPPED_STATE` code is not emitted today.
- `Field` requires `column` and `nullable`. Both are mandatory in the Zod schema (`src/parse/schema.ts:fieldSchema` — `.strict()`).
- `relation.to` must be a local entity. Cross-service references are rejected (`PDM_STRUCT_RELATION_UNKNOWN_ENTITY`) and listed as an explicit gap in `docs/gaps/pdm-gaps.md`.
- In the project-first model, PDM is project-level and shared across services. Service ownership is expressed by the project blueprint layer, which classifies root vs. owned entities and scopes service responsibilities without making `@rntme/pdm` understand service boundaries.
- `parsePdm` accepts a JSON string. If `input` is a string it is `JSON.parse`d first; a `JSON.parse` failure surfaces as `PDM_PARSE_SCHEMA_VIOLATION` with `layer: 'parse'`. Tests: `test/unit/parse.test.ts` — "parses valid PDM (JSON string input)" / "rejects invalid JSON string".

## Out of scope / known limits

- `ScalarPrimitive` is closed: `'integer' | 'decimal' | 'string' | 'boolean' | 'date' | 'datetime'`. No `enum`, `json`, `money`, or nested struct. Demos approximate enums with plain `string`. Adding a new primitive requires reading `docs/gaps/pdm-gaps.md` first (P0/P1 list).
- `GeneratedKind` is exactly `'id' | 'createdAt' | 'updatedAt' | 'actor'`. No `deletedAt` — soft-delete must be hand-rolled as a nullable datetime, and the validator will not exclude such a field from `affects` automatically.
- No multi-table or polymorphic entities. One entity = one table. No inheritance.
- No cross-service entity references inside PDM. `relation.to` resolves only inside the project PDM; cross-service composition belongs to `@rntme/blueprint`.
- No migrations / schema-evolution support. The DDL emitted from a `ValidatedPdm` is a fresh schema; evolving an existing database is out of scope.
- No state-machine guards, side-effects, or guards on `from` arrays beyond declared-state membership. The validator does not check that every state has an outgoing transition (terminal sinks are allowed).
- No author-facing diagnostics for impossible transitions (e.g., `from: ['a', 'b']` where one branch is unreachable from creation). Reachability is computed per-state, not per-transition.
- `validatePdm` does not run `derive`. Event-type derivation is a separate, side-effect-free function the caller invokes when needed.

## Where to look first

- "How is an artifact validated?" → `validatePdm` in `src/validate/index.ts`. It calls `validateStructural` then `validateStateMachine`. Layering is verified by `test/unit/validate.test.ts`.
- "What rules does the state-machine layer enforce?" → `validateStateMachine` in `src/validate/state-machine.ts`. Per-rule cases live in `test/unit/validate-state-machine.test.ts`. Reachability is computed by the local `computeReachable` (BFS from creation transitions) in the same file.
- "How are reachable states computed?" → `computeReachable` inside `src/validate/state-machine.ts`; queue-driven BFS seeded from every transition with `from: null`.
- "What event types come out of a PDM?" → `deriveEventTypes` in `src/derive/event-types.ts`. Naming is local `pascalCase(entity) + pascalCase(transition)` — one event per transition per entity that has a `stateMachine`.
- "Why is `payloadFields` smaller than `affects`?" → `buildSpec` in `src/derive/event-types.ts`; for creation transitions the payload skips the auto-prepended `stateField` because the new value comes from `to`.
- "What does the resolver expose?" → `createPdmResolver` in `src/resolvers/pdm-resolver.ts`. The `Resolved*` shapes live in `src/types/resolvers.ts`.
- "Where are the error codes defined?" → `ERROR_CODES` const in `src/types/result.ts`. The `Layer` and `PdmError` types are in the same file.
- "What is the schema shape?" → `src/parse/schema.ts`; every Zod sub-schema is `.strict()`.
- "How are the branded `StructurallyValidPdm` / `ValidatedPdm` types declared?" → `src/types/artifact.ts` (bottom of file).
- "End-to-end pipeline example?" → `test/smoke.test.ts` exercises `parsePdm → validatePdm → deriveEventTypes → createPdmResolver` against `test/fixtures/issue-tracker-with-sm.pdm.json` (seven transitions, including the `reassign` self-loop).
- "Run only this package's tests" → `pnpm --filter @rntme/pdm test`.

## Specs

- [`../../docs/superpowers/specs/2026-04-23-project-first-blueprint-design.md`](../../docs/superpowers/specs/2026-04-23-project-first-blueprint-design.md) — active umbrella spec for the project-first pivot: moves `PDM` to the project level, introduces entity-per-file authoring, and restricts meaningful derived events to service-owned entities rather than field-level ownership.
- [`../../docs/superpowers/specs/done/2026-04-14-mutations-design.md`](../../docs/superpowers/specs/done/2026-04-14-mutations-design.md) — stateMachine extension, derived event types, and the event-sourcing topology that consumes them.
- [`../../docs/adr/2026-04-15-event-driven-architecture.md`](../../docs/adr/2026-04-15-event-driven-architecture.md) — write-path topology (event log, outbox shape, relay) that consumes the events `deriveEventTypes` produces.
- [`../../docs/gaps/pdm-gaps.md`](../../docs/gaps/pdm-gaps.md) — canonical list of PDM type-system gaps vs. a commerce-class case (Money, embedded objects, soft-delete, foreign-service-ref, migrations). Read before proposing a new `ScalarPrimitive` member or relation kind.
