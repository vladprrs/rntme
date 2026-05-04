import { z } from 'zod';

export const StateRefSchema = z
  .object({
    $state: z.string(),
  })
  .strict();

export const ParamValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  StateRefSchema,
]);

export const DataBindingSchema = z
  .object({
    binding: z.string(),
    params: z.record(z.string(), ParamValueSchema).optional(),
    refetchOn: z.array(z.enum(['mount', 'params'])).optional(),
  })
  .strict();

export const NavigationActionSchema = z
  .object({
    kind: z.literal('navigation'),
    navigateTo: z.string(),
    paramsFromState: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export const CommandActionSchema = z
  .object({
    kind: z.literal('command'),
    binding: z.string(),
    paramsFromState: z.record(z.string(), z.string()),
    onSuccess: z
      .object({
        navigateTo: z.string().optional(),
        refetchData: z.array(z.string()).optional(),
        clearFormState: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    onError: z
      .object({
        showAlert: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const RefetchActionSchema = z
  .object({
    kind: z.literal('refetch'),
    targets: z.array(z.string()),
  })
  .strict();

export const ModuleActionSchema = z
  .object({
    kind: z.literal('module-action'),
    target: z.string().optional(),
    module: z.string().optional(),
    category: z.string().optional(),
    name: z.string(),
    params: z.record(z.string(), ParamValueSchema).optional(),
    onSuccess: z
      .object({
        showAlert: z.string().optional(),
        navigateTo: z.string().optional(),
      })
      .strict()
      .optional(),
    onError: z
      .object({
        showAlert: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const ActionDefSchema = z.discriminatedUnion('kind', [
  NavigationActionSchema,
  CommandActionSchema,
  RefetchActionSchema,
  ModuleActionSchema,
]);

export const ScreenDescriptorSchema = z
  .object({
    metadata: z
      .object({
        title: z.string().optional(),
      })
      .strict()
      .optional(),
    data: z.record(z.string(), DataBindingSchema).optional(),
    actions: z.record(z.string(), ActionDefSchema).optional(),
  })
  .strict();

export const RefElementSchema = z
  .object({
    $ref: z.string(),
    bind: z.record(z.string(), z.unknown()),
  })
  .strict();

export const ElementJsonSchema = z
  .object({
    type: z.string(),
    props: z.record(z.string(), z.unknown()).default({}),
    children: z.array(z.string()).optional(),
    visible: z.unknown().optional(),
    on: z.record(z.string(), z.unknown()).optional(),
    watch: z.record(z.string(), z.unknown()).optional(),
    repeat: z
      .object({
        statePath: z.string(),
        key: z.string().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const SpecJsonSchema = z
  .object({
    root: z.string(),
    elements: z.record(z.string(), z.union([ElementJsonSchema, RefElementSchema])),
  })
  .strict();

export const RouteEntrySchema = z
  .object({
    layout: z.string(),
    screen: z.string(),
  })
  .strict();

export const SourceManifestSchema = z
  .object({
    version: z.literal('2.0'),
    pdmRef: z.string(),
    qsmRef: z.string(),
    graphSpecRef: z.string(),
    bindingsRef: z.string(),
    metadata: z
      .object({
        title: z.string(),
        description: z.string().optional(),
      })
      .strict(),
    layouts: z.record(z.string(), z.string()),
    routes: z.record(z.string(), RouteEntrySchema),
  })
  .strict();
