/**
 * Conformance scenarios for AiLlmModule.Complete.
 *
 * Spec § 12.2 mandates the following scenarios at minimum:
 *
 *   Happy path:
 *     - Complete: text-only single-turn (asserts: response shape, finish_reason=STOP|LENGTH,
 *       usage.input_tokens > 0, usage.output_tokens > 0, content[0].type=TEXT,
 *       CompletionFinished event published within 5s).
 *     - Complete: same idempotency_key returns same completion_id, no duplicate event.
 *
 *   Capability-flagged:
 *     - Complete: image input (requires input_modalities ⊇ ["image"]).
 *     - Complete: audio input (requires input_modalities ⊇ ["audio"]).
 *     - Complete: file input (requires input_modalities ⊇ ["file"]).
 *     - Complete: model returns tool_calls (asserts finish_reason=TOOL_CALLS,
 *       tool_calls[0].name matches input tool, arguments parses to expected struct).
 *     - Complete: reasoning with FULL visibility (requires reasoning_visibility_supported ⊇ ["full"];
 *       asserts usage.reasoning_tokens > 0, ContentBlock type=THINKING present).
 *     - Complete: reasoning with SUMMARY visibility (requires ⊇ ["summary"]).
 *
 *   Negative (structural):
 *     - Complete: missing model returns AI_LLM_STRUCTURAL_MISSING_MODEL.
 *     - Complete: missing idempotency_key returns AI_LLM_STRUCTURAL_MISSING_IDEMPOTENCY_KEY.
 *     - Complete: empty messages returns AI_LLM_STRUCTURAL_EMPTY_MESSAGES.
 *     - Complete: foreign vendor prefix returns AI_LLM_STRUCTURAL_VENDOR_MISMATCH.
 *     - Complete: invalid tool schema returns AI_LLM_STRUCTURAL_INVALID_TOOL_SCHEMA.
 *
 *   Negative (consistency):
 *     - Complete: audio block when input_modalities ⊉ ["audio"] returns
 *       AI_LLM_CONSISTENCY_UNSUPPORTED_MODALITY.
 *     - Complete: REASONING_VISIBILITY_FULL when reasoning_visibility_supported ⊉ ["full"]
 *       returns AI_LLM_CONSISTENCY_UNSUPPORTED_REASONING_VISIBILITY.
 *
 * Scenarios are empty in v1 skeleton — the runner does not yet exist. When
 * @rntme/conformance-framework lands, replace this array with concrete Scenario
 * objects per spec §12.2 and the framework's assertion DSL.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
