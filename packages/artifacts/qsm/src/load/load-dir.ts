import { loadArtifactDir } from '@rntme/artifact-shared';
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

export function loadQsmDir(dir: string): Promise<Result<QsmArtifact>> {
  return loadArtifactDir<z.output<typeof QsmDirectoryIndexSchema>, QsmArtifact, QsmError>({
    dir,
    indexFile: 'qsm.json',
    leafDir: 'projections',
    indexSchema: QsmDirectoryIndexSchema,
    parseFn: ({ index, leafEntries }) =>
      parseQsm({ projections: leafEntries, relations: index.relations }),
    buildIoError: ({ message, path }) => ({
      layer: 'parse',
      code: ERROR_CODES.QSM_PARSE_DIR_INVALID,
      message,
      path,
    }),
  });
}
