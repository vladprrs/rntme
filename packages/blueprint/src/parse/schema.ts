import { z } from 'zod';

const nonEmptyString = z.string().min(1);
const pathKey = z.string().startsWith('/');

export const ServiceDescriptorSchema = z
  .object({
    kind: z.enum(['domain', 'integration']),
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
        z
          .object({
            kind: nonEmptyString,
            provider: nonEmptyString.optional(),
            policy: nonEmptyString.optional(),
          })
          .strict(),
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
  })
  .strict();
