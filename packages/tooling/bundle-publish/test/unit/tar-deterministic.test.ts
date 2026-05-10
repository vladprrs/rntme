import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import * as tar from 'tar-stream';
import { describe, expect, it } from 'bun:test';
import { buildDeterministicTarGz } from '../../src/tar-deterministic.js';

function makeFolder(): string {
  const dir = mkdtempSync(join(tmpdir(), 'bp-'));
  mkdirSync(join(dir, 'sub'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><h1>hi</h1>');
  writeFileSync(join(dir, 'sub', 'a.css'), 'body {}');
  return dir;
}

async function listTarEntries(gz: Buffer): Promise<string[]> {
  const names: string[] = [];
  await new Promise<void>((resolve, reject) => {
    const extract = tar.extract();
    extract.on('entry', (header, stream, next) => {
      names.push(header.name);
      stream.resume();
      stream.on('end', next);
    });
    extract.on('finish', resolve);
    extract.on('error', reject);
    extract.end(gunzipSync(gz));
  });
  return names;
}

describe('buildDeterministicTarGz', () => {
  it('produces identical bytes for identical input across calls', async () => {
    const dir = makeFolder();

    const a = await buildDeterministicTarGz(dir, []);
    const b = await buildDeterministicTarGz(dir, []);

    expect(Buffer.compare(a, b)).toBe(0);
  });

  it('honors ignore globs', async () => {
    const dir = makeFolder();
    writeFileSync(join(dir, '.git'), '');

    const out = await buildDeterministicTarGz(dir, ['.git', '.git/**']);

    await expect(listTarEntries(out)).resolves.toEqual(['index.html', 'sub/a.css']);
  });
});
