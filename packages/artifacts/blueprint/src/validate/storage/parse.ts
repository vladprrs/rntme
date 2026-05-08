import {
  ERROR_CODES,
  err,
  ok,
  type BlueprintError,
  type Result,
} from '../../types/result.js';

export interface RawStorageJson {
  readonly version: unknown;
  readonly routes: Record<string, unknown>;
}

export function parseStorageJson(text: string): Result<RawStorageJson> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return err([
      {
        layer: 'parse',
        code: ERROR_CODES.STORAGE_PARSE_INVALID_JSON,
        message: `storage.json is not valid JSON: ${(e as Error).message}`,
        path: 'storage.json',
      },
    ]);
  }

  if (parsed === null || typeof parsed !== 'object') {
    return err([
      {
        layer: 'parse',
        code: ERROR_CODES.STORAGE_PARSE_INVALID_JSON,
        message: 'storage.json must be a JSON object',
        path: 'storage.json',
      },
    ]);
  }

  const obj = parsed as Record<string, unknown>;
  if (!('version' in obj)) {
    return err([
      {
        layer: 'parse',
        code: ERROR_CODES.STORAGE_PARSE_MISSING_VERSION,
        message: 'storage.json: missing required field "version"',
        path: 'storage.json',
      },
    ]);
  }
  if (!('routes' in obj) || obj.routes === null || typeof obj.routes !== 'object') {
    return err([
      {
        layer: 'parse',
        code: ERROR_CODES.STORAGE_PARSE_MISSING_ROUTES,
        message: 'storage.json: missing required field "routes" (object)',
        path: 'storage.json#routes',
      },
    ]);
  }

  const routes = obj.routes as Record<string, unknown>;
  for (const [routeId, value] of Object.entries(routes)) {
    if (value === null || typeof value !== 'object') {
      const error: BlueprintError = {
        layer: 'parse',
        code: ERROR_CODES.STORAGE_PARSE_INVALID_ROUTE_SHAPE,
        message: `storage.json: route "${routeId}" must be an object`,
        path: `storage.json#routes.${routeId}`,
      };
      return err([error]);
    }
  }

  return ok({ version: obj.version, routes });
}
