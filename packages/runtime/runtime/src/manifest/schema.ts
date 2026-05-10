import { z } from 'zod';

const HttpBodyLimitSchema = z
  .object({
    enabled: z.boolean().optional(),
    maxBytes: z.number().int().min(1).optional(),
  })
  .strict();

const HttpRateLimitSchema = z
  .object({
    enabled: z.boolean().optional(),
    windowMs: z.number().int().min(1).optional(),
    max: z.number().int().min(1).optional(),
  })
  .strict();

const HttpCorsSchema = z
  .object({
    origins: z.array(z.string().min(1)).optional(),
    credentials: z.boolean().optional(),
    allowHeaders: z.array(z.string().min(1)).optional(),
  })
  .strict();

const HttpSecurityHeadersSchema = z
  .object({
    csp: z.union([z.string(), z.null()]).optional(),
    contentTypeOptions: z.union([z.string(), z.null()]).optional(),
    referrerPolicy: z.union([z.string(), z.null()]).optional(),
  })
  .strict();

const ModuleGrpcTlsSchema = z
  .object({
    rootCertPath: z.string().min(1).optional(),
    privateKeyPath: z.string().min(1).optional(),
    certChainPath: z.string().min(1).optional(),
  })
  .strict();

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
            bodyLimit: HttpBodyLimitSchema.optional(),
            rateLimit: HttpRateLimitSchema.optional(),
            cors: HttpCorsSchema.optional(),
            securityHeaders: HttpSecurityHeadersSchema.optional(),
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
    modules: z
      .array(
        z
          .object({
            name: z.string().min(1),
            grpc: z
              .object({
                address: z.string().min(1),
                tls: ModuleGrpcTlsSchema.optional(),
              })
              .strict(),
            protoPath: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();
