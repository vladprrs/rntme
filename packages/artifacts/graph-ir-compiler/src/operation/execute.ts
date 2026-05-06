import type { AppendEventInput } from '@rntme/event-store';
import { checkTransitionLegal } from '../command-runtime/transition.js';
import { replayAggregateState } from '../command-runtime/replay.js';
import { buildEmitPlans } from '../emit/plan.js';
import { derivePayload, evalExprAtRuntime } from '../emit/payload.js';
import { runtimeError } from '../types/errors.js';
import type { EmitPlan } from '../types/command.js';
import type { CompiledOperation, OperationExecutionContext, OperationResult } from '../types/operation.js';
import { evalObjectExpr, evalOperationExpr, type NodeOutputs } from './eval.js';
import { executeFindOne } from './local-read.js';

export async function executeOperation(
  compiled: CompiledOperation,
  params: Record<string, unknown>,
  ctx: OperationExecutionContext,
): Promise<OperationResult> {
  const outputs: NodeOutputs = {};
  const eventIds: string[] = [];
  const emitPlans = new Map(buildEmitPlans(compiled.graph, compiled.pdm).map((plan) => [plan.nodeId, plan]));
  let selectedBranchTarget: string | null = null;

  for (const node of compiled.graph.nodes) {
    if (node.kind === 'findOne') {
      outputs[node.id] = executeFindOne(node, params, outputs, ctx.qsmDb, compiled.qsm);
      continue;
    }

    if (node.kind === 'uuid') {
      outputs[node.id] = ctx.nextId();
      continue;
    }

    if (node.kind === 'branch') {
      const selected = node.cases.find((c) =>
        'when' in c ? Boolean(evalOperationExpr(c.when, params, outputs)) : true,
      );
      selectedBranchTarget = selected?.then ?? null;
      outputs[node.id] = { selected: selectedBranchTarget };
      continue;
    }

    if (node.kind === 'call') {
      if (ctx.callClient === null) {
        throw runtimeError('RUNTIME_INTERNAL_ERROR', `call node "${node.id}" requires callClient`);
      }
      const registryEntry = compiled.registryEntriesByNodeId[node.id];
      if (registryEntry === undefined) {
        throw runtimeError('RUNTIME_INTERNAL_ERROR', `call node "${node.id}" target metadata missing`);
      }
      const payload = evalObjectExpr(node.input, params, outputs) as Record<string, unknown>;
      const callResult = await ctx.callClient.call({
        target: registryEntry,
        payload,
        idempotencyKey: registryEntry.effect === 'action' ? ctx.idempotencyKey : null,
        correlationId: ctx.correlation.correlationId,
      });
      if (!callResult.ok) {
        throw runtimeError(
          'RUNTIME_INTERNAL_ERROR',
          `${callResult.error.code}: ${callResult.error.message}`,
        );
      }
      outputs[node.id] = { result: callResult.value };
      continue;
    }

    if (node.kind === 'emit') {
      if (selectedBranchTarget !== null && selectedBranchTarget !== node.id) {
        outputs[node.id] = { didRun: false, aggregateId: null, version: null, eventIds: [], payload: null };
        continue;
      }
      if (ctx.eventStore === null) {
        throw runtimeError('RUNTIME_INTERNAL_ERROR', `emit node "${node.id}" requires eventStore`);
      }
      const plan = emitPlans.get(node.id);
      if (plan === undefined) {
        throw runtimeError('RUNTIME_INTERNAL_ERROR', `emit plan missing for "${node.id}"`);
      }

      const aggregateId = String(evalExprAtRuntime(plan.aggregateIdExpr, params, outputs) ?? '');
      const subject = `${plan.aggregate}-${aggregateId}`;
      const history = ctx.eventStore.readStream(subject);
      const { state, version } = replayAggregateState(history);
      checkTransitionLegal(plan, state, stateFieldForPlan(plan));
      const payload = derivePayload(plan, params, state, outputs);
      const event: AppendEventInput = {
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
      };
      const result = ctx.eventStore.appendEvents([{ subject, expectedVersion: version, events: [event] }])[0]!;
      const ids = result.appendedEvents.map((e) => e.id);
      eventIds.push(...ids);
      outputs[node.id] = { didRun: true, aggregateId, version: result.lastVersion, eventIds: ids, payload };
      continue;
    }

    if (node.kind === 'result') {
      outputs[node.id] = evalObjectExpr(node.value, params, outputs);
    }
  }

  return {
    value: outputs[compiled.resultNodeId] ?? null,
    metadata: {
      eventIds,
      commandId: ctx.correlation.commandId,
      correlationId: ctx.correlation.correlationId,
    },
  };
}

function stateFieldForPlan(plan: EmitPlan): string {
  return plan.affects.find((field) => !(field in plan.payloadExprs)) ?? 'status';
}
