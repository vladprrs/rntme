import { z } from 'zod';

export const ModuleSecretSchema = z
  .object({
    name: z.string().min(1),
    scope: z.enum(['tenant', 'project', 'service']),
  })
  .strict();

export const ModuleManifestSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    description: z.string().min(1).optional(),
    contact: z.string().min(1),
    grpcServiceName: z.string().min(1),
    webhookPath: z.string().startsWith('/'),
    secrets: z.array(ModuleSecretSchema),
    capabilities: z.array(z.string().min(1)),
  })
  .strict();

export type ModuleSecret = z.infer<typeof ModuleSecretSchema>;
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
