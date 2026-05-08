import type { Scenario } from '../types.js';

/**
 * Conformance scenarios for StorageModule.DeleteFile.
 *
 * Inventory: deletes committed object, idempotent repeat, missing file id,
 * file not found, owner mismatch, and emits FileDeleted.
 * Stubs only; runner does not exist yet.
 */
export const scenarios: ReadonlyArray<Scenario> = [
  {
    id: 'deleteFile_marksDeleted',
    description: 'DeleteFile deletes a committed file and returns deleted metadata',
    status: 'pending',
    action: () => undefined,
    assertions: [],
  },
];
