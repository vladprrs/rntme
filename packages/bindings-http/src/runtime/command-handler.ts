import type { Context } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import type { EventStore, ActorRef } from '@rntme/event-store';
import type { ExternalAdapterClient } from '@rntme/runtime';
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
import type { IdempotencyCache } from '../idempotency/cache.js';
import { deriveCommandRunId } from '../idempotency/derive-keys.js';
import { randomUUID } from 'node:crypto';
import type { Metrics, recordPreStep } from '@rntme/runtime';

export type CommandHandlerDeps = {
  commandExecutor: CommandExecutor;
  eventStore: EventStore;
  qsmDb: BetterSqlite3.Database | null;
  now: () => string;
  nextId: () => string;
  actorFromRequest: (c: Context) => ActorRef | null;
  onError?: (err: unknown, ctx: Context) => void;
  externalAdapterClient?: ExternalAdapterClient;
  idempotencyCache?: IdempotencyCache;
  logger: import('pino').Logger;
  metrics?: Metrics;
};

type Handler = (c: Context<{ Variables: { correlation: CorrelationCtx } }>) => Promise<Response>;

export function makeCommandHandler(plan: CommandBindingPlan, deps: CommandHandlerDeps): Handler {
  const declaredQueryParams = plan.entry.http.parameters.filter((p) => p.in === 'query');
  const hasBody = plan.bodyParamNames.length > 0;

  return async (c) => {
    const pathBag = extractPath(c, plan.pathParamNames);
    const pathParsed = plan.schemas.pathSchema.safeParse(pathBag);
    if (!pathParsed.success) return c.json(validationErrorBody(pathParsed.error), 400);

    const queryBag = extractQuery(c, declaredQueryParams, plan.listParamNames);
    const queryParsed = plan.schemas.querySchema.safeParse(queryBag);
    if (!queryParsed.success) return c.json(validationErrorBody(queryParsed.error), 400);

    let bodyValues: Record<string, unknown> = {};
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
      ...(queryParsed.data as Record<string, unknown>),
      ...(pathParsed.data as Record<string, unknown>),
      ...bodyValues,
    };
    let graphInputs = remapToGraphInputs(combined, plan.bindToMap);
    const correlation = c.get('correlation');

    const idemCtx = c.get('idempotency') as { clientKey: string | null; runId: string | null } | undefined;
    const clientKey = idemCtx?.clientKey ?? null;
    const runId = idemCtx?.runId ?? (clientKey !== null ? deriveCommandRunId(plan.commandName, clientKey) : randomUUID());
    const correlationId = c.get('correlation')?.correlationId ?? randomUUID();

    const scope = {
      body: bodyValues,
      query: queryParsed.data as Record<string, unknown>,
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
        return c.json(preResult.body, preResult.httpStatus);
      }
      graphInputs = { ...graphInputs, ...preResult.systemFields };
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
