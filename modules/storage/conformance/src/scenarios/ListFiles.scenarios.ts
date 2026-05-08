import type { Scenario } from '../types.js';

/**
 * Conformance scenarios for StorageModule.ListFiles.
 *
 * Inventory: lists committed files by route/entity, pagination, missing route,
 * missing entity, entity not found, owner mismatch, and max-count ordering.
 * Stubs only; runner does not exist yet.
 */
export const scenarios: ReadonlyArray<Scenario> = [
  {
    id: 'listFiles_byRouteAndEntity',
    description: 'ListFiles returns committed files for a route/entity pair',
    status: 'pending',
    action: () => undefined,
    assertions: [],
  },
];
