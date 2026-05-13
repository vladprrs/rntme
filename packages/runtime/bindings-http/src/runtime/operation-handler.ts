import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';
import type { RedirectStatusCode } from 'hono/utils/http-status';
import type { SqliteDatabase } from '@rntme/sqlite';
import type { EventStore, ActorRef } from '@rntme/event-store';
import type { OperationCallClient } from '@rntme/graph-ir-compiler';
import type { BindingPlan } from '../startup/compile-plan.js';
import type { OperationExecutor, OperationExecutorError } from '../operation-contract.js';
import { extractQuery, extractPath } from './extract.js';
import { extractInputs } from './extract-inputs.js';
import { remapToGraphInputs } from './remap.js';
import { renderOkResponse, renderErrResponse } from './render-response.js';
import { errorToHttp } from './error-to-http.js';
import {
  validationErrorBody,
  invalidBodyErrorBody,
  internalErrorBody,
  type ErrorResponseBody,
} from '../errors.js';
import type { IdempotencyCache } from '../idempotency/cache.js';

export type OperationHandlerDeps = {
  operationExecutor: OperationExecutor;
  eventStore: EventStore | null;
  qsmDb: SqliteDatabase;
  now: () => string;
  nextId: () => string;
  callClient: OperationCallClient | null;
  actorFromRequest: (c: Context) => ActorRef | null;
  onError?: (err: unknown, ctx: Context) => void;
  idempotencyCache?: IdempotencyCache | undefined;
};

type Handler = (c: Context) => Promise<Response>;

function hasFormContentType(c: Context): boolean {
  const ct = c.req.header('content-type') ?? '';
  return ct.includes('application/x-www-form-urlencoded');
}

function isAbsoluteUrl(s: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(s);
}

function originOf(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

async function safeParseJsonBody(c: Context): Promise<Record<string, unknown> | null> {
  try {
    const j = await c.req.json();
    return j !== null && typeof j === 'object' && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function safeParseFormBody(c: Context): Promise<Record<string, string>> {
  const raw = await c.req.parseBody();
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = typeof v === 'string' ? v : String(v);
  return out;
}

function operationErrorStatus(code: string): number {
  return errorToHttp(code).status;
}

function operationErrorBody(err: OperationExecutorError): ErrorResponseBody {
  const body: ErrorResponseBody = { code: err.code, message: err.message };
  if (err.detail !== undefined) body.details = err.detail;
  return body;
}

function defaultSuccessBody(plan: BindingPlan, out: Awaited<ReturnType<OperationExecutor['execute']>> & { ok: true }): unknown {
  const value = out.value.value;
  if (plan.exposure !== 'action' || value === null || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  return {
    ...(value as Record<string, unknown>),
    eventIds: out.value.metadata.eventIds,
    commandId: out.value.metadata.commandId,
    correlationId: out.value.metadata.correlationId,
  };
}

function fallbackCorrelation(c: Context): { commandId: string; correlationId: string; traceparent: string | null } {
  const fromMiddleware = (c.var as { correlation?: { commandId: string; correlationId: string; traceparent: string | null } }).correlation;
  if (fromMiddleware !== undefined) return fromMiddleware;
  const traceparent = c.req.header('traceparent') ?? null;
  return {
    commandId: randomUUID(),
    correlationId: c.req.header('Correlation-Id') ?? randomUUID(),
    traceparent,
  };
}

export function makeOperationHandler(plan: BindingPlan, deps: OperationHandlerDeps): Handler {
  const declaredQueryParams = plan.entry.http.parameters.filter((p) => p.in === 'query');
  const hasBody = plan.bodyParamNames.length > 0;
  const hasInputFrom = plan.inputFrom !== null;
  const bodyBytesKeys: string[] =
    plan.inputFrom === null
      ? []
      : Object.entries(plan.inputFrom)
          .filter(([, src]) => src.from === 'bodyBytes')
          .map(([key]) => key);
  const hasBodyBytes = bodyBytesKeys.length > 0;
  const nonByteInputFrom =
    plan.inputFrom === null
      ? null
      : Object.fromEntries(
          Object.entries(plan.inputFrom).filter(([, src]) => src.from !== 'bodyBytes'),
        );

  return async (c: Context): Promise<Response> => {
    let graphInputs: Record<string, unknown> = {};
    let bodyValues: Record<string, unknown> = {};
    let formValues: Record<string, unknown> = {};
    let queryData: Record<string, unknown> = {};
    let headerValues: Record<string, unknown> = {};
    const searchParams = new URL(c.req.url).searchParams;

    const pathParsed = plan.schemas.pathSchema.safeParse(extractPath(c, plan.pathParamNames));
    if (!pathParsed.success) return c.json(validationErrorBody(pathParsed.error), 400);

    const queryParsed = plan.schemas.querySchema.safeParse(extractQuery(c, declaredQueryParams, plan.listParamNames));
    if (!queryParsed.success) return c.json(validationErrorBody(queryParsed.error), 400);
    queryData = queryParsed.data as Record<string, unknown>;

    let parsedJsonBody: Record<string, unknown> | null = null;
    let rawBodyBytes: Uint8Array | null = null;
    if (hasBodyBytes && plan.entry.http.method === 'POST') {
      const buf = await c.req.arrayBuffer();
      rawBodyBytes = new Uint8Array(buf);
    } else if (hasBody) {
      let rawBody: unknown;
      try {
        rawBody = await c.req.json();
      } catch {
        return c.json(invalidBodyErrorBody('Request body is not valid JSON'), 400);
      }
      if (rawBody === null || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
        return c.json(invalidBodyErrorBody('Request body must be a JSON object'), 400);
      }
      const bodyParsed = plan.schemas.bodySchema!.safeParse(rawBody);
      if (!bodyParsed.success) return c.json(validationErrorBody(bodyParsed.error), 400);
      parsedJsonBody = bodyParsed.data as Record<string, unknown>;
      bodyValues = parsedJsonBody;
    } else if (hasInputFrom && plan.entry.http.method === 'POST' && !hasFormContentType(c)) {
      parsedJsonBody = await safeParseJsonBody(c);
      bodyValues = parsedJsonBody ?? {};
    }

    if (hasInputFrom && plan.entry.http.method === 'POST' && hasFormContentType(c)) {
      formValues = await safeParseFormBody(c);
    }

    const combined = {
      ...(queryParsed.data as Record<string, unknown>),
      ...(pathParsed.data as Record<string, unknown>),
      ...bodyValues,
    };
    graphInputs = remapToGraphInputs(combined, plan.bindToMap);
    headerValues = Object.fromEntries(c.req.raw.headers.entries());

    if (hasInputFrom) {
      const request = {
        query: searchParams,
        header: (name: string) => c.req.header(name) ?? null,
        body: parsedJsonBody,
        form: Object.keys(formValues).length > 0 ? formValues as Record<string, string> : null,
      };
      const extracted = extractInputs(nonByteInputFrom!, request);
      if (!extracted.ok) {
        return c.json({ code: extracted.error.code, message: extracted.error.message }, 400);
      }
      graphInputs = { ...graphInputs, ...extracted.values };
      if (hasBodyBytes && rawBodyBytes !== null) {
        for (const key of bodyBytesKeys) {
          graphInputs[key] = rawBodyBytes;
        }
      }
      queryData = { ...Object.fromEntries(searchParams.entries()), ...queryData };
    }

    const actor = deps.actorFromRequest(c);
    const clientKey = c.req.header('Idempotency-Key') ?? null;

    let out;
    try {
      out = await deps.operationExecutor.execute({
        operationName: plan.operationName,
        inputs: graphInputs,
        ctx: {
            qsmDb: deps.qsmDb,
          eventStore: deps.eventStore,
          callClient: deps.callClient,
          now: deps.now,
          nextId: deps.nextId,
          actor,
          correlation: fallbackCorrelation(c),
          idempotencyKey: clientKey,
        },
      });
    } catch (err) {
      deps.onError?.(err, c);
      return c.json(internalErrorBody(), 500);
    }

    const requestScope = {
      body: bodyValues,
      form: formValues,
      query: queryData,
      header: headerValues,
      auth: { userId: (actor as { id?: string } | null)?.id ?? null },
      config: {},
    };

    if (plan.response !== null) {
      const scope = out.ok
        ? { ...requestScope, result: out.value.value, error: null }
        : { ...requestScope, result: null, error: out.error };
      const rendered = out.ok
        ? renderOkResponse(plan.response, scope)
        : renderErrResponse(plan.response, scope, out.error.code, operationErrorStatus(out.error.code));

      if (rendered.kind === 'redirect' && isAbsoluteUrl(rendered.location)) {
        const origin = originOf(rendered.location);
        const allow = plan.entry.allowedRedirectHosts ?? [];
        if (origin === null || !allow.includes(origin)) {
          return c.json(
            {
              code: 'BINDINGS_RUNTIME_REDIRECT_HOST_NOT_ALLOWED',
              message: 'absolute redirect target is not permitted',
            },
            500,
          );
        }
      }

      if (out.ok && deps.idempotencyCache !== undefined && clientKey !== null) {
        deps.idempotencyCache.set(
          plan.operationName,
          clientKey,
          rendered.kind === 'json'
            ? { status: rendered.status, body: JSON.stringify(rendered.body ?? null) }
            : { status: rendered.status, body: '', headers: { Location: rendered.location } },
          Date.now(),
        );
      }

      if (rendered.kind === 'json') {
        return c.json(rendered.body, rendered.status as 200 | 201 | 400 | 404 | 409 | 422 | 500);
      }
      return c.redirect(rendered.location, rendered.status as RedirectStatusCode);
    }

    if (!out.ok) {
      const status = operationErrorStatus(out.error.code);
      if (status >= 500) deps.onError?.(out.error.detail ?? out.error, c);
      return c.json(operationErrorBody(out.error), status as 400 | 404 | 409 | 422 | 500);
    }

    if (deps.idempotencyCache !== undefined && clientKey !== null) {
      const body = defaultSuccessBody(plan, out);
      deps.idempotencyCache.set(
        plan.operationName,
        clientKey,
        { status: 200, body: JSON.stringify(body) },
        Date.now(),
      );
    }

    return c.json(defaultSuccessBody(plan, out) as object, 200);
  };
}
