import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadComposedBlueprint } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const demoDir = join(
  here,
  '..',
  '..',
  '..',
  '..',
  'demo',
  'order-fulfillment-blueprint',
);

type BpmnIds = {
  readonly processId: string;
  readonly messageNames: readonly string[];
  readonly serviceTaskIds: readonly string[];
};

function readBpmnAttribute(
  xml: string,
  elementName: string,
  attributeName: string,
): string {
  const match = new RegExp(
    `<bpmn:${elementName}\\b[^>]*\\s${attributeName}="([^"]+)"`,
  ).exec(xml);
  expect(match, `missing bpmn:${elementName} ${attributeName}`).not.toBeNull();
  return match?.[1] ?? '';
}

function readBpmnAttributes(
  xml: string,
  elementName: string,
  attributeName: string,
): readonly string[] {
  return Array.from(
    xml.matchAll(
      new RegExp(
        `<bpmn:${elementName}\\b[^>]*\\s${attributeName}="([^"]+)"`,
        'g',
      ),
    ),
    (match) => match[1] ?? '',
  );
}

function readBpmnIds(xml: string): BpmnIds {
  return {
    processId: readBpmnAttribute(xml, 'process', 'id'),
    messageNames: readBpmnAttributes(xml, 'message', 'name'),
    serviceTaskIds: readBpmnAttributes(xml, 'serviceTask', 'id'),
  };
}

describe('order-fulfillment BPMN demo blueprint', () => {
  it('composes with validated workflows', () => {
    const result = loadComposedBlueprint(demoDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const workflows = result.value.workflows;
    expect(workflows).toBeDefined();
    if (!workflows) return;

    const definition = workflows.definitions[0];
    const messageStart = workflows.messageStarts[0];
    expect(definition).toBeDefined();
    expect(messageStart).toBeDefined();
    if (definition === undefined || messageStart === undefined) return;

    expect(definition.id).toBe('orderFulfillment');
    expect(Object.keys(result.value.services).sort()).toEqual([
      'inventory',
      'orders',
    ]);

    expect(messageStart).toEqual(
      expect.objectContaining({
        businessKey: '$event.rntAggregateId',
        variables: {
          orderId: '$event.rntAggregateId',
          sku: '$event.data.after.sku',
          quantity: '$event.data.after.quantity',
        },
      }),
    );
    expect(workflows.serviceTasks.map((task) => task.bindingRef).sort()).toEqual(
      ['inventory.reserveStock', 'orders.cancelOrder', 'orders.confirmOrder'],
    );
    expect(
      workflows.serviceTasks.find((task) => task.taskId === 'confirmOrder')
        ?.input,
    ).toMatchObject({ reservationId: '$process.reservation.aggregateId' });
    const bpmn = readFileSync(
      join(demoDir, 'workflows/order-fulfillment.bpmn'),
      'utf8',
    );
    const bpmnIds = readBpmnIds(bpmn);

    expect(definition.processId).toBe(bpmnIds.processId);
    expect(bpmnIds.messageNames).toContain(messageStart.messageName);
    for (const task of workflows.serviceTasks) {
      expect(bpmnIds.serviceTaskIds).toContain(task.taskId);
    }

    expect(
      workflows.serviceTasks.find((task) => task.taskId === 'cancelOrder')
        ?.input,
    ).toMatchObject({ reason: 'stock reservation unavailable' });

    expect(bpmn).toContain('process id="orderFulfillment"');
    expect(bpmn).toContain('id="reserveStock"');
    expect(bpmn).toContain('id="confirmOrder"');
    expect(bpmn).toContain('id="cancelOrder"');
    expect(bpmn).toContain('name="OrderPlaced"');
    expect(bpmn).toContain('reservation.aggregateId != null');
    expect(bpmn).not.toContain('reservation.status');
  });
});
