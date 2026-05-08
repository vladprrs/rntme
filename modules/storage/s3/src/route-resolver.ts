import type { ErrorCode } from '@rntme/contracts-storage-v1';

export interface StorageRouteLike {
  readonly id: string;
  readonly owner: { readonly aggregate: string; readonly association: string };
  readonly maxSize: number;
  readonly allowedTypes: readonly string[];
  readonly maxCount: number | null;
  readonly auth: { readonly requireRole: readonly string[] | null };
  readonly lifecycle: {
    readonly expirePendingMs: number;
    readonly retainCommittedMs: number | null;
  };
}

export interface StorageJsonLike {
  readonly version: '1.0';
  readonly routes: Readonly<Record<string, StorageRouteLike>>;
}

type ResolveOk = { ok: true; route: StorageRouteLike };
type ResolveErr = { ok?: false; error: ErrorCode; message: string };

export interface RouteResolver {
  resolve(routeId: string): ResolveOk | ResolveErr;
  checkUploadAllowed(
    routeId: string,
    req: { contentType: string; declaredSize: number; currentCount: number },
  ): ResolveOk | ResolveErr;
}

function mimeMatches(globs: readonly string[], type: string): boolean {
  return globs.some((g) => {
    if (g === type) return true;
    const slash = g.indexOf('/');
    const typeSlash = type.indexOf('/');
    if (slash < 0 || typeSlash < 0) return false;
    const left = g.slice(0, slash);
    const right = g.slice(slash + 1);
    const typeLeft = type.slice(0, typeSlash);
    const typeRight = type.slice(typeSlash + 1);
    return (left === '*' || left === typeLeft) && (right === '*' || right === typeRight);
  });
}

export function createRouteResolver(sj: StorageJsonLike): RouteResolver {
  return {
    resolve(routeId) {
      const route = sj.routes[routeId];
      if (route === undefined) {
        return {
          error: 'STORAGE_REFERENCES_ROUTE_NOT_FOUND',
          message: `route "${routeId}" not declared in storage.json`,
        };
      }
      return { ok: true, route };
    },
    checkUploadAllowed(routeId, req) {
      const found = this.resolve(routeId);
      if (found.ok !== true) return found;
      const route = found.route;
      if (req.declaredSize > route.maxSize) {
        return {
          error: 'STORAGE_CONSISTENCY_FILE_TOO_LARGE',
          message: `${req.declaredSize} > ${route.maxSize}`,
        };
      }
      if (!mimeMatches(route.allowedTypes, req.contentType)) {
        return {
          error: 'STORAGE_CONSISTENCY_MIME_NOT_ALLOWED',
          message: `${req.contentType} not in ${route.allowedTypes.join(',')}`,
        };
      }
      if (route.maxCount !== null && req.currentCount >= route.maxCount) {
        return {
          error: 'STORAGE_CONSISTENCY_MAX_COUNT_EXCEEDED',
          message: `count ${req.currentCount} >= ${route.maxCount}`,
        };
      }
      return { ok: true, route };
    },
  };
}
