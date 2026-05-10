import { describe, expect, it } from 'bun:test';
import { proto } from '../src/index.js';

const EXPECTED_RPCS = [
  'PrepareUpload',
  'CommitUpload',
  'AbortUpload',
  'GetFile',
  'ListFiles',
  'GetDownloadUrl',
  'DeleteFile',
] as const;

const EXPECTED_RPC_EVENT_FIXTURE_NAMES = {
  PrepareUpload: ['FileUploadInitiated'],
  CommitUpload: ['FileUploadCommitted'],
  AbortUpload: ['FileUploadAborted'],
  GetFile: [],
  ListFiles: [],
  GetDownloadUrl: [],
  DeleteFile: ['FileDeleted'],
} as const satisfies Record<(typeof EXPECTED_RPCS)[number], readonly string[]>;

function rpcNamesFromPrototype(): Set<string> {
  const Cons = proto.rntme.contracts.storage.v1.StorageModule;
  const names = new Set<string>();
  for (const key of Object.getOwnPropertyNames(Cons.prototype)) {
    if (key === 'constructor') continue;
    const fn = (Cons.prototype as unknown as Record<string, unknown>)[key];
    if (typeof fn !== 'function') continue;
    const name = (fn as { name?: string }).name;
    if (name && /^[A-Z][a-zA-Z0-9]*$/.test(name)) names.add(name);
  }
  return names;
}

describe('service StorageModule shape', () => {
  it('declares exactly 7 RPCs by canonical name', () => {
    const methodNames = rpcNamesFromPrototype();
    expect(methodNames.size).toBe(7);
    expect([...methodNames].sort()).toEqual([...EXPECTED_RPCS].sort());
  });

  it('keeps the RPC short-name to event-fixture-name mapping in sync', () => {
    expect(Object.keys(EXPECTED_RPC_EVENT_FIXTURE_NAMES).sort()).toEqual([...EXPECTED_RPCS].sort());
  });
});
