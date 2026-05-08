import type { Scenario } from '../types.js';

/**
 * Conformance scenarios for StorageModule.GetFile.
 *
 * Inventory: reads committed file metadata, missing file id, file not found,
 * owner mismatch, and deleted-file behavior.
 * Stubs only; runner does not exist yet.
 */
export const scenarios: ReadonlyArray<Scenario> = [
  {
    id: 'getFile_returnsMetadata',
    description: 'GetFile returns metadata for a committed file',
    status: 'pending',
    action: () => undefined,
    assertions: [],
  },
];
