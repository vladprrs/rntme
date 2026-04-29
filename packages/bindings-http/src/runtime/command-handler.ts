import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';
import type { RedirectStatusCode } from 'hono/utils/http-status';
import type BetterSqlite3 from 'better-sqlite3';
import type { EventStore, ActorRef } from '@rntme/event-store';
import type { Logger } from 'pino';
import type { ExternalAdapterClient, Metrics } from '../runtime-contract.js';
import type { CommandBindingPlan } from '../startup/compile-plan.js';
import type { CommandExecutor } from '../executor-contract.js';
import type { CorrelationCtx } from './correlation-middleware.js';
import {
  validationErrorBody,
  invalidBodyErrorBody,
  commandErrorBody,
} from '../errors.js';
import { extractQuery, extractPath } from './extract.js';
import { remapToGraphInputs } from './remap.js';
import { runPreSteps } from '../pre/run-pre-steps.js';
import { extractInputs } from './extract-inputs.js';
import { renderOkResponse, renderErrResponse } from './render-response.js';
import type { IdempotencyCache } from '../idempotency/cache.js';
import { deriveCommandRunId } from '../idempotency/derive-keys.js';
import { errorToHttp } from './error-to-http.js';

export type CommandHandlerDeps = {
  commandExecutor: CommandExecutor;
  eventStore: EventStore;
  qsmDb: BetterSqlite3.Database | null;
  now: () => string;
  nextId: () => string;
  actorFromRequest: (c: Context) => ActorRef | null;
  onError?: (err: unknown, ctx: Context) => void;
  externalAdapterClient?: ExternalAdapterClient | undefined;
  idempotencyCache?: IdempotencyCache | undefined;
  logger: Logger;
  metrics?: Metrics | undefined;
};

type IdempotencyCtx = { clientKey: string | null; runId: string | null };

type Handler = (c: Context<{ Variables: { correlation: CorrelationCtx; idempotency: IdempotencyCtx } }>) => Promise<Response>;

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

export function makeCommandHandler(plan: CommandBindingPlan, deps: CommandHandlerDeps): Handler {
  const declaredQueryParams = plan.entry.http.parameters.filter((p) => p.in === 'query');
  const hasBody = plan.bodyParamNames.length > 0;
  const hasInputFrom = plan.inputFrom !== null;

  return async (c) => {
    let graphInputs: Record<string, unknown> = {};
    let bodyValues: Record<string, unknown> = {};
    let formValues: Record<string, unknown> = {};
    let queryData: Record<string, unknown> = {};
    let headerValues: Record<string, unknown> = {};

    if (hasInputFrom) {
      const request = {
        query: new URL(c.req.url).searchParams,
        header: (name: string) => c.req.header(name) ?? null,
        body: plan.entry.http.method === 'POST' && !hasFormContentType(c) ? await safeParseJsonBody(c) : null,
        form: plan.entry.http.method === 'POST' && hasFormContentType(c) ? await safeParseFormBody(c) : null,
      };
      const extracted = extractInputs(plan.inputFrom!, request);
      if (!extracted.ok) {
        return c.json({ code: extracted.error.code, message: extracted.error.message }, 400);
      }
      graphInputs = extracted.values;
      bodyValues = request.body ?? {};
      formValues = request.form ?? {};
      queryData = Object.fromEntries(request.query.entries());
      headerValues = Object.fromEntries(c.req.raw.headers.entries());
    } else {
      const pathBag = extractPath(c, plan.pathParamNames);
      const pathParsed = plan.schemas.pathSchema.safeParse(pathBag);
      if (!pathParsed.success) return c.json(validationErrorBody(pathParsed.error), 400);

      const queryBag = extractQuery(c, declaredQueryParams, plan.listParamNames);
      const queryParsed = plan.schemas.querySchema.safeParse(queryBag);
      if (!queryParsed.success) return c.json(validationErrorBody(queryParsed.error), 400);
      queryData = queryParsed.data as Record<string, unknown>;

      if (hasBody) {
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
        bodyValues = bodyParsed.data as Record<string, unknown>;
      }

      const combined: Record<string, unknown> = {
        ...queryData,
        ...(pathParsed.data as Record<string, unknown>),
        ...bodyValues,
      };
      graphInputs = remapToGraphInputs(combined, plan.bindToMap);
      headerValues = Object.fromEntries(c.req.raw.headers.entries());
    }

    const correlation = c.get('correlation');

    const idemCtx = c.get('idempotency');
    const clientKey = idemCtx?.clientKey ?? null;
    const runId = idemCtx?.runId ?? (clientKey !== null ? deriveCommandRunId(plan.commandName, clientKey) : randomUUID());
    const correlationId = correlation?.correlationId ?? randomUUID();

    const requestScope = {
      body: bodyValues,
      form: formValues,
      query: queryData,
      header: headerValues,
      auth: { userId: (deps.actorFromRequest(c) as { id?: string } | null)?.id ?? null },
      config: {},
    };

    if (plan.pre.length > 0) {
      if (deps.externalAdapterClient === undefined) {
        return c.json({ code: 'BINDINGS_CONFIG_ADAPTER_MISSING', message: 'pre[] requires externalAdapterClient' }, 500);
      }
      const preResult = await runPreSteps(plan.pre, {
        scope: requestScope,
        adapterClient: deps.externalAdapterClient,
        runId,
        correlationId,
        logger: (evt) => {
          deps.logger.info(evt, 'pre-step');
          if (deps.metrics && evt.pre_step === 'module-rpc') {
            const { module, rpc, result, code } = evt as Record<string, string>;
            if (module && rpc && result) {
              deps.metrics.externalPreStep?.labels({
                module,
                rpc,
                result,
                error_code: code ?? '',
              }).inc();
            }
          }
        },
      });
      if (!preResult.ok) {
        return c.json(preResult.body, preResult.httpStatus as 200 | 201 | 400 | 401 | 409 | 422 | 500 | 502 | 503 | 504);
      }

      const preScope = (preResult.systemFields.pre ?? {}) as Record<string, unknown>;
      const flattened: Record<string, unknown> = {};
      for (const step of plan.pre) {
        const raw = preScope[step.bindName];
        const value = step.bindPick === null
          ? raw
          : (raw !== null && typeof raw === 'object' && !Array.isArray(raw)
              ? (raw as Record<string, unknown>)[step.bindPick]
              : undefined);
        flattened[step.bindName] = value;
      }
      graphInputs = { ...graphInputs, ...flattened, pre: preScope };
    }

    const out = await deps.commandExecutor.execute({
      commandName: plan.commandName,
      inputs: graphInputs,
      ctx: {
        eventStore: deps.eventStore,
        qsmDb: deps.qsmDb,
        now: deps.now,
        nextId: deps.nextId,
        actor: deps.actorFromRequest(c),
        correlation,
      },
    });

    if (plan.response !== null) {
      if (!out.ok) {
        const { status } = errorToHttp(out.error.code);
        if (out.error.code === 'COMMAND_HANDLER_THREW' || status === 500) {
          deps.onError?.(out.error.detail ?? out.error, c);
        }
      }

      const scope = out.ok
        ? { ...requestScope, result: out.value, error: null }
        : { ...requestScope, result: null, error: out.error };
      const rendered = out.ok
        ? renderOkResponse(plan.response, scope)
        : renderErrResponse(plan.response, scope, out.error.code);

      if (rendered.kind === 'redirect' && isAbsoluteUrl(rendered.location)) {
        const origin = originOf(rendered.location);
        const allow = plan.entry.allowedRedirectHosts ?? [];
        if (origin === null || !allow.includes(origin)) {
          deps.logger.warn({ location: rendered.location }, 'refused absolute redirect outside allowlist');
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
        if (rendered.kind === 'json') {
          deps.idempotencyCache.set(
            plan.commandName,
            clientKey,
            { status: rendered.status, body: JSON.stringify(rendered.body ?? null) },
            Date.now(),
          );
        } else {
          deps.idempotencyCache.set(
            plan.commandName,
            clientKey,
            {
              status: rendered.status,
              body: '',
              headers: { Location: rendered.location },
            },
            Date.now(),
          );
        }
      }

      if (rendered.kind === 'json') {
        return c.json(rendered.body, rendered.status as 200 | 201 | 400 | 409 | 422 | 500);
      }
      return c.redirect(rendered.location, rendered.status as RedirectStatusCode);
    }

    if (!out.ok) {
      const { status } = errorToHttp(out.error.code);
      if (out.error.code === 'COMMAND_HANDLER_THREW' || status === 500) {
        deps.onError?.(out.error.detail ?? out.error, c);
      }
      return c.json(
        commandErrorBody({ code: out.error.code, message: out.error.message }),
        status as 400 | 409 | 422 | 500,
      );
    }

    if (deps.idempotencyCache !== undefined && clientKey !== null) {
      deps.idempotencyCache.set(
        plan.commandName,
        clientKey,
        { status: 200, body: JSON.stringify(out.value) },
        Date.now(),
      );
    }

    return c.json(out.value, 200);
  };
}
