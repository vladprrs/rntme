import { randomUUID } from 'node:crypto';
import type { Context } from 'hono';
import type BetterSqlite3 from 'better-sqlite3';
import type { Logger } from 'pino';
import { execute } from '@rntme/graph-ir-compiler';
import type { QueryBindingPlan } from '../startup/compile-plan.js';
import {
  validationErrorBody,
  invalidBodyErrorBody,
  internalErrorBody,
} from '../errors.js';
import { extractQuery, extractPath } from './extract.js';
import { remapToGraphInputs } from './remap.js';
import type { ExternalAdapterClient } from '../runtime-contract.js';
import { runPreSteps } from '../pre/run-pre-steps.js';

export type HandlerDeps = {
  db: BetterSqlite3.Database;
  onError?: (err: unknown, ctx: Context) => void;
  externalAdapterClient?: ExternalAdapterClient | undefined;
  logger?: Logger | undefined;
};

type Handler = (c: Context) => Promise<Response>;

export function makeHandler(plan: QueryBindingPlan, deps: HandlerDeps): Handler {
  const declaredQueryParams = plan.entry.http.parameters.filter((p) => p.in === 'query');
  const hasBody = plan.bodyParamNames.length > 0;

  return async (c) => {
    // 1. Extract path params.
    const pathBag = extractPath(c, plan.pathParamNames);
    const pathParsed = plan.schemas.pathSchema.safeParse(pathBag);
    if (!pathParsed.success) {
      return c.json(validationErrorBody(pathParsed.error), 400);
    }

    // 2. Extract query params.
    const queryBag = extractQuery(c, declaredQueryParams, plan.listParamNames);
    const queryParsed = plan.schemas.querySchema.safeParse(queryBag);
    if (!queryParsed.success) {
      return c.json(validationErrorBody(queryParsed.error), 400);
    }

    // 3. Extract and parse body if needed.
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
      if (!bodyParsed.success) {
        return c.json(validationErrorBody(bodyParsed.error), 400);
      }
      bodyValues = bodyParsed.data as Record<string, unknown>;
    }

    const queryData = queryParsed.data as Record<string, unknown>;
    const headerValues = Object.fromEntries(c.req.raw.headers.entries());

    // 4. Remap http names → graph input names.
    const combined: Record<string, unknown> = {
      ...queryData,
      ...(pathParsed.data as Record<string, unknown>),
      ...bodyValues,
    };
    let graphInputs = remapToGraphInputs(combined, plan.bindToMap);

    if (plan.pre.length > 0) {
      if (deps.externalAdapterClient === undefined) {
        return c.json({ code: 'BINDINGS_CONFIG_ADAPTER_MISSING', message: 'pre[] requires externalAdapterClient' }, 500);
      }
      const requestScope = {
        body: bodyValues,
        form: {},
        query: queryData,
        header: headerValues,
        auth: { userId: null as string | null },
        config: {},
      };

      const preResult = await runPreSteps(plan.pre, {
        scope: requestScope,
        adapterClient: deps.externalAdapterClient,
        runId: randomUUID(),
        correlationId: randomUUID(),
        logger: (evt) => {
          deps.logger?.info(evt, 'query-pre-step');
        },
      });
      if (!preResult.ok) {
        return c.json(preResult.body, preResult.httpStatus as 401 | 400 | 500);
      }

      const preScope = (preResult.systemFields.pre ?? {}) as Record<string, unknown>;
      const flattened: Record<string, unknown> = {};
      for (const step of plan.pre) {
        const raw = preScope[step.bindName];
        const value =
          step.bindPick === null
            ? raw
            : raw !== null && typeof raw === 'object' && !Array.isArray(raw)
              ? (raw as Record<string, unknown>)[step.bindPick]
              : undefined;
        flattened[step.bindName] = value;
      }
      graphInputs = { ...graphInputs, ...flattened, pre: preScope };
    }

    // 5. Execute.
    let rows: unknown[];
    try {
      rows = execute(plan.compiled, graphInputs, deps.db);
    } catch (e) {
      deps.onError?.(e, c);
      return c.json(internalErrorBody(), 500);
    }

    // 6. Respond.
    return c.json(rows as object[], 200);
  };
}
