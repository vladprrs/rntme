import { describe, expect, it } from 'vitest';
import { parseWorkflowArtifact, validateWorkflowStructural } from '../../src/index.js';

function artifact(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

function parseValid(raw: unknown) {
  const parsed = parseWorkflowArtifact(raw);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.errors));
  return parsed.value;
}

describe('validateWorkflowStructural', () => {
  it('accepts a structurally valid artifact', () => {
    const result = validateWorkflowStructural(parseValid(artifact()));
    expect(result.ok).toBe(true);
  });

  it('rejects duplicate definition ids', () => {
    const result = validateWorkflowStructural(
      parseValid(
        artifact({
          definitions: [
            { id: 'orderFulfillment', bpmnFile: 'a.bpmn', processId: 'a' },
            { id: 'orderFulfillment', bpmnFile: 'b.bpmn', processId: 'b' },
          ],
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => e.code)).toContain('WORKFLOWS_STRUCT_DEFINITION_ID_DUPLICATE');
  });

  it('rejects unknown definition refs', () => {
    const result = validateWorkflowStructural(
      parseValid(
        artifact({
          serviceTasks: [{ definition: 'missing', taskId: 'reserveStock', bindingRef: 'inventory.reserveStock' }],
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('WORKFLOWS_STRUCT_UNKNOWN_DEFINITION');
  });

  it('rejects mapping expressions outside v1 path grammar', () => {
    const result = validateWorkflowStructural(
      parseValid(
        artifact({
          messageStarts: [
            {
              id: 'orderPlaced',
              definition: 'orderFulfillment',
              messageName: 'OrderPlaced',
              event: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
              businessKey: '$env.SECRET',
            },
          ],
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('WORKFLOWS_STRUCT_MAPPING_PATH_INVALID');
  });
});
