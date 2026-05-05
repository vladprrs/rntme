import { describe, expect, it } from 'vitest';
import { VERSION, exampleHandlers } from '../../src/index.js';
import type { CommandExecutionContext } from '@rntme/contracts-handlers-v1';

describe('@rntme/module-skeleton smoke', () => {
  it('exports the package version marker', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('exports an echo handler with the expected shape', async () => {
    expect(exampleHandlers).toEqual(
      expect.objectContaining({
        echo: expect.any(Function),
      }),
    );
    const handler = (exampleHandlers as unknown as Record<string, (ctx: CommandExecutionContext, input: unknown) => Promise<unknown>>).echo;
    if (!handler) throw new Error('echo handler missing');
    const out = await handler(
      { correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null } } as unknown as CommandExecutionContext,
      { message: 'hello' },
    );
    expect(out).toEqual(
      expect.objectContaining({
        ok: true,
        value: expect.objectContaining({
          aggregateId: 'echo',
          eventIds: [],
        }),
      }),
    );
  });
});
