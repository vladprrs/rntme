export type DeploymentMode = 'preview' | 'production';

export type DeploymentEnvironment = 'default';

export type ExternalEventBusSecurity =
  | { readonly protocol: 'plaintext' }
  | {
      readonly protocol: 'sasl_ssl';
      readonly mechanism: 'scram-sha-256' | 'scram-sha-512';
      readonly secretRefs: {
        readonly username: string;
        readonly password: string;
      };
    };

export const DEFAULT_REDPANDA_IMAGE = 'docker.redpanda.com/redpandadata/redpanda:v24.3.6';
export const DEFAULT_RUSTFS_IMAGE = 'rustfs/rustfs:1.0.0-beta.1';

export const DEFAULT_REDPANDA_CONSOLE_IMAGE = 'docker.redpanda.com/redpandadata/console:v3.7.2';

export type RedpandaConsoleAccessConfig = {
  readonly enabled: boolean;
  readonly image?: string;
  readonly publicBaseUrl?: string;
  readonly basicAuth: {
    readonly username: string;
    readonly htpasswdSecretRef: string;
  };
};

export type ExternalEventBusConfig = {
  readonly kind: 'kafka';
  readonly mode?: 'external';
  readonly brokers: readonly string[];
  readonly topicPrefix?: string;
  readonly security?: ExternalEventBusSecurity;
};

export type ProvisionedEventBusConfig = {
  readonly kind: 'kafka';
  readonly mode: 'provisioned';
  readonly provider: 'redpanda';
  readonly image?: string;
  readonly topicPrefix?: string;
};

export type InMemoryEventBusConfig = {
  readonly kind: 'memory';
  readonly mode: 'in-memory';
};

export type EventBusConfig = ExternalEventBusConfig | ProvisionedEventBusConfig | InMemoryEventBusConfig;

export type ExternalStorageConfig = {
  readonly mode: 'external';
};

export type ProvisionedRustfsStorageConfig = {
  readonly mode: 'provisioned';
  readonly provider: 'rustfs';
  readonly image?: string;
  readonly publicBaseUrl: string;
  readonly accessKeyRef: string;
  readonly secretKeyRef: string;
};

export type StorageConfig = ExternalStorageConfig | ProvisionedRustfsStorageConfig;

export type WorkflowEngineConfig =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'operaton';
      readonly mode: 'provisioned';
      readonly image: string;
      readonly adminUserSecretRef?: string;
    };

export type OperatonUiAccessConfig = {
  readonly enabled: true;
  readonly publicBaseUrl: string;
  readonly auth: { readonly kind: 'basic'; readonly secretRef: string };
};

export type BpmnWorkerConfig = {
  readonly image: string;
};

export type IntegrationModuleDeploymentConfig = {
  readonly image?: string;
  readonly expose?: boolean;
  readonly env?: Readonly<Record<string, string>>;
  readonly secretRefs?: Readonly<Record<string, string>>;
  readonly [key: string]: unknown;
};

export type RateLimitPolicyConfig = {
  readonly requestsPerMinute: number;
  readonly burst: number;
};

export type BodyLimitPolicyConfig = {
  readonly maxBodySize: string;
};

export type TimeoutPolicyConfig = {
  readonly upstreamTimeoutMs: number;
};

export type RequestContextPolicyConfig = {
  readonly requestIdHeader?: string;
  readonly correlationIdHeader?: string;
};

export type DeploymentPolicyConfig = {
  readonly rateLimit?: Readonly<Record<string, RateLimitPolicyConfig>>;
  readonly bodyLimit?: Readonly<Record<string, BodyLimitPolicyConfig>>;
  readonly timeout?: Readonly<Record<string, TimeoutPolicyConfig>>;
  readonly requestContext?: Readonly<Record<string, RequestContextPolicyConfig>>;
};

export type ProjectAuthConfig = {
  readonly auth0?: {
    readonly clientId: string;
    readonly domain?: string;
    readonly audience?: string;
    readonly redirectUri?: string;
  };
};

export type ProjectDeploymentConfig = {
  readonly targetSlug?: string;
  readonly orgSlug: string;
  readonly environment: DeploymentEnvironment;
  readonly mode: DeploymentMode;
  readonly eventBus?: EventBusConfig;
  readonly storage?: StorageConfig;
  readonly modules?: Readonly<Record<string, IntegrationModuleDeploymentConfig>>;
  readonly policies?: DeploymentPolicyConfig;
  readonly auth?: ProjectAuthConfig;
  readonly runtimeImage?: string;
  readonly workflows?: {
    readonly engine: WorkflowEngineConfig;
    readonly worker: BpmnWorkerConfig;
    readonly operatonUi?: OperatonUiAccessConfig;
  };
  readonly manualAccess?: {
    readonly redpandaConsole?: RedpandaConsoleAccessConfig;
  };
};
