import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { ZodType } from 'zod';

import { err, type Result } from './result.js';

/**
 * Build a package-specific I/O error. Used by `loadArtifactDir` to surface
 * missing files, malformed JSON, schema violations on the index, and any
 * unexpected `readFile`/`readdir` throw.
 */
export type IoErrorBuilder<E> = (info: { message: string; path: string }) => E;

export type LoadArtifactDirOptions<I, T, E> = {
  /** Absolute or relative path to the directory containing the index file and leaf dir. */
  dir: string;
  /** Index filename inside `dir`, e.g. `'pdm.json'`. */
  indexFile: string;
  /** Leaf directory name inside `dir` whose `*.json` files become entries, e.g. `'entities'`. */
  leafDir: string;
  /** Schema applied to the parsed index file. The output is threaded into `parseFn`. */
  indexSchema: ZodType<I>;
  /**
   * Called once with the parsed `index` and the leaf entries map (basename → JSON).
   * The helper does not parse leaf entries against any schema — that is the
   * inner parser's job (e.g. `parsePdm({ entities })`).
   */
  parseFn: (parts: { index: I; leafEntries: Record<string, unknown> }) => Result<T, E>;
  /** Maps an I/O failure to the package's error type. */
  buildIoError: IoErrorBuilder<E>;
};

/**
 * Load an artifact directory laid out as one index file plus one leaf directory
 * of `*.json` entries.
 *
 * Replaces the near-identical bodies of `loadPdmDir` (`pdm.json` + `entities/`)
 * and `loadQsmDir` (`qsm.json` + `projections/`). The only differences between
 * those two — and any future loader of this shape — are:
 * - the index filename and leaf directory name (`indexFile`, `leafDir`)
 * - the schema applied to the index (`indexSchema`)
 * - whether the inner parser uses parsed-index fields (`parseFn`)
 * - the package's error type (`buildIoError`)
 *
 * Reads the index file and the leaf directory entries in parallel.
 */
export async function loadArtifactDir<I, T, E>(
  opts: LoadArtifactDirOptions<I, T, E>,
): Promise<Result<T, E>> {
  const { dir, indexFile, leafDir, indexSchema, parseFn, buildIoError } = opts;

  const indexPath = join(dir, indexFile);
  const leafDirPath = join(dir, leafDir);

  try {
    await stat(indexPath);
  } catch {
    return err([
      buildIoError({
        message: `missing required file: ${indexFile}`,
        path: indexFile,
      }),
    ]);
  }

  try {
    await stat(leafDirPath);
  } catch {
    return err([
      buildIoError({
        message: `missing required directory: ${leafDir}`,
        path: leafDir,
      }),
    ]);
  }

  try {
    const [indexText, leafFileNames] = await Promise.all([
      readFile(indexPath, 'utf8'),
      readdir(leafDirPath),
    ]);

    const index = indexSchema.parse(JSON.parse(indexText));

    const jsonFileNames = leafFileNames.filter((fname) => fname.endsWith('.json'));
    const leafJsonTexts = await Promise.all(
      jsonFileNames.map((fname) => readFile(join(leafDirPath, fname), 'utf8')),
    );

    const leafEntries: Record<string, unknown> = {};
    for (let i = 0; i < jsonFileNames.length; i += 1) {
      const fname = jsonFileNames[i]!;
      const text = leafJsonTexts[i]!;
      const entryName = basename(fname, '.json');
      leafEntries[entryName] = JSON.parse(text);
    }

    return parseFn({ index, leafEntries });
  } catch (error) {
    return err([
      buildIoError({
        message: error instanceof Error ? error.message : String(error),
        path: dir,
      }),
    ]);
  }
}
