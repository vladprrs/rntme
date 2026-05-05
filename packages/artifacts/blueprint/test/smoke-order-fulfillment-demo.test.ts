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

describe('order-fulfillment BPMN demo blueprint', () => {
  it('composes with validated workflows', () => {
    const result = loadComposedBlueprint(demoDir);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const workflows = result.value.workflows;
    expect(workflows?.definitions[0]?.id).toBe('orderFulfillment');
    expect(Object.keys(result.value.services).sort()).toEqual([
      'inventory',
      'orders',
    ]);

    expect(workflows?.messageStarts[0]).toEqual(
      expect.objectContaining({
        businessKey: '$event.rntAggregateId',
        variables: {
          orderId: '$event.rntAggregateId',
          sku: '$event.data.after.sku',
          quantity: '$event.data.after.quantity',
        },
      }),
    );
    expect(workflows?.serviceTasks.map((task) => task.bindingRef).sort()).toEqual(
      ['inventory.reserveStock', 'orders.cancelOrder', 'orders.confirmOrder'],
    );
    expect(
      workflows?.serviceTasks.find((task) => task.taskId === 'confirmOrder')
        ?.input,
    ).toMatchObject({ reservationId: '$process.reservation.aggregateId' });
    expect(
      workflows?.serviceTasks.find((task) => task.taskId === 'cancelOrder')
        ?.input,
    ).toMatchObject({ reason: 'stock reservation unavailable' });

    const bpmn = readFileSync(
      join(demoDir, 'workflows/order-fulfillment.bpmn'),
      'utf8',
    );
    expect(bpmn).toContain('process id="orderFulfillment"');
    expect(bpmn).toContain('id="reserveStock"');
    expect(bpmn).toContain('id="confirmOrder"');
    expect(bpmn).toContain('id="cancelOrder"');
    expect(bpmn).toContain('name="OrderPlaced"');
    expect(bpmn).toContain('reservation.aggregateId != null');
    expect(bpmn).not.toContain('reservation.status');
  });
});
