import { describe, it, expect, jest } from 'bun:test';
import { makeGrpcHandler, type HandlerDeps } from '../../src/server/handler.js';

describe('makeGrpcHandler', () => {
  it('invokes the operation executor with entry.graph, not bindingId', async () => {
    const execute = jest.fn().mockResolvedValue({
      ok: true,
      value: {
        value: { ok: true },
        metadata: { eventIds: [], commandId: 'c', correlationId: 'r' },
      },
    });

    const deps = {
      operationExecutor: { execute },
      eventStore: {} as never,
      qsmDb: {} as never,
      now: () => '2026-04-23T00:00:00.000Z',
      nextId: () => 'id-1',
    } as unknown as HandlerDeps;

    const resolved = {
      entry: {
        exposure: 'action',
        graph: 'createOrder',
        target: { engine: 'sqlite', dialect: 'rntme' },
        http: { method: 'POST', path: '/orders', parameters: [] },
      },
      signature: {
        id: 'createOrder',
        inputs: {},
        output: { from: 'out', type: { kind: 'row', shape: 'CreateOrderResult' } },
        effects: {
          localReads: true,
          localEmits: [{ aggregate: 'Order', transition: 'create', eventType: 'OrderCreated' }],
          calls: [],
          waits: false,
        },
      },
      outputShape: { fields: [] },
    } as never;

    const handler = makeGrpcHandler('OrdersService_CreateOrder', resolved, deps);
    const call = { request: {}, metadata: { getMap: () => ({}) } } as never;

    await new Promise<void>((resolve) => {
      handler(call, () => resolve());
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[0].operationName).toBe('createOrder');
  });

  it('converts snake_case proto fields to camelCase graph inputs', async () => {
    const execute = jest.fn().mockResolvedValue({
      ok: true,
      value: {
        value: { ok: true },
        metadata: { eventIds: [], commandId: 'c', correlationId: 'r' },
      },
    });

    const deps = {
      operationExecutor: { execute },
      eventStore: {} as never,
      qsmDb: {} as never,
      now: () => '2026-04-23T00:00:00.000Z',
      nextId: () => 'id-1',
    } as unknown as HandlerDeps;

    const resolved = {
      entry: {
        exposure: 'action',
        graph: 'createOrder',
        target: { engine: 'sqlite', dialect: 'rntme' },
        http: { method: 'POST', path: '/orders', parameters: [] },
      },
      signature: {
        id: 'createOrder',
        inputs: {
          customerId: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
          orderLineItems: { type: { kind: 'list', element: 'string' }, mode: 'required' },
        },
        output: { from: 'out', type: { kind: 'row', shape: 'CreateOrderResult' } },
        effects: {
          localReads: true,
          localEmits: [{ aggregate: 'Order', transition: 'create', eventType: 'OrderCreated' }],
          calls: [],
          waits: false,
        },
      },
      outputShape: { fields: [] },
    } as never;

    const handler = makeGrpcHandler('binding-id', resolved, deps);
    const call = {
      request: { customer_id: 'cust-1', order_line_items: ['S'] },
      metadata: { getMap: () => ({}) },
    } as never;

    await new Promise<void>((resolve) => {
      handler(call, () => resolve());
    });

    expect(execute.mock.calls[0]?.[0].inputs).toEqual({
      customerId: 'cust-1',
      orderLineItems: ['S'],
    });
  });
});
