import { describe, expect, it } from 'bun:test';
import { VERSION, exampleHandlers } from '../../src/index.js';
import type { CommandExecutionContext } from '@rntme/contracts-handlers-v1';

describe('@rntme/module-scaffold smoke', () => {
  it('exports the package version marker', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('exports an echo handler with the expected shape', async () => {
    expect(exampleHandlers).toEqual(
      expect.objectContaining({
        echo: expect.any(Function),
      }),
    );
    const handler = exampleHandlers.echo;
    if (!handler) throw new Error('echo handler missing');
    const ctx: CommandExecutionContext = {
      now: () => '2026-04-19T00:00:00.000Z',
      nextId: () => 'id-1',
      correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
    };
    const out = await handler(ctx, { message: 'hello' });
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
