import {
  ERROR_CODES,
  err,
  ok,
  type BlueprintError,
  type Result,
} from '../../types/result.js';
import type {
  RouteAuth,
  RouteLifecycle,
  RouteOwner,
  StorageJson,
  StorageRoute,
} from '../../types/storage-json.js';
import { parseBytes } from './byte-size.js';
import { parseDurationMs } from './duration.js';
import type { RawStorageJson } from './parse.js';

const ROUTE_ID_RE = /^[a-z][a-z0-9-]*$/;
const MIME_GLOB_RE = /^[a-z0-9.+-]+\/[a-z0-9.+*-]+$/i;

function shapeError(message: string, path: string): BlueprintError {
  return {
    layer: 'structural',
    code: ERROR_CODES.STORAGE_PARSE_INVALID_ROUTE_SHAPE,
    message,
    path,
  };
}

function readOwner(raw: unknown, path: string, errors: BlueprintError[]): RouteOwner | null {
  if (raw === null || typeof raw !== 'object') {
    errors.push(shapeError(`${path} owner must be an object`, `${path}.owner`));
    return null;
  }
  const o = raw as { aggregate?: unknown; association?: unknown };
  if (typeof o.aggregate !== 'string' || typeof o.association !== 'string') {
    errors.push(shapeError(`${path} owner must have string aggregate + association`, `${path}.owner`));
    return null;
  }
  return { aggregate: o.aggregate, association: o.association };
}

function readAuth(raw: unknown, path: string, errors: BlueprintError[]): RouteAuth | null {
  if (raw === null || typeof raw !== 'object') {
    errors.push(shapeError(`${path} auth must be an object`, `${path}.auth`));
    return null;
  }
  const a = raw as { requireRole?: unknown };
  if (a.requireRole === null || a.requireRole === undefined) return { requireRole: null };
  if (!Array.isArray(a.requireRole) || a.requireRole.some((r) => typeof r !== 'string')) {
    errors.push(shapeError(`${path} auth.requireRole must be string[] or null`, `${path}.auth.requireRole`));
    return null;
  }
  return { requireRole: a.requireRole };
}

function readLifecycle(raw: unknown, path: string, errors: BlueprintError[]): RouteLifecycle | null {
  if (raw === null || typeof raw !== 'object') {
    errors.push(shapeError(`${path} lifecycle must be an object`, `${path}.lifecycle`));
    return null;
  }
  const l = raw as { expirePending?: unknown; retainCommitted?: unknown };
  const expirePendingMs = parseDurationMs(l.expirePending);
  if (expirePendingMs === null) {
    errors.push({
      layer: 'structural',
      code: ERROR_CODES.STORAGE_STRUCTURAL_INVALID_DURATION,
      message: `${path} lifecycle.expirePending must parse as a duration`,
      path: `${path}.lifecycle.expirePending`,
    });
    return null;
  }
  let retainCommittedMs: number | null = null;
  if (l.retainCommitted !== null && l.retainCommitted !== undefined) {
    const v = parseDurationMs(l.retainCommitted);
    if (v === null) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.STORAGE_STRUCTURAL_INVALID_DURATION,
        message: `${path} lifecycle.retainCommitted must parse as a duration or null`,
        path: `${path}.lifecycle.retainCommitted`,
      });
      return null;
    }
    retainCommittedMs = v;
  }
  return { expirePendingMs, retainCommittedMs };
}

export function validateStorageJsonStructural(raw: RawStorageJson): Result<StorageJson> {
  const errors: BlueprintError[] = [];
  if (raw.version !== '1.0') {
    errors.push({
      layer: 'structural',
      code: ERROR_CODES.STORAGE_PARSE_MISSING_VERSION,
      message: 'storage.json: version must be "1.0"',
      path: 'storage.json#version',
    });
  }

  const routes: Record<string, StorageRoute> = {};
  for (const [routeId, rawRoute] of Object.entries(raw.routes)) {
    const path = `storage.json#routes.${routeId}`;
    if (!ROUTE_ID_RE.test(routeId)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.STORAGE_STRUCTURAL_ROUTE_ID_FORMAT,
        message: `route id "${routeId}" must match ^[a-z][a-z0-9-]*$`,
        path,
      });
      continue;
    }

    const r = rawRoute as Record<string, unknown>;
    const owner = readOwner(r.owner, path, errors);
    const auth = readAuth(r.auth, path, errors);
    const lifecycle = readLifecycle(r.lifecycle, path, errors);
    if (owner === null || auth === null || lifecycle === null) continue;

    const maxSize = parseBytes(r.maxSize);
    if (maxSize === null) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.STORAGE_STRUCTURAL_INVALID_BYTE_SIZE,
        message: `${path} maxSize must parse as bytes (e.g. "10MB" or 1048576)`,
        path: `${path}.maxSize`,
      });
      continue;
    }

    if (!Array.isArray(r.allowedTypes) || r.allowedTypes.length === 0) {
      errors.push(shapeError(`${path} allowedTypes must be a non-empty string[]`, `${path}.allowedTypes`));
      continue;
    }
    let mimeOk = true;
    for (const t of r.allowedTypes as unknown[]) {
      if (typeof t !== 'string' || !MIME_GLOB_RE.test(t)) {
        errors.push({
          layer: 'structural',
          code: ERROR_CODES.STORAGE_STRUCTURAL_INVALID_MIME_GLOB,
          message: `${path} allowedTypes contains malformed mime: ${String(t)}`,
          path: `${path}.allowedTypes`,
        });
        mimeOk = false;
        break;
      }
    }
    if (!mimeOk) continue;

    const maxCount =
      r.maxCount === null || r.maxCount === undefined
        ? null
        : typeof r.maxCount === 'number' && Number.isInteger(r.maxCount)
          ? r.maxCount
          : null;

    routes[routeId] = {
      id: routeId,
      owner,
      maxSize,
      allowedTypes: r.allowedTypes as string[],
      maxCount,
      auth,
      lifecycle,
    };
  }

  if (errors.length > 0) return err(errors);
  return ok({ version: '1.0', routes });
}
