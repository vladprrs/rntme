import { err, ok, type Result, type UiError } from '../types/result.js';
import type { CompiledArtifact, CompiledScreen } from '../types/compiled.js';
import type { ExpandedSource } from '../expand/expand.js';
import { resolveScreenHttp, type HttpEntry, type EmitModuleContext } from './http-map.js';

const defaultEmitCtx: EmitModuleContext = { resolveCategoryToModule: () => undefined };

export function emit(
  expanded: ExpandedSource,
  httpMap: Record<string, HttpEntry>,
  ctx: EmitModuleContext = defaultEmitCtx,
): Result<CompiledArtifact> {
  const errors: UiError[] = [];
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
    const { data, actions, errors: screenErrors } = resolveScreenHttp(
      screen.screen,
      httpMap,
      ctx,
      `screen:${name}`,
    );
    errors.push(...screenErrors);
    screens[name] = {
      spec: screen.spec,
      ...(Object.keys(data).length > 0 ? { data } : {}),
      ...(Object.keys(actions).length > 0 ? { actions } : {}),
    } as CompiledScreen;
  }

  const layouts: Record<string, CompiledScreen> = {};
  for (const [name, layout] of Object.entries(expanded.layouts)) {
    const { data, actions, errors: layoutErrors } = resolveScreenHttp(
      layout.screen,
      httpMap,
      ctx,
      `layout:${name}`,
    );
    errors.push(...layoutErrors);
    layouts[name] = {
      spec: layout.spec,
      ...(Object.keys(data).length > 0 ? { data } : {}),
      ...(Object.keys(actions).length > 0 ? { actions } : {}),
    } as CompiledScreen;
  }

  if (errors.length > 0) return err(errors);

  return ok({ manifest, layouts, screens });
}
