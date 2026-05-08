import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { ZodType } from 'zod';

import { err, type Result } from './result.js';

/**
 * Build a package-specific I/O error. Used by `loadArtifactDir` to surface
 * missing files, malformed JSON, schema violations on the index, and any
 * unexpected `readFileSync`/`readdirSync` throw.
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
 */
export function loadArtifactDir<I, T, E>(
  opts: LoadArtifactDirOptions<I, T, E>,
): Result<T, E> {
  const { dir, indexFile, leafDir, indexSchema, parseFn, buildIoError } = opts;

  try {
    const indexPath = join(dir, indexFile);
    const leafDirPath = join(dir, leafDir);

    if (!existsSync(indexPath)) {
      return err([
        buildIoError({
          message: `missing required file: ${indexFile}`,
          path: indexFile,
        }),
      ]);
    }

    if (!existsSync(leafDirPath)) {
      return err([
        buildIoError({
          message: `missing required directory: ${leafDir}`,
          path: leafDir,
        }),
      ]);
    }

    const index = indexSchema.parse(JSON.parse(readFileSync(indexPath, 'utf8')));

    const leafEntries: Record<string, unknown> = {};
    for (const fname of readdirSync(leafDirPath)) {
      if (!fname.endsWith('.json')) continue;
      const entryName = basename(fname, '.json');
      leafEntries[entryName] = JSON.parse(
        readFileSync(join(leafDirPath, fname), 'utf8'),
      );
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
