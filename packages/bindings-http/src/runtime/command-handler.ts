import type { Context } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import { executeCommand, CommandExecutionError } from '@rntme/graph-ir-compiler';
import type { EventStore, ActorRef } from '@rntme/event-store';
import type { CommandBindingPlan } from '../startup/compile-plan.js';
import {
  validationErrorBody,
  invalidBodyErrorBody,
  internalErrorBody,
  commandErrorBody,
  commandErrorStatus,
} from '../errors.js';
import { extractQuery, extractPath } from './extract.js';
import { remapToGraphInputs } from './remap.js';

export type CommandHandlerDeps = {
  eventStore: EventStore;
  qsmDb: BetterSqlite3.Database | null;
  now: () => string;
  nextId: () => string;
  actorFromRequest: (c: Context) => ActorRef | null;
  onError?: (err: unknown, ctx: Context) => void;
};

type Handler = (c: Context) => Promise<Response>;

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
    const graphInputs = remapToGraphInputs(combined, plan.bindToMap);

    try {
      const result = executeCommand(plan.compiled, graphInputs, {
        eventStore: deps.eventStore,
        qsmDb: deps.qsmDb,
        now: deps.now,
        nextId: deps.nextId,
        actor: deps.actorFromRequest(c),
      });
      return c.json(result, 200);
    } catch (e) {
      if (e instanceof CommandExecutionError) {
        return c.json(commandErrorBody(e), commandErrorStatus(e));
      }
      deps.onError?.(e, c);
      return c.json(internalErrorBody(), 500);
    }
  };
}
