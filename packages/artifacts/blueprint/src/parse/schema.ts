import { z } from 'zod';

const nonEmptyString = z.string().min(1);
const pathKey = z.string().startsWith('/');

const genericMiddleware = z
  .object({
    kind: nonEmptyString,
    provider: nonEmptyString.optional(),
    policy: nonEmptyString.optional(),
  })
  .strict();

const authMiddleware = z
  .object({
    kind: z.literal('auth'),
    provider: nonEmptyString,
    audience: nonEmptyString,
    moduleSlug: nonEmptyString,
    policy: nonEmptyString.optional(),
  })
  .strict();

const moduleProjectRefSchema = z
  .object({
    package: nonEmptyString,
    publicConfig: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const ServiceDescriptorSchema = z
  .object({
    kind: z.enum(['domain', 'integration', 'integration-module']),
  })
  .strict();

export const ProjectBlueprintSchema = z
  .object({
    name: nonEmptyString,
    services: z.array(nonEmptyString).min(1),
    routes: z
      .object({
        ui: z.record(pathKey, nonEmptyString).optional(),
        http: z.record(pathKey, nonEmptyString).optional(),
      })
      .strict()
      .optional(),
    middleware: z
      .record(
        nonEmptyString,
        z.union([authMiddleware, genericMiddleware]),
      )
      .optional(),
    mounts: z
      .array(
        z
          .object({
            target: nonEmptyString,
            use: z.array(nonEmptyString),
          })
          .strict(),
      )
      .optional(),
    modules: z.record(nonEmptyString, moduleProjectRefSchema).optional(),
  })
  .strict();
