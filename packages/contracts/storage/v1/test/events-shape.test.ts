import { describe, expect, it } from 'bun:test';
import { proto } from '../src/index.js';

const EXPECTED_EVENTS = [
  'FileUploadInitiated',
  'FileUploadCommitted',
  'FileUploadAborted',
  'FileOrphaned',
  'FileDeleted',
  'FileLifecycleSwept',
] as const;

describe('storage event payloads', () => {
  it('every event short-name is exported as a Message constructor', () => {
    const ns = proto.rntme.contracts.storage.v1 as unknown as Record<string, unknown>;
    for (const evt of EXPECTED_EVENTS) {
      expect(ns[evt], `event message ${evt} missing from generated proto`).toBeDefined();
    }
    expect(EXPECTED_EVENTS.length).toBe(6);
  });
});
