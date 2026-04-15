# @rntme/pdm

Parser, validator, resolver and event-type deriver for the **Platform Domain Model** — rntme's source of truth for entities, fields, relations, and (optionally) a per-entity finite-state machine that drives event-sourced mutations.

## Role in the system

`@rntme/pdm` is a zero-internal-dependency foundation package. Downstream consumers:

- [`@rntme/qsm`](../qsm) validates projections against a `PdmResolver` and needs `deriveEventTypes` for handler derivation.
- [`@rntme/projection-consumer`](../projection-consumer) uses the resolver when compiling apply plans (generated fields, idempotency columns).
- [`@rntme/graph-ir-compiler`](../graph-ir-compiler) consumes the resolver in both the query and command paths; the command runtime additionally uses the stateMachine to validate transitions.

## Install

```bash
pnpm add @rntme/pdm zod
```

## Quick start

```ts
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
  deriveEventTypes,
} from '@rntme/pdm';

const raw = {
  entities: {
    Issue: {
      table: 'issues',
      keys: ['id'],
      fields: {
        id:        { type: 'integer', generated: 'id' },
        title:     { type: 'string' },
        status:    { type: 'string' },
        createdAt: { type: 'datetime', generated: 'createdAt' },
        updatedAt: { type: 'datetime', generated: 'updatedAt' },
        actor:     { type: 'string',   generated: 'actor' },
      },
      stateMachine: {
        stateField: 'status',
        states: ['draft', 'open', 'closed'],
        transitions: [
          { name: 'report', from: null,     to: 'draft',  affects: ['title', 'status'] },
          { name: 'submit', from: 'draft',  to: 'open',   affects: ['status'] },
          { name: 'close',  from: 'open',   to: 'closed', affects: ['status'] },
        ],
      },
    },
  },
};

const parsed = parsePdm(raw);
if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));

const validated = validatePdm(parsed.value);
if (!validated.ok) throw new Error(JSON.stringify(validated.errors));

const resolver = createPdmResolver(validated.value);
const eventTypes = deriveEventTypes(validated.value);
// eventTypes[0].name === 'IssueReport' (derived from Issue + 'report')
```

## API

| Export | Signature | Purpose |
| ------ | --------- | ------- |
| `parsePdm` | `(raw: unknown) => Result<PdmArtifactParsed>` | Zod-driven structural parsing. |
| `PdmArtifactSchema` | `z.ZodSchema` | Raw Zod schema (exported for embedding). |
| `validateStructural` | `(parsed) => Result<StructurallyValidPdm>` | Duplicate / reference / key / generated-kind checks. |
| `validateStateMachine` | `(structural) => Result<ValidatedPdm>` | State-machine rules (duplicate transitions, unreachable states, affects/keys/generated violations, …). |
| `validatePdm` | `(parsed) => Result<ValidatedPdm>` | Convenience: runs both validation layers and aggregates errors. |
| `createPdmResolver` | `(validated: ValidatedPdm) => PdmResolver` | Pure-lookup resolver for entities / fields / relations / stateMachine. |
| `deriveEventTypes` | `(validated: ValidatedPdm) => EventTypeSpec[]` | One `EventTypeSpec` per transition across every entity that has a stateMachine. |
| `ok`, `err`, `isOk`, `isErr` | | `Result<T>` helpers. |
| `ERROR_CODES` | | Stable machine-readable error-code registry (see below). |

## Exported types

```ts
import type {
  // artifact
  PdmArtifact,
  StructurallyValidPdm,
  ValidatedPdm,
  Entity,
  Field,
  Relation,
  RelationCardinality,
  StateMachine,
  Transition,
  ScalarPrimitive,          // 'integer' | 'decimal' | 'string' | 'boolean' | 'date' | 'datetime'
  GeneratedKind,            // 'id' | 'createdAt' | 'updatedAt' | 'actor'
  ActorRef,                 // { kind: 'user' | 'system' | 'service'; id: string }
  // resolver
  PdmResolver,
  ResolvedEntity,
  ResolvedField,
  ResolvedRelation,
  ResolvedStateMachine,
  ResolvedTransition,
  // event types
  EventTypeSpec,
  EventFieldSpec,
  // result monad
  Result, Ok, Err,
  Layer, PdmError, PdmErrorCode,
} from '@rntme/pdm';
```

`ValidatedPdm` is a **branded** type: it can only be constructed by `validatePdm`/`validateStateMachine`, so downstream packages statically prove validation has run.

## Validation layers

`validatePdm` collects independent errors within each layer before failing.

| Layer | Examples of what it enforces |
| ----- | ---------------------------- |
| `parse` | Zod shape; required fields present; enum values. |
| `structural` | Unique entity/field/relation names; known field types; relation endpoints exist; keys reference real fields; `generated` kinds recognised. |
| `state-machine` | `stateField` exists and is `string`/`integer`; no duplicate transition names; every non-initial state is reachable; no trapped terminal states; `affects` doesn't target keys or generated fields; creation transitions (`from: null`) include `affects`. |

### Error codes

All codes live in `ERROR_CODES` and have a `PdmErrorCode` union type. Representative entries:

- Parse: `PDM_PARSE_SCHEMA_VIOLATION`.
- Structural: `PDM_STRUCT_DUPLICATE_ENTITY`, `PDM_STRUCT_DUPLICATE_FIELD`, `PDM_STRUCT_DUPLICATE_RELATION`, `PDM_STRUCT_UNKNOWN_FIELD_TYPE`, `PDM_STRUCT_UNKNOWN_GENERATED_KIND`, `PDM_STRUCT_RELATION_UNKNOWN_ENTITY`, `PDM_STRUCT_RELATION_UNKNOWN_LOCAL_KEY`, `PDM_STRUCT_RELATION_UNKNOWN_FOREIGN_KEY`, `PDM_STRUCT_KEY_UNKNOWN_FIELD`, `PDM_STRUCT_KEY_EMPTY`.
- State-machine: `PDM_SM_STATE_FIELD_MISSING`, `PDM_SM_STATE_FIELD_TYPE_INVALID`, `PDM_SM_STATES_EMPTY`, `PDM_SM_STATES_DUPLICATE`, `PDM_SM_UNKNOWN_STATE`, `PDM_SM_UNKNOWN_AFFECTED_FIELD`, `PDM_SM_AFFECTS_KEY`, `PDM_SM_AFFECTS_GENERATED`, `PDM_SM_EMPTY_SELF_LOOP`, `PDM_SM_CREATION_MISSING_AFFECTS`, `PDM_SM_UNREACHABLE_STATE`, `PDM_SM_TRAPPED_STATE`, `PDM_SM_DUPLICATE_TRANSITION_NAME`.
- Internal: `PDM_INTERNAL`.

Every `PdmError` carries `layer`, `code`, `message`, and an optional `path` and `hint`.

## StateMachine extension

`StateMachine` sits next to the rest of an `Entity` and contributes nothing to structural compilation — it is consumed by `deriveEventTypes` (to name events and derive payload field lists per transition), by `@rntme/qsm` (entity-mirror projections require a stateMachine), and by the command runtime in `@rntme/graph-ir-compiler` (to validate transitions and decide creation vs. update).

Event-type naming uses `deriveEventTypeName` (re-exported from `@rntme/graph-ir-compiler`) and follows `<AggregateType><TransitionPascal>` — e.g. `Issue` + `report` → `IssueReport`.

## Spec

See [`docs/superpowers/specs/2026-04-14-mutations-design.md`](../../docs/superpowers/specs/2026-04-14-mutations-design.md) §2–§3 for the authoritative spec.
