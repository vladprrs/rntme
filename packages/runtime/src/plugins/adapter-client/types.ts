export type RetryStrategy = 'never' | 'transient' | 'all';

export type RetryPolicy = {
  attempts: number;
  backoffMs: 'exp' | number;
  retryOn: RetryStrategy;
};

export const DEFAULT_RETRY: RetryPolicy = { attempts: 3, backoffMs: 'exp', retryOn: 'transient' };
export const DEFAULT_TIMEOUT_MS = 2000;

export type AdapterErrorCode =
  | 'EXTERNAL_MODULE_TIMEOUT'
  | 'EXTERNAL_MODULE_UNAVAILABLE'
  | 'EXTERNAL_MODULE_OVERLOAD'
  | 'EXTERNAL_MODULE_INTERNAL'
  | 'EXTERNAL_MODULE_SCHEMA_MISMATCH'
  | 'EXTERNAL_MODULE_NOT_CONFIGURED'
  | 'EXTERNAL_MODULE_CIRCUIT_OPEN'
  | 'EXTERNAL_VENDOR_DOMAIN';        // pass-through from module (kept generic; real code in `details.domainCode`)

export type AdapterError = Readonly<{
  code: AdapterErrorCode;
  message: string;
  /** For EXTERNAL_VENDOR_DOMAIN: the code reported by the module (e.g. PAYMENTS_PRICE_NOT_FOUND). */
  domainCode?: string;
  /** HTTP status the caller (bindings-http) should surface. */
  httpStatus: number;
  /** Raw metadata; not serialized to the client by default. */
  detail?: unknown;
}>;

export type AdapterCallOptions = {
  idempotencyKey: string;
  timeoutMs: number;
  retry: RetryPolicy;
  correlationId?: string;
};

export type AdapterOk = { ok: true; value: unknown };
export type AdapterErr = { ok: false; errors: AdapterError[] };
export type AdapterResult = AdapterOk | AdapterErr;

export interface ExternalAdapterClient {
  call(
    module: string,
    rpc: string,
    input: unknown,
    opts: AdapterCallOptions,
  ): Promise<AdapterResult>;
}
