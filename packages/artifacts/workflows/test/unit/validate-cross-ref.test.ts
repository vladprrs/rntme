import { describe, expect, it } from 'bun:test';
import {
  parseWorkflowArtifact,
  validateWorkflowCrossRef,
  validateWorkflowStructural,
  type WorkflowBindingResolution,
  type WorkflowCrossRefContext,
  type WorkflowEventRef,
} from '../../src/index.js';

function parsed(raw: unknown) {
  const parsed = parseWorkflowArtifact(raw);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  const structural = validateWorkflowStructural(parsed.value);
  if (!structural.ok) throw new Error(JSON.stringify(structural.errors));
  return structural.value;
}

const base = {
  workflowVersion: 1,
  definitions: [
    { id: 'orderFulfillment', bpmnFile: 'order-fulfillment.bpmn', processId: 'orderFulfillment' },
  ],
  messageStarts: [
    {
      id: 'orderPlaced',
      definition: 'orderFulfillment',
      messageName: 'OrderPlaced',
      event: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
      businessKey: '$event.data.orderId',
    },
  ],
  serviceTasks: [
    { definition: 'orderFulfillment', taskId: 'reserveStock', bindingRef: 'inventory.reserveStock' },
  ],
};

function ctx(overrides: Partial<WorkflowCrossRefContext> = {}): WorkflowCrossRefContext {
  const bindings: Record<string, WorkflowBindingResolution> = {
    'inventory.reserveStock': {
      service: 'inventory',
      bindingId: 'reserveStock',
      qualifiedId: 'inventory.reserveStock',
      kind: 'command',
    },
    'inventory.listStock': {
      service: 'inventory',
      bindingId: 'listStock',
      qualifiedId: 'inventory.listStock',
      kind: 'query',
    },
    'inventory.mismatched': {
      service: 'warehouse',
      bindingId: 'mismatched',
      qualifiedId: 'warehouse.mismatched',
      kind: 'command',
    },
  };
  return {
    services: ['orders', 'inventory'],
    fileExists: (path) => path === 'order-fulfillment.bpmn',
    resolveEvent: (ref: WorkflowEventRef) =>
      ref.service === 'orders' && ref.aggregateType === 'Order' && ref.eventType === 'OrderPlaced'
        ? ref
        : null,
    resolveBindingRef: (ref) => bindings[ref] ?? null,
    ...overrides,
  };
}

describe('validateWorkflowCrossRef', () => {
  it('accepts valid refs', () => {
    const result = validateWorkflowCrossRef(parsed(base), ctx());
    expect(result.ok).toBe(true);
  });

  it('rejects missing BPMN files', () => {
    const result = validateWorkflowCrossRef(parsed(base), ctx({ fileExists: () => false }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('WORKFLOWS_XREF_BPMN_FILE_MISSING');
  });

  it('rejects unknown event services', () => {
    const result = validateWorkflowCrossRef(
      parsed({
        ...base,
        messageStarts: [
          {
            ...base.messageStarts[0],
            event: { service: 'billing', aggregateType: 'Order', eventType: 'OrderPlaced' },
          },
        ],
      }),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('WORKFLOWS_XREF_EVENT_UNKNOWN_SERVICE');
  });

  it('rejects unknown events', () => {
    const result = validateWorkflowCrossRef(parsed(base), ctx({ resolveEvent: () => null }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('WORKFLOWS_XREF_EVENT_UNKNOWN_TYPE');
  });

  it('rejects unknown binding refs', () => {
    const result = validateWorkflowCrossRef(
      parsed({
        ...base,
        serviceTasks: [
          { definition: 'orderFulfillment', taskId: 'x', bindingRef: 'missing.command' },
        ],
      }),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('WORKFLOWS_XREF_BINDING_REF_UNKNOWN');
  });

  it('rejects query binding refs', () => {
    const result = validateWorkflowCrossRef(
      parsed({
        ...base,
        serviceTasks: [
          { definition: 'orderFulfillment', taskId: 'x', bindingRef: 'inventory.listStock' },
        ],
      }),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('WORKFLOWS_XREF_BINDING_NOT_COMMAND');
  });

  it('rejects binding refs that resolve to a different service', () => {
    const result = validateWorkflowCrossRef(
      parsed({
        ...base,
        serviceTasks: [
          { definition: 'orderFulfillment', taskId: 'x', bindingRef: 'inventory.mismatched' },
        ],
      }),
      ctx(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('WORKFLOWS_XREF_BINDING_SERVICE_MISMATCH');
  });
});
