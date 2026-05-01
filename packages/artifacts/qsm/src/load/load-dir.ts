import { basename, join } from 'node:path';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { z } from 'zod';
import { parseQsm } from '../parse/parse.js';
import { err, type Result } from '../types/result.js';
import type { QsmArtifact } from '../types/artifact.js';

const QsmDirectoryIndexSchema = z
  .object({
    version: z.string().optional(),
    relations: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export function loadQsmDir(dir: string): Result<QsmArtifact> {
  try {
    const indexPath = join(dir, 'qsm.json');
    const projectionsDir = join(dir, 'projections');

    if (!existsSync(indexPath)) {
      return err([
        {
          layer: 'parse',
          code: 'QSM_PARSE_DIR_INVALID',
          message: 'missing required file: qsm.json',
          path: 'qsm.json',
        },
      ]);
    }

    if (!existsSync(projectionsDir)) {
      return err([
        {
          layer: 'parse',
          code: 'QSM_PARSE_DIR_INVALID',
          message: 'missing required directory: projections',
          path: 'projections',
        },
      ]);
    }

    const index = QsmDirectoryIndexSchema.parse(
      JSON.parse(readFileSync(indexPath, 'utf8')),
    );
    const projections: Record<string, unknown> = {};

    for (const fname of readdirSync(projectionsDir)) {
      if (!fname.endsWith('.json')) continue;
      const projectionName = basename(fname, '.json');
      projections[projectionName] = JSON.parse(
        readFileSync(join(projectionsDir, fname), 'utf8'),
      );
    }

    return parseQsm({
      projections,
      relations: index.relations,
    });
  } catch (error) {
    return err([
      {
        layer: 'parse',
        code: 'QSM_PARSE_DIR_INVALID',
        message: error instanceof Error ? error.message : String(error),
        path: dir,
      },
    ]);
  }
}
