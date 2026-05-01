import type { EdgeAuthDescriptor } from '@rntme/module-skeleton';
import type { CatalogManifest } from '../types/artifact.js';
import type { PropSchema } from '../types/result.js';
import { ERROR_CODES, err, ok, type BlueprintError, type Result } from '../types/result.js';
import type { DiscoveredModule } from './modules.js';

export function buildCatalog(
  discovered: Record<string, DiscoveredModule>,
): Result<CatalogManifest> {
  const errors: BlueprintError[] = [];
  const components: Array<{ type: string; module: string; props: Record<string, PropSchema> }> = [];
  const operations: Array<{
    name: string;
    module: string;
    appliesTo: string[] | null;
    params: Record<string, PropSchema>;
    category: string | null;
  }> = [];
  const modulesWithBoot: string[] = [];
  const categoryToModule: Record<string, string> = {};
  const publicConfig: Record<string, Record<string, unknown>> = {};
  const moduleEdgeAuth: Record<string, EdgeAuthDescriptor | null> = {};
  const seenTypes = new Map<string, string>();

  for (const [moduleName, mod] of Object.entries(discovered)) {
    const m = mod.manifest;

    if (m.category) {
      const prev = categoryToModule[m.category];
      if (prev !== undefined && prev !== moduleName) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_CATEGORY_AMBIGUOUS,
          message: `category "${m.category}" is declared by both "${prev}" and "${moduleName}"`,
          path: 'project.json#modules',
        });
      } else {
        categoryToModule[m.category] = moduleName;
      }
    }

    if (m.client?.boot) modulesWithBoot.push(moduleName);
    publicConfig[moduleName] = { ...mod.publicConfig };
    moduleEdgeAuth[moduleName] = m.capabilities?.edgeAuth ?? null;

    for (const c of m.client?.components ?? []) {
      const props = c.props as Record<string, PropSchema>;
      const dupFrom = seenTypes.get(c.type);
      if (dupFrom !== undefined) {
        errors.push({
          layer: 'composition',
          code: ERROR_CODES.BLUEPRINT_DUPLICATE_COMPONENT,
          message: `component type "${c.type}" is declared by "${dupFrom}" and "${moduleName}"`,
          path: `${moduleName}/module.json`,
        });
        continue;
      }
      seenTypes.set(c.type, moduleName);
      components.push({ type: c.type, module: moduleName, props });
    }

    for (const op of m.client?.operations ?? []) {
      const params = (op.params ?? {}) as Record<string, PropSchema>;
      operations.push({
        name: op.name,
        module: moduleName,
        appliesTo: op.appliesTo ? [...op.appliesTo] : null,
        params,
        category: m.category ?? null,
      });
    }
  }

  if (errors.length > 0) return err(errors);

  return ok({
    components,
    operations,
    modulesWithBoot,
    categoryToModule,
    publicConfig,
    moduleEdgeAuth,
  } satisfies CatalogManifest);
}
