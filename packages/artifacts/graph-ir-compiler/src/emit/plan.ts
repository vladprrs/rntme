import type { CanonicalEmit, CanonicalGraph } from '../types/canonical.js';
import type { ValidatedPdm } from '@rntme/pdm';
import type { EmitPlan } from '../types/command.js';
import { lookupEventTypeSpec } from './event-type.js';

export function buildEmitPlans(graph: CanonicalGraph, pdm: ValidatedPdm): EmitPlan[] {
  const plans: EmitPlan[] = [];
  for (const n of graph.nodes) {
    if (n.kind !== 'emit') continue;
    const emit = n as CanonicalEmit;
    const spec = lookupEventTypeSpec(pdm, emit.aggregate, emit.transition);
    if (!spec) continue;
    const plan: EmitPlan = {
      nodeId: emit.id,
      aggregate: emit.aggregate,
      aggregateIdExpr: emit.aggregateId,
      transition: emit.transition,
      eventType: spec.eventType,
      affects: spec.affects,
      payloadExprs: emit.payload,
      isCreation: spec.isCreation,
      isSelfLoop: spec.isSelfLoop,
      fromStates: spec.from,
      toState: spec.to,
    };
    if (emit.actor !== undefined) plan.actorExpr = emit.actor;
    plans.push(plan);
  }
  return plans;
}
