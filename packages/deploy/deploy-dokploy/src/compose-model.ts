import type { DeploymentWorkload } from '@rntme/deploy-core';
import type { RenderedEnvVar, RenderedSecretFileRef } from './render.js';

export type RenderedComposeServiceClass =
  | 'domain-service'
  | 'integration-module'
  | 'edge-gateway'
  | 'bpmn-worker'
  | 'event-bus'
  | 'workflow-engine'
  | 'object-storage'
  | 'infrastructure-proxy';

export type RenderedComposeRestartPolicy = {
  readonly container: 'on-failure:3' | 'unless-stopped';
  readonly swarm?: {
    readonly condition: 'on-failure';
    readonly delay: '30s';
    readonly maxAttempts: 3;
    readonly window: '5m';
  };
};

export type RenderedComposeResourceLimits = {
  readonly cpus: '0.10' | '0.25' | '0.50' | '1.00';
  readonly memory: '128M' | '256M' | '512M' | '1G';
};

export type RenderedComposeVolumeMount = {
  readonly source: string;
  readonly target: string;
  readonly readOnly: boolean;
};

export type RenderedComposeService = {
  readonly name: string;
  readonly logicalId: string;
  readonly serviceClass: RenderedComposeServiceClass;
  readonly workloadKind?: DeploymentWorkload['kind'] | 'infrastructure-proxy';
  readonly workloadSlug?: string;
  readonly image: string;
  readonly command?: string;
  readonly args?: readonly string[];
  readonly env: readonly RenderedEnvVar[];
  readonly files?: Readonly<Record<string, string>>;
  readonly secretFiles?: Readonly<Record<string, RenderedSecretFileRef>>;
  readonly ports?: readonly number[];
  readonly volumes?: readonly RenderedComposeVolumeMount[];
  readonly restart: RenderedComposeRestartPolicy;
  readonly resources: RenderedComposeResourceLimits;
};

export type RenderedComposeDomain = {
  readonly host: string;
  readonly path: '/';
  readonly serviceName: string;
  readonly containerPort: number;
  readonly https: boolean;
};

export function runtimeRestartPolicy(): RenderedComposeRestartPolicy {
  return {
    container: 'on-failure:3',
    swarm: { condition: 'on-failure', delay: '30s', maxAttempts: 3, window: '5m' },
  };
}

export function infraRestartPolicy(): RenderedComposeRestartPolicy {
  return { container: 'unless-stopped' };
}

export function runtimeLimits(): RenderedComposeResourceLimits {
  return { cpus: '0.50', memory: '512M' };
}

export function proxyLimits(): RenderedComposeResourceLimits {
  return { cpus: '0.10', memory: '128M' };
}

export function redpandaLimits(): RenderedComposeResourceLimits {
  return { cpus: '1.00', memory: '1G' };
}

export function operatonLimits(): RenderedComposeResourceLimits {
  return { cpus: '1.00', memory: '1G' };
}

export function rustfsLimits(): RenderedComposeResourceLimits {
  return { cpus: '0.50', memory: '512M' };
}

export function consoleLimits(): RenderedComposeResourceLimits {
  return { cpus: '0.25', memory: '256M' };
}
