import { describe, expect, it, mock } from 'bun:test';
import { runBundlePublish } from '../../../src/commands/bundle/publish.js';

describe('rntme bundle publish', () => {
  it('emits BundleSource JSON when --print-json is passed', async () => {
    const fakePublish = mock(async () => ({
      ok: true as const,
      value: { ref: { bucket: 'b', key: 'p/hash.tar.gz', sha256: 'h'.repeat(64) }, bytes: 100, durationMs: 1 },
    }));
    const stdout = mock();

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
    const fakePublish = mock(async () => ({
      ok: false as const,
      errors: [{ code: 'BUNDLE_PUBLISH_NO_INDEX_HTML' as const, message: 'index.html required' }],
    }));
    const stderr = mock();

    const exit = await runBundlePublish(
      { folder: './x', target: { kind: 's3', bucket: 'b' }, printJson: false },
      { publish: fakePublish, stdout: mock(), stderr },
    );

    expect(exit).toBe(1);
    expect(String(stderr.mock.calls[0]?.[0] ?? '')).toContain('BUNDLE_PUBLISH_NO_INDEX_HTML');
  });
});
