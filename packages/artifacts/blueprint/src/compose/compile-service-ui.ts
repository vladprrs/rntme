import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { compile, type CompiledArtifact } from '@rntme/ui';
import type { CatalogManifest, RoutedBindingEntry } from '../types/artifact.js';
import {
  ERROR_CODES,
  err,
  ok,
  type Result,
} from '../types/result.js';
import {
  buildUiHttpMap,
  resolveProjectBindingRef,
} from './binding-registry.js';
import { catalogValidationResolvers } from './catalog-resolvers.js';
import { resolveCoreComponent } from './ui-core-components.js';

export function compileServiceUi(input: {
  rootDir: string;
  serviceSlug: string;
  bindingRegistry: Record<string, RoutedBindingEntry>;
  uiRoutePatterns: readonly string[];
  catalogManifest?: CatalogManifest | null;
}): Result<CompiledArtifact | null> {
  const relPath = `services/${input.serviceSlug}/ui`;
  const sourceDir = join(input.rootDir, relPath);

  if (!existsSync(join(sourceDir, 'manifest.json'))) {
    return ok(null);
  }

  try {
    const catRes = catalogValidationResolvers(input.catalogManifest ?? null);
    const compiled = compile({
      sourceDir,
      httpMap: buildUiHttpMap(input.bindingRegistry, input.serviceSlug),
      resolvers: {
        resolveBinding: (id) =>
          resolveProjectBindingRef(
            input.bindingRegistry,
            input.serviceSlug,
            id,
          ),
        resolveComponent: (ty) => catRes.resolveComponent(ty) ?? resolveCoreComponent(ty),
        resolveRoute: (path) =>
          input.uiRoutePatterns.some((pattern) => routePatternMatches(pattern, path)),
        resolveOperation: catRes.resolveOperation,
        resolveCategoryToModule: catRes.resolveCategoryToModule,
      },
    });

    if (!compiled.ok) {
      return uiErr(
        input.serviceSlug,
        relPath,
        `service "${input.serviceSlug}" ui failed validation`,
        compiled.errors,
      );
    }

    return ok(compiled.value);
  } catch (error) {
    return uiErr(
      input.serviceSlug,
      relPath,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function routePatternMatches(pattern: string, path: string): boolean {
  if (pattern === path) return true;
  const patternParts = pattern.split('/');
  const pathParts = path.split('/');
  if (patternParts.length !== pathParts.length) return false;
  return patternParts.every((part, index) => part.startsWith(':') || part === pathParts[index]);
}

function uiErr<T>(
  serviceSlug: string,
  path: string,
  message: string,
  cause?: readonly unknown[],
): Result<T> {
  return err([
    {
      layer: 'service',
      code: ERROR_CODES.BLUEPRINT_SERVICE_UI_INVALID,
      message,
      path,
      ...(cause === undefined ? {} : { cause: [...cause] }),
    },
  ]);
}
