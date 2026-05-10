import { describe, it, expect } from 'bun:test';
import { evalExprAtRuntime, derivePayload } from '../../../src/emit/payload.js';
import type { EmitPlan } from '../../../src/types/command.js';

describe('evalExprAtRuntime', () => {
  it('resolves $param from params map', () => {
    expect(evalExprAtRuntime({ $param: 'x' }, { x: 42 })).toBe(42);
  });
  it('passes through literals', () => {
    expect(evalExprAtRuntime(7, {})).toBe(7);
    expect(evalExprAtRuntime({ $literal: 'open' }, {})).toBe('open');
    expect(evalExprAtRuntime(null, {})).toBe(null);
  });
  it('throws on unsupported expr shapes', () => {
    expect(() => evalExprAtRuntime({ eq: ['a', 1] } as never, {})).toThrow();
  });
});

describe('derivePayload', () => {
  const plan: EmitPlan = {
    nodeId: 'e',
    aggregate: 'Issue',
    aggregateIdExpr: { $param: 'id' },
    transition: 'assign',
    eventType: 'IssueAssigned',
    affects: ['status', 'assigneeId'],
    payloadExprs: { assigneeId: { $param: 'assigneeId' } },
    isCreation: false,
    isSelfLoop: false,
    fromStates: ['open'],
    toState: 'in_progress',
  };
  it('produces {before, after} for a state-change transition', () => {
    const currentState = { status: 'open', assigneeId: null };
    const p = derivePayload(plan, { id: 1, assigneeId: 99 }, currentState);
    expect(p.before).toEqual({ status: 'open', assigneeId: null });
    expect(p.after).toEqual({ status: 'in_progress', assigneeId: 99 });
  });
  it('produces {before: null} for a creation', () => {
    const creation: EmitPlan = {
      ...plan,
      isCreation: true,
      fromStates: [null],
      toState: 'draft',
      payloadExprs: { title: { $param: 't' } },
      affects: ['status', 'title'],
    };
    const p = derivePayload(creation, { t: 'hi' }, null);
    expect(p.before).toBeNull();
    expect(p.after).toEqual({ status: 'draft', title: 'hi' });
  });
});
