import { describe, expect, it } from 'bun:test';

import { runPollOnce } from '../../src/poll-loop.js';

describe('runPollOnce', () => {
  it('dispatches each locked task to the matching native handler', async () => {
    const fetched: string[] = [];
    const completed: Array<{ id: string; vars: Record<string, unknown> }> = [];
    const handlerCalls: Array<{ key: string; input: Record<string, unknown> }> = [];
    const handlers = new Map([
      [
        'd1.t1',
        async (input: Readonly<Record<string, unknown>>) => {
          handlerCalls.push({ key: 'd1.t1', input: { ...input } });
          return { ok: true };
        },
      ],
    ]);

    await runPollOnce({
      manifest: {
        workflowVersion: 1,
        definitions: [{ id: 'd1', bpmnFile: 'd1.bpmn', processId: 'p1' }],
        messageStarts: [],
        serviceTasks: [],
        nativeTasks: [
          {
            definition: 'd1',
            taskId: 't1',
            handler: { module: 'm', export: 'h' },
            resultVariable: 'r',
          },
        ],
      },
      operaton: {
        startProcess: async () => ({ processInstanceId: 'pi-1' }),
        fetchAndLock: async () => {
          fetched.push('fetched');
          return [
            {
              id: 'task-1',
              taskId: 't1',
              processInstanceId: 'pi-1',
              activityInstanceId: 'a1',
              variables: {},
            },
          ];
        },
        completeTask: async (id: string, vars: Record<string, unknown>) => {
          completed.push({ id, vars });
        },
        failTask: async () => {
          throw new Error('should not fail');
        },
        deployDefinitions: async () => undefined,
      } as never,
      nativeHandlers: handlers,
      definitionByProcessInstance: new Map([['pi-1', 'd1']]),
    });

    expect(fetched).toHaveLength(1);
    expect(handlerCalls).toEqual([{ key: 'd1.t1', input: {} }]);
    expect(completed).toEqual([{ id: 'task-1', vars: { r: { ok: true } } }]);
  });
});
