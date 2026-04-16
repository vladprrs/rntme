import { z } from 'zod';

export const StateRefSchema = z.object({ $state: z.string().startsWith('/') }).strict();
export const LiteralSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const ParamValueSchema = z.union([LiteralSchema, StateRefSchema]);

export const ElementSchema: z.ZodTypeAny = z
  .object({
    type: z.string().min(1),
    props: z.record(z.string(), z.unknown()).default({}),
    children: z.array(z.string()).default([]),
    visible: z.unknown().optional(),
    watch: z
      .record(
        z.string(),
        z.object({
          action: z.string(),
          params: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .optional(),
  })
  .strict();

export const JsonRenderSpecSchema = z
  .object({
    root: z.string().min(1),
    elements: z.record(z.string(), ElementSchema),
  })
  .strict();

export const DatasetDefSchema = z
  .object({
    binding: z.string().min(1),
    params: z.record(z.string(), ParamValueSchema).optional(),
    refetchOn: z.array(z.enum(['mount', 'params'])).optional(),
  })
  .strict();

export const CommandActionSchema = z
  .object({
    kind: z.literal('command'),
    binding: z.string().min(1),
    paramsFromState: z.record(z.string(), z.string().startsWith('/')),
    onSuccess: z
      .object({
        navigateTo: z.string().optional(),
        clearFormState: z.array(z.string().startsWith('/')).optional(),
        refetchData: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
    onError: z.object({ showAlert: z.boolean().optional() }).strict().optional(),
  })
  .strict();

export const NavigationActionSchema = z
  .object({
    kind: z.literal('navigation'),
    navigateTo: z.string().min(1),
    paramsFromState: z.record(z.string(), z.string().startsWith('/')).optional(),
  })
  .strict();

export const ActionDefSchema = z.discriminatedUnion('kind', [
  CommandActionSchema,
  NavigationActionSchema,
]);

export const LayoutSpecSchema = z.object({ spec: JsonRenderSpecSchema }).strict();

export const RouteSpecSchema = z
  .object({
    layout: z.string().optional(),
    metadata: z.object({ title: z.string().optional() }).strict().optional(),
    page: JsonRenderSpecSchema,
    data: z.record(z.string(), DatasetDefSchema).optional(),
    actions: z.record(z.string(), ActionDefSchema).optional(),
  })
  .strict();

export const UiArtifactSchema = z
  .object({
    version: z.literal('1.0-rc1'),
    pdmRef: z.string(),
    qsmRef: z.string(),
    graphSpecRef: z.string(),
    bindingsRef: z.string(),
    metadata: z
      .object({
        title: z.object({ default: z.string(), template: z.string().optional() }).strict(),
        description: z.string().optional(),
      })
      .strict(),
    layouts: z.record(z.string(), LayoutSpecSchema),
    routes: z.record(z.string(), RouteSpecSchema),
  })
  .strict();

export type { UiArtifact as UiArtifactParsed } from '../types/artifact.js';
