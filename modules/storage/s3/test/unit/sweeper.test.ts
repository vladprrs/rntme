import { Database } from 'bun:sqlite';
import { describe, expect, it, mock } from 'bun:test';
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
      presign: mock(),
      exists: mock(),
      size: mock(),
      deleteObject: mock(async () => undefined),
    };
    const bus = { publish: mock(async () => undefined) };
    const out = await runSweepOnce({ store, s3, bus, now: () => 1_000 });
    expect(out.aborted).toBe(1);
    expect(store.findById('f1')?.state).toBe('aborted');
    expect(s3.deleteObject).toHaveBeenCalledWith('k');
    expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({ type: 'FileUploadAborted' }));
  });
});
