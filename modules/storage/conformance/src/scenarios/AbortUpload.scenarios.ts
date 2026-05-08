import type { Scenario } from '../types.js';

/**
 * Conformance scenarios for StorageModule.AbortUpload.
 *
 * Inventory: abort pending upload, idempotent repeat, missing file id,
 * file not found, already committed precondition, and route-disabled reason.
 * Stubs only; runner does not exist yet.
 */
export const scenarios: ReadonlyArray<Scenario> = [
  {
    id: 'abortUpload_marksAborted',
    description: 'AbortUpload marks a pending upload aborted and returns metadata',
    status: 'pending',
    action: () => undefined,
    assertions: [],
  },
];
