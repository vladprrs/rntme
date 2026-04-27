/**
 * Conformance scenarios for AiLlmModule.CancelJob (capability: async_job_types non-empty).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - CancelJob: in-progress job transitions to CANCELLED, AsyncJobCancelled event.
 *     - CancelJob: best-effort — already-terminal job returns current state without error.
 *
 *   Negative:
 *     - CancelJob: unknown canonical_id returns AI_LLM_REFERENCES_ASYNC_JOB_NOT_FOUND.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
