import { describe, expect, it } from 'vitest';
import { VERSION, exampleHandlers } from '@rntme/module-skeleton';

describe('@rntme/module-skeleton public contract', () => {
  it('exports the package version marker from the built entrypoint', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('exports an echo handler with the expected shape from the built entrypoint', async () => {
    expect(exampleHandlers).toEqual(
      expect.objectContaining({
        echo: expect.any(Function),
      }),
    );
    const out = await exampleHandlers.echo(
      { correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null } } as any,
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
