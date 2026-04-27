/**
 * Conformance scenarios for CrmModule.UpdateDeal.
 *
 * Spec: docs/superpowers/specs/2026-04-27-crm-canonical-contract-design.md §11.2.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: 'See this file docstring and CRM spec §11.2 for required happy-path, negative, event, and idempotency assertions.',
  }),
] satisfies Scenario[];
