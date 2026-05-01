import type { ScreenDescriptor } from '../types/source.js';

export type HttpEntry = { method: 'GET' | 'POST'; path: string };

export type EmitModuleContext = {
  resolveCategoryToModule: (cat: string) => string | undefined;
};

/**
 * Given a screen descriptor and a lookup of binding -> HTTP entry,
 * resolves data bindings and command actions to HTTP endpoints.
 */
export function resolveScreenHttp(
  screen: ScreenDescriptor,
  httpMap: Record<string, HttpEntry>,
  ctx: EmitModuleContext,
): {
  data: Record<string, { method: 'GET' | 'POST'; path: string; params?: Record<string, unknown>; refetchOn?: string[] }>;
  actions: Record<string, unknown>;
} {
  const data: Record<
    string,
    { method: 'GET' | 'POST'; path: string; params?: Record<string, unknown>; refetchOn?: string[] }
  > = {};

  if (screen.data) {
    for (const [statePath, db] of Object.entries(screen.data)) {
      const http = httpMap[db.binding];
      if (!http) continue;
      data[statePath] = {
        method: http.method,
        path: http.path,
        ...(db.params ? { params: db.params } : {}),
        ...(db.refetchOn ? { refetchOn: db.refetchOn } : {}),
      };
    }
  }

  const actions: Record<string, unknown> = {};
  if (screen.actions) {
    for (const [actionId, action] of Object.entries(screen.actions)) {
      if (action.kind === 'navigation') {
        actions[actionId] = { ...action };
      } else if (action.kind === 'refetch') {
        actions[actionId] = { ...action };
      } else if (action.kind === 'module-action') {
        const compiled: Record<string, unknown> = {
          kind: 'module-action',
          name: action.name,
          ...(action.params ? { params: action.params } : {}),
          ...(action.onSuccess ? { onSuccess: action.onSuccess } : {}),
          ...(action.onError ? { onError: action.onError } : {}),
        };
        if (action.target) {
          compiled.target = action.target;
        } else if (action.module) {
          compiled.module = action.module;
        } else if (action.category) {
          const resolved = ctx.resolveCategoryToModule(action.category);
          if (!resolved) {
            throw new Error(`emit: category "${action.category}" not mapped`);
          }
          compiled.module = resolved;
        }
        actions[actionId] = compiled;
      } else {
        const http = httpMap[action.binding];
        if (!http) continue;
        const { binding: _, ...rest } = action;
        actions[actionId] = {
          ...rest,
          method: http.method,
          path: http.path,
        };
      }
    }
  }

  return { data, actions };
}
