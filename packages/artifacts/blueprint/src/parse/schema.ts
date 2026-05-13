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

const authProviderBase = z.object({
  provider: nonEmptyString,
  moduleSlug: nonEmptyString,
}).strict();

const auth0Provider = authProviderBase.extend({
  provider: z.literal('auth0'),
  audience: nonEmptyString,
});

const platformTokensProvider = authProviderBase.extend({
  provider: z.literal('platform-tokens'),
  introspectPath: z.string().startsWith('/'),
  introspectPort: z.number().int().positive(),
});

const authProvider = z.union([auth0Provider, platformTokensProvider]);

const authMiddleware = z
  .object({
    kind: z.literal('auth'),
    providers: z.array(authProvider).min(1),
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
    module: nonEmptyString.optional(),
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
    vars: z
      .record(
        z.string().regex(/^[A-Z][A-Z0-9_]*$/),
        z
          .object({
            from: nonEmptyString,
            required: z.boolean().default(true),
          })
          .strict(),
      )
      .optional(),
    workflows: z
      .object({
        manifest: nonEmptyString,
      })
      .strict()
      .optional(),
  })
  .strict();
