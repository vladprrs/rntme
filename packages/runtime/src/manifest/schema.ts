import { z } from 'zod';

export const StudioConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    mountPath: z.string().startsWith('/').default('/_studio'),
    maxRows: z.number().int().min(1).max(1_000_000).default(10_000),
  })
  .strict();

export type StudioConfig = z.infer<typeof StudioConfigSchema>;

export const ManifestSchema = z
  .object({
    rntmeVersion: z.string(),
    service: z.object({
      name: z.string().min(1),
      version: z.string().min(1),
    }),
    surface: z
      .object({
        http: z
          .object({
            enabled: z.boolean().optional(),
            port: z.number().int().min(0).max(65535).optional(),
          })
          .strict()
          .optional(),
        grpc: z
          .object({
            enabled: z.boolean().optional(),
            port: z.number().int().min(0).max(65535).optional(),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    persistence: z
      .object({
        mode: z.enum(['ephemeral', 'persistent']).optional(),
        eventStorePath: z.string().optional(),
        qsmPath: z.string().optional(),
      })
      .strict()
      .optional(),
    bus: z
      .object({
        mode: z.literal('in-memory').optional(),
      })
      .strict()
      .optional(),
    auth: z
      .object({
        mode: z.literal('header').optional(),
        headerName: z.string().min(1).optional(),
        actorKind: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    observability: z
      .object({
        health: z
          .object({ path: z.string().startsWith('/').optional() })
          .strict()
          .optional(),
        metrics: z
          .object({ path: z.string().startsWith('/').optional() })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
    seed: z
      .object({
        enabled: z.boolean().optional(),
        path: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    studio: StudioConfigSchema.optional(),
  })
  .strict();
