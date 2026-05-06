import { describe, expect, it } from 'vitest';
import type { WorkflowArtifact } from '@rntme/workflows';

import { runBpmnWorker, runWorkflowEventOnce, type OperatonClient, type RntmeCommandClient } from '../../src/index.js';

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

  it('completes insufficient-stock business results without failing the task', async () => {
    let completedVariables: unknown;
    const calls: string[] = [];

    await runWorkflowEventOnce({
      manifest: createManifest(),
      event: createEvent(),
      eventRef: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
      operaton: createOperaton(calls, {
        async completeTask(id, variables) {
          completedVariables = variables;
          calls.push(
            `complete:${id}:${String((variables as { reservation?: { reserved?: boolean } }).reservation?.reserved)}`,
          );
        },
      }),
      commands: createCommands(calls, {
        async execute(bindingRef, input, metadata) {
          calls.push(`command:${bindingRef}:${String((input as { orderId?: string }).orderId)}:${metadata.commandId}`);
          return { reserved: false, reason: 'insufficient stock' };
        },
      }),
    });

    expect(calls).toEqual([
      'start:orderFulfillment:ord_1',
      'command:inventory.reserveStock:ord_1:bpmn:proc_1:reserveStock:act_1',
      'complete:task_1:false',
    ]);
    expect(completedVariables).toEqual({
      reservation: { reserved: false, reason: 'insufficient stock' },
    });
  });

  it('continues polling and executes the cancellation task after insufficient stock', async () => {
    const calls: string[] = [];
    let fetchCount = 0;

    await runWorkflowEventOnce({
      manifest: createManifest({
        serviceTasks: [
          {
            definition: 'orderFulfillment',
            taskId: 'reserveStock',
            bindingRef: 'inventory.reserveStock',
            input: { orderId: '$process.orderId' },
            resultVariable: 'reservation',
          },
          {
            definition: 'orderFulfillment',
            taskId: 'cancelOrder',
            bindingRef: 'orders.cancelOrder',
            input: {
              orderId: '$process.orderId',
              reason: '$process.reservation.reason',
            },
          },
        ],
      }),
      event: createEvent(),
      eventRef: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
      operaton: createOperaton(calls, {
        async fetchAndLock() {
          fetchCount += 1;
          if (fetchCount === 1) {
            return [
              {
                id: 'task_reserve',
                taskId: 'reserveStock',
                processInstanceId: 'proc_1',
                activityInstanceId: 'act_reserve',
                variables: { orderId: 'ord_1' },
              },
            ];
          }
          if (fetchCount === 2) {
            return [
              {
                id: 'task_cancel',
                taskId: 'cancelOrder',
                processInstanceId: 'proc_1',
                activityInstanceId: 'act_cancel',
                variables: {
                  orderId: 'ord_1',
                  reservation: { reserved: false, reason: 'insufficient stock' },
                },
              },
            ];
          }
          return [];
        },
      }),
      commands: createCommands(calls, {
        async execute(bindingRef, input, metadata) {
          calls.push(`command:${bindingRef}:${String((input as { orderId?: string }).orderId)}:${metadata.commandId}`);
          if (bindingRef === 'inventory.reserveStock') {
            return { reserved: false, reason: 'insufficient stock' };
          }
          return { aggregateId: 'ord_1', version: 2, eventIds: ['evt_cancel'] };
        },
      }),
    });

    expect(calls).toEqual([
      'start:orderFulfillment:ord_1',
      'command:inventory.reserveStock:ord_1:bpmn:proc_1:reserveStock:act_reserve',
      'complete:task_reserve:false',
      'command:orders.cancelOrder:ord_1:bpmn:proc_1:cancelOrder:act_cancel',
      'complete:task_cancel:undefined',
    ]);
  });

  it('consumes matching workflow events and commits after processing', async () => {
    const calls: string[] = [];
    const consumer = {
      async *events() {
        yield {
          envelope: createEvent(),
          eventRef: { service: 'orders', aggregateType: 'Order', eventType: 'OrderPlaced' },
          commit: async () => { calls.push('commit'); },
        };
      },
      stop: async () => { calls.push('stop'); },
    };

    await runBpmnWorker({
      manifest: createManifest(),
      subscriptions: [{
        messageStartId: 'orderPlaced',
        topic: 'rntme.orders.order',
        service: 'orders',
        aggregateType: 'Order',
        eventType: 'OrderPlaced',
        processId: 'orderFulfillment',
        messageName: 'OrderPlaced',
        businessKey: '$event.data.orderId',
      }],
      operaton: createOperaton(calls),
      commands: createCommands(calls),
      consumer,
      stopAfterEvents: 1,
    });

    expect(calls).toEqual([
      'start:orderFulfillment:ord_1',
      'command:inventory.reserveStock:ord_1:bpmn:proc_1:reserveStock:act_1',
      'complete:task_1:true',
      'commit',
      'stop',
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
