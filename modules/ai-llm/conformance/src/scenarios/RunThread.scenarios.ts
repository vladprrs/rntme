/**
 * Conformance scenarios for AiLlmModule.RunThread (capability: thread=true).
 *
 * Spec § 12.2 — RunThread is the most complex multi-step scenario.
 *
 *   Happy path:
 *     - Thread: full tool-call cycle:
 *         steps:
 *           1. CreateThread
 *           2. AddMessage(user, "What is the weather in Berlin?")
 *           3. RunThread(tools=[get_weather])
 *           4. assertEventWithin: ThreadRunRequiresAction (30s)
 *           5. AddMessage(role=tool, ContentBlock{tool_result, tool_call_id matches event})
 *           6. RunThread()  // same thread, new run
 *           7. assertEventWithin: ThreadRunCompleted (30s)
 *
 *     - RunThread plain: simple run without tools, asserts ThreadRunCompleted with
 *       new_items containing assistant message.
 *
 *   Negative:
 *     - RunThread: unknown thread_id returns AI_LLM_REFERENCES_THREAD_NOT_FOUND.
 *     - RunThread: thread with status=DELETED returns AI_LLM_CONSISTENCY_THREAD_DELETED.
 *
 *   Capability-flagged:
 *     - RunThread with reasoning_effort=HIGH (requires reasoning_visibility_supported
 *       to include hidden at minimum).
 *
 * Scenarios are empty in v1 skeleton; the multi-step Thread tool-cycle is the canonical
 * acceptance test for this RPC and lands first when the framework gains step+substitution
 * support ($1.canonical_id).
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
