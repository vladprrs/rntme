import { z } from 'zod';

export const ModuleSecretSchema = z
  .object({
    name: z.string().min(1),
    scope: z.enum(['tenant', 'project', 'service']),
  })
  .strict();

export const EdgeAuthDescriptorSchema = z
  .object({
    kind: z.literal('introspection-sidecar'),
    transport: z.literal('http'),
    method: z.literal('GET'),
    path: z.string().startsWith('/'),
    port: z.number().int().min(1).max(65_535),
  })
  .strict();

export const ModuleCapabilitiesSchema = z
  .object({
    vendors: z.array(z.string().min(1)).optional(),
    entities: z.array(z.string().min(1)).optional(),
    rpcs: z.array(z.string().min(1)).default([]),
    events: z.array(z.string().min(1)).default([]),
    edgeAuth: EdgeAuthDescriptorSchema.optional(),
    search_tiers: z.array(z.string().min(1)).optional(),
    labeled_associations: z.boolean().optional(),
    bulk_operations: z.record(z.unknown()).optional(),
    async_job_types: z.array(z.string().min(1)).optional(),
    webhook_format: z.string().min(1).optional(),
    webhook_retry_policy: z.string().min(1).optional(),
  })
  .strict();

export const PropSchemaSchema = z
  .object({
    type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
    required: z.boolean().optional(),
    array: z.boolean().optional(),
  })
  .strict();

export const ComponentDeclarationSchema = z
  .object({
    type: z.string().min(1),
    props: z.record(PropSchemaSchema),
  })
  .strict();

export const OperationDeclarationSchema = z
  .object({
    name: z.string().min(1),
    appliesTo: z.array(z.string().min(1)).optional(),
    params: z.record(PropSchemaSchema).optional(),
  })
  .strict();

export const ClientConfigSchema = z
  .object({
    schema: z.record(PropSchemaSchema),
  })
  .strict();

export const ClientBlockSchema = z
  .object({
    entry: z.string().min(1),
    boot: z.boolean().optional(),
    bootTimeoutMs: z.number().int().positive().optional(),
    contract: z.enum(['identity']).optional(),
    config: ClientConfigSchema.optional(),
    components: z.array(ComponentDeclarationSchema).optional(),
    operations: z.array(OperationDeclarationSchema).optional(),
  })
  .strict();

export const ProvisionerProducesSchema = z
  .object({
    name: z.string().min(1),
    kind: z.enum(['single', 'many']),
    secret: z.boolean(),
  })
  .strict();

export const ProvisionerRequiresSchema = z
  .object({
    name: z.string().min(1),
    schema: z.string().min(1),
  })
  .strict();

export const ProvisionerBlockSchema = z
  .object({
    entry: z.string().min(1),
    produces: z.array(ProvisionerProducesSchema).min(1),
    requires: z.array(ProvisionerRequiresSchema).default([]),
    timeoutMs: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const names = v.produces.map((p) => p.name);
    const dup = names.filter((n, i) => names.indexOf(n) !== i);
    if (dup.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['produces'],
        message: `MODULE_MANIFEST_PROVISIONER_DUPLICATE_PRODUCES: duplicate produces names (${[...new Set(dup)].join(', ')})`,
      });
    }
    const reqNames = v.requires.map((r) => r.name);
    const dupReq = reqNames.filter((n, i) => reqNames.indexOf(n) !== i);
    if (dupReq.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requires'],
        message: `MODULE_MANIFEST_PROVISIONER_DUPLICATE_REQUIRES: duplicate requires names (${[...new Set(dupReq)].join(', ')})`,
      });
    }
  });

export const ModuleManifestSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    category: z.string().min(1).optional(),
    vendor: z.string().min(1).optional(),
    contract: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    contact: z.string().min(1).optional(),
    grpcServiceName: z.string().min(1).optional(),
    webhookPath: z.string().startsWith('/').optional(),
    secrets: z.array(ModuleSecretSchema).optional(),
    capabilities: ModuleCapabilitiesSchema.optional(),
    client: ClientBlockSchema.optional(),
    provisioner: ProvisionerBlockSchema.optional(),
    limitations: z.array(z.string().min(1)).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasCapabilities =
      !!value.capabilities &&
      (value.capabilities.rpcs.length > 0 || value.capabilities.events.length > 0);
    const hasClient =
      !!value.client &&
      (!!value.client.boot ||
        (value.client.components?.length ?? 0) > 0 ||
        (value.client.operations?.length ?? 0) > 0);
    if (!hasCapabilities && !hasClient) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['<root>'],
        message:
          'MODULE_MANIFEST_EMPTY: manifest must declare a non-empty `capabilities` or `client` surface',
      });
    }
    if ((value.category && !value.contract) || (!value.category && value.contract)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: value.category ? ['contract'] : ['category'],
        message:
          'MODULE_MANIFEST_CATEGORY_REQUIRES_CONTRACT: `category` and `contract` must both be set or both omitted',
      });
    }
    if (value.category && value.contract && !value.vendor) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['vendor'],
        message: 'MODULE_MANIFEST_VENDOR_REQUIRED: canonical modules must declare `vendor`',
      });
    }
    const types = (value.client?.components ?? []).map((c) => c.type);
    const dupTypes = types.filter((t, i) => types.indexOf(t) !== i);
    if (dupTypes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['client', 'components'],
        message: `MODULE_MANIFEST_DUPLICATE_COMPONENT: component types must be unique (duplicates: ${[...new Set(dupTypes)].join(', ')})`,
      });
    }
    const opNames = (value.client?.operations ?? []).map((o) => o.name);
    const dupOps = opNames.filter((n, i) => opNames.indexOf(n) !== i);
    if (dupOps.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['client', 'operations'],
        message: `MODULE_MANIFEST_DUPLICATE_OPERATION: operation names must be unique (duplicates: ${[...new Set(dupOps)].join(', ')})`,
      });
    }
    const declaredTypes = new Set(types);
    for (const op of value.client?.operations ?? []) {
      for (const t of op.appliesTo ?? []) {
        if (!declaredTypes.has(t)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['client', 'operations', op.name, 'appliesTo'],
            message: `MODULE_MANIFEST_OPERATION_BAD_APPLIES_TO: operation "${op.name}" appliesTo "${t}" but no such component is declared in this module`,
          });
        }
      }
    }
  });

export type ProvisionerProduces = z.infer<typeof ProvisionerProducesSchema>;
export type ProvisionerRequires = z.infer<typeof ProvisionerRequiresSchema>;
export type ProvisionerBlock = z.infer<typeof ProvisionerBlockSchema>;
export type ModuleSecret = z.infer<typeof ModuleSecretSchema>;
export type EdgeAuthDescriptor = z.infer<typeof EdgeAuthDescriptorSchema>;
export type ModuleCapabilities = z.infer<typeof ModuleCapabilitiesSchema>;
export type PropSchema = z.infer<typeof PropSchemaSchema>;
export type ComponentDeclaration = z.infer<typeof ComponentDeclarationSchema>;
export type OperationDeclaration = z.infer<typeof OperationDeclarationSchema>;
export type ClientBlock = z.infer<typeof ClientBlockSchema>;
export type ModuleManifest = z.infer<typeof ModuleManifestSchema>;

export type ModuleManifestError = {
  path: string;
  message: string;
};

export type ModuleManifestResult =
  | { ok: true; value: ModuleManifest }
  | { ok: false; errors: ModuleManifestError[] };

export function parseModuleManifest(raw: unknown): ModuleManifestResult {
  const result = ModuleManifestSchema.safeParse(raw);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.length === 0 ? '<root>' : issue.path.join('.'),
      message: issue.message,
    })),
  };
}
