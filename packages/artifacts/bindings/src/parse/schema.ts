import { z } from 'zod';

const nonEmptyString = z.string().min(1);

const pathString = z
  .string()
  .regex(/^\/[^?#]*$/, 'path must start with "/" and contain no "?" or "#"');

const passthrough = z.record(z.string(), z.unknown());

const parameterSchema = z
  .object({
    name: nonEmptyString,
    in: z.enum(['query', 'path', 'body']),
    bindTo: nonEmptyString,
    required: z.boolean(),
    description: z.string().optional(),
    openapi: passthrough.optional(),
  })
  .strict();

const httpSchema = z
  .object({
    method: z.enum(['GET', 'POST']),
    path: pathString,
    parameters: z.array(parameterSchema),
    summary: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(nonEmptyString).optional(),
    operationId: nonEmptyString.optional(),
    openapi: passthrough.optional(),
  })
  .strict();

const InputSourceSchema = z.discriminatedUnion('from', [
  z.object({ from: z.literal('body'), path: z.string().min(1).optional() }).strict(),
  z.object({ from: z.literal('bodyBytes') }).strict(),
  z.object({ from: z.literal('query'), name: z.string().min(1), required: z.boolean().optional() }).strict(),
  z.object({ from: z.literal('header'), name: z.string().min(1), required: z.boolean().optional() }).strict(),
  z.object({ from: z.literal('form'), name: z.string().min(1), required: z.boolean().optional() }).strict(),
]);

const InputFromMapSchema = z.record(z.string().min(1), InputSourceSchema);
const RedirectSchema = z.union([
  z.string(),
  z.object({
    expr: z.union([z.string(), z.record(z.string(), z.unknown())]),
  }).strict(),
]);

const ResponseBranchSchema = z.union([
  z.object({ json: z.unknown() }).strict(),
  z.object({ redirect: RedirectSchema, status: z.union([z.literal(302), z.literal(303)]).optional() }).strict(),
]).refine((val) => 'json' in val || 'redirect' in val, {
  message: 'Response branch must have either json or redirect',
});

const ResponseShapeSchema = z.object({
  onOk: ResponseBranchSchema,
  onErr: ResponseBranchSchema,
}).strict();

const bindingEntrySchema = z
  .object({
    exposure: z.enum(['read', 'action']),
    graph: nonEmptyString,
    target: z
      .object({
        engine: nonEmptyString,
        dialect: nonEmptyString,
      })
      .strict(),
    http: httpSchema,
    inputFrom: InputFromMapSchema.optional(),
    response: ResponseShapeSchema.optional(),
    allowedRedirectHosts: z.array(nonEmptyString).optional(),
  })
  .strict();

const openApiDefaultsSchema = z
  .object({
    info: z
      .object({
        title: z.string().optional(),
        version: z.string().optional(),
        description: z.string().optional(),
      })
      .strict()
      .optional(),
    servers: z
      .array(
        z
          .object({
            url: nonEmptyString,
            description: z.string().optional(),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export const BindingArtifactSchema = z
  .object({
    version: z.literal('1.0'),
    graphSpecRef: nonEmptyString,
    pdmRef: nonEmptyString,
    qsmRef: nonEmptyString,
    openapi: openApiDefaultsSchema.optional(),
    bindings: z.record(z.string(), bindingEntrySchema),
  })
  .strict();

export type BindingArtifactParsed = z.infer<typeof BindingArtifactSchema>;
