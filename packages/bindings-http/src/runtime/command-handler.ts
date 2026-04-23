import type { Context } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import type { EventStore, ActorRef } from '@rntme/event-store';
import type { ExternalAdapterClient, Metrics } from '@rntme/runtime';
import type { Logger } from 'pino';
import type { CommandBindingPlan } from '../startup/compile-plan.js';
import type { CommandExecutor } from '../executor-contract.js';
import type { CorrelationCtx } from './correlation-middleware.js';
import {
  validationErrorBody,
  invalidBodyErrorBody,
  internalErrorBody,
  commandErrorBody,
} from '../errors.js';
import { extractQuery, extractPath } from './extract.js';
import { remapToGraphInputs } from './remap.js';
import { runPreSteps } from '../pre/run-pre-steps.js';
import { extractInputs } from './extract-inputs.js';
import { renderOkResponse, renderErrResponse } from './render-response.js';
import type { IdempotencyCache } from '../idempotency/cache.js';
import { deriveCommandRunId } from '../idempotency/derive-keys.js';
import { randomUUID } from 'node:crypto';

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
    let queryData: Record<string, unknown> = {};

    if (hasInputFrom) {
      // Use inputFrom-based extraction
      const req = {
        query: new URL(c.req.url).searchParams,
        header: (name: string) => c.req.header(name) ?? null,
        body: plan.entry.http.method === 'POST' && !hasFormContentType(c) ? await safeParseJsonBody(c) : null,
        form: plan.entry.http.method === 'POST' && hasFormContentType(c) ? await safeParseFormBody(c) : null,
      };
      const extracted = extractInputs(plan.inputFrom!, req);
      if (!extracted.ok) {
        return c.json({ code: extracted.error.code, message: extracted.error.message }, 400);
      }
      graphInputs = extracted.values;
      bodyValues = req.body ?? {};
    } else {
      // Use existing parameter-based extraction
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
    }
    const correlation = c.get('correlation');

    const idemCtx = c.get('idempotency');
    const clientKey = idemCtx?.clientKey ?? null;
    const runId = idemCtx?.runId ?? (clientKey !== null ? deriveCommandRunId(plan.commandName, clientKey) : randomUUID());
    const correlationId = c.get('correlation')?.correlationId ?? randomUUID();

    const scope = {
      body: bodyValues,
      query: hasInputFrom ? Object.fromEntries(new URL(c.req.url).searchParams.entries()) : queryData,
      auth: { userId: (deps.actorFromRequest(c) as { id?: string } | null)?.id ?? null },
      config: {},
    };

    if (plan.pre.length > 0) {
      if (deps.externalAdapterClient === undefined) {
        return c.json({ code: 'BINDINGS_CONFIG_ADAPTER_MISSING', message: 'pre[] requires externalAdapterClient' }, 500);
      }
      const preResult = await runPreSteps(plan.pre, {
        scope,
        adapterClient: deps.externalAdapterClient,
        runId,
        correlationId,
        logger: (evt) => {
          deps.logger.info(evt, 'pre-step');
          if (deps.metrics && evt.pre_step === 'module-rpc') {
            const { module, rpc, result, code } = evt as Record<string, string>;
            if (module && rpc && result) {
              (deps.metrics as Metrics).externalPreStep?.labels({
                module, rpc, result,
                error_code: code ?? '',
              }).inc();
            }
          }
        },
      });
      if (!preResult.ok) {
        return c.json(preResult.body, preResult.httpStatus as 200 | 201 | 400 | 409 | 422 | 500 | 502 | 503 | 504);
      }
      // Flatten pre-step results: if a value is an object with a single key
      // that matches the bindAs name, extract the inner value.
      const flattened: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(preResult.systemFields)) {
        if (key === 'pre' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
          // Flatten nested values inside 'pre'
          for (const [preKey, preValue] of Object.entries(value as Record<string, unknown>)) {
            if (preValue !== null && typeof preValue === 'object' && !Array.isArray(preValue)) {
              const entries = Object.entries(preValue as Record<string, unknown>);
              if (entries.length === 1 && entries[0]![0] === preKey) {
                flattened[preKey] = entries[0]![1];
              } else {
                flattened[preKey] = preValue;
              }
            } else {
              flattened[preKey] = preValue;
            }
          }
        } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          const entries = Object.entries(value as Record<string, unknown>);
          if (entries.length === 1 && entries[0]![0] === key) {
            flattened[key] = entries[0]![1];
          } else {
            flattened[key] = value;
          }
        } else {
          flattened[key] = value;
        }
      }
      graphInputs = { ...graphInputs, ...flattened };
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

    // Render response using response shape if present
    if (plan.response !== null) {
      const scope = out.ok ? { result: out.value, error: null } : { result: null, error: out.error };
      const rendered = out.ok ? renderOkResponse(plan.response, scope) : renderErrResponse(plan.response, scope);
      if (rendered.kind === 'json') return c.json(rendered.body, rendered.status as 200 | 201 | 400 | 409 | 422 | 500);
      // redirect
      return c.redirect(rendered.location, rendered.status as 302 | 303);
    }

    // No response shape → existing JSON behavior (plan 1)
    if (!out.ok) {
      const code = out.error.code;
      if (code === 'COMMAND_GUARD_REJECTED') {
        return c.json(commandErrorBody({ code, message: out.error.message }), 422);
      }
      if (code === 'COMMAND_CONCURRENCY_CONFLICT') {
        return c.json(commandErrorBody({ code, message: out.error.message }), 409);
      }
      if (code === 'COMMAND_NOT_FOUND') {
        return c.json(commandErrorBody({ code, message: out.error.message }), 500);
      }
      deps.onError?.(out.error.detail ?? out.error, c);
      return c.json(internalErrorBody(), 500);
    }

    if (deps.idempotencyCache !== undefined && clientKey !== null) {
      const bodyStr = JSON.stringify(out.value);
      deps.idempotencyCache.set(plan.commandName, clientKey, { status: 200, body: bodyStr }, Date.now());
    }

    return c.json(out.value, 200);
  };
}
