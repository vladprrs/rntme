import { z } from 'zod';

const SecretRefSchema = z.object({
  source: z.literal('env'),
  name: z.string().min(1),
});

const DokployTargetFileSchema = z.object({
  kind: z.literal('dokploy'),
  displayName: z.string().min(1).max(120),
  config: z.object({
    dokployUrl: z.string().url(),
    dokployProjectId: z.string().min(1).optional(),
    dokployProjectName: z.string().min(1).optional(),
    allowCreateProject: z.boolean().optional(),
  }),
  secrets: z.object({
    apiToken: SecretRefSchema,
  }),
  eventBus: z
    .object({
      kind: z.literal('kafka').default('kafka'),
      mode: z.enum(['provisioned', 'external']),
      provider: z.literal('redpanda').optional(),
      brokers: z.array(z.string().min(1)).optional(),
    })
    .optional(),
  publicBaseUrl: z.string().url().optional(),
});

export const TargetFileSchema = z.discriminatedUnion('kind', [DokployTargetFileSchema]);
export type TargetFile = z.infer<typeof TargetFileSchema>;
export type SecretRef = z.infer<typeof SecretRefSchema>;
