/**
 * Conformance scenarios for AiLlmModule.ListJobs (capability: async_job_types non-empty).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - ListJobs: returns jobs in created_at DESC order.
 *     - ListJobs filtered by type=BATCH_COMPLETION returns only matching jobs.
 *     - ListJobs filtered by status=COMPLETED returns only matching jobs.
 *     - ListJobs cursor pagination round-trip yields full set without dupes.
 *
 *   Negative:
 *     - (none — empty result is valid).
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
