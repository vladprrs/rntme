import type { Expr } from '../types/authoring.js';
import type { EmitPlan } from '../types/command.js';
import { runtimeError } from '../types/errors.js';

export function evalExprAtRuntime(
  expr: Expr,
  params: Record<string, unknown>,
  nodeOutputs?: Record<string, unknown>,
): unknown {
  if (expr === null || typeof expr === 'number' || typeof expr === 'boolean') return expr;
  if (typeof expr === 'string') {
    throw runtimeError('RUNTIME_INTERNAL_ERROR', `field paths are not allowed in emit payload at runtime: ${expr}`);
  }
  if (typeof expr === 'object') {
    if ('$param' in expr) {
      const v = (params as Record<string, unknown>)[(expr as { $param: string }).$param];
      return v === undefined ? null : v;
    }
    if ('$literal' in expr) return (expr as { $literal: string }).$literal;
    if ('$node' in expr) {
      const nodeId = (expr as { $node: string }).$node;
      const value = nodeOutputs?.[nodeId];
      if (value === undefined) {
        throw runtimeError('RUNTIME_INTERNAL_ERROR', `$node "${nodeId}" not found in node outputs`);
      }
      return value;
    }
  }
  throw runtimeError('RUNTIME_INTERNAL_ERROR', `unsupported expr in emit payload: ${JSON.stringify(expr)}`);
}

export type DerivedPayload = {
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
};

function stateFieldFromPlan(plan: EmitPlan): string {
  const outsidePayload = plan.affects.filter((f) => plan.payloadExprs[f] === undefined);
  return outsidePayload[0] ?? plan.affects[0]!;
}

export function derivePayload(
  plan: EmitPlan,
  params: Record<string, unknown>,
  currentState: Record<string, unknown> | null,
  nodeOutputs?: Record<string, unknown>,
): DerivedPayload {
  const stateField = stateFieldFromPlan(plan);
  const after: Record<string, unknown> = {};
  for (const field of plan.affects) {
    if (field === stateField) after[field] = plan.toState;
    else if (plan.payloadExprs[field] !== undefined) {
      after[field] = evalExprAtRuntime(plan.payloadExprs[field]!, params, nodeOutputs);
    }
  }

  if (plan.isCreation) return { before: null, after };

  const before: Record<string, unknown> = {};
  for (const field of plan.affects) before[field] = currentState?.[field] ?? null;
  return { before, after };
}
