import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { isErr, isOk, loadArtifactDir, ok } from '../src/index.js';

type DemoError = { code: string; message: string; path: string };

const buildIoError = ({ message, path }: { message: string; path: string }): DemoError => ({
  code: 'IO',
  message,
  path,
});

const IndexSchema = z
  .object({
    version: z.string().optional(),
    relations: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

describe('loadArtifactDir', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'load-artifact-dir-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('happy path: parses index and assembles leaf entries', async () => {
    writeFileSync(join(dir, 'index.json'), JSON.stringify({ version: '1', relations: { a: {} } }));
    mkdirSync(join(dir, 'leaves'));
    writeFileSync(join(dir, 'leaves', 'one.json'), JSON.stringify({ name: 'one' }));
    writeFileSync(join(dir, 'leaves', 'two.json'), JSON.stringify({ name: 'two' }));
    writeFileSync(join(dir, 'leaves', 'README.md'), 'ignored');

    const r = await loadArtifactDir<z.output<typeof IndexSchema>, { index: unknown; leaves: unknown }, DemoError>({
      dir,
      indexFile: 'index.json',
      leafDir: 'leaves',
      indexSchema: IndexSchema,
      parseFn: ({ index, leafEntries }) => ok({ index, leaves: leafEntries }),
      buildIoError,
    });

    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.index).toEqual({ version: '1', relations: { a: {} } });
      expect(r.value.leaves).toEqual({ one: { name: 'one' }, two: { name: 'two' } });
    }
  });

  it('threads the parsed index through to parseFn (relations default applied)', async () => {
    writeFileSync(join(dir, 'index.json'), JSON.stringify({}));
    mkdirSync(join(dir, 'leaves'));

    let received: unknown;
    await loadArtifactDir<z.output<typeof IndexSchema>, null, DemoError>({
      dir,
      indexFile: 'index.json',
      leafDir: 'leaves',
      indexSchema: IndexSchema,
      parseFn: ({ index }) => {
        received = index;
        return ok(null);
      },
      buildIoError,
    });

    expect(received).toEqual({ relations: {} });
  });

  it('returns IO error when index file is missing', async () => {
    mkdirSync(join(dir, 'leaves'));
    const r = await loadArtifactDir<z.output<typeof IndexSchema>, null, DemoError>({
      dir,
      indexFile: 'index.json',
      leafDir: 'leaves',
      indexSchema: IndexSchema,
      parseFn: () => ok(null),
      buildIoError,
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0]?.path).toBe('index.json');
      expect(r.errors[0]?.message).toContain('missing required file: index.json');
    }
  });

  it('returns IO error when leaf directory is missing', async () => {
    writeFileSync(join(dir, 'index.json'), JSON.stringify({}));
    const r = await loadArtifactDir<z.output<typeof IndexSchema>, null, DemoError>({
      dir,
      indexFile: 'index.json',
      leafDir: 'leaves',
      indexSchema: IndexSchema,
      parseFn: () => ok(null),
      buildIoError,
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.errors[0]?.path).toBe('leaves');
      expect(r.errors[0]?.message).toContain('missing required directory: leaves');
    }
  });

  it('returns IO error when index JSON is malformed', async () => {
    writeFileSync(join(dir, 'index.json'), '{not json');
    mkdirSync(join(dir, 'leaves'));
    const r = await loadArtifactDir<z.output<typeof IndexSchema>, null, DemoError>({
      dir,
      indexFile: 'index.json',
      leafDir: 'leaves',
      indexSchema: IndexSchema,
      parseFn: () => ok(null),
      buildIoError,
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.errors[0]?.path).toBe(dir);
    }
  });

  it('returns IO error when index fails the schema', async () => {
    writeFileSync(join(dir, 'index.json'), JSON.stringify({ version: 5 }));
    mkdirSync(join(dir, 'leaves'));
    const r = await loadArtifactDir<z.output<typeof IndexSchema>, null, DemoError>({
      dir,
      indexFile: 'index.json',
      leafDir: 'leaves',
      indexSchema: IndexSchema,
      parseFn: () => ok(null),
      buildIoError,
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.errors[0]?.path).toBe(dir);
    }
  });

  it('returns IO error when a leaf JSON is malformed', async () => {
    writeFileSync(join(dir, 'index.json'), JSON.stringify({}));
    mkdirSync(join(dir, 'leaves'));
    writeFileSync(join(dir, 'leaves', 'good.json'), JSON.stringify({ a: 1 }));
    writeFileSync(join(dir, 'leaves', 'bad.json'), '{nope');

    const r = await loadArtifactDir<z.output<typeof IndexSchema>, null, DemoError>({
      dir,
      indexFile: 'index.json',
      leafDir: 'leaves',
      indexSchema: IndexSchema,
      parseFn: () => ok(null),
      buildIoError,
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.errors[0]?.path).toBe(dir);
    }
  });

  it('skips non-.json entries in the leaf dir', async () => {
    writeFileSync(join(dir, 'index.json'), JSON.stringify({}));
    mkdirSync(join(dir, 'leaves'));
    writeFileSync(join(dir, 'leaves', 'real.json'), JSON.stringify({ x: 1 }));
    writeFileSync(join(dir, 'leaves', 'NOTES.txt'), 'skip me');

    let entries: Record<string, unknown> = {};
    await loadArtifactDir<z.output<typeof IndexSchema>, null, DemoError>({
      dir,
      indexFile: 'index.json',
      leafDir: 'leaves',
      indexSchema: IndexSchema,
      parseFn: ({ leafEntries }) => {
        entries = leafEntries;
        return ok(null);
      },
      buildIoError,
    });
    expect(Object.keys(entries)).toEqual(['real']);
  });
});
