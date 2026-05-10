import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { ZodType } from 'zod';

import { err, type Result } from './result.js';

export type LoadArtifactDirFailureKind =
  | 'index-missing'
  | 'leaf-dir-missing'
  | 'index-json-invalid'
  | 'index-schema-invalid'
  | 'leaf-json-invalid'
  | 'read-failed';

export type LoadArtifactDirFailure = {
  kind: LoadArtifactDirFailureKind;
  message: string;
  path: string;
  cause?: unknown;
};

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Build a package-specific I/O error. Used by `loadArtifactDir` to surface
 * missing files, malformed JSON, schema violations on the index, and any
 * unexpected `readFile`/`readdir` throw.
 */
export type IoErrorBuilder<E> = (info: LoadArtifactDirFailure) => E;

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
export async function loadArtifactDir<I, T, E>(
  opts: LoadArtifactDirOptions<I, T, E>,
): Promise<Result<T, E>> {
  const { dir, indexFile, leafDir, indexSchema, parseFn, buildIoError } = opts;

  const indexPath = join(dir, indexFile);
  const leafDirPath = join(dir, leafDir);

  try {
    await stat(indexPath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return err([
        buildIoError({
          kind: 'index-missing',
          message: `missing required file: ${indexFile}`,
          path: indexFile,
          cause: error,
        }),
      ]);
    }
    return err([
      buildIoError({
        kind: 'read-failed',
        message: errorMessage(error),
        path: indexFile,
        cause: error,
      }),
    ]);
  }

  try {
    await stat(leafDirPath);
  } catch (error) {
    if (isMissingPathError(error)) {
      return err([
        buildIoError({
          kind: 'leaf-dir-missing',
          message: `missing required directory: ${leafDir}`,
          path: leafDir,
          cause: error,
        }),
      ]);
    }
    return err([
      buildIoError({
        kind: 'read-failed',
        message: errorMessage(error),
        path: leafDir,
        cause: error,
      }),
    ]);
  }

  let indexText: string;
  try {
    indexText = await readFile(indexPath, 'utf8');
  } catch (error) {
    return err([
      buildIoError({
        kind: 'read-failed',
        message: errorMessage(error),
        path: indexFile,
        cause: error,
      }),
    ]);
  }

  let indexRaw: unknown;
  try {
    indexRaw = JSON.parse(indexText);
  } catch (error) {
    return err([
      buildIoError({
        kind: 'index-json-invalid',
        message: `invalid JSON in ${indexFile}: ${errorMessage(error)}`,
        path: indexFile,
        cause: error,
      }),
    ]);
  }

  const parsedIndex = indexSchema.safeParse(indexRaw);
  if (!parsedIndex.success) {
    return err([
      buildIoError({
        kind: 'index-schema-invalid',
        message: `${indexFile} failed validation`,
        path: indexFile,
        cause: parsedIndex.error.issues,
      }),
    ]);
  }

  let leafFileNames: string[];
  try {
    // Sort so leafEntries assembly is deterministic across filesystems —
    // readdir returns inode/hash order on ext4, which differs between hosts.
    leafFileNames = (await readdir(leafDirPath)).sort();
  } catch (error) {
    return err([
      buildIoError({
        kind: 'read-failed',
        message: errorMessage(error),
        path: leafDir,
        cause: error,
      }),
    ]);
  }

  const leafEntries: Record<string, unknown> = {};
  for (const fname of leafFileNames.filter((name) => name.endsWith('.json'))) {
    const leafPath = `${leafDir}/${fname}`;
    let text: string;
    try {
      text = await readFile(join(leafDirPath, fname), 'utf8');
    } catch (error) {
      return err([
        buildIoError({
          kind: 'read-failed',
          message: errorMessage(error),
          path: leafPath,
          cause: error,
        }),
      ]);
    }

    try {
      leafEntries[basename(fname, '.json')] = JSON.parse(text);
    } catch (error) {
      return err([
        buildIoError({
          kind: 'leaf-json-invalid',
          message: `invalid JSON in ${leafPath}: ${errorMessage(error)}`,
          path: leafPath,
          cause: error,
        }),
      ]);
    }
  }

  return parseFn({ index: parsedIndex.data, leafEntries });
}
