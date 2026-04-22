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
  bindAs: z.string().min(1),
}).strict();

const PreStepModuleRpcSchema = z.object({
  kind: z.literal('module-rpc'),
  module: z.string().min(1),
  rpc: z.string().min(1),
  input: z.unknown(),
  bindAs: z.string().min(1),
  timeoutMs: z.number().int().min(1).max(30_000).optional(),
  retry: RetryPolicySchema.optional(),
}).strict();

const PreStepSchema = z.discriminatedUnion('kind', [PreStepSystemSchema, PreStepModuleRpcSchema]);

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
