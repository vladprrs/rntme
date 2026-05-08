import { loadArtifactDir } from '@rntme/artifact-shared';
import { z } from 'zod';
import { parsePdm } from '../parse/parse.js';
import type { PdmArtifact } from '../types/artifact.js';
import { ERROR_CODES, type PdmError, type Result } from '../types/result.js';

const PdmDirectoryIndexSchema = z
  .object({
    version: z.string().optional(),
  })
  .strict();

export function loadPdmDir(dir: string): Promise<Result<PdmArtifact>> {
  return loadArtifactDir<z.output<typeof PdmDirectoryIndexSchema>, PdmArtifact, PdmError>({
    dir,
    indexFile: 'pdm.json',
    leafDir: 'entities',
    indexSchema: PdmDirectoryIndexSchema,
    parseFn: ({ leafEntries }) => parsePdm({ entities: leafEntries }),
    buildIoError: ({ message, path }) => ({
      layer: 'parse',
      code: ERROR_CODES.PDM_PARSE_DIR_INVALID,
      message,
      path,
    }),
  });
}
