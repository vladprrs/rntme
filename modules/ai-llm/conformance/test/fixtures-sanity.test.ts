import { describe, expect, it } from 'vitest';
import { statSync, readFileSync } from 'node:fs';
import { samplePngPath, sampleMp3Path, samplePdfPath } from '../src/fixtures/media/index.js';

const MAX_SIZE_BYTES = 100 * 1024; // 100 KB per spec §16

describe('binary media fixtures', () => {
  it('sample.png exists and is ≤ 100KB and is a valid PNG', () => {
    const stat = statSync(samplePngPath);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(MAX_SIZE_BYTES);
    const head = readFileSync(samplePngPath).subarray(0, 8);
    expect(Array.from(head)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it('sample.mp3 exists and is ≤ 100KB and starts with an MP3 frame sync', () => {
    const stat = statSync(sampleMp3Path);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(MAX_SIZE_BYTES);
    const head = readFileSync(sampleMp3Path).subarray(0, 2);
    expect(head[0]).toBe(0xff);
    expect((head[1]! & 0xe0) === 0xe0).toBe(true);
  });

  it('sample.pdf exists and is ≤ 100KB and starts with %PDF-', () => {
    const stat = statSync(samplePdfPath);
    expect(stat.size).toBeGreaterThan(0);
    expect(stat.size).toBeLessThanOrEqual(MAX_SIZE_BYTES);
    const head = readFileSync(samplePdfPath, { encoding: 'utf8' }).slice(0, 5);
    expect(head).toBe('%PDF-');
  });
});
