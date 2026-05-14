import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import type { Result } from '../result.js';
import { ok, err } from '../result.js';

export type NestedError = {
  code: string;
  message: string;
  path?: string | undefined;
  pkg?: string | undefined;
  stage?: string | undefined;
  cause?: NestedError[] | undefined;
};

export type ApiError = {
  kind: 'http';
  status: number;
  code: string;
  message: string;
  stage?: string | undefined;
  pkg?: string | undefined;
  path?: string | undefined;
  requestId?: string | undefined;
  nested?: NestedError[] | undefined;
};

export type NetworkError = { kind: 'network'; message: string; cause: unknown };
export type ClientError = ApiError | NetworkError;

export type ApiCallOptions<T> = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  baseUrl: string;
  token: string | null;
  body?: unknown;
  rawBody?: string;
  contentType?: string;
  responseSchema: z.ZodType<T>;
  requestId?: string;
  timeoutMs?: number;
};

const VERSION = '0.0.0';

/**
 * Mount paths for the platform blueprint HTTP surface.
 *
 * These are the prefixes asserted by `platform-blueprint.test.ts`. CLI command
 * code should compose URLs from these constants instead of hard-coding `/v1`
 * org-slug-nested paths. Legacy `/v1/...` paths still exist for endpoints not
 * yet ported to the platform blueprint (auth.me, tokens, project operations,
 * project version show).
 */
export const PLATFORM_API = {
  projects: '/api/projects',
  deployments: '/api/deployments',
  deployTargets: '/api/deployments/targets',
  tokens: '/api/tokens',
  audit: '/api/audit',
} as const;

export async function apiCall<T>(opts: ApiCallOptions<T>): Promise<Result<T, ClientError>> {
  const requestId = opts.requestId ?? `req_${randomUUID().replaceAll('-', '')}`;
  const url = `${opts.baseUrl.replace(/\/+$/, '')}${opts.path}`;
  const headers: Record<string, string> = {
    'Content-Type': opts.contentType ?? 'application/json',
    'User-Agent': `rntme-cli/${VERSION} (node/${process.version.replace(/^v/, '')})`,
    'X-Request-ID': requestId,
  };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120_000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method,
      headers,
      body: opts.rawBody ?? (opts.body === undefined ? null : JSON.stringify(opts.body)),
      signal: controller.signal,
    });
  } catch (cause) {
    clearTimeout(timeout);
    return err({ kind: 'network', message: String((cause as Error)?.message ?? cause), cause });
  }
  clearTimeout(timeout);

  const echoedRequestId = res.headers.get('x-request-id') ?? requestId;

  const text = await res.text();
  let parsedBody: unknown = null;
  if (text.length > 0) {
    try {
      parsedBody = JSON.parse(text);
    } catch {
      parsedBody = null;
    }
  }

  if (res.ok) {
    const nativeError = parseNativeHandlerErrorEnvelope(parsedBody);
    if (nativeError !== null) {
      return err({
        kind: 'http',
        status: res.status,
        code: nativeError.code,
        message: nativeError.message,
        stage: nativeError.stage,
        pkg: nativeError.pkg,
        path: nativeError.path,
        requestId: echoedRequestId,
        nested: nativeError.nested,
      });
    }

    const schemaResult = opts.responseSchema.safeParse(parsedBody);
    if (!schemaResult.success) {
      return err({
        kind: 'http',
        status: res.status,
        code: 'CLI_RESPONSE_PARSE_FAILED',
        message: `response did not match expected schema: ${schemaResult.error.issues.map((i) => i.message).join('; ')}`,
        requestId: echoedRequestId,
      });
    }
    if (schemaResult.data && typeof schemaResult.data === 'object') {
      Object.defineProperty(schemaResult.data, '__status', {
        value: res.status,
        enumerable: false,
      });
    }
    return ok(schemaResult.data);
  }

  const envelope = parseErrorEnvelope(parsedBody);
  return err({
    kind: 'http',
    status: res.status,
    code: envelope?.code ?? 'PLATFORM_INTERNAL',
    message: envelope?.message ?? `HTTP ${res.status}`,
    stage: envelope?.stage,
    pkg: envelope?.pkg,
    path: envelope?.path,
    requestId: echoedRequestId,
    nested: envelope?.nested,
  });
}

function parseNativeHandlerErrorEnvelope(body: unknown):
  | { code: string; message: string; stage?: string | undefined; pkg?: string | undefined; path?: string | undefined; nested?: NestedError[] | undefined }
  | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (b.status !== 'error' || !Array.isArray(b.errors) || b.errors.length === 0) return null;
  const first = parseNestedError(b.errors[0]);
  return {
    code: first.code,
    message: first.message,
    stage: first.stage,
    pkg: first.pkg,
    path: first.path,
    nested: b.errors.map(parseNestedError),
  };
}

function parseErrorEnvelope(body: unknown):
  | { code: string; message: string; stage?: string | undefined; pkg?: string | undefined; path?: string | undefined; nested?: NestedError[] | undefined }
  | null {
  if (!body || typeof body !== 'object') return null;
  const errObj = (body as { error?: unknown }).error;
  if (!errObj || typeof errObj !== 'object') return null;
  const e = errObj as Record<string, unknown>;
  const code = typeof e.code === 'string' ? e.code : 'PLATFORM_INTERNAL';
  const message = typeof e.message === 'string' ? e.message : 'unknown';
  const stage = typeof e.stage === 'string' ? e.stage : undefined;
  const pkg = typeof e.pkg === 'string' ? e.pkg : undefined;
  const path = typeof e.path === 'string' ? e.path : undefined;

  const nestedRaw = Array.isArray(e.errors)
    ? e.errors
    : (e.cause && typeof e.cause === 'object' && (e.cause as { errors?: unknown }).errors) || undefined;
  let nested: NestedError[] | undefined;
  if (Array.isArray(nestedRaw)) {
    nested = nestedRaw.map(parseNestedError);
  }

  return { code, message, stage, pkg, path, nested };
}

function parseNestedError(value: unknown): NestedError {
  if (!value || typeof value !== 'object') return { code: 'UNKNOWN', message: String(value) };
  const x = value as Record<string, unknown>;
  return {
    code: typeof x.code === 'string' ? x.code : 'UNKNOWN',
    message: typeof x.message === 'string' ? x.message : '',
    path: typeof x.path === 'string' ? x.path : undefined,
    pkg: typeof x.pkg === 'string' ? x.pkg : undefined,
    stage: typeof x.stage === 'string' ? x.stage : undefined,
    cause: Array.isArray(x.cause) ? x.cause.map(parseNestedError) : undefined,
  };
}
