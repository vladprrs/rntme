import { describe, expect, it } from 'vitest';
import { createOperatonRestClient } from '../../src/operaton-rest.js';

describe('createOperatonRestClient', () => {
  it('deploys BPMN definitions through deployment/create', async () => {
    const calls: Array<{ url: string; method: string | undefined }> = [];
    const client = createOperatonRestClient({
      baseUrl: 'http://operaton:8080/engine-rest',
      workerId: 'worker-1',
      topics: ['reserveStock'],
      fetch: async (url, init) => {
        calls.push({ url: String(url), method: init?.method });
        return new globalThis.Response('{}', { status: 200 });
      },
    });

    await client.deployDefinitions({ 'order-fulfillment.bpmn': '<definitions />' });

    expect(calls).toEqual([{ url: 'http://operaton:8080/engine-rest/deployment/create', method: 'POST' }]);
  });

  it('correlates message starts and returns the process instance id', async () => {
    const bodies: unknown[] = [];
    const client = createOperatonRestClient({
      baseUrl: 'http://operaton:8080/engine-rest',
      workerId: 'worker-1',
      topics: ['reserveStock'],
      fetch: async (_url, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return new globalThis.Response(JSON.stringify([{ processInstance: { id: 'proc_1' } }]), { status: 200 });
      },
    });

    const result = await client.startProcess({
      processId: 'orderFulfillment',
      messageName: 'OrderPlaced',
      businessKey: 'ord_1',
      variables: { orderId: 'ord_1', quantity: 1 },
    });

    expect(result).toEqual({ processInstanceId: 'proc_1' });
    expect(bodies[0]).toMatchObject({
      messageName: 'OrderPlaced',
      businessKey: 'ord_1',
      resultEnabled: true,
      processVariables: {
        orderId: { value: 'ord_1', type: 'String' },
        quantity: { value: 1, type: 'Integer' },
      },
    });
  });

  it('fetches, completes, and fails external tasks with the configured worker id', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    const client = createOperatonRestClient({
      baseUrl: 'http://operaton:8080/engine-rest',
      workerId: 'worker-1',
      topics: ['reserveStock'],
      fetch: async (url, init) => {
        calls.push({ url: String(url), body: init?.body === undefined ? null : JSON.parse(String(init.body)) });
        if (String(url).endsWith('/external-task/fetchAndLock')) {
          return new globalThis.Response(JSON.stringify([
            {
              id: 'task_1',
              activityId: 'reserveStock',
              processInstanceId: 'proc_1',
              activityInstanceId: 'act_1',
              variables: { orderId: { value: 'ord_1' } },
            },
          ]), { status: 200 });
        }
        return new globalThis.Response('{}', { status: 200 });
      },
    });

    expect(await client.fetchAndLock()).toEqual([
      {
        id: 'task_1',
        taskId: 'reserveStock',
        processInstanceId: 'proc_1',
        activityInstanceId: 'act_1',
        variables: { orderId: 'ord_1' },
      },
    ]);
    await client.completeTask('task_1', { reservation: { reserved: true } });
    await client.failTask('task_1', 'inventory unavailable');

    expect(calls.map((call) => call.url)).toEqual([
      'http://operaton:8080/engine-rest/external-task/fetchAndLock',
      'http://operaton:8080/engine-rest/external-task/task_1/complete',
      'http://operaton:8080/engine-rest/external-task/task_1/failure',
    ]);
  });
});
