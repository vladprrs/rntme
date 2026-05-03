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

export type EventBusConfig = ExternalEventBusConfig | ProvisionedEventBusConfig;

export type IntegrationModuleDeploymentConfig = {
  readonly image: string;
  readonly expose?: boolean;
  readonly env?: Readonly<Record<string, string>>;
  readonly secretRefs?: Readonly<Record<string, string>>;
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
  };
};

export type ProjectDeploymentConfig = {
  readonly targetSlug?: string;
  readonly orgSlug: string;
  readonly environment: DeploymentEnvironment;
  readonly mode: DeploymentMode;
  readonly eventBus?: EventBusConfig;
  readonly modules?: Readonly<Record<string, IntegrationModuleDeploymentConfig>>;
  readonly policies?: DeploymentPolicyConfig;
  readonly auth?: ProjectAuthConfig;
  readonly runtimeImage?: string;
};
