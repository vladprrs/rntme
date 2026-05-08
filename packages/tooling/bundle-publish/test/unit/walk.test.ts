import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { walkFolder } from '../../src/walk.js';

describe('walkFolder', () => {
  it('returns entries sorted by relPath', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'walk-'));
    writeFileSync(join(dir, 'b.txt'), '2');
    writeFileSync(join(dir, 'a.txt'), '1');

    const { entries } = await walkFolder(dir, [], 1024);

    expect(entries.map((entry) => entry.relPath)).toEqual(['a.txt', 'b.txt']);
  });

  it('throws when total bytes exceed maxBytes', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'walk-'));
    writeFileSync(join(dir, 'big.bin'), Buffer.alloc(1024));

    await expect(walkFolder(dir, [], 100)).rejects.toThrow('BUNDLE_PUBLISH_TOO_LARGE');
  });

  it('honors ignore globs', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'walk-'));
    mkdirSync(join(dir, 'node_modules'));
    writeFileSync(join(dir, 'node_modules', 'x.js'), '');
    writeFileSync(join(dir, 'index.html'), '<html>');

    const { entries } = await walkFolder(dir, ['node_modules/**'], 1024 * 1024);

    expect(entries.map((entry) => entry.relPath)).toEqual(['index.html']);
  });
});
