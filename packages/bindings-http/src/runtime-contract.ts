export type RetryStrategy = 'never' | 'transient' | 'all';

export type RetryPolicy = {
  attempts: number;
  backoffMs: 'exp' | number;
  retryOn: RetryStrategy;
};

export const DEFAULT_RETRY: RetryPolicy = {
  attempts: 3,
  backoffMs: 'exp',
  retryOn: 'transient',
};

export const DEFAULT_TIMEOUT_MS = 2000;

export type AdapterErrorCode =
  | 'EXTERNAL_MODULE_TIMEOUT'
  | 'EXTERNAL_MODULE_UNAVAILABLE'
  | 'EXTERNAL_MODULE_OVERLOAD'
  | 'EXTERNAL_MODULE_INTERNAL'
  | 'EXTERNAL_MODULE_SCHEMA_MISMATCH'
  | 'EXTERNAL_MODULE_NOT_CONFIGURED'
  | 'EXTERNAL_MODULE_CIRCUIT_OPEN'
  | 'EXTERNAL_VENDOR_DOMAIN';

export type AdapterError = Readonly<{
  code: AdapterErrorCode;
  message: string;
  domainCode?: string;
  httpStatus: number;
  detail?: unknown;
}>;

export type AdapterCallOptions = {
  idempotencyKey: string;
  timeoutMs: number;
  retry: RetryPolicy;
  correlationId?: string;
};

export type AdapterResult =
  | { ok: true; value: unknown }
  | { ok: false; error: AdapterError };

export interface ExternalAdapterClient {
  call(
    module: string,
    rpc: string,
    input: unknown,
    opts: AdapterCallOptions,
  ): Promise<AdapterResult>;
}

export type Metrics = {
  externalPreStep?: {
    labels(labels: {
      module: string;
      rpc: string;
      result: string;
      error_code: string;
    }): { inc(): void };
  };
};
