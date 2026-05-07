/**
 * Conformance scenarios for CrmModule.UpdateCompany.
 *
 * Spec: docs/history/specs/historical/2026-04-27-crm-canonical-contract-design.md §11.2.
 */

import type { Scenario } from '../types.js';
import { pendingScenario } from '../types.js';
import { assertionsFor } from './assertions.js';

const rpcName = new URL(import.meta.url).pathname.split('/').pop()?.replace('.scenarios.ts', '') ?? 'UnknownRpc';

export const scenarios = [
  pendingScenario({
    id: rpcName + '.pending',
    capability: rpcName,
    name: rpcName + ' pending conformance fixture',
    assertionsDescription: assertionsFor(rpcName),
  }),
] satisfies Scenario[];
