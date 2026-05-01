/** Mirrors `PropSchema` in `@rntme/module-skeleton` without a workspace dependency (avoids cycles). */
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

export type ValidateResolvers = {
  resolveBinding: (id: string) => unknown | undefined;
  resolveComponent: (type: string) => ComponentInfo | undefined;
  resolveRoute: (path: string) => boolean;
  resolveOperation: (
    name: string,
    opts: { module?: string; category?: string; targetElementType?: string },
  ) => OperationDescriptor | undefined;
  resolveCategoryToModule: (category: string) => string | undefined;
};
