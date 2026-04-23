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

const RetryPolicySchema = z.object({
  attempts: z.number().int().min(1).max(10).optional(),
  backoffMs: z.union([z.literal('exp'), z.number().int().min(0)]).optional(),
  retryOn: z.enum(['never', 'transient', 'all']).optional(),
}).strict();

const PreStepSystemSchema = z.object({
  kind: z.literal('system'),
  op: z.literal('randomBytes'),
  bytes: z.number().int().min(1).max(1024),
  bindAs: nonEmptyString,
}).strict();

const PreStepModuleRpcSchema = z.object({
  kind: z.literal('module-rpc'),
  module: nonEmptyString,
  rpc: nonEmptyString,
  input: z.unknown(),
  bindAs: nonEmptyString,
  timeoutMs: z.number().int().min(1).max(30_000).optional(),
  retry: RetryPolicySchema.optional(),
}).strict();

const PreStepSchema = z.discriminatedUnion('kind', [PreStepSystemSchema, PreStepModuleRpcSchema]);

const InputSourceSchema = z.discriminatedUnion('from', [
  z.object({ from: z.literal('body'), path: z.string().min(1).optional() }).strict(),
  z.object({ from: z.literal('query'), name: z.string().min(1), required: z.boolean().optional() }).strict(),
  z.object({ from: z.literal('header'), name: z.string().min(1), required: z.boolean().optional() }).strict(),
  z.object({ from: z.literal('form'), name: z.string().min(1), required: z.boolean().optional() }).strict(),
]);

const InputFromMapSchema = z.record(z.string().min(1), InputSourceSchema);

const ResponseBranchSchema = z.union([
  z.object({ json: z.unknown() }).strict(),
  z.object({ redirect: z.unknown(), status: z.union([z.literal(302), z.literal(303)]).optional() }).strict(),
]).refine((val) => 'json' in val || 'redirect' in val, {
  message: 'Response branch must have either json or redirect',
});

const ResponseShapeSchema = z.object({
  onOk: ResponseBranchSchema,
  onErr: ResponseBranchSchema,
}).strict();

const bindingEntrySchema = z
  .object({
    kind: z.enum(['query', 'command']).default('query'),
    graph: nonEmptyString,
    target: z
      .object({
        engine: nonEmptyString,
        dialect: nonEmptyString,
      })
      .strict(),
    http: httpSchema,
    pre: z.array(PreStepSchema).optional(),
    inputFrom: InputFromMapSchema.optional(),
    response: ResponseShapeSchema.optional(),
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
