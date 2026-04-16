import { ok, err, type Result, type UiError } from '../types/result.js';
import type { ExpandedSource } from '../expand/expand.js';
import { validateStructural } from './structural.js';
import { validateReferences } from './references.js';

export type ValidateResolvers = {
  resolveBinding: (id: string) => unknown | undefined;
  resolveComponent: (type: string) => { childrenModel: 'none' | 'list' } | undefined;
  resolveRoute: (path: string) => boolean;
};

export function validate(expanded: ExpandedSource, resolvers: ValidateResolvers): Result<void> {
  const errors: UiError[] = [];

  // Structural validation — layouts
  for (const [name, layout] of Object.entries(expanded.layouts)) {
    errors.push(...validateStructural(layout.spec, `layout:${name}`, true));
  }

  // Structural validation — screens
  for (const [name, screen] of Object.entries(expanded.screens)) {
    errors.push(...validateStructural(screen.spec, `screen:${name}`, false));
  }

  // Stop early if structural errors
  if (errors.length > 0) return err(...errors);

  // Route resolver that knows about manifest routes
  const routePatterns = Object.keys(expanded.manifest.routes);
  const resolveRoute = (path: string): boolean => {
    return routePatterns.some((pattern) => {
      if (pattern === path) return true;
      const patternParts = pattern.split('/');
      const pathParts = path.split('/');
      if (patternParts.length !== pathParts.length) return false;
      return patternParts.every((p, i) => p.startsWith(':') || p === pathParts[i]);
    });
  };

  const mergedResolvers: ValidateResolvers = {
    ...resolvers,
    resolveRoute: (path) => resolvers.resolveRoute(path) || resolveRoute(path),
  };

  // Reference validation — screens
  for (const [name, screen] of Object.entries(expanded.screens)) {
    errors.push(
      ...validateReferences(screen.spec, screen.screen, `screen:${name}`, mergedResolvers),
    );
  }

  // Reference validation — layouts
  for (const [name, layout] of Object.entries(expanded.layouts)) {
    errors.push(
      ...validateReferences(layout.spec, layout.screen, `layout:${name}`, mergedResolvers),
    );
  }

  if (errors.length > 0) return err(...errors);
  return ok(undefined);
}
