import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, mock } from 'bun:test';
import { createS3ClientForTarget, publishFolder } from '../../src/publish-folder.js';

describe('publishFolder', () => {
  it('uploads folder and returns S3Reference with content-addressable key', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pub-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><h1>x</h1>');
    const putSpy = mock(async () => ({}));

    const result = await publishFolder(dir, { kind: 's3', bucket: 'b' }, { keyPrefix: 'p' }, { client: { send: putSpy } });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ref.bucket).toBe('b');
      expect(result.value.ref.key).toMatch(/^p\/[0-9a-f]{64}\.tar\.gz$/);
      expect(result.value.ref.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(result.value.bytes).toBeGreaterThan(0);
    }
    expect(putSpy).toHaveBeenCalledTimes(1);
  });

  it('returns BUNDLE_PUBLISH_FOLDER_MISSING for nonexistent folder', async () => {
    const result = await publishFolder('/nonexistent/path', { kind: 's3', bucket: 'b' }, {}, { client: { send: mock() } });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('BUNDLE_PUBLISH_FOLDER_MISSING');
  });

  it('returns BUNDLE_PUBLISH_NO_INDEX_HTML when index.html is absent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pub-'));
    writeFileSync(join(dir, 'about.html'), '<!doctype html>');

    const result = await publishFolder(dir, { kind: 's3', bucket: 'b' }, {}, { client: { send: mock() } });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('BUNDLE_PUBLISH_NO_INDEX_HTML');
  });

  it('defaults the S3 client region for S3-compatible local endpoints', async () => {
    const client = createS3ClientForTarget({ kind: 's3', bucket: 'b', endpoint: 'http://localhost:9000' });

    await expect(client.config.region()).resolves.toBe('us-east-1');
  });

  it('uses path-style requests for S3-compatible endpoints', () => {
    const client = createS3ClientForTarget({ kind: 's3', bucket: 'b', endpoint: 'http://localhost:9000' });

    expect(client.config.forcePathStyle).toBe(true);
  });
});
