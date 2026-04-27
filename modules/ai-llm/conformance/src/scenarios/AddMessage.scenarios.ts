/**
 * Conformance scenarios for AiLlmModule.AddMessage (capability: thread=true).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - AddMessage user role: returns ThreadItem with role=user, run_id="",
 *       ThreadMessageAdded event published.
 *     - AddMessage tool role with tool_result content: only valid in REQUIRES_ACTION
 *       state of an open run; otherwise AI_LLM_CONSISTENCY_RUN_NOT_REQUIRES_ACTION
 *       OR AI_LLM_CONSISTENCY_TOOL_RESULT_MISMATCH.
 *
 *   Capability-flagged:
 *     - AddMessage with image content (requires input_modalities ⊇ ["image"]).
 *     - AddMessage with audio content (requires input_modalities ⊇ ["audio"]).
 *     - AddMessage with file content (requires input_modalities ⊇ ["file"]).
 *
 *   Negative:
 *     - AddMessage to deleted thread returns AI_LLM_CONSISTENCY_THREAD_DELETED.
 *     - AddMessage to unknown thread returns AI_LLM_REFERENCES_THREAD_NOT_FOUND.
 *     - AddMessage with tool_result whose tool_call_id is unknown returns
 *       AI_LLM_CONSISTENCY_TOOL_RESULT_MISMATCH.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
