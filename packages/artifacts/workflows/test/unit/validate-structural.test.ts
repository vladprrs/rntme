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

  it('rejects literal business keys', () => {
    const result = validateWorkflowStructural(
      parseValid(
        artifact({
          messageStarts: [
            {
              id: 'orderPlaced',
              definition: 'orderFulfillment',
              messageName: 'OrderPlaced',
              event: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
              businessKey: 'order-1',
            },
          ],
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('WORKFLOWS_STRUCT_MAPPING_PATH_INVALID');
  });

  it('allows literal strings in variables and service task input mappings', () => {
    const result = validateWorkflowStructural(
      parseValid(
        artifact({
          messageStarts: [
            {
              id: 'orderPlaced',
              definition: 'orderFulfillment',
              messageName: 'OrderPlaced',
              event: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
              businessKey: '$event.data.orderId',
              variables: { literalStatus: 'pending' },
            },
          ],
          serviceTasks: [
            {
              definition: 'orderFulfillment',
              taskId: 'reserveStock',
              bindingRef: 'inventory.reserveStock',
              input: { literalMode: 'strict' },
            },
          ],
        }),
      ),
    );
    expect(result.ok).toBe(true);
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

  it('rejects non-posix relative BPMN file paths', () => {
    const invalidPaths = [
      'https://example.com/order.bpmn',
      'nested\\order.bpmn',
      './order.bpmn',
      'nested/./order.bpmn',
      'nested//order.bpmn',
    ];

    for (const bpmnFile of invalidPaths) {
      const result = validateWorkflowStructural(
        parseValid(
          artifact({
            definitions: [{ id: 'orderFulfillment', bpmnFile, processId: 'orderFulfillment' }],
          }),
        ),
      );
      expect(result.ok, bpmnFile).toBe(false);
      if (!result.ok) expect(result.errors[0]?.code).toBe('WORKFLOWS_STRUCT_MAPPING_PATH_INVALID');
    }
  });

  it('rejects duplicate messageStart ids', () => {
    const result = validateWorkflowStructural(
      parseValid(
        artifact({
          messageStarts: [
            {
              id: 'orderPlaced',
              definition: 'orderFulfillment',
              messageName: 'OrderPlaced',
              event: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
              businessKey: '$event.data.orderId',
            },
            {
              id: 'orderPlaced',
              definition: 'orderFulfillment',
              messageName: 'OrderPlacedAgain',
              event: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlacedAgain' },
              businessKey: '$event.data.orderId',
            },
          ],
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => e.code)).toContain('WORKFLOWS_STRUCT_MESSAGE_START_ID_DUPLICATE');
  });

  it('rejects duplicate service task ids within the same definition', () => {
    const result = validateWorkflowStructural(
      parseValid(
        artifact({
          serviceTasks: [
            { definition: 'orderFulfillment', taskId: 'reserveStock', bindingRef: 'inventory.reserveStock' },
            { definition: 'orderFulfillment', taskId: 'reserveStock', bindingRef: 'inventory.reserveStockAgain' },
          ],
        }),
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((e) => e.code)).toContain('WORKFLOWS_STRUCT_SERVICE_TASK_ID_DUPLICATE');
  });

  it('does not collide service task ids by joined definition and task strings', () => {
    const result = validateWorkflowStructural(
      parseValid(
        artifact({
          definitions: [
            { id: 'a:b', bpmnFile: 'first.bpmn', processId: 'first' },
            { id: 'a', bpmnFile: 'second.bpmn', processId: 'second' },
          ],
          messageStarts: [],
          serviceTasks: [
            { definition: 'a:b', taskId: 'c', bindingRef: 'inventory.reserveStock' },
            { definition: 'a', taskId: 'b:c', bindingRef: 'inventory.reserveStockAgain' },
          ],
        }),
      ),
    );
    expect(result.ok).toBe(true);
  });
});
