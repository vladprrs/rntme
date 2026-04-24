import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GraphJson, ServiceGraphSpec } from '../types/artifact.js';
import {
  ERROR_CODES,
  err,
  ok,
  type Result,
} from '../types/result.js';

export function readServiceGraphSpec(
  rootDir: string,
  slug: string,
): Result<ServiceGraphSpec> {
  const graphRelPath = `services/${slug}/graphs`;
  const graphsDir = join(rootDir, graphRelPath);
  const shapesPath = join(graphsDir, 'shapes.json');

  if (!existsSync(shapesPath)) {
    return err([
      {
        layer: 'service',
        code: ERROR_CODES.BLUEPRINT_SERVICE_GRAPHS_INVALID,
        message: `service "${slug}" graph shapes file is missing`,
        path: `${graphRelPath}/shapes.json`,
      },
    ]);
  }

  try {
    const shapes = JSON.parse(
      readFileSync(shapesPath, 'utf8'),
    ) as ServiceGraphSpec['shapes'];
    const graphs: Record<string, GraphJson> = {};

    for (const fileName of readdirSync(graphsDir).sort()) {
      if (!fileName.endsWith('.json') || fileName === 'shapes.json') continue;

      const graphName = fileName.slice(0, -'.json'.length);
      graphs[graphName] = JSON.parse(
        readFileSync(join(graphsDir, fileName), 'utf8'),
      ) as GraphJson;
    }

    return ok({
      version: '1.0-rc7',
      shapes,
      graphs,
    });
  } catch (error) {
    return err([
      {
        layer: 'service',
        code: ERROR_CODES.BLUEPRINT_SERVICE_GRAPHS_INVALID,
        message: error instanceof Error ? error.message : String(error),
        path: graphRelPath,
      },
    ]);
  }
}
