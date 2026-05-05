import type { CodeCommandHandlerMap } from '@rntme/contracts-handlers-v1';

export const exampleHandlers: CodeCommandHandlerMap = {
  echo: async (ctx, _input) => ({
    ok: true,
    value: {
      aggregateId: 'echo',
      version: 0,
      eventIds: [],
      commandId: ctx.correlation.commandId,
      correlationId: ctx.correlation.correlationId,
      result: { echo: true },
    },
  }),
};
