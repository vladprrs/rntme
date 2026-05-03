import { randomUUID } from 'node:crypto';
import type BetterSqlite3 from 'better-sqlite3';
import type { EventStore, AppendEventInput, AppendRequest, ActorRef } from '@rntme/event-store';
import { ConcurrencyConflict } from '@rntme/event-store';
import type { CompiledCommand, CommandResult } from '../types/command.js';
import { replayAggregateState } from './replay.js';
import { checkTransitionLegal } from './transition.js';
import { derivePayload, evalExprAtRuntime } from '../emit/payload.js';
import { CommandExecutionError } from './errors.js';
import { runtimeError } from '../types/errors.js';

export type CorrelationCtx = Readonly<{
  commandId: string;
  correlationId: string;
  traceparent: string | null;
}>;

export type ExecuteCommandContext = {
  eventStore: EventStore;
  /** Required when `compiled.readPrelude` is non-null. */
  qsmDb: BetterSqlite3.Database | null;
  now: () => string;
  nextId: () => string;
  actor: ActorRef | null;
  correlation: CorrelationCtx;
};

function preludePositional(
  compiled: CompiledCommand,
  paramValues: Record<string, unknown>,
): unknown[] {
  const rp = compiled.readPrelude!;
  const optionalSet = rp.optionalParams.length ? new Set(rp.optionalParams) : undefined;
  const defaults = rp.paramDefaults ?? {};
  return rp.paramOrder.map((name) => {
    const resolved = resolveParamValue(name, paramValues);
    if (resolved.found) {
      const v = resolved.value;
      return v === undefined ? null : v;
    }
    if (Object.hasOwn(defaults, name)) return defaults[name];
    if (optionalSet?.has(name)) return null;
    return null;
  });
}

function resolveParamValue(name: string, paramValues: Record<string, unknown>): { found: boolean; value: unknown } {
  if (Object.prototype.hasOwnProperty.call(paramValues, name)) {
    return { found: true, value: paramValues[name] };
  }
  if (!name.startsWith('pre.')) return { found: false, value: undefined };
  let cur: unknown = paramValues.pre;
  for (const segment of name.slice('pre.'.length).split('.').filter((s) => s.length > 0)) {
    if (cur === null || cur === undefined) return { found: true, value: null };
    if (typeof cur !== 'object' || Array.isArray(cur)) return { found: true, value: null };
    cur = (cur as Record<string, unknown>)[segment];
  }
  return { found: true, value: cur ?? null };
}

function stateFieldForPlan(plan: CompiledCommand['emits'][number]): string {
  const f = plan.affects.find((field) => !(field in plan.payloadExprs));
  return f ?? 'status';
}

export function executeCommand(
  compiled: CompiledCommand,
  paramValues: Record<string, unknown>,
  ctx: ExecuteCommandContext,
): CommandResult {
  if (compiled.readPrelude) {
    if (!ctx.qsmDb) {
      throw runtimeError('RUNTIME_INTERNAL_ERROR', 'executeCommand: qsmDb required when readPrelude is present');
    }
    const positional = preludePositional(compiled, paramValues);
    const rows = ctx.qsmDb.prepare(compiled.readPrelude.sql).all(...positional);
    if (rows.length === 0) {
      throw new CommandExecutionError(
        'COMMAND_GUARD_REJECTED',
        `command guard at node "${compiled.readPreludeGuardNodeId ?? 'unknown'}" rejected input`,
      );
    }
  }

  if (compiled.emits.length === 0) {
    throw runtimeError('RUNTIME_INTERNAL_ERROR', 'executeCommand: no emits in compiled command');
  }

  const nodeOutputs: Record<string, unknown> = {};
  for (const nodeId of compiled.runtimeNodes) {
    nodeOutputs[nodeId] = randomUUID();
  }

  const head = compiled.emits[0]!;
  const aggregateId = String(evalExprAtRuntime(head.aggregateIdExpr, paramValues, nodeOutputs) ?? '');
  const subject = `${head.aggregate}-${aggregateId}`;

  const history = ctx.eventStore.readStream(subject);
  const { state, version } = replayAggregateState(history);

  const events: AppendEventInput[] = [];
  let runningState = state;

  for (const plan of compiled.emits) {
    const stateField = stateFieldForPlan(plan);
    checkTransitionLegal(plan, runningState, stateField);
    const payload = derivePayload(plan, paramValues, runningState, nodeOutputs);
    events.push({
      id: ctx.nextId(),
      eventType: plan.eventType,
      rntAggregateType: plan.aggregate,
      rntAggregateId: aggregateId,
      time: ctx.now(),
      actor: ctx.actor,
      data: payload,
      rntSchemaVersion: 1,
      correlationId: ctx.correlation.correlationId,
      causationId: ctx.correlation.commandId,
      commandId: ctx.correlation.commandId,
      traceparent: ctx.correlation.traceparent,
    });
    runningState = { ...(runningState ?? {}), ...payload.after };
  }

  const req: AppendRequest = { subject, expectedVersion: version, events };
  let results;
  try {
    results = ctx.eventStore.appendEvents([req]);
  } catch (e) {
    if (e instanceof ConcurrencyConflict) {
      throw new CommandExecutionError(
        'COMMAND_CONCURRENCY_CONFLICT',
        `concurrent append conflict on subject ${subject}`,
      );
    }
    throw e;
  }
  const result = results[0]!;
  return {
    aggregateId,
    version: result.lastVersion,
    eventIds: result.appendedEvents.map((e) => e.id),
    commandId: ctx.correlation.commandId,
    correlationId: ctx.correlation.correlationId,
  };
}
