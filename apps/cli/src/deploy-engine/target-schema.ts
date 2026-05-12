import { z } from 'zod';

const SecretRefSchema = z.object({
  source: z.literal('env'),
  name: z.string().min(1),
});

const NestedSecretRefSchema = z.record(z.string().min(1), SecretRefSchema);

const ExtraSecretRefSchema = z.union([SecretRefSchema, NestedSecretRefSchema]);

const Auth0TargetAuthSchema = z.object({
  clientId: z.string().min(1).optional(),
  domain: z.string().min(1).optional(),
  audience: z.string().min(1).optional(),
  redirectUri: z.string().url().optional(),
});

const OperatonUiAccessSchema = z.object({
  enabled: z.literal(true),
  publicBaseUrl: z.string().url(),
  auth: z.object({
    kind: z.literal('basic'),
    secretRef: z.string().min(1),
  }),
});

const WorkflowsTargetSchema = z.object({
  engine: z.object({
    kind: z.literal('operaton'),
    mode: z.literal('provisioned'),
    image: z.string().min(1),
    adminUserSecretRef: z.string().min(1).optional(),
  }),
  worker: z.object({
    image: z.string().min(1),
  }),
  operatonUi: OperatonUiAccessSchema.optional(),
});

const ModuleConfigSchema = z.object({
  image: z.string().min(1),
  expose: z.boolean().optional(),
  env: z.record(z.string().min(1), z.string()).optional(),
  secretRefs: z.record(z.string().min(1), z.string().min(1)).optional(),
});

const PolicyValuesSchema = z.record(z.string().min(1), z.record(z.string().min(1), z.unknown()));

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
    extras: z.record(z.string().min(1), ExtraSecretRefSchema).optional(),
  }),
  eventBus: z
    .union([
      z.object({
        kind: z.literal('in-memory'),
      }),
      z.object({
        kind: z.literal('kafka').default('kafka'),
        mode: z.enum(['provisioned', 'external']),
        provider: z.literal('redpanda').optional(),
        brokers: z.array(z.string().min(1)).optional(),
      }),
    ])
    .optional(),
  workflows: WorkflowsTargetSchema.optional(),
  auth: z
    .object({
      auth0: Auth0TargetAuthSchema.optional(),
    })
    .optional(),
  modules: z.record(z.string().min(1), ModuleConfigSchema).optional(),
  policyValues: PolicyValuesSchema.optional(),
  runtimeImage: z.string().min(1).optional(),
  publicBaseUrl: z.string().url().optional(),
});

export const TargetFileSchema = z.discriminatedUnion('kind', [DokployTargetFileSchema]);
export type TargetFile = z.infer<typeof TargetFileSchema>;
export type SecretRef = z.infer<typeof SecretRefSchema>;
export type ExtraSecretRef = z.infer<typeof ExtraSecretRefSchema>;
