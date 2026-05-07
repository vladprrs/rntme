import type { Scenario } from '../types.js';

/**
 * Conformance scenarios for `IdentityModule.GetUser`.
 *
 * Stubs only — fill when @rntme/conformance-framework lands. Each
 * scenario should cover at minimum:
 *   - happy path: seeded user is returned with full ref + email + status
 *   - canonical_id miss: returns IDENTITY_REFERENCES_USER_NOT_FOUND
 *   - soft-deleted user: returned with status = USER_STATUS_DELETED and deleted_at set
 *
 * See spec docs/history/specs/historical/2026-04-26-identity-canonical-contract-design.md §9.2.
 */
export const scenarios: ReadonlyArray<Scenario> = [];

