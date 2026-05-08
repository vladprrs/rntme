import type { EventBusLike } from './event-bus.js';
import type { PendingStore } from './pending-store.js';
import type { S3ClientLike } from './s3-client.js';

export async function runSweepOnce(deps: {
  store: PendingStore;
  s3: S3ClientLike;
  bus: EventBusLike;
  now?: () => number;
}): Promise<{ aborted: number }> {
  const now = deps.now ?? (() => Date.now());
  const stale = deps.store.findStalePending(now());
  for (const row of stale) {
    deps.store.markAborted(row.fileId, 'timeout');
    try {
      await deps.s3.deleteObject(row.objectKey);
    } catch {
      // best-effort cleanup
    }
    await deps.bus.publish({
      type: 'FileUploadAborted',
      subject: row.fileId,
      payload: { file_id: row.fileId, reason: 'timeout' },
    });
  }
  return { aborted: stale.length };
}

export function startSweeper(deps: {
  store: PendingStore;
  s3: S3ClientLike;
  bus: EventBusLike;
  intervalMs?: number;
}): () => void {
  const interval = deps.intervalMs ?? 60_000;
  const timer = globalThis.setInterval(() => {
    void runSweepOnce(deps);
  }, interval);
  if (typeof (timer as unknown as { unref?: () => void }).unref === 'function') {
    (timer as unknown as { unref: () => void }).unref();
  }
  return () => globalThis.clearInterval(timer);
}
