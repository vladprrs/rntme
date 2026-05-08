import { loadArtifactDir } from '@rntme/artifact-shared';
import { z } from 'zod';
import { parsePdm } from '../parse/parse.js';
import type { ValidatedPdm } from '../types/artifact.js';
import { ERROR_CODES, isErr, type PdmError, type Result } from '../types/result.js';
import { validatePdm } from '../validate/index.js';

const PdmDirectoryIndexSchema = z
  .object({
    version: z.string().optional(),
  })
  .strict();

export function loadPdmDir(dir: string): Promise<Result<ValidatedPdm>> {
  return loadArtifactDir<z.output<typeof PdmDirectoryIndexSchema>, ValidatedPdm, PdmError>({
    dir,
    indexFile: 'pdm.json',
    leafDir: 'entities',
    indexSchema: PdmDirectoryIndexSchema,
    parseFn: ({ leafEntries }) => {
      const parsed = parsePdm({ entities: leafEntries });
      if (isErr(parsed)) return parsed;
      return validatePdm(parsed.value);
    },
    buildIoError: ({ message, path, cause }) => ({
      layer: 'parse',
      code: ERROR_CODES.PDM_PARSE_DIR_INVALID,
      message,
      path,
      ...(cause === undefined ? {} : { cause }),
    }),
  });
}
