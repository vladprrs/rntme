import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { err, type Result } from '../types/result.js';

export function loadBlueprint(dir: string): Result<{ dir: string }> {
  const projectPath = join(dir, 'project.json');
  if (!existsSync(projectPath)) {
    return err([
      {
        layer: 'load',
        code: 'BLUEPRINT_IO_ERROR',
        message: 'missing required file: project.json',
        path: 'project.json',
      },
    ]);
  }

  return { ok: true, value: { dir } };
}
