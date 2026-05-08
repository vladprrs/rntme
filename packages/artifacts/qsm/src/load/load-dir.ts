import { loadArtifactDir, type LoadArtifactDirFailure } from '@rntme/artifact-shared';
import { z } from 'zod';
import { parseQsm } from '../parse/parse.js';
import type { QsmArtifact } from '../types/artifact.js';
import { ERROR_CODES, type QsmError, type Result } from '../types/result.js';

const QsmDirectoryIndexSchema = z
  .object({
    version: z.string().optional(),
    relations: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

function qsmDirectoryError(info: LoadArtifactDirFailure): QsmError {
  const base = {
    layer: 'parse' as const,
    message: info.message,
    path: info.path,
    ...(info.cause === undefined ? {} : { cause: info.cause }),
  };

  switch (info.kind) {
    case 'index-missing':
      return {
        ...base,
        code: ERROR_CODES.QSM_PARSE_DIR_INDEX_MISSING,
        message: 'missing required file: qsm.json',
        path: 'qsm.json',
      };
    case 'leaf-dir-missing':
      return {
        ...base,
        code: ERROR_CODES.QSM_PARSE_DIR_PROJECTIONS_MISSING,
        message: 'missing required directory: projections',
        path: 'projections',
      };
    case 'index-json-invalid':
      return {
        ...base,
        code: ERROR_CODES.QSM_PARSE_DIR_INDEX_JSON_INVALID,
      };
    case 'index-schema-invalid':
      return {
        ...base,
        code: ERROR_CODES.QSM_PARSE_DIR_INDEX_SCHEMA_VIOLATION,
        message: 'qsm.json failed validation',
        path: 'qsm.json',
      };
    case 'leaf-json-invalid':
      return {
        ...base,
        code: ERROR_CODES.QSM_PARSE_DIR_PROJECTION_JSON_INVALID,
      };
    case 'read-failed':
      return {
        ...base,
        code: ERROR_CODES.QSM_PARSE_DIR_READ_FAILED,
        message: `failed to read ${info.path}: ${info.message}`,
      };
  }
}

export function loadQsmDir(dir: string): Promise<Result<QsmArtifact>> {
  return loadArtifactDir<z.output<typeof QsmDirectoryIndexSchema>, QsmArtifact, QsmError>({
    dir,
    indexFile: 'qsm.json',
    leafDir: 'projections',
    indexSchema: QsmDirectoryIndexSchema,
    parseFn: ({ index, leafEntries }) =>
      parseQsm({ projections: leafEntries, relations: index.relations }),
    buildIoError: qsmDirectoryError,
  });
}
