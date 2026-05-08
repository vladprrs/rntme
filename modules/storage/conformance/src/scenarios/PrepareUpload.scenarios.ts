import type { Scenario } from '../types.js';

/**
 * Conformance scenarios for StorageModule.PrepareUpload.
 *
 * Inventory: returns presign, idempotent repeat, missing route/entity,
 * oversize, disallowed mime, max-count, anonymous, and missing role.
 * Stubs only; runner does not exist yet.
 */
export const scenarios: ReadonlyArray<Scenario> = [
  {
    id: 'prepareUpload_returnsPresign',
    description: 'PrepareUpload returns a presigned PUT URL and a fileId',
    status: 'pending',
    action: () => undefined,
    assertions: [],
  },
];
