/**
 * Conformance scenarios for AiLlmModule.GetThreadRun (capability: thread=true).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - GetThreadRun: returns canonical ThreadRun shape with current status.
 *
 *   Negative:
 *     - GetThreadRun: unknown thread_id returns AI_LLM_REFERENCES_THREAD_NOT_FOUND.
 *     - GetThreadRun: unknown run_id returns AI_LLM_REFERENCES_THREAD_RUN_NOT_FOUND.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
