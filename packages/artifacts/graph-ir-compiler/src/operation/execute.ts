import type { AppendEventInput } from '@rntme/event-store';
import { createPdmResolver } from '@rntme/pdm';
import { createQsmResolver } from '@rntme/qsm';
import { checkTransitionLegal } from '../command-runtime/transition.js';
import { replayAggregateState } from '../command-runtime/replay.js';
import { derivePayload, evalExprAtRuntime } from '../emit/payload.js';
import { runtimeError } from '../types/errors.js';
import type { EmitPlan } from '../types/command.js';
import type { CompiledOperation, OperationExecutionContext, OperationResult } from '../types/operation.js';
import { camelCase } from '../types/strings.js';
import { evalObjectExpr, evalOperationExpr, type NodeOutputs } from './eval.js';
import {
  executeFilter,
  executeFindMany,
  executeFindOne,
  executeLimit,
  executeMap,
  executeReduce,
  executeSort,
  type RowsetMetas,
} from './local-read.js';

export async function executeOperation(
  compiled: CompiledOperation,
  params: Record<string, unknown>,
  ctx: OperationExecutionContext,
): Promise<OperationResult> {
  const effectiveParams = applyInputDefaults(compiled, params);
  const outputs: NodeOutputs = {};
  const rowsets: RowsetMetas = {};
  const eventIds: string[] = [];
  const readCtx = {
    db: ctx.qsmDb,
    pdm: compiled.pdm,
    qsm: compiled.qsm,
    pdmResolver: createPdmResolver(compiled.pdm),
    qsmResolver: createQsmResolver(compiled.qsm),
    params: effectiveParams,
    predicateOptionalParams: compiled.predicateOptionalParams,
    relationCache: new Map<string, Record<string, unknown> | null>(),
  };
  let selectedBranchTarget: string | null = null;

  for (const node of compiled.graph.nodes) {
    if (node.kind === 'findMany') {
      const { rows, meta } = executeFindMany(node, readCtx);
      outputs[node.id] = rows;
      rowsets[node.id] = meta;
      continue;
    }

    if (node.kind === 'findOne') {
      outputs[node.id] = executeFindOne(node, readCtx);
      continue;
    }

    if (node.kind === 'filter') {
      const input = rowsFor(node.input, outputs, node.id);
      outputs[node.id] = executeFilter(node, input, metaFor(node.input, rowsets, node.id), readCtx);
      rowsets[node.id] = metaFor(node.input, rowsets, node.id);
      continue;
    }

    if (node.kind === 'sort') {
      const input = rowsFor(node.input, outputs, node.id);
      outputs[node.id] = executeSort(node, input, metaFor(node.input, rowsets, node.id), readCtx);
      rowsets[node.id] = metaFor(node.input, rowsets, node.id);
      continue;
    }

    if (node.kind === 'limit') {
      const input = rowsFor(node.input, outputs, node.id);
      outputs[node.id] = executeLimit(node, input, effectiveParams);
      rowsets[node.id] = metaFor(node.input, rowsets, node.id);
      continue;
    }

    if (node.kind === 'map') {
      const input = rowsFor(node.input, outputs, node.id);
      outputs[node.id] = executeMap(node, input, metaFor(node.input, rowsets, node.id), readCtx);
      rowsets[node.id] = { alias: camelCase(node.into), projectionName: null, entityName: null };
      continue;
    }

    if (node.kind === 'reduce') {
      const input = rowsFor(node.input, outputs, node.id);
      outputs[node.id] = executeReduce(node, input, metaFor(node.input, rowsets, node.id), readCtx);
      rowsets[node.id] = { alias: camelCase(node.into), projectionName: null, entityName: null };
      continue;
    }

    if (node.kind === 'uuid') {
      outputs[node.id] = ctx.nextId();
      continue;
    }

    if (node.kind === 'branch') {
      const selected = node.cases.find((c) =>
        'when' in c ? Boolean(evalOperationExpr(c.when, effectiveParams, outputs)) : true,
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
      const payload = evalObjectExpr(node.input, effectiveParams, outputs) as Record<string, unknown>;
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
      const plan = compiled.emitPlansByNodeId[node.id];
      if (plan === undefined) {
        throw runtimeError('RUNTIME_INTERNAL_ERROR', `emit plan missing for "${node.id}"`);
      }

      const aggregateId = String(evalExprAtRuntime(plan.aggregateIdExpr, effectiveParams, outputs) ?? '');
      const subject = `${plan.aggregate}-${aggregateId}`;
      const history = ctx.eventStore.readStream(subject);
      const { state, version } = replayAggregateState(history);
      checkTransitionLegal(plan, state, stateFieldForPlan(plan));
      const payload = derivePayload(plan, effectiveParams, state, outputs);
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
      outputs[node.id] = evalObjectExpr(node.value, effectiveParams, outputs);
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

function applyInputDefaults(compiled: CompiledOperation, params: Record<string, unknown>): Record<string, unknown> {
  const out = { ...params };
  for (const [name, input] of Object.entries(compiled.graph.signature.inputs)) {
    if (out[name] !== undefined) continue;
    if (input.mode === 'defaulted' && input.default !== undefined) out[name] = input.default;
  }
  return out;
}

function rowsFor(nodeId: string, outputs: NodeOutputs, currentNodeId: string): Record<string, unknown>[] {
  const value = outputs[nodeId];
  if (!Array.isArray(value)) {
    throw runtimeError('RUNTIME_INTERNAL_ERROR', `node "${currentNodeId}" expected rowset input "${nodeId}"`);
  }
  return value as Record<string, unknown>[];
}

function metaFor(nodeId: string, rowsets: RowsetMetas, currentNodeId: string): RowsetMetas[string] {
  const meta = rowsets[nodeId];
  if (meta === undefined) {
    throw runtimeError('RUNTIME_INTERNAL_ERROR', `node "${currentNodeId}" expected rowset metadata for "${nodeId}"`);
  }
  return meta;
}

function stateFieldForPlan(plan: EmitPlan): string {
  return plan.affects.find((field) => !(field in plan.payloadExprs)) ?? 'status';
}
