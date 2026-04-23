import { basename, join } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { z } from 'zod';
import { parsePdm } from '../parse/parse.js';
import { err, type Result } from '../types/result.js';
import type { PdmArtifact } from '../types/artifact.js';

const PdmDirectoryIndexSchema = z
  .object({
    version: z.string().optional(),
  })
  .strict();

export function loadPdmDir(dir: string): Result<PdmArtifact> {
  try {
    const indexPath = join(dir, 'pdm.json');
    const entitiesDir = join(dir, 'entities');

    if (!existsSync(indexPath)) {
      return err([
        {
          layer: 'parse',
          code: 'PDM_PARSE_DIR_INVALID',
          message: 'missing required file: pdm.json',
          path: 'pdm.json',
        },
      ]);
    }

    if (!existsSync(entitiesDir)) {
      return err([
        {
          layer: 'parse',
          code: 'PDM_PARSE_DIR_INVALID',
          message: 'missing required directory: entities',
          path: 'entities',
        },
      ]);
    }

    PdmDirectoryIndexSchema.parse(JSON.parse(readFileSync(indexPath, 'utf8')));

    const entities: Record<string, unknown> = {};
    for (const fname of readdirSync(entitiesDir)) {
      if (!fname.endsWith('.json')) continue;
      const entityName = basename(fname, '.json');
      entities[entityName] = JSON.parse(readFileSync(join(entitiesDir, fname), 'utf8'));
    }

    return parsePdm({ entities });
  } catch (error) {
    return err([
      {
        layer: 'parse',
        code: 'PDM_PARSE_DIR_INVALID',
        message: error instanceof Error ? error.message : String(error),
        path: dir,
      },
    ]);
  }
}
