import { describe, it, expect } from 'bun:test';
import { checkTransitionLegal } from '../../../src/command-runtime/transition.js';
import type { EmitPlan } from '../../../src/types/command.js';

const assignPlan: EmitPlan = {
  nodeId: 'e',
  aggregate: 'Issue',
  aggregateIdExpr: { $param: 'id' },
  transition: 'assign',
  eventType: 'IssueAssign',
  affects: ['status', 'assigneeId'],
  payloadExprs: {},
  isCreation: false,
  isSelfLoop: false,
  fromStates: ['open'],
  toState: 'in_progress',
};

describe('checkTransitionLegal', () => {
  it('passes when current state is in fromStates', () => {
    expect(() => checkTransitionLegal(assignPlan, { status: 'open' }, 'status')).not.toThrow();
  });
  it('throws COMMAND_ILLEGAL_TRANSITION when current state not in fromStates', () => {
    try {
      checkTransitionLegal(assignPlan, { status: 'closed' }, 'status');
      throw new Error('expected throw');
    } catch (e) {
      expect((e as { code?: string }).code).toBe('COMMAND_ILLEGAL_TRANSITION');
    }
  });
  it('throws COMMAND_ILLEGAL_TRANSITION when aggregate does not exist but transition is not creation', () => {
    try {
      checkTransitionLegal(assignPlan, null, 'status');
      throw new Error('expected throw');
    } catch (e) {
      expect((e as { code?: string }).code).toBe('COMMAND_ILLEGAL_TRANSITION');
    }
  });
  it('passes for creation transition against null state', () => {
    const creation: EmitPlan = { ...assignPlan, isCreation: true, fromStates: [null], toState: 'draft' };
    expect(() => checkTransitionLegal(creation, null, 'status')).not.toThrow();
  });
  it('throws for creation transition against existing state', () => {
    const creation: EmitPlan = { ...assignPlan, isCreation: true, fromStates: [null], toState: 'draft' };
    try {
      checkTransitionLegal(creation, { status: 'draft' }, 'status');
      throw new Error('expected throw');
    } catch (e) {
      expect((e as { code?: string }).code).toBe('COMMAND_ILLEGAL_TRANSITION');
    }
  });
});
