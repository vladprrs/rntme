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
    gateway_upstreams: z.array(z.string().min(1)).optional(),
    entities: z.array(z.string().min(1)).optional(),
    rpcs: z.array(z.string().min(1)).default([]),
    events: z.array(z.string().min(1)).default([]),
    edgeAuth: EdgeAuthDescriptorSchema.optional(),
    search_tiers: z.array(z.string().min(1)).optional(),
    labeled_associations: z.boolean().optional(),
    bulk_operations: z.record(z.string(), z.unknown()).optional(),
    input_modalities: z.array(z.enum(['text', 'image', 'audio', 'file'])).optional(),
    reasoning_visibility_supported: z.array(z.enum(['hidden', 'summary', 'full'])).optional(),
    thread: z.boolean().optional(),
    async_job_types: z.array(z.string().min(1)).optional(),
    agent_execution_mode: z.enum(['delegated', 'local', 'none']).optional(),
    webhook_format: z.string().min(1).optional(),
    webhook_retry_policy: z.string().min(1).optional(),
    s3_compatible_backends: z.array(z.string().min(1)).optional(),
    max_object_size_bytes: z.number().int().positive().optional(),
    presign_ttl_default_sec: z.number().int().positive().optional(),
    supports_multipart: z.boolean().optional(),
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
    props: z.record(z.string(), PropSchemaSchema),
  })
  .strict();

export const OperationDeclarationSchema = z
  .object({
    name: z.string().min(1),
    appliesTo: z.array(z.string().min(1)).optional(),
    params: z.record(z.string(), PropSchemaSchema).optional(),
  })
  .strict();

export const ClientConfigSchema = z
  .object({
    schema: z.record(z.string(), PropSchemaSchema),
  })
  .strict();

const SAFE_CLIENT_PATH_SEGMENT_RE = /^[A-Za-z0-9._-]+$/;

export const ClientRelativePathSchema = z.string().min(1).superRefine((value, ctx) => {
  if (
    value.startsWith('/') ||
    value.includes('\\') ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) ||
    value.split('/').some((segment) => segment === '' || segment === '.' || segment === '..' || !SAFE_CLIENT_PATH_SEGMENT_RE.test(segment))
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `MODULE_MANIFEST_CLIENT_PATH_UNSAFE: client asset/preset path "${value}" must be a relative path inside the module package`,
    });
  }
});

const ClientAssetIdSchema = z.string().min(1).regex(/^[A-Za-z0-9._-]+$/);

export const ClientStylesheetAssetSchema = z
  .object({
    id: ClientAssetIdSchema,
    path: ClientRelativePathSchema,
    order: z.number().int().optional(),
    media: z.string().min(1).optional(),
    scope: z.literal('document').optional(),
  })
  .strict();

export const ClientFontAssetSchema = z
  .object({
    id: ClientAssetIdSchema,
    path: ClientRelativePathSchema,
    family: z.string().min(1),
    weight: z.string().min(1).optional(),
    style: z.string().min(1).optional(),
    preload: z.boolean().optional(),
  })
  .strict();

export const ClientImageAssetSchema = z
  .object({
    id: ClientAssetIdSchema,
    path: ClientRelativePathSchema,
    alt: z.string().optional(),
  })
  .strict();

export const ClientStaticFileAssetSchema = z
  .object({
    id: ClientAssetIdSchema,
    path: ClientRelativePathSchema,
  })
  .strict();

export const ClientPreloadAssetSchema = z
  .object({
    path: ClientRelativePathSchema,
    as: z.enum(['style', 'font', 'image', 'fetch']),
    type: z.string().min(1).optional(),
    crossorigin: z.enum(['anonymous', 'use-credentials']).optional(),
  })
  .strict();

export const ClientAssetsSchema = z
  .object({
    stylesheets: z.array(ClientStylesheetAssetSchema).optional(),
    fonts: z.array(ClientFontAssetSchema).optional(),
    icons: z.array(ClientImageAssetSchema).optional(),
    images: z.array(ClientImageAssetSchema).optional(),
    staticFiles: z.array(ClientStaticFileAssetSchema).optional(),
    preloads: z.array(ClientPreloadAssetSchema).optional(),
  })
  .strict();

export const ClientPresetSchema = z
  .object({
    name: z.string().min(1).regex(/^[A-Za-z0-9._-]+$/),
    kind: z.literal('fragment'),
    path: ClientRelativePathSchema,
    description: z.string().min(1).optional(),
    inputs: z.record(z.string(), PropSchemaSchema).default({}),
  })
  .strict();

export const ClientBlockSchema = z
  .object({
    entry: z.string().min(1).optional(),
    boot: z.boolean().optional(),
    bootTimeoutMs: z.number().int().positive().optional(),
    contract: z.enum(['identity', 'storage']).optional(),
    config: ClientConfigSchema.optional(),
    components: z.array(ComponentDeclarationSchema).optional(),
    operations: z.array(OperationDeclarationSchema).optional(),
    assets: ClientAssetsSchema.optional(),
    presets: z.array(ClientPresetSchema).optional(),
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
    optional: z.boolean().optional(),
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
        (value.client.operations?.length ?? 0) > 0 ||
        totalClientAssetCount(value.client.assets) > 0 ||
        (value.client.presets?.length ?? 0) > 0);
    const hasProvisioner = !!value.provisioner && value.provisioner.entry.length > 0;
    if (!hasCapabilities && !hasClient && !hasProvisioner) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['<root>'],
        message:
          'MODULE_MANIFEST_EMPTY: manifest must declare a non-empty `capabilities`, `client`, or `provisioner` surface',
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

    const hasExecutableClient =
      !!value.client &&
      (!!value.client.boot ||
        (value.client.components?.length ?? 0) > 0 ||
        (value.client.operations?.length ?? 0) > 0);
    if (hasExecutableClient && !value.client?.entry) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['client', 'entry'],
        message:
          'MODULE_MANIFEST_CLIENT_ENTRY_REQUIRED: client.entry is required when boot, components, or operations are declared',
      });
    }

    const assetIds = [
      ...(value.client?.assets?.stylesheets ?? []).map((a) => a.id),
      ...(value.client?.assets?.fonts ?? []).map((a) => a.id),
      ...(value.client?.assets?.icons ?? []).map((a) => a.id),
      ...(value.client?.assets?.images ?? []).map((a) => a.id),
      ...(value.client?.assets?.staticFiles ?? []).map((a) => a.id),
    ];
    const dupAssetIds = assetIds.filter((id, i) => assetIds.indexOf(id) !== i);
    if (dupAssetIds.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['client', 'assets'],
        message: `MODULE_MANIFEST_DUPLICATE_CLIENT_ASSET: client asset ids must be unique (duplicates: ${[...new Set(dupAssetIds)].join(', ')})`,
      });
    }

    const presetNames = (value.client?.presets ?? []).map((p) => p.name);
    const dupPresetNames = presetNames.filter((name, i) => presetNames.indexOf(name) !== i);
    if (dupPresetNames.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['client', 'presets'],
        message: `MODULE_MANIFEST_DUPLICATE_PRESET_NAME: preset names must be unique (duplicates: ${[...new Set(dupPresetNames)].join(', ')})`,
      });
    }

    const presetPaths = (value.client?.presets ?? []).map((p) => p.path);
    const dupPresetPaths = presetPaths.filter((path, i) => presetPaths.indexOf(path) !== i);
    if (dupPresetPaths.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['client', 'presets'],
        message: `MODULE_MANIFEST_DUPLICATE_PRESET_PATH: preset paths must be unique (duplicates: ${[...new Set(dupPresetPaths)].join(', ')})`,
      });
    }
  });

function totalClientAssetCount(assets: z.infer<typeof ClientAssetsSchema> | undefined): number {
  if (!assets) return 0;
  return (
    (assets.stylesheets?.length ?? 0) +
    (assets.fonts?.length ?? 0) +
    (assets.icons?.length ?? 0) +
    (assets.images?.length ?? 0) +
    (assets.staticFiles?.length ?? 0) +
    (assets.preloads?.length ?? 0)
  );
}

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
export type ClientAssets = z.infer<typeof ClientAssetsSchema>;
export type ClientPreset = z.infer<typeof ClientPresetSchema>;
export type ClientStylesheetAsset = z.infer<typeof ClientStylesheetAssetSchema>;
export type ClientFontAsset = z.infer<typeof ClientFontAssetSchema>;
export type ClientImageAsset = z.infer<typeof ClientImageAssetSchema>;
export type ClientStaticFileAsset = z.infer<typeof ClientStaticFileAssetSchema>;
export type ClientPreloadAsset = z.infer<typeof ClientPreloadAssetSchema>;
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
