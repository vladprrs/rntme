import { describe, expect, it } from 'bun:test';

import { resolveNativeHandlers } from '../../src/native-handlers.js';

describe('resolveNativeHandlers', () => {
  it('imports each handler module export and indexes by definition+taskId', async () => {
    const fakeModule = { sampleHandler: async (input: unknown) => ({ echoed: input }) };
    const importer = async (mod: string) => {
      if (mod === 'fake-mod') return fakeModule;
      throw new Error(`unexpected import "${mod}"`);
    };

    const handlers = await resolveNativeHandlers({
      manifest: {
        workflowVersion: 1,
        definitions: [],
        messageStarts: [],
        serviceTasks: [],
        nativeTasks: [
          { definition: 'def-1', taskId: 'task-a', handler: { module: 'fake-mod', export: 'sampleHandler' } },
        ],
      },
      importModule: importer,
    });

    expect(handlers.size).toBe(1);
    const fn = handlers.get('def-1.task-a');
    expect(fn).toBeDefined();
    const result = await fn!({ greeting: 'hello' }, {});
    expect(result).toEqual({ echoed: { greeting: 'hello' } });
  });

  it('throws WORKFLOW_NATIVE_HANDLER_MISSING_EXPORT when export is missing', async () => {
    const importer = async () => ({}) as Record<string, unknown>;
    await expect(
      resolveNativeHandlers({
        manifest: {
          workflowVersion: 1,
          definitions: [],
          messageStarts: [],
          serviceTasks: [],
          nativeTasks: [
            { definition: 'd', taskId: 't', handler: { module: 'm', export: 'missing' } },
          ],
        },
        importModule: importer,
      }),
    ).rejects.toMatchObject({ code: 'WORKFLOW_NATIVE_HANDLER_MISSING_EXPORT' });
  });
});
