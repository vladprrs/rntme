import type { Scenario } from '../types.js';

/**
 * Conformance scenarios for StorageModule.CommitUpload.
 *
 * Inventory: committed object becomes durable metadata, repeat is idempotent,
 * missing file id, file not found, already committed, expired upload.
 * Stubs only; runner does not exist yet.
 */
export const scenarios: ReadonlyArray<Scenario> = [
  {
    id: 'commitUpload_marksCommitted',
    description: 'CommitUpload verifies the object and returns committed file metadata',
    status: 'pending',
    action: () => undefined,
    assertions: [],
  },
];
