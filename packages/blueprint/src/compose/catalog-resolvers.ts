import type { OperationDescriptor, ValidateResolvers } from '@rntme/ui';

import type { CatalogManifest } from '../types/artifact.js';

function toDesc(op: CatalogManifest['operations'][number]): OperationDescriptor {
  return {
    module: op.module,
    appliesTo: op.appliesTo ? [...op.appliesTo] : null,
    params: { ...op.params },
    category: op.category,
  };
}

/** Pick resolvers derived from compose-time module catalog for @rntme/ui validation. */
export function catalogValidationResolvers(
  catalog: CatalogManifest | null,
): Pick<ValidateResolvers, 'resolveComponent' | 'resolveOperation' | 'resolveCategoryToModule'> {
  if (!catalog) {
    return {
      resolveComponent: () => undefined,
      resolveOperation: () => undefined,
      resolveCategoryToModule: () => undefined,
    };
  }

  const cat = catalog;

  return {
    resolveComponent: (type) => {
      const c = cat.components.find((x) => x.type === type);
      if (!c) return undefined;
      return { childrenModel: 'list', props: { ...c.props } };
    },
    resolveCategoryToModule: (category) => cat.categoryToModule[category],
    resolveOperation: (name, opts) => {
      const matches = cat.operations.filter((o) => o.name === name);
      if (matches.length === 0) return undefined;

      if (opts.module) {
        const hit = matches.find((m) => m.module === opts.module);
        return hit ? toDesc(hit) : undefined;
      }
      if (opts.category) {
        const hit = matches.find((m) => m.category === opts.category);
        return hit ? toDesc(hit) : undefined;
      }
      if (opts.targetElementType) {
        const bound = matches.filter(
          (m) => m.appliesTo !== null && m.appliesTo.includes(opts.targetElementType!),
        );
        if (bound.length === 1) return toDesc(bound[0]!);
        return undefined;
      }

      return undefined;
    },
  };
}
