import { mkdtempSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildAndPushImage } from '../../src/build-image.js';

describe('buildAndPushImage', () => {
  it('writes nginx static Dockerfile and invokes docker buildx push', async () => {
    const bundleDir = mkdtempSync(join(tmpdir(), 'mksite-build-'));
    const run = vi.fn(async () => 0);

    const result = await buildAndPushImage({
      bundleDir,
      imageRef: 'localhost:5000/site:abc1234',
      registry: { url: 'localhost:5000' },
      log: vi.fn(),
      run,
    });

    expect(result.ok).toBe(true);
    await expect(readFile(join(bundleDir, '..', 'Dockerfile'), 'utf8')).resolves.toContain('FROM nginx:alpine');
    expect(run).toHaveBeenCalledWith('docker', ['buildx', 'build', '--push', '--tag', 'localhost:5000/site:abc1234', join(bundleDir, '..')], expect.any(Function));
  });
});
