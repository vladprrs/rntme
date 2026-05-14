/**
 * Structural mirror types for @rntme/platform-core's DeployTarget and its nested
 * schemas. These types are intentionally kept import-free of platform-core so
 * deploy-runner has no dependency on it.
 *
 * TypeScript's structural typing means any value that satisfies platform-core's
 * `DeployTarget` also satisfies `DeployTargetForBuild` — no adapter needed.
 *
 * IMPORTANT: All optional fields use `?: T | undefined` (not `?: T`) to be
 * compatible with platform-core's Zod-inferred types under
 * `exactOptionalPropertyTypes: true`. Zod's `.optional()` infers `T | undefined`,
 * and `exactOptionalPropertyTypes` requires the source type to explicitly include
 * `undefined` if the target property does.
 */

// ---------------------------------------------------------------------------
// EventBusConfig
// ---------------------------------------------------------------------------

type KafkaSecurityPlaintext = {
  readonly protocol: 'plaintext';
};

type KafkaSecuritySaslSsl = {
  readonly protocol: 'sasl_ssl';
  readonly mechanism: 'scram-sha-256' | 'scram-sha-512';
  readonly secretRefs: {
    readonly username: string;
    readonly password: string;
  };
};

export type KafkaSecurity = KafkaSecurityPlaintext | KafkaSecuritySaslSsl;

type ExternalEventBusConfig = {
  readonly kind: 'kafka';
  // mode is `z.literal('external').optional()` in platform-core, so Zod infers
  // `'external' | undefined`. Include `| undefined` to stay compatible under
  // `exactOptionalPropertyTypes: true`.
  readonly mode?: 'external' | undefined;
  readonly brokers: readonly string[];
  readonly topicPrefix?: string | undefined;
  readonly security?: KafkaSecurity | undefined;
};

type ProvisionedEventBusConfig = {
  readonly kind: 'kafka';
  readonly mode: 'provisioned';
  readonly provider: 'redpanda';
  readonly image?: string | undefined;
  readonly topicPrefix?: string | undefined;
};

type InMemoryEventBusConfig = {
  readonly kind: 'in-memory';
};

export type EventBusConfig = ExternalEventBusConfig | ProvisionedEventBusConfig | InMemoryEventBusConfig;

// ---------------------------------------------------------------------------
// PolicyValues
// ---------------------------------------------------------------------------

export type PolicyValues = Record<string, Record<string, unknown>>;

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export type ModuleConfig = {
  readonly image?: string | undefined;
  readonly expose?: boolean | undefined;
  readonly env?: Record<string, string> | undefined;
  readonly secretRefs?: Record<string, string> | undefined;
  readonly [key: string]: unknown;
};

export type DeployTargetModules = Record<string, ModuleConfig>;

export type DomainServiceConfig = {
  readonly env?: Record<string, string> | undefined;
  readonly secretRefs?: Record<string, string> | undefined;
};

export type DeployTargetServices = Record<string, DomainServiceConfig>;

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

export type OperatonUiAccess = {
  readonly enabled: true;
  readonly publicBaseUrl: string;
  readonly auth: {
    readonly kind: 'basic';
    readonly secretRef: string;
  };
};

export type DeployTargetWorkflows = {
  readonly engine: {
    readonly kind: 'operaton';
    readonly mode: 'provisioned';
    readonly image: string;
    readonly adminUserSecretRef?: string | undefined;
  };
  readonly worker: {
    readonly image: string;
  };
  readonly operatonUi?: OperatonUiAccess | undefined;
} | null;

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

type ExternalStorageConfig = {
  readonly mode: 'external';
};

type ProvisionedRustfsStorageConfig = {
  readonly mode: 'provisioned';
  readonly provider: 'rustfs';
  readonly image?: string | undefined;
  readonly publicBaseUrl: string;
  readonly accessKeyRef: string;
  readonly secretKeyRef: string;
};

export type DeployTargetStorage = ExternalStorageConfig | ProvisionedRustfsStorageConfig;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export type DeployTargetAuthConfig = {
  readonly auth0?: {
    readonly clientId: string;
    readonly domain?: string | undefined;
    readonly audience?: string | undefined;
    readonly redirectUri?: string | undefined;
  } | undefined;
};

// ---------------------------------------------------------------------------
// Manual Access
// ---------------------------------------------------------------------------

export type DeployTargetManualAccess = {
  readonly redpandaConsole?: {
    readonly enabled: boolean;
    readonly image?: string | undefined;
    readonly publicBaseUrl?: string | undefined;
    readonly basicAuth: {
      readonly username: string;
      readonly htpasswdSecretRef: string;
    };
  } | undefined;
};

// ---------------------------------------------------------------------------
// DeployTargetForBuild — the aggregate type passed to build-deploy-config fns
// ---------------------------------------------------------------------------

/**
 * Structural mirror of platform-core's `DeployTarget` covering the fields
 * accessed by `buildProjectDeploymentConfig` and `buildDokployTargetConfig`.
 *
 * Any value satisfying platform-core's `DeployTarget` also satisfies this type
 * without conversion — TypeScript's structural subtyping guarantees it.
 */
export type DeployTargetForBuild = {
  readonly id: string;
  readonly slug: string;
  readonly kind: 'dokploy';
  readonly displayName: string;
  readonly dokployUrl: string;
  readonly publicBaseUrl: string | null;
  readonly dokployProjectId: string | null;
  readonly dokployProjectName: string | null;
  readonly allowCreateProject: boolean;
  readonly eventBus: EventBusConfig;
  readonly services?: DeployTargetServices | undefined;
  readonly modules: DeployTargetModules;
  readonly workflows: DeployTargetWorkflows;
  readonly storage: DeployTargetStorage;
  readonly auth: DeployTargetAuthConfig;
  readonly policyValues: PolicyValues;
  readonly manualAccess: DeployTargetManualAccess;
};
