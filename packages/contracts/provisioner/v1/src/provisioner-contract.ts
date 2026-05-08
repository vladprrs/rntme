import type { Result } from './result.js';

export type ProvisionerLog = (entry: {
  readonly step: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly code?: string;
  readonly message: string;
}) => void;

export type ProvisionerInput<I = unknown> = {
  readonly publicConfig: I;
  readonly targetSecrets: Readonly<Record<string, unknown>>;
  readonly priorOutputs?: {
    readonly publicOutputs: Readonly<Record<string, unknown>>;
    readonly secretOutputs: Readonly<Record<string, unknown>>;
  };
  /**
   * Per-service validated artifacts keyed by service slug. Vendor provisioners
   * that need service-level configuration can cast entries to their own
   * validated branded types (for example ValidatedStorageJson).
   */
  readonly serviceArtifacts?: Readonly<Record<string, unknown>>;
  readonly log: ProvisionerLog;
  readonly signal: globalThis.AbortSignal;
};

export type ProvisionerOutput = {
  readonly publicOutputs: Readonly<Record<string, unknown>>;
  readonly secretOutputs: Readonly<Record<string, unknown>>;
};

export type ProvisionerVendorError = {
  readonly code: string;
  readonly message: string;
};

export type ProvisionerContract<I = unknown> = {
  provision(input: ProvisionerInput<I>): Promise<Result<ProvisionerOutput, ProvisionerVendorError>>;
  tearDown?(input: ProvisionerInput<I>): Promise<Result<void, ProvisionerVendorError>>;
};
