import { describe, expect, it, vi } from 'vitest';
import { runBundlePublish } from '../../../src/commands/bundle/publish.js';

describe('rntme bundle publish', () => {
  it('emits BundleSource JSON when --print-json is passed', async () => {
    const fakePublish = vi.fn(async () => ({
      ok: true as const,
      value: { ref: { bucket: 'b', key: 'p/hash.tar.gz', sha256: 'h'.repeat(64) }, bytes: 100, durationMs: 1 },
    }));
    const stdout = vi.fn();

    const exit = await runBundlePublish(
      { folder: './x', target: { kind: 's3', bucket: 'b' }, printJson: true },
      { publish: fakePublish, stdout },
    );

    expect(exit).toBe(0);
    expect(stdout).toHaveBeenCalledWith(
      JSON.stringify({ kind: 's3', bucket: 'b', key: 'p/hash.tar.gz', sha256: 'h'.repeat(64) }),
    );
  });

  it('returns non-zero exit and readable error on failure', async () => {
    const fakePublish = vi.fn(async () => ({
      ok: false as const,
      errors: [{ code: 'BUNDLE_PUBLISH_NO_INDEX_HTML' as const, message: 'index.html required' }],
    }));
    const stderr = vi.fn();

    const exit = await runBundlePublish(
      { folder: './x', target: { kind: 's3', bucket: 'b' }, printJson: false },
      { publish: fakePublish, stdout: vi.fn(), stderr },
    );

    expect(exit).toBe(1);
    expect(String(stderr.mock.calls[0]?.[0] ?? '')).toContain('BUNDLE_PUBLISH_NO_INDEX_HTML');
  });
});
