import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { GraphJson, ServiceGraphSpec } from '../types/artifact.js';
import {
  ERROR_CODES,
  err,
  ok,
  type Result,
} from '../types/result.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidShapes(
  value: unknown,
): value is ServiceGraphSpec['shapes'] {
  if (!isRecord(value)) return false;

  for (const shape of Object.values(value)) {
    if (!isRecord(shape) || !isRecord(shape.fields)) return false;

    for (const field of Object.values(shape.fields)) {
      if (!isRecord(field)) return false;
      if (typeof field.type !== 'string') return false;
      if (typeof field.nullable !== 'boolean') return false;
    }
  }

  return true;
}

function isValidGraph(value: unknown): value is GraphJson {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string') return false;
  if (!isRecord(value.signature)) return false;
  if (!isRecord(value.signature.inputs)) return false;
  if (!isRecord(value.signature.output)) return false;
  if (typeof value.signature.output.type !== 'string') return false;
  if (typeof value.signature.output.from !== 'string') return false;
  if (!Array.isArray(value.nodes)) return false;

  for (const input of Object.values(value.signature.inputs)) {
    if (!isRecord(input)) return false;
    if (typeof input.type !== 'string') return false;
    if (typeof input.mode !== 'string') return false;
  }

  return true;
}

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
    const shapes = JSON.parse(readFileSync(shapesPath, 'utf8')) as unknown;
    if (!isValidShapes(shapes)) {
      throw new Error(`service "${slug}" graph shapes file is malformed`);
    }

    const graphs: Record<string, GraphJson> = {};

    for (const fileName of readdirSync(graphsDir).sort()) {
      if (!fileName.endsWith('.json') || fileName === 'shapes.json') continue;

      const graphName = fileName.slice(0, -'.json'.length);
      const graph = JSON.parse(
        readFileSync(join(graphsDir, fileName), 'utf8'),
      ) as unknown;
      if (!isValidGraph(graph)) {
        throw new Error(
          `service "${slug}" graph file "${fileName}" is malformed`,
        );
      }
      graphs[graphName] = graph;
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
