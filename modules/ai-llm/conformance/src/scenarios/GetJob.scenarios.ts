/**
 * Conformance scenarios for AiLlmModule.GetJob (capability: async_job_types non-empty).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - GetJob: returns canonical AsyncJob with current status.
 *
 *   Negative:
 *     - GetJob: unknown canonical_id returns AI_LLM_REFERENCES_ASYNC_JOB_NOT_FOUND.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
