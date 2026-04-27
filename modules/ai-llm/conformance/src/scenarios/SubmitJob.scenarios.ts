/**
 * Conformance scenarios for AiLlmModule.SubmitJob (capability: async_job_types ⊇ ["BATCH_COMPLETION"]).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - SubmitJob batch_completion: small batch (2 items) — asserts AsyncJob shape
 *       with type=BATCH_COMPLETION, status one of VALIDATING|QUEUED, AsyncJobSubmitted
 *       event with input_item_count=2.
 *     - SubmitJob lifecycle: full state machine
 *         steps:
 *           1. SubmitJob(small batch)
 *           2. assertEventWithin: AsyncJobStatusChanged transitions through QUEUED → RUNNING
 *           3. assertEventWithin: AsyncJobCompleted (timeout up to 24h in live mode; mock
 *              vendor completes in <5s).
 *           4. GetJob: returns COMPLETED with non-empty result_uri.
 *
 *     - SubmitJob idempotency replay returns same job_id, no duplicate event.
 *
 *   Negative:
 *     - SubmitJob: missing idempotency_key returns AI_LLM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY.
 *     - SubmitJob: empty body returns AI_LLM_STRUCTURAL_EMPTY_MESSAGES (no items).
 *     - SubmitJob: oversized batch returns AI_LLM_CONSISTENCY_BATCH_TOO_LARGE.
 *     - SubmitJob with VENDOR_SPECIFIC type returns AI_LLM_CONSISTENCY_UNSUPPORTED_ASYNC_JOB_TYPE.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
