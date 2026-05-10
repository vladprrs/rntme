import { describe, expect, it } from 'bun:test';
import { parseWorkflowArtifact } from '../../src/index.js';

const valid = {
  workflowVersion: 1,
  definitions: [{ id: 'orderFulfillment', bpmnFile: 'order-fulfillment.bpmn', processId: 'orderFulfillment' }],
  messageStarts: [
    {
      id: 'orderPlaced',
      definition: 'orderFulfillment',
      messageName: 'OrderPlaced',
      event: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
      businessKey: '$event.data.orderId',
      variables: { orderId: '$event.data.orderId' },
    },
  ],
  serviceTasks: [
    {
      definition: 'orderFulfillment',
      taskId: 'reserveStock',
      bindingRef: 'inventory.reserveStock',
      input: { orderId: '$process.orderId' },
      resultVariable: 'reservation',
    },
  ],
};

describe('parseWorkflowArtifact', () => {
  it('parses a valid object', () => {
    const result = parseWorkflowArtifact(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.definitions[0]?.id).toBe('orderFulfillment');
  });

  it('parses a JSON string', () => {
    const result = parseWorkflowArtifact(JSON.stringify(valid));
    expect(result.ok).toBe(true);
  });

  it('rejects unknown fields', () => {
    const result = parseWorkflowArtifact({ ...valid, extra: true });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.code).toBe('WORKFLOWS_PARSE_SCHEMA_VIOLATION');
      expect(result.errors[0]?.path).toBeDefined();
    }
  });

  it('rejects unsupported workflowVersion', () => {
    const result = parseWorkflowArtifact({ ...valid, workflowVersion: 2 });
    expect(result.ok).toBe(false);
  });

  it('accepts a workflow artifact with nativeTasks', () => {
    const result = parseWorkflowArtifact({
      workflowVersion: 1,
      definitions: [{ id: 'd1', bpmnFile: 'd1.bpmn', processId: 'p1' }],
      messageStarts: [],
      serviceTasks: [],
      nativeTasks: [
        {
          definition: 'd1',
          taskId: 'task-1',
          handler: { module: '@rntme/deploy-runner', export: 'composeStageHandler' },
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.nativeTasks).toHaveLength(1);
      expect(result.value.nativeTasks?.[0]?.handler.module).toBe('@rntme/deploy-runner');
    }
  });
});
