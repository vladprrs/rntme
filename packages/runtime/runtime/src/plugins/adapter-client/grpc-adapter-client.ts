import * as grpc from '@grpc/grpc-js';
import pino, { type Logger } from 'pino';
import type {
  ExternalAdapterClient,
  AdapterCallOptions,
  AdapterResult,
  AdapterError,
} from './types.js';
import { withRetry } from './retry.js';
import { CircuitBreaker } from './circuit-breaker.js';
import type { ProtoRegistry } from './proto-registry.js';

export type GrpcAdapterClientConfig = {
  modules: Record<string, { address: string; protoPath: string; credentials?: grpc.ChannelCredentials }>;
  registry: ProtoRegistry;
  logger?: Logger;
  circuit?: { windowMs?: number; minCalls?: number; errorRateThreshold?: number; halfOpenAfterMs?: number };
};

export class GrpcAdapterClient implements ExternalAdapterClient {
  private readonly clients: Map<string, grpc.Client> = new Map();
  private readonly breakers: Map<string, CircuitBreaker> = new Map();
  private readonly logger: Logger;

  constructor(private readonly cfg: GrpcAdapterClientConfig) {
    this.logger = cfg.logger ?? pino({ level: process.env.LOG_LEVEL ?? 'info' });
  }

  private getBreaker(module: string, rpc: string): CircuitBreaker {
    const key = `${module}:${rpc}`;
    let cb = this.breakers.get(key);
    if (cb === undefined) {
      cb = new CircuitBreaker({
        windowMs: this.cfg.circuit?.windowMs ?? 30_000,
        minCalls: this.cfg.circuit?.minCalls ?? 10,
        errorRateThreshold: this.cfg.circuit?.errorRateThreshold ?? 0.5,
        halfOpenAfterMs: this.cfg.circuit?.halfOpenAfterMs ?? 30_000,
      });
      this.breakers.set(key, cb);
    }
    return cb;
  }

  private getClient(module: string): grpc.Client | undefined {
    let client = this.clients.get(module);
    if (client !== undefined) return client;
    const cfg = this.cfg.modules[module];
    if (cfg === undefined) return undefined;
    const credentials = cfg.credentials ?? this.insecureFallbackCredentials(module);
    client = new grpc.Client(cfg.address, credentials);
    this.clients.set(module, client);
    return client;
  }

  private insecureFallbackCredentials(module: string): grpc.ChannelCredentials {
    if (process.env.NODE_ENV === 'production') {
      this.logger.warn({
        msg: 'grpc_module_insecure_credentials',
        module,
      });
    }
    return grpc.credentials.createInsecure();
  }

  async call(module: string, rpc: string, input: unknown, opts: AdapterCallOptions): Promise<AdapterResult> {
    const client = this.getClient(module);
    if (client === undefined) {
      return { ok: false, errors: [{
        code: 'EXTERNAL_MODULE_NOT_CONFIGURED',
        message: `module "${module}" is not declared in manifest.modules`,
        httpStatus: 500,
      }] };
    }
    const methods = this.cfg.registry.getMethodDescriptors(module);
    const method = methods[rpc];
    if (method === undefined) {
      return { ok: false, errors: [{
        code: 'EXTERNAL_MODULE_SCHEMA_MISMATCH',
        message: `rpc "${rpc}" not found in module "${module}" proto`,
        httpStatus: 500,
      }] };
    }
    const breaker = this.getBreaker(module, rpc);
    if (!breaker.allow()) {
      return { ok: false, errors: [{
        code: 'EXTERNAL_MODULE_CIRCUIT_OPEN',
        message: `circuit breaker open for ${module}.${rpc}`,
        httpStatus: 503,
      }] };
    }

    const doCall = async (): Promise<AdapterResult> => {
      const meta = new grpc.Metadata();
      meta.add('rntme-idempotency-key', opts.idempotencyKey);
      if (opts.correlationId !== undefined) meta.add('rntme-correlation-id', opts.correlationId);
      const deadline = new Date(Date.now() + opts.timeoutMs);

      return new Promise<AdapterResult>((resolve) => {
        if (input === null || typeof input !== 'object' || Array.isArray(input)) {
          resolve({ ok: false, errors: [{
            code: 'EXTERNAL_MODULE_SCHEMA_MISMATCH',
            message: `rpc "${rpc}" input must be a JSON object`,
            httpStatus: 500,
          }] });
          return;
        }
        try {
          client.makeUnaryRequest(
            method.path,
            method.requestSerialize,
            method.responseDeserialize,
            input,
            meta,
            { deadline },
            (err: grpc.ServiceError | null, res?: object) => {
              if (err !== null && err !== undefined) {
                resolve({ ok: false, errors: [statusToAdapterError(err)] });
                return;
              }
              resolve({ ok: true, value: res });
            },
          );
        } catch (e) {
          resolve({ ok: false, errors: [{
            code: 'EXTERNAL_MODULE_SCHEMA_MISMATCH',
            message: e instanceof Error ? e.message : String(e),
            httpStatus: 500,
          }] });
        }
      });
    };

    const result = await withRetry(doCall, opts.retry, (attempt, r, delay): void => {
      this.logger.info({
        msg: 'pre_step_attempt',
        module, rpc, attempt, delay_ms: delay,
        result: r.ok ? 'ok' : (r.errors[0]?.code ?? 'EXTERNAL_MODULE_INTERNAL'),
        idempotency_key: opts.idempotencyKey,
      });
    });

    if (result.ok) breaker.onSuccess();
    else breaker.onFailure();

    return result;
  }
}

export function statusToAdapterError(err: Partial<grpc.ServiceError>): AdapterError {
  const status = (err.code ?? grpc.status.UNKNOWN) as grpc.status;
  const message = err.message ?? 'unknown gRPC error';
  if (status === grpc.status.DEADLINE_EXCEEDED) {
    return { code: 'EXTERNAL_MODULE_TIMEOUT', message, httpStatus: 504 };
  }
  if (status === grpc.status.UNAVAILABLE) {
    return { code: 'EXTERNAL_MODULE_UNAVAILABLE', message, httpStatus: 503 };
  }
  if (status === grpc.status.RESOURCE_EXHAUSTED) {
    return { code: 'EXTERNAL_MODULE_OVERLOAD', message, httpStatus: 503 };
  }
  if (status === grpc.status.INTERNAL || status === grpc.status.UNKNOWN) {
    return { code: 'EXTERNAL_MODULE_INTERNAL', message, httpStatus: 502 };
  }
  const httpMap: Record<number, number> = {
    [grpc.status.INVALID_ARGUMENT]: 400,
    [grpc.status.NOT_FOUND]: 404,
    [grpc.status.FAILED_PRECONDITION]: 409,
    [grpc.status.PERMISSION_DENIED]: 403,
    [grpc.status.UNAUTHENTICATED]: 401,
    [grpc.status.ALREADY_EXISTS]: 409,
    [grpc.status.ABORTED]: 409,
  };
  // Prefer err.details (the original server-supplied detail string) for vendor
  // domain code extraction. grpc-js prefixes err.message with the status code
  // (e.g. "3 INVALID_ARGUMENT: LIMIT_EXCEEDED: ..."), which would defeat the
  // anchored regex. Fall back to message when details is absent (unit-test
  // shape / synthetic ServiceError).
  const detailSource = typeof err.details === 'string' && err.details.length > 0 ? err.details : message;
  const domainCode = /^([A-Z][A-Z0-9_]+):\s*/.exec(detailSource)?.[1];
  return {
    code: 'EXTERNAL_VENDOR_DOMAIN',
    message,
    ...(domainCode !== undefined ? { domainCode } : {}),
    httpStatus: httpMap[status] ?? 502,
  };
}
