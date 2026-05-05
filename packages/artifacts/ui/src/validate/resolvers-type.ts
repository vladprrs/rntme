/** Mirrors `PropSchema` in `@rntme/contracts-module-v1` without a workspace dependency (avoids cycles). */
export type PropSchema = {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  array?: boolean;
};

export type OperationDescriptor = {
  module: string;
  appliesTo: string[] | null;
  params: Record<string, PropSchema>;
  category: string | null;
};

export type ComponentInfo = {
  childrenModel: 'list' | 'none';
  props: Record<string, PropSchema>;
};

export type BindingKind = 'query' | 'command';

/**
 * Binding resolvers may return the direct binding entry or a wrapper produced by
 * project composition. Only the optional kind metadata is inspected here.
 */
export type BindingDescriptor = {
  kind?: BindingKind;
  entry?: { kind?: BindingKind };
};

export type ValidateResolvers = {
  resolveBinding: (id: string) => BindingDescriptor | undefined;
  resolveComponent: (type: string) => ComponentInfo | undefined;
  resolveRoute: (path: string) => boolean;
  resolveOperation: (
    name: string,
    opts: { module?: string; category?: string; targetElementType?: string },
  ) => OperationDescriptor | undefined;
  resolveCategoryToModule: (category: string) => string | undefined;
};
