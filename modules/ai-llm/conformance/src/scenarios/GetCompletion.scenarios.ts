/**
 * Conformance scenarios for AiLlmModule.GetCompletion.
 *
 * Spec § 12.2 mandates:
 *
 *   Happy path:
 *     - GetCompletion: returns canonical Completion shape for a previously-Completed canonical_id
 *       (only when vendor retains; gateway and Anthropic likely return UNIMPLEMENTED here —
 *       enforced via anti-conformance, see modules-monorepo §7.3).
 *
 *   Negative:
 *     - GetCompletion: unknown canonical_id returns AI_LLM_REFERENCES_COMPLETION_NOT_FOUND.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
