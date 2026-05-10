import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'bun:test';
import { loadComposedBlueprint } from '../../src/index.js';

const tempDirs: string[] = [];

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, JSON.stringify(value, null, 2));
}

function scaffoldProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'rntme-workflows-blueprint-'));
  tempDirs.push(dir);
  mkdirSync(join(dir, 'pdm/entities'), { recursive: true });
  mkdirSync(join(dir, 'services/orders/graphs'), { recursive: true });
  mkdirSync(join(dir, 'services/orders/bindings'), { recursive: true });
  mkdirSync(join(dir, 'services/inventory/graphs'), { recursive: true });
  mkdirSync(join(dir, 'services/inventory/bindings'), { recursive: true });
  mkdirSync(join(dir, 'workflows'), { recursive: true });

  writeJson(join(dir, 'project.json'), {
    name: 'order-fulfillment',
    services: ['orders', 'inventory'],
    routes: {
      http: { '/api/orders': 'orders', '/api/inventory': 'inventory' },
    },
  });
  writeJson(join(dir, 'pdm/pdm.json'), { version: '1' });
  writeJson(join(dir, 'pdm/entities/Order.json'), {
    ownerService: 'orders',
    kind: 'owned',
    table: 'orders',
    fields: {
      id: { type: 'string', nullable: false, column: 'id' },
      sku: { type: 'string', nullable: false, column: 'sku' },
      quantity: { type: 'integer', nullable: false, column: 'quantity' },
      status: { type: 'string', nullable: false, column: 'status' },
    },
    keys: ['id'],
    stateMachine: {
      stateField: 'status',
      initial: null,
      states: ['placed', 'confirmed', 'cancelled'],
      transitions: {
        place: { from: null, to: 'placed', affects: ['sku', 'quantity'] },
        confirm: { from: 'placed', to: 'confirmed' },
        cancel: { from: 'placed', to: 'cancelled' },
      },
    },
  });
  writeJson(join(dir, 'pdm/entities/StockReservation.json'), {
    ownerService: 'inventory',
    kind: 'owned',
    table: 'stock_reservations',
    fields: {
      id: { type: 'string', nullable: false, column: 'id' },
      orderId: { type: 'string', nullable: false, column: 'order_id' },
      status: { type: 'string', nullable: false, column: 'status' },
    },
    keys: ['id'],
    stateMachine: {
      stateField: 'status',
      initial: null,
      states: ['reserved', 'rejected'],
      transitions: {
        reserve: { from: null, to: 'reserved', affects: ['orderId'] },
        reject: { from: null, to: 'rejected', affects: ['orderId'] },
      },
    },
  });

  for (const service of ['orders', 'inventory']) {
    writeJson(join(dir, `services/${service}/service.json`), {
      kind: 'domain',
    });
    writeJson(join(dir, `services/${service}/graphs/shapes.json`), {
      WorkflowActionResult: {
        fields: {
          aggregateId: { type: 'string', nullable: false },
          version: { type: 'integer', nullable: false },
        },
      },
    });
  }
  writeJson(join(dir, 'services/orders/graphs/confirmOrder.json'), {
    id: 'confirmOrder',
    signature: {
      inputs: {},
      output: { type: 'row<WorkflowActionResult>', from: 'out' },
    },
    nodes: [
      {
        id: 'emit',
        type: 'emit',
        config: {
          aggregate: 'Order',
          aggregateId: { $literal: 'order-1' },
          transition: 'confirm',
          payload: {},
        },
      },
      {
        id: 'out',
        type: 'result',
        value: {
          aggregateId: { $ref: 'emit.aggregateId' },
          version: { $ref: 'emit.version' },
        },
      },
    ],
  });
  writeJson(join(dir, 'services/orders/bindings/bindings.json'), {
    version: '1.0',
    graphSpecRef: '../graphs',
    pdmRef: '../../pdm',
    qsmRef: '../qsm',
    bindings: {
      confirmOrder: {
        exposure: 'action',
        graph: 'confirmOrder',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: { method: 'POST', path: '/confirm', parameters: [] },
      },
    },
  });
  writeJson(join(dir, 'services/inventory/graphs/reserveStock.json'), {
    id: 'reserveStock',
    signature: {
      inputs: {},
      output: { type: 'row<WorkflowActionResult>', from: 'out' },
    },
    nodes: [
      {
        id: 'emit',
        type: 'emit',
        config: {
          aggregate: 'StockReservation',
          aggregateId: { $literal: 'reservation-1' },
          transition: 'reserve',
          payload: {
            orderId: { $literal: 'order-1' },
          },
        },
      },
      {
        id: 'out',
        type: 'result',
        value: {
          aggregateId: { $ref: 'emit.aggregateId' },
          version: { $ref: 'emit.version' },
        },
      },
    ],
  });
  writeJson(join(dir, 'services/inventory/bindings/bindings.json'), {
    version: '1.0',
    graphSpecRef: '../graphs',
    pdmRef: '../../pdm',
    qsmRef: '../qsm',
    bindings: {
      reserveStock: {
        exposure: 'action',
        graph: 'reserveStock',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: { method: 'POST', path: '/reserve', parameters: [] },
      },
    },
  });
  writeJson(join(dir, 'workflows/workflows.json'), {
    workflowVersion: 1,
    definitions: [
      {
        id: 'orderFulfillment',
        bpmnFile: 'order-fulfillment.bpmn',
        processId: 'orderFulfillment',
      },
    ],
    messageStarts: [
      {
        id: 'orderPlaced',
        definition: 'orderFulfillment',
        messageName: 'OrderPlaced',
        event: {
          service: 'orders',
          aggregateType: 'Order',
          eventType: 'OrderPlace',
        },
        businessKey: '$event.data.id',
      },
    ],
    serviceTasks: [
      {
        definition: 'orderFulfillment',
        taskId: 'reserveStock',
        bindingRef: 'inventory.reserveStock',
      },
    ],
  });
  writeFileSync(
    join(dir, 'workflows/order-fulfillment.bpmn'),
    '<definitions id="orderFulfillment" />',
  );
  return dir;
}

describe('project workflows', () => {
  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('loads validated workflows into composed blueprint', async () => {
    const result = await loadComposedBlueprint(scaffoldProject());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.workflows?.definitions[0]?.id).toBe(
        'orderFulfillment',
      );
    }
  });

  it('rejects workflow definitions whose BPMN path is a directory', async () => {
    const dir = scaffoldProject();
    const bpmnPath = join(dir, 'workflows/order-fulfillment.bpmn');
    rmSync(bpmnPath);
    mkdirSync(bpmnPath);

    const result = await loadComposedBlueprint(dir);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([
        expect.objectContaining({
          code: 'BLUEPRINT_WORKFLOWS_INVALID',
          cause: expect.arrayContaining([
            expect.objectContaining({
              code: 'WORKFLOWS_XREF_BPMN_FILE_MISSING',
            }),
          ]),
        }),
      ]);
    }
  });
});
