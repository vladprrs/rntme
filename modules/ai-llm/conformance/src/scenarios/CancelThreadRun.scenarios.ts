/**
 * Conformance scenarios for AiLlmModule.CancelThreadRun (capability: thread=true).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - CancelThreadRun: in-progress run transitions to CANCELLED, ThreadRunCancelled event.
 *     - CancelThreadRun: best-effort — already-terminal run returns current state without error.
 *
 *   Negative:
 *     - CancelThreadRun: unknown run_id returns AI_LLM_REFERENCES_THREAD_RUN_NOT_FOUND.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
