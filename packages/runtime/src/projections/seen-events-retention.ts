import type Database from 'better-sqlite3';

export type SeenEventsRetentionOpts = {
  /**
   * Retain rows whose `applied_at` is within `retentionDays` days of `now`.
   * Falls back to the `RNTME_SEEN_EVENTS_RETENTION_DAYS` env var, then to a
   * 30-day default.
   *
   * This must exceed `max(Kafka retention.ms for subscribed topics) +
   * max consumer downtime`; violating that opens a double-apply window for
   * late-redelivered envelopes.
   */
  retentionDays?: number;
  /**
   * Sweep interval in milliseconds. Defaults to one hour. The returned
   * disposer clears the interval (`clearInterval`).
   */
  intervalMs?: number;
};

/**
 * Start a periodic DELETE sweep on the `seen_events` table. Runs one sweep
 * synchronously at start, then schedules recurring sweeps at `intervalMs`.
 * The returned disposer clears the interval; call it from the service
 * shutdown path.
 *
 * The interval's timer is `.unref()`-ed so it does not keep the Node
 * process alive on its own.
 */
export function startSeenEventsRetention(
  db: Database.Database,
  opts?: SeenEventsRetentionOpts,
): () => void {
  const days =
    opts?.retentionDays ??
    Number(process.env.RNTME_SEEN_EVENTS_RETENTION_DAYS ?? 30);
  const intervalMs = opts?.intervalMs ?? 60 * 60 * 1000;
  const stmt = db.prepare('DELETE FROM seen_events WHERE applied_at < ?');
  const tick = (): void => {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    stmt.run(cutoff);
  };
  // Run once at start, then on interval.
  tick();
  const handle = setInterval(tick, intervalMs);
  // Prevent the timer from keeping the Node process alive on its own.
  if (typeof handle.unref === 'function') handle.unref();
  return () => clearInterval(handle);
}
