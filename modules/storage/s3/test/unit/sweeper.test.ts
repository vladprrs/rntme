import Database from 'better-sqlite3';
import { describe, expect, it, vi } from 'vitest';
import { createPendingStore, type DatabaseLike } from '../../src/pending-store.js';
import { runSweepOnce } from '../../src/sweeper.js';

describe('runSweepOnce', () => {
  it('aborts pending rows past expiresAt and best-effort deletes them from S3', async () => {
    const store = createPendingStore({
      db: new Database(':memory:') as unknown as DatabaseLike,
      now: () => 0,
    });
    store.insertPending({
      fileId: 'f1',
      routeId: 'r',
      entityId: 'e',
      ownerPrincipal: 'u',
      contentType: 'png',
      declaredSize: 1,
      objectKey: 'k',
      ttlMs: 1,
    });
    const s3 = {
      presign: vi.fn(),
      exists: vi.fn(),
      size: vi.fn(),
      deleteObject: vi.fn(async () => undefined),
    };
    const bus = { publish: vi.fn(async () => undefined) };
    const out = await runSweepOnce({ store, s3, bus, now: () => 1_000 });
    expect(out.aborted).toBe(1);
    expect(store.findById('f1')?.state).toBe('aborted');
    expect(s3.deleteObject).toHaveBeenCalledWith('k');
    expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'FileUploadAborted' }));
  });
});
