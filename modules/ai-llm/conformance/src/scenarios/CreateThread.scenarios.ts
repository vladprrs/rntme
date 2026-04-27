/**
 * Conformance scenarios for AiLlmModule.CreateThread (capability: thread=true).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - CreateThread: empty thread (no initial_messages) — asserts ThreadCreated event
 *       with initial_message_count=0, status=ACTIVE.
 *     - CreateThread: with initial_messages — asserts initial_message_count matches.
 *     - CreateThread: idempotency replay returns same thread_id, no duplicate event.
 *
 *   Negative:
 *     - CreateThread: missing idempotency_key returns AI_LLM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
