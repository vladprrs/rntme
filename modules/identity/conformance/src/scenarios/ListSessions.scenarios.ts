import type { Scenario } from '../types.js';

/**
 * Conformance scenarios for `IdentityModule.ListSessions`.
 *
 * Stubs only — fill when @rntme/conformance-framework lands. Each
 * scenario asserts shape match against canonical proto, idempotent replay
 * with the same idempotency_key, expected error code on negative branches,
 * and (for command RPCs) expected CloudEvents `type` published within 5s.
 *
 * See spec docs/superpowers/specs/done/2026-04-26-identity-canonical-contract-design.md §9.2.
 */
export const scenarios: ReadonlyArray<Scenario> = [];
