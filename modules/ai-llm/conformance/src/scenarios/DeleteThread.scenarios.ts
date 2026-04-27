/**
 * Conformance scenarios for AiLlmModule.DeleteThread (capability: thread=true).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - DeleteThread soft: returns thread with status=DELETED, deleted_at set,
 *       ThreadDeleted event with hard_delete=false.
 *     - DeleteThread hard: returns terminal thread, ThreadDeleted with hard_delete=true
 *       (only on vendors with native hard-delete; otherwise expect
 *       AI_LLM_CONSISTENCY_UNSUPPORTED_HARD_DELETE).
 *     - DeleteThread idempotency replay returns same final state, no duplicate event.
 *
 *   Negative:
 *     - DeleteThread: unknown canonical_id returns AI_LLM_REFERENCES_THREAD_NOT_FOUND.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
