import { describe, expect, it } from 'vitest';
import type { WorkflowArtifact } from '@rntme/workflows';

import { runWorkflowEventOnce, type OperatonClient, type RntmeCommandClient } from '../../src/index.js';

describe('runWorkflowEventOnce', () => {
  it('starts process and completes a service task through command client', async () => {
    const calls: string[] = [];
    const operaton = createOperaton(calls);
    const commands = createCommands(calls);

    await runWorkflowEventOnce({
      manifest: createManifest(),
      event: createEvent(),
      eventRef: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
      operaton,
      commands,
    });

    expect(calls).toEqual([
      'start:orderFulfillment:ord_1',
      'command:inventory.reserveStock:ord_1:bpmn:proc_1:reserveStock:act_1',
      'complete:task_1:true',
    ]);
  });

  it('uses service task mapping from the started definition when task ids overlap', async () => {
    const calls: string[] = [];

    await runWorkflowEventOnce({
      manifest: createManifest({
        definitions: [
          { id: 'returns', bpmnFile: 'returns.bpmn', processId: 'returns' },
          { id: 'orderFulfillment', bpmnFile: 'order-fulfillment.bpmn', processId: 'orderFulfillment' },
        ],
        serviceTasks: [
          {
            definition: 'returns',
            taskId: 'reserveStock',
            bindingRef: 'returns.reserveStock',
            input: { orderId: '$process.orderId' },
            resultVariable: 'reservation',
          },
          {
            definition: 'orderFulfillment',
            taskId: 'reserveStock',
            bindingRef: 'inventory.reserveStock',
            input: { orderId: '$process.orderId' },
            resultVariable: 'reservation',
          },
        ],
      }),
      event: createEvent(),
      eventRef: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
      operaton: createOperaton(calls),
      commands: createCommands(calls),
    });

    expect(calls).toEqual([
      'start:orderFulfillment:ord_1',
      'command:inventory.reserveStock:ord_1:bpmn:proc_1:reserveStock:act_1',
      'complete:task_1:true',
    ]);
  });

  it('does nothing when event ref does not match a message start', async () => {
    const calls: string[] = [];

    await runWorkflowEventOnce({
      manifest: createManifest(),
      event: createEvent(),
      eventRef: { service: 'orders', aggregateType: 'Order', eventType: 'OrderCancelled' },
      operaton: createOperaton(calls),
      commands: createCommands(calls),
    });

    expect(calls).toEqual([]);
  });

  it('does nothing when the matching start references a missing definition', async () => {
    const calls: string[] = [];

    await runWorkflowEventOnce({
      manifest: createManifest({
        messageStarts: [
          {
            id: 'orderPlaced',
            definition: 'missing',
            messageName: 'OrderPlaced',
            event: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
            businessKey: '$event.data.orderId',
            variables: { orderId: '$event.data.orderId' },
          },
        ],
      }),
      event: createEvent(),
      eventRef: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
      operaton: createOperaton(calls),
      commands: createCommands(calls),
    });

    expect(calls).toEqual([]);
  });

  it('leaves unmapped service tasks locked without command execution', async () => {
    const calls: string[] = [];

    await runWorkflowEventOnce({
      manifest: createManifest(),
      event: createEvent(),
      eventRef: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
      operaton: createOperaton(calls, {
        async fetchAndLock() {
          return [
            {
              id: 'task_1',
              taskId: 'chargeCard',
              processInstanceId: 'proc_1',
              activityInstanceId: 'act_1',
              variables: { orderId: 'ord_1' },
            },
          ];
        },
      }),
      commands: createCommands(calls),
    });

    expect(calls).toEqual(['start:orderFulfillment:ord_1']);
  });

  it('ignores tasks from another process instance', async () => {
    const calls: string[] = [];

    await runWorkflowEventOnce({
      manifest: createManifest(),
      event: createEvent(),
      eventRef: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
      operaton: createOperaton(calls, {
        async fetchAndLock() {
          return [
            {
              id: 'task_1',
              taskId: 'reserveStock',
              processInstanceId: 'proc_other',
              activityInstanceId: 'act_1',
              variables: { orderId: 'ord_1' },
            },
          ];
        },
      }),
      commands: createCommands(calls),
    });

    expect(calls).toEqual(['start:orderFulfillment:ord_1']);
  });

  it('fails the task with the command error message when command execution fails', async () => {
    const calls: string[] = [];

    await runWorkflowEventOnce({
      manifest: createManifest(),
      event: createEvent(),
      eventRef: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
      operaton: createOperaton(calls),
      commands: createCommands(calls, {
        async execute(bindingRef, input, metadata) {
          calls.push(
            `command:${bindingRef}:${String((input as { orderId?: string }).orderId)}:${metadata.commandId}`,
          );
          throw new Error('inventory unavailable');
        },
      }),
    });

    expect(calls).toEqual([
      'start:orderFulfillment:ord_1',
      'command:inventory.reserveStock:ord_1:bpmn:proc_1:reserveStock:act_1',
      'fail:task_1:inventory unavailable',
    ]);
  });

  it('fails the task when completion fails after command execution', async () => {
    const calls: string[] = [];

    await runWorkflowEventOnce({
      manifest: createManifest(),
      event: createEvent(),
      eventRef: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
      operaton: createOperaton(calls, {
        async completeTask(id, variables) {
          calls.push(
            `complete:${id}:${String((variables as { reservation?: { reserved?: boolean } }).reservation?.reserved)}`,
          );
          throw new Error('complete rejected');
        },
      }),
      commands: createCommands(calls),
    });

    expect(calls).toEqual([
      'start:orderFulfillment:ord_1',
      'command:inventory.reserveStock:ord_1:bpmn:proc_1:reserveStock:act_1',
      'complete:task_1:true',
      'fail:task_1:complete rejected',
    ]);
  });
});

function createManifest(overrides: Partial<WorkflowArtifact> = {}): WorkflowArtifact {
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

function createEvent() {
  return {
    id: 'evt_1',
    correlationId: 'corr_1',
    data: { orderId: 'ord_1' },
  };
}

function createOperaton(calls: string[], overrides: Partial<OperatonClient> = {}): OperatonClient {
  return {
    async startProcess(input) {
      calls.push(`start:${input.processId}:${input.businessKey}`);
      return { processInstanceId: 'proc_1' };
    },
    async fetchAndLock() {
      return [
        {
          id: 'task_1',
          taskId: 'reserveStock',
          processInstanceId: 'proc_1',
          activityInstanceId: 'act_1',
          variables: { orderId: 'ord_1' },
        },
      ];
    },
    async completeTask(id, variables) {
      calls.push(
        `complete:${id}:${String((variables as { reservation?: { reserved?: boolean } }).reservation?.reserved)}`,
      );
    },
    async failTask(id, message) {
      calls.push(`fail:${id}:${message}`);
    },
    ...overrides,
  };
}

function createCommands(calls: string[], overrides: Partial<RntmeCommandClient> = {}): RntmeCommandClient {
  return {
    async execute(bindingRef, input, metadata) {
      calls.push(`command:${bindingRef}:${String((input as { orderId?: string }).orderId)}:${metadata.commandId}`);
      return { reserved: true, reservationId: 'res_1' };
    },
    ...overrides,
  };
}
