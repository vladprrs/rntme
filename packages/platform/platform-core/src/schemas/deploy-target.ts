import { z } from 'zod';
import { SlugSchema, UuidSchema } from './primitives.js';
import { HttpUrlSchema } from './url.js';

const KafkaSecuritySchema = z
  .discriminatedUnion('protocol', [
    z.object({
      protocol: z.literal('plaintext'),
    }),
    z.object({
      protocol: z.literal('sasl_ssl'),
      mechanism: z.enum(['scram-sha-256', 'scram-sha-512']),
      secretRefs: z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }),
    }),
  ])
  .optional();

const ExternalEventBusConfigSchema = z.object({
  kind: z.literal('kafka'),
  mode: z.literal('external').optional(),
  brokers: z.array(z.string().min(1)).min(1),
  topicPrefix: z.string().optional(),
  security: KafkaSecuritySchema,
});

const ProvisionedEventBusConfigSchema = z.object({
  kind: z.literal('kafka'),
  mode: z.literal('provisioned'),
  provider: z.literal('redpanda'),
  image: z.string().min(1).optional(),
  topicPrefix: z.string().optional(),
});

export const EventBusConfigSchema = z.preprocess((value) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const candidate = value as Record<string, unknown>;
    if (candidate.mode === undefined) return { ...candidate, mode: 'external' };
  }
  return value;
}, z.discriminatedUnion('mode', [ExternalEventBusConfigSchema, ProvisionedEventBusConfigSchema]));
export type EventBusConfig = z.infer<typeof EventBusConfigSchema>;

export const PolicyValuesSchema = z.record(z.string(), z.record(z.string(), z.unknown())).default({});
export type PolicyValues = z.infer<typeof PolicyValuesSchema>;
const PatchPolicyValuesSchema = z.record(z.string(), z.record(z.string(), z.unknown()));

export const IntegrationModuleDeploymentConfigSchema = z
  .object({
    image: z.string().trim().min(1).optional(),
    expose: z.boolean().optional(),
    env: z.record(z.string(), z.string()).optional(),
    secretRefs: z.record(z.string(), z.string()).optional(),
  })
  .catchall(z.unknown());
export type IntegrationModuleDeploymentConfig = z.infer<typeof IntegrationModuleDeploymentConfigSchema>;

export const DeployTargetModulesSchema = z.record(z.string(), IntegrationModuleDeploymentConfigSchema).default({});
export type DeployTargetModules = z.infer<typeof DeployTargetModulesSchema>;
const PatchDeployTargetModulesSchema = z.record(z.string(), IntegrationModuleDeploymentConfigSchema);

export const OperatonUiAccessSchema = z
  .object({
    enabled: z.literal(true),
    publicBaseUrl: HttpUrlSchema,
    auth: z.object({
      kind: z.literal('basic'),
      secretRef: z.string().min(1),
    }),
  })
  .strict();

const DeployTargetWorkflowsConfigSchema = z
  .object({
    engine: z
      .object({
        kind: z.literal('operaton'),
        mode: z.literal('provisioned'),
        image: z.string().min(1),
        adminUserSecretRef: z.string().min(1).optional(),
      })
      .strict(),
    worker: z
      .object({
        image: z.string().min(1),
      })
      .strict(),
    operatonUi: OperatonUiAccessSchema.optional(),
  })
  .strict();

export const DeployTargetWorkflowsSchema = DeployTargetWorkflowsConfigSchema.nullable().default(null);
export type DeployTargetWorkflows = z.infer<typeof DeployTargetWorkflowsSchema>;
const PatchDeployTargetWorkflowsSchema = DeployTargetWorkflowsConfigSchema.nullable().optional();

export const DeployTargetManualAccessSchema = z
  .object({
    redpandaConsole: z
      .object({
        enabled: z.boolean(),
        image: z.string().min(1).optional(),
        publicBaseUrl: HttpUrlSchema.optional(),
        basicAuth: z
          .object({
            username: z.string().trim().min(1),
            htpasswdSecretRef: z.string().trim().min(1),
          })
          .strict(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .default({});
export type DeployTargetManualAccess = z.infer<typeof DeployTargetManualAccessSchema>;
const PatchDeployTargetManualAccessSchema = z
  .object({
    redpandaConsole: z
      .object({
        enabled: z.boolean(),
        image: z.string().min(1).optional(),
        publicBaseUrl: HttpUrlSchema.optional(),
        basicAuth: z
          .object({
            username: z.string().trim().min(1),
            htpasswdSecretRef: z.string().trim().min(1),
          })
          .strict(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();

const ExternalStorageConfigSchema = z
  .object({
    mode: z.literal('external'),
  })
  .strict();

const ProvisionedRustfsStorageConfigSchema = z
  .object({
    mode: z.literal('provisioned'),
    provider: z.literal('rustfs'),
    image: z.string().min(1).optional(),
    publicBaseUrl: HttpUrlSchema,
    accessKeyRef: z.string().min(1),
    secretKeyRef: z.string().min(1),
  })
  .strict();

export const DeployTargetStorageSchema = z
  .discriminatedUnion('mode', [ExternalStorageConfigSchema, ProvisionedRustfsStorageConfigSchema])
  .default({ mode: 'external' });
export type DeployTargetStorage = z.infer<typeof DeployTargetStorageSchema>;
const PatchDeployTargetStorageSchema = z
  .discriminatedUnion('mode', [ExternalStorageConfigSchema, ProvisionedRustfsStorageConfigSchema])
  .optional();

const Auth0TargetConfigSchema = z.object({
  clientId: z.string().min(1),
  domain: z.string().min(1).optional(),
  audience: z.string().min(1).optional(),
  redirectUri: HttpUrlSchema.optional(),
});

export const DeployTargetAuthConfigSchema = z
  .object({
    auth0: Auth0TargetConfigSchema.optional(),
  })
  .default({});
export type DeployTargetAuthConfig = z.infer<typeof DeployTargetAuthConfigSchema>;
const PatchDeployTargetAuthConfigSchema = z.object({
  auth0: Auth0TargetConfigSchema.optional(),
});

export const DeployTargetKindSchema = z.enum(['dokploy']);
export type DeployTargetKind = z.infer<typeof DeployTargetKindSchema>;

export const CreateDeployTargetRequestSchema = z
  .object({
    slug: SlugSchema,
    displayName: z.string().min(1).max(120),
    kind: DeployTargetKindSchema,
    dokployUrl: HttpUrlSchema,
    publicBaseUrl: HttpUrlSchema.optional(),
    dokployProjectId: z.string().min(1).optional(),
    dokployProjectName: z.string().min(1).optional(),
    allowCreateProject: z.boolean().default(false),
    apiToken: z.string().min(1),
    eventBus: EventBusConfigSchema,
    modules: DeployTargetModulesSchema,
    workflows: DeployTargetWorkflowsSchema,
    storage: DeployTargetStorageSchema,
    auth: DeployTargetAuthConfigSchema,
    policyValues: PolicyValuesSchema,
    manualAccess: DeployTargetManualAccessSchema,
    isDefault: z.boolean().default(false),
  })
  .refine(
    (value) =>
      Boolean(value.dokployProjectId) ||
      (Boolean(value.dokployProjectName) && value.allowCreateProject),
    {
      message: 'either dokployProjectId or (dokployProjectName + allowCreateProject) is required',
    },
  );
export type CreateDeployTargetRequest = z.infer<typeof CreateDeployTargetRequestSchema>;

export const UpdateDeployTargetRequestSchema = z
  .object({
    displayName: z.string().min(1).max(120).optional(),
    dokployUrl: HttpUrlSchema.optional(),
    publicBaseUrl: HttpUrlSchema.optional(),
    dokployProjectId: z.string().min(1).nullable().optional(),
    dokployProjectName: z.string().min(1).nullable().optional(),
    allowCreateProject: z.boolean().optional(),
    eventBus: EventBusConfigSchema.optional(),
    modules: PatchDeployTargetModulesSchema.optional(),
    workflows: PatchDeployTargetWorkflowsSchema,
    storage: PatchDeployTargetStorageSchema,
    auth: PatchDeployTargetAuthConfigSchema.optional(),
    policyValues: PatchPolicyValuesSchema.optional(),
    manualAccess: PatchDeployTargetManualAccessSchema,
    isDefault: z.boolean().optional(),
  })
  .strict();
export type UpdateDeployTargetRequest = z.infer<typeof UpdateDeployTargetRequestSchema>;

export const RotateApiTokenRequestSchema = z.object({ apiToken: z.string().min(1) });
export type RotateApiTokenRequest = z.infer<typeof RotateApiTokenRequestSchema>;

export const DeployTargetSchema = z.object({
  id: UuidSchema,
  orgId: UuidSchema,
  slug: SlugSchema,
  displayName: z.string(),
  kind: DeployTargetKindSchema,
  dokployUrl: HttpUrlSchema,
  publicBaseUrl: HttpUrlSchema.nullable(),
  dokployProjectId: z.string().nullable(),
  dokployProjectName: z.string().nullable(),
  allowCreateProject: z.boolean(),
  apiTokenRedacted: z.literal('***'),
  eventBus: EventBusConfigSchema,
  modules: DeployTargetModulesSchema,
  workflows: DeployTargetWorkflowsSchema,
  storage: DeployTargetStorageSchema,
  auth: DeployTargetAuthConfigSchema,
  policyValues: PolicyValuesSchema,
  manualAccess: DeployTargetManualAccessSchema,
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type DeployTarget = z.infer<typeof DeployTargetSchema>;

export type DeployTargetWithSecret = Omit<DeployTarget, 'apiTokenRedacted'> & {
  readonly apiTokenCiphertext: Buffer;
  readonly apiTokenNonce: Buffer;
  readonly apiTokenKeyVersion: number;
};
