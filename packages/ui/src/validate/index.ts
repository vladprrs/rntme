import { ok, err, type Result, type UiError } from '../types/result.js';
import type { ExpandedSource } from '../expand/expand.js';
import { validateStructural, validateSpecSemantics } from './structural.js';
import {
  validateReferences,
  validateModuleActions,
  validateComponentTypesAndProps,
} from './references.js';
import type { ValidateResolvers } from './resolvers-type.js';

export type { ValidateResolvers, OperationDescriptor, ComponentInfo, PropSchema } from './resolvers-type.js';

export function validate(expanded: ExpandedSource, resolvers: ValidateResolvers): Result<void> {
  const errors: UiError[] = [];

  for (const [name, layout] of Object.entries(expanded.layouts)) {
    errors.push(...validateStructural(layout.spec, `layout:${name}`, true));
  }

  for (const [name, screen] of Object.entries(expanded.screens)) {
    errors.push(...validateStructural(screen.spec, `screen:${name}`, false));
  }

  if (errors.length > 0) return err(...errors);

  for (const [name, layout] of Object.entries(expanded.layouts)) {
    errors.push(...validateSpecSemantics(layout.spec, layout.screen, `layout:${name}`));
  }

  for (const [name, screen] of Object.entries(expanded.screens)) {
    errors.push(...validateSpecSemantics(screen.spec, screen.screen, `screen:${name}`));
  }

  if (errors.length > 0) return err(...errors);

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

  for (const [name, screen] of Object.entries(expanded.screens)) {
    errors.push(
      ...validateReferences(screen.spec, screen.screen, `screen:${name}`, mergedResolvers),
    );
  }

  for (const [name, layout] of Object.entries(expanded.layouts)) {
    errors.push(
      ...validateReferences(layout.spec, layout.screen, `layout:${name}`, mergedResolvers),
    );
  }

  if (errors.length > 0) return err(...errors);

  validateModuleActions(expanded, mergedResolvers, errors);
  validateComponentTypesAndProps(expanded, mergedResolvers, errors);

  if (errors.length > 0) return err(...errors);
  return ok(undefined);
}
