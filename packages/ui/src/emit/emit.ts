import { ok, type Result } from '../types/result.js';
import type { CompiledArtifact, CompiledScreen } from '../types/compiled.js';
import type { ExpandedSource } from '../expand/expand.js';
import { resolveScreenHttp, type HttpEntry, type EmitModuleContext } from './http-map.js';

const defaultEmitCtx: EmitModuleContext = { resolveCategoryToModule: () => undefined };

export function emit(
  expanded: ExpandedSource,
  httpMap: Record<string, HttpEntry>,
  ctx: EmitModuleContext = defaultEmitCtx,
): Result<CompiledArtifact> {
  const manifest = {
    version: '2.0' as const,
    metadata: expanded.manifest.metadata,
    routes: {} as Record<string, { layout: string; screen: string }>,
  };

  for (const [pattern, route] of Object.entries(expanded.manifest.routes)) {
    const screenName = route.screen.split('/').pop()!;
    manifest.routes[pattern] = {
      layout: route.layout,
      screen: screenName,
    };
  }

  const screens: Record<string, CompiledScreen> = {};
  for (const [name, screen] of Object.entries(expanded.screens)) {
    const { data, actions } = resolveScreenHttp(screen.screen, httpMap, ctx);
    screens[name] = {
      spec: screen.spec,
      ...(Object.keys(data).length > 0 ? { data } : {}),
      ...(Object.keys(actions).length > 0 ? { actions } : {}),
    } as CompiledScreen;
  }

  const layouts: Record<string, CompiledScreen> = {};
  for (const [name, layout] of Object.entries(expanded.layouts)) {
    const { data, actions } = resolveScreenHttp(layout.screen, httpMap, ctx);
    layouts[name] = {
      spec: layout.spec,
      ...(Object.keys(data).length > 0 ? { data } : {}),
      ...(Object.keys(actions).length > 0 ? { actions } : {}),
    } as CompiledScreen;
  }

  return ok({ manifest, layouts, screens });
}
