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
  readonly messagesById: Readonly<Record<string, string>>;
  readonly startEventMessageRefs: Readonly<Record<string, string>>;
  readonly serviceTaskIds: readonly string[];
};

type GraphFixture = {
  readonly nodes: readonly {
    readonly id?: string;
    readonly type?: string;
  }[];
};

function readXmlAttribute(
  source: string,
  attributeName: string,
  label: string,
): string {
  const match = new RegExp(`\\b${attributeName}="([^"]+)"`).exec(source);
  expect(match, `missing ${label} ${attributeName}`).not.toBeNull();
  return match?.[1] ?? '';
}

function readBpmnAttribute(
  xml: string,
  elementName: string,
  attributeName: string,
): string {
  const match = new RegExp(`<bpmn:${elementName}\\b([^>]*)>`).exec(xml);
  expect(match, `missing bpmn:${elementName}`).not.toBeNull();
  return readXmlAttribute(
    match?.[1] ?? '',
    attributeName,
    `bpmn:${elementName}`,
  );
}

function readBpmnMessages(xml: string): Readonly<Record<string, string>> {
  const messages: Record<string, string> = {};
  for (const match of xml.matchAll(/<bpmn:message\b([^>]*)>/g)) {
    const attributes = match[1] ?? '';
    const id = readXmlAttribute(attributes, 'id', 'bpmn:message');
    messages[id] = readXmlAttribute(attributes, 'name', `bpmn:message ${id}`);
  }
  return messages;
}

function readBpmnStartEventMessageRefs(
  xml: string,
): Readonly<Record<string, string>> {
  const refs: Record<string, string> = {};
  for (const match of xml.matchAll(
    /<bpmn:startEvent\b([^>]*)>([\s\S]*?)<\/bpmn:startEvent>/g,
  )) {
    const id = readXmlAttribute(match[1] ?? '', 'id', 'bpmn:startEvent');
    const messageRefMatch = /<bpmn:messageEventDefinition\b([^>]*)\/?>/.exec(
      match[2] ?? '',
    );
    expect(
      messageRefMatch,
      `missing bpmn:messageEventDefinition for start event ${id}`,
    ).not.toBeNull();
    refs[id] = readXmlAttribute(
      messageRefMatch?.[1] ?? '',
      'messageRef',
      `bpmn:startEvent ${id} messageEventDefinition`,
    );
  }
  return refs;
}

function readBpmnAttributes(
  xml: string,
  elementName: string,
  attributeName: string,
): readonly string[] {
  return Array.from(
    xml.matchAll(new RegExp(`<bpmn:${elementName}\\b([^>]*)>`, 'g')),
    (match) =>
      readXmlAttribute(
        match[1] ?? '',
        attributeName,
        `bpmn:${elementName}`,
      ),
  );
}

function readResolvedStartMessageName(
  bpmn: BpmnIds,
  startEventId: string,
): string {
  const messageRef = bpmn.startEventMessageRefs[startEventId];
  expect(messageRef, `missing BPMN start event ${startEventId}`).toBeDefined();
  if (messageRef === undefined) return '';

  const messageName = bpmn.messagesById[messageRef];
  expect(messageName, `missing BPMN message ${messageRef}`).toBeDefined();
  if (messageName === undefined) return '';

  return messageName;
}

function readBpmnIds(xml: string): BpmnIds {
  return {
    processId: readBpmnAttribute(xml, 'process', 'id'),
    messagesById: readBpmnMessages(xml),
    startEventMessageRefs: readBpmnStartEventMessageRefs(xml),
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
        event: {
          service: 'orders',
          aggregateType: 'Order',
          eventType: 'OrderPlaced',
        },
      }),
    );
    expect(workflows.serviceTasks.map((task) => task.bindingRef).sort()).toEqual(
      ['inventory.reserveStock', 'orders.cancelOrder', 'orders.confirmOrder'],
    );
    expect(
      workflows.serviceTasks.find((task) => task.taskId === 'confirmOrder')
        ?.input,
    ).toMatchObject({ reservationId: '$process.reservation.reservationId' });
    const bpmn = readFileSync(
      join(demoDir, 'workflows/order-fulfillment.bpmn'),
      'utf8',
    );
    const reserveStockGraph = JSON.parse(
      readFileSync(
        join(demoDir, 'services/inventory/graphs/reserveStock.json'),
        'utf8',
      ),
    ) as GraphFixture;
    const bpmnIds = readBpmnIds(bpmn);

    expect(definition.processId).toBe(bpmnIds.processId);
    expect(readResolvedStartMessageName(bpmnIds, messageStart.id)).toBe(
      messageStart.messageName,
    );
    for (const task of workflows.serviceTasks) {
      expect(bpmnIds.serviceTaskIds).toContain(task.taskId);
    }

    expect(
      workflows.serviceTasks.find((task) => task.taskId === 'cancelOrder')
        ?.input,
    ).toMatchObject({ reason: '$process.reservation.reason' });

    expect(bpmn).toContain('process id="orderFulfillment"');
    expect(bpmn).toContain('id="reserveStock"');
    expect(bpmn).toContain('id="confirmOrder"');
    expect(bpmn).toContain('id="cancelOrder"');
    expect(bpmn).toContain('name="OrderPlaced"');
    expect(bpmn).toContain('operaton:historyTimeToLive="30"');
    expect(bpmn).toContain('reservation.prop("reserved").boolValue() == true');
    expect(bpmn).toContain('reservation.prop("reserved").boolValue() == false');
    expect(bpmn).not.toContain('reservation.aggregateId');
    expect(bpmn).not.toContain('reservation.status');
    expect(reserveStockGraph.nodes.some((node) => node.type === 'branch')).toBe(true);
    expect(reserveStockGraph.nodes.some((node) => node.id === 'emitRejected')).toBe(true);
    expect(reserveStockGraph.nodes.some((node) => node.type === 'result')).toBe(true);
  });

});
