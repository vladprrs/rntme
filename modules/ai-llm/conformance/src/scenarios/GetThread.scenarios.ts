/**
 * Conformance scenarios for AiLlmModule.GetThread (capability: thread=true).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - GetThread: returns canonical AssistantThread shape for an existing thread.
 *
 *   Negative:
 *     - GetThread: unknown canonical_id returns AI_LLM_REFERENCES_THREAD_NOT_FOUND.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
