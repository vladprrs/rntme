/**
 * Conformance scenarios for AiLlmModule.ListThreadItems (capability: thread=true).
 *
 * Spec § 12.2:
 *   Happy path:
 *     - ListThreadItems: returns items in created_at DESC order by default.
 *     - ListThreadItems: limit=N returns at most N items, has_more accurate.
 *     - ListThreadItems: cursor pagination round-trip yields full set without dupes.
 *     - ListThreadItems: after_item_id shortcut returns items strictly after that id.
 *
 *   Negative:
 *     - ListThreadItems: unknown thread_id returns AI_LLM_REFERENCES_THREAD_NOT_FOUND.
 *
 * Scenarios are empty in v1 skeleton.
 */

import type { Scenario } from '../types.js';

export const scenarios: ReadonlyArray<Scenario> = [];
