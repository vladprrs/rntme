import { describe, expect, it } from 'vitest';
import { VERSION, exampleHandlers } from '@rntme/module-skeleton';

describe('@rntme/module-skeleton public contract', () => {
  it('exports the package version marker from the built entrypoint', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('exports an echo handler with the expected shape from the built entrypoint', () => {
    expect(exampleHandlers).toEqual(
      expect.objectContaining({
        echo: expect.any(Function),
      }),
    );
    expect(exampleHandlers.echo('hello')).toBe('hello');
  });
});
