# Runtime Actor Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close U-288 by validating actor kind at manifest validation time and normalizing/rejecting unsafe actor IDs at the request boundary.

**Architecture:** Keep the runtime's existing optional actor contract: missing actor headers produce `null`. Invalid actor headers are treated the same way instead of stamping unsafe data into event envelopes. Manifest `auth.actorKind` is constrained to the event-store actor union (`user`, `system`, `service`) so `buildActorFromRequest` receives a validated actor kind.

**Tech Stack:** TypeScript strict ESM, Hono context shape, Vitest.

---

## File Map

- Modify `packages/runtime/runtime/src/manifest/types.ts` and `src/manifest/validate.ts` to type and validate `auth.actorKind`.
- Modify `packages/runtime/runtime/src/start/build-actor-from-request.ts` to trim actor IDs, reject empty/overlong/unsafe values, and export small validation helpers for tests.
- Create `packages/runtime/runtime/test/unit/build-actor-from-request.test.ts` for actor ID normalization.
- Modify `packages/runtime/runtime/test/unit/manifest-validate.test.ts` for invalid actor kind coverage.
- Modify `packages/runtime/runtime/README.md`, `docs/audit/00-waves.md`, and `docs/audit/01-current-priority-tasks.md` for documentation-touch.

### Task 1: Failing Tests

- [x] **Step 1: Add actor request-boundary tests**

Create `packages/runtime/runtime/test/unit/build-actor-from-request.test.ts` with tests proving:

- `normalizeActorId(undefined)` and whitespace-only input return `null`;
- valid IDs are trimmed and preserved, e.g. `auth0|user_123`;
- IDs longer than 256 characters return `null`;
- IDs with spaces or unsafe shell/control-ish characters return `null`;
- `buildActorFromRequest(manifest)` returns `{ kind: 'user', id: 'auth0|user_123' }` for a valid header and `null` for invalid.

- [x] **Step 2: Add manifest actor-kind test**

Add a test to `packages/runtime/runtime/test/unit/manifest-validate.test.ts`:

```ts
  it('rejects auth.actorKind outside the event-store actor union', () => {
    const r = validateManifest(
      { ...MIN, auth: { mode: 'header', actorKind: 'owner' } },
      RUNTIME_VERSION,
    );

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'MANIFEST_INVALID_ACTOR_KIND',
            path: 'auth.actorKind',
          }),
        ]),
      );
    }
  });
```

- [x] **Step 3: Confirm RED**

Run:

```bash
pnpm -F @rntme/runtime test -- test/unit/build-actor-from-request.test.ts test/unit/manifest-validate.test.ts
```

Expected before implementation: FAIL because actor helpers do not exist and invalid actor kind still validates.

### Task 2: Actor Validation Implementation

- [x] **Step 1: Validate manifest actor kind**

In `manifest/types.ts`, type `ValidatedManifest['auth']['actorKind']` as `ActorRef['kind']` and add `MANIFEST_INVALID_ACTOR_KIND` to `ManifestErrorCode`.

In `manifest/validate.ts`, reject any explicit `parsed.auth.actorKind` that is not `user`, `system`, or `service`.

- [x] **Step 2: Normalize actor IDs**

In `build-actor-from-request.ts`, add:

```ts
export const MAX_ACTOR_ID_LENGTH = 256;
const ACTOR_ID_PATTERN = /^[A-Za-z0-9._:@|/+=$,-]+$/;

export function normalizeActorId(id: string | undefined): string | null {
  if (id === undefined) return null;
  const trimmed = id.trim();
  if (trimmed === '' || trimmed.length > MAX_ACTOR_ID_LENGTH) return null;
  if (!ACTOR_ID_PATTERN.test(trimmed)) return null;
  return trimmed;
}
```

Then use the normalized value in `buildActorFromRequest`; return `null` when it is invalid.

- [x] **Step 3: Confirm GREEN**

Run:

```bash
pnpm -F @rntme/runtime test -- test/unit/build-actor-from-request.test.ts test/unit/manifest-validate.test.ts
```

Expected: PASS.

### Task 3: Documentation And Audit Ledger

- [x] **Step 1: Update runtime README**

Document the actor kind and actor ID validation rules under the `RuntimeConfig` or auth section.

- [x] **Step 2: Close U-288 in audit docs**

Mark U-288 `✅ closed | A8` in `docs/audit/00-waves.md`, remove it from `docs/audit/01-current-priority-tasks.md`, and update Package D evidence.

- [x] **Step 3: Full verification**

Run:

```bash
pnpm -F @rntme/runtime typecheck
pnpm -F @rntme/runtime test
pnpm -F @rntme/runtime lint
pnpm -F @rntme/runtime build
```

Expected: all PASS. Run build before full tests if `dist/` has been removed.

---

## Self-Review

- Spec coverage: U-288 asks for actor id shape and kind validation at runtime boundary; this plan validates manifest kind and normalizes request IDs.
- Placeholder scan: no placeholders remain.
- Type consistency: `ValidatedManifest.auth.actorKind` is narrowed to `ActorRef['kind']`, and `normalizeActorId` returns `string | null` for build-actor use.
