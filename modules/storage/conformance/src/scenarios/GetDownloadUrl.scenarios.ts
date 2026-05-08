import type { Scenario } from '../types.js';

/**
 * Conformance scenarios for StorageModule.GetDownloadUrl.
 *
 * Inventory: returns a presigned GET URL, clamps/validates TTL, missing file id,
 * file not found, deleted file, and owner mismatch.
 * Stubs only; runner does not exist yet.
 */
export const scenarios: ReadonlyArray<Scenario> = [
  {
    id: 'getDownloadUrl_returnsPresign',
    description: 'GetDownloadUrl returns a presigned GET URL for a committed file',
    status: 'pending',
    action: () => undefined,
    assertions: [],
  },
];
