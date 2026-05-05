import { describe, expect, it } from 'vitest';

import { runWorkflowEventOnce, type OperatonClient, type RntmeCommandClient } from '../../src/index.js';

describe('runWorkflowEventOnce', () => {
  it('starts process and completes a service task through command client', async () => {
    const calls: string[] = [];
    const operaton: OperatonClient = {
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
    };
    const commands: RntmeCommandClient = {
      async execute(bindingRef, input, metadata) {
        calls.push(`command:${bindingRef}:${String((input as { orderId?: string }).orderId)}:${metadata.commandId}`);
        return { reserved: true, reservationId: 'res_1' };
      },
    };

    await runWorkflowEventOnce({
      manifest: {
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
      },
      event: {
        id: 'evt_1',
        correlationId: 'corr_1',
        data: { orderId: 'ord_1' },
      },
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
});
