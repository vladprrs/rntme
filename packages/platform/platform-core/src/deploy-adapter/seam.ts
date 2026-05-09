import type { Result } from '../types/result.js';

export type DeployAdapterInput = {
  readonly deploymentId: string;
  readonly organizationId: string;
  readonly projectVersionId: string;
  readonly targetId: string;
  readonly bundleObjectKey: string;
};

export type DeployAdapterLogLine = {
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly stage: string;
  readonly message: string;
};

export type DeployAdapterSuccess = {
  readonly status: 'succeeded';
  readonly targetProvider: 'dokploy';
  readonly renderedDigest: string;
  readonly logs: readonly DeployAdapterLogLine[];
  readonly evidence: Readonly<Record<string, unknown>>;
};

export type DeployAdapterFailure = {
  readonly status: 'failed';
  readonly targetProvider: 'dokploy';
  readonly logs: readonly DeployAdapterLogLine[];
  readonly error: { readonly code: string; readonly message: string };
  readonly evidence?: Readonly<Record<string, unknown>>;
};

export type DeployAdapterResult = DeployAdapterSuccess | DeployAdapterFailure;

export type DeployAdapter = {
  readonly run: (input: DeployAdapterInput) => Promise<Result<DeployAdapterResult>>;
};
