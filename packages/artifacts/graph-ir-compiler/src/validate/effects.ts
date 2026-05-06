import { deriveEventTypeName } from '../emit/event-type.js';
import { ERROR_CODES, err, ok, type GraphIrError, type Result } from '../types/result.js';
import type { CanonicalGraph } from '../types/canonical.js';
import type { CallEffect, EffectSummary, Exposure, LocalEmitEffect } from '../types/effects.js';
import type { OperationRegistry } from '../types/operation.js';

export function inferEffectSummary(
  graph: CanonicalGraph,
  registry: OperationRegistry,
  eventTypesByAggregateTransition: Record<string, string>,
): Result<EffectSummary> {
  const errors: GraphIrError[] = [];
  const calls: CallEffect[] = [];
  const localEmits: LocalEmitEffect[] = [];
  let localReads = false;

  for (const node of graph.nodes) {
    if (node.kind === 'findMany' || node.kind === 'findOne') {
      localReads = true;
    }

    if (node.kind === 'call') {
      const entry = registry.resolve(node.target);
      if (entry === null) {
        errors.push({
          layer: 'semantic',
          code: ERROR_CODES.GRAPH_CALL_TARGET_UNRESOLVED,
          message: `call node "${node.id}" target could not be resolved`,
          location: { graphId: graph.id, nodeId: node.id },
        });
        continue;
      }
      calls.push({
        target: 'module' in node.target ? 'module' : 'service',
        operation:
          'module' in node.target
            ? `${node.target.module}.${node.target.operation}`
            : `${node.target.service}.${node.target.operation}`,
        effect: entry.effect,
        idempotency: entry.idempotency,
      });
    }

    if (node.kind === 'emit') {
      localEmits.push(localEmitEffectFor(node.aggregate, node.transition, eventTypesByAggregateTransition));
    }
  }

  if (errors.length > 0) return err(errors);
  return ok({ localReads, localEmits, calls, waits: false });
}

export function validateOperationEffects(input: {
  graph: CanonicalGraph;
  registry: OperationRegistry;
  ownedAggregates: ReadonlySet<string>;
  eventTypesByAggregateTransition: ReadonlyMap<string, string>;
  exposure?: Exposure;
}): Result<EffectSummary> {
  const eventTypes = Object.fromEntries(input.eventTypesByAggregateTransition);
  const summary = inferEffectSummary(input.graph, input.registry, eventTypes);
  const errors: GraphIrError[] = summary.ok ? [] : [...summary.errors];

  for (const node of input.graph.nodes) {
    if (node.kind !== 'emit') continue;
    if (!input.ownedAggregates.has(node.aggregate)) {
      errors.push({
        layer: 'semantic',
        code: ERROR_CODES.GRAPH_EMIT_FOREIGN_AGGREGATE,
        message: `emit target aggregate "${node.aggregate}" is not owned by the current service`,
        location: { graphId: input.graph.id, nodeId: node.id },
      });
    }
  }

  if (summary.ok && input.exposure === 'read') {
    if (summary.value.localEmits.length > 0 || summary.value.calls.some((call) => call.effect === 'action')) {
      errors.push({
        layer: 'semantic',
        code: ERROR_CODES.GRAPH_EXPOSURE_EFFECT_FORBIDDEN,
        message: 'exposure "read" cannot include local emits or action calls',
        location: { graphId: input.graph.id },
      });
    }
  }

  if (!input.graph.nodes.some((node) => node.kind === 'result')) {
    errors.push({
      layer: 'structural',
      code: ERROR_CODES.GRAPH_RESULT_NODE_REQUIRED,
      message: `graph "${input.graph.id}" must contain a result node`,
      location: { graphId: input.graph.id },
    });
  }

  for (const node of input.graph.nodes) {
    if (node.kind !== 'branch') continue;
    const defaults = node.cases.filter((c) => 'default' in c).length;
    if (defaults !== 1) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.GRAPH_BRANCH_DEFAULT_REQUIRED,
        message: `branch "${node.id}" must declare exactly one default case`,
        location: { graphId: input.graph.id, nodeId: node.id },
      });
    }
  }

  if (errors.length > 0) return err(errors);
  return summary;
}

function localEmitEffectFor(
  aggregate: string,
  transition: string,
  eventTypesByAggregateTransition: Record<string, string>,
): LocalEmitEffect {
  return {
    aggregate,
    transition,
    eventType:
      eventTypesByAggregateTransition[`${aggregate}.${transition}`] ??
      deriveEventTypeName(aggregate, transition),
  };
}
