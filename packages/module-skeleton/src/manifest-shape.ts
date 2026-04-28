import { z } from 'zod';

export const ModuleSecretSchema = z
  .object({
    name: z.string().min(1),
    scope: z.enum(['tenant', 'project', 'service']),
  })
  .strict();

export const ModuleCapabilitiesSchema = z
  .object({
    vendors: z.array(z.string().min(1)).optional(),
    entities: z.array(z.string().min(1)).optional(),
    rpcs: z.array(z.string().min(1)),
    events: z.array(z.string().min(1)),
    search_tiers: z.array(z.string().min(1)).optional(),
    labeled_associations: z.boolean().optional(),
    bulk_operations: z.record(z.unknown()).optional(),
    async_job_types: z.array(z.string().min(1)).optional(),
    webhook_format: z.string().min(1).optional(),
    webhook_retry_policy: z.string().min(1).optional(),
  })
  .strict();

export const ModuleManifestSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    category: z.string().min(1),
    vendor: z.string().min(1),
    contract: z.string().min(1),
    description: z.string().min(1).optional(),
    contact: z.string().min(1).optional(),
    grpcServiceName: z.string().min(1).optional(),
    webhookPath: z.string().startsWith('/').optional(),
    secrets: z.array(ModuleSecretSchema).optional(),
    capabilities: ModuleCapabilitiesSchema,
    limitations: z.array(z.string().min(1)).optional(),
  })
  .strict();

export type ModuleSecret = z.infer<typeof ModuleSecretSchema>;
export type ModuleCapabilities = z.infer<typeof ModuleCapabilitiesSchema>;
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
