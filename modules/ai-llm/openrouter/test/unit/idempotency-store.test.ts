import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createIdempotencyStore, type IdempotencyStore } from '../../src/idempotency-store.js';

interface TempCtx { dir: string; store: IdempotencyStore }

function makeFixtureBytes(s: string): Buffer { return Buffer.from(s); }

for (const mode of ['sqlite', 'memory'] as const) {
  describe(`IdempotencyStore (${mode})`, () => {
    let ctx: TempCtx;
    let now = Date.parse('2026-05-06T10:00:00Z');

    beforeEach(() => {
      const dir = mkdtempSync(join(tmpdir(), 'ai-llm-or-test-'));
      const store = createIdempotencyStore(
        mode === 'sqlite'
          ? { mode: 'sqlite', path: join(dir, 'idem.sqlite'), ttlMs: 24 * 3600_000, now: () => now }
          : { mode: 'memory', ttlMs: 24 * 3600_000, now: () => now },
      );
      ctx = { dir, store };
    });

    afterEach(async () => {
      await ctx.store.close();
      rmSync(ctx.dir, { recursive: true, force: true });
    });

    it('returns null on get for missing key', async () => {
      expect(await ctx.store.get('missing')).toBeNull();
    });

    it('round-trips put/get', async () => {
      await ctx.store.put('k1', makeFixtureBytes('payload-1'));
      const got = await ctx.store.get('k1');
      expect(got).not.toBeNull();
      expect(got!.toString()).toBe('payload-1');
    });

    it('returns null after TTL expiry', async () => {
      await ctx.store.put('k2', makeFixtureBytes('payload-2'));
      now += 24 * 3600_000 + 1;
      expect(await ctx.store.get('k2')).toBeNull();
    });

    it('evictExpired removes stale rows', async () => {
      await ctx.store.put('a', makeFixtureBytes('a'));
      now += 24 * 3600_000 + 1;
      await ctx.store.put('b', makeFixtureBytes('b'));
      const removed = await ctx.store.evictExpired();
      expect(removed).toBe(1);
      expect(await ctx.store.get('a')).toBeNull();
      expect(await ctx.store.get('b')).not.toBeNull();
    });
  });
}
