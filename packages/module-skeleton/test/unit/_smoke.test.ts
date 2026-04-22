import { describe, expect, it } from 'vitest';
import { VERSION, exampleHandlers } from '@rntme/module-skeleton';

describe('@rntme/module-skeleton smoke', () => {
  it('exports the package version marker', () => {
    expect(VERSION).toBe('0.0.0');
  });

  it('exports an echo handler with the expected shape', () => {
    expect(exampleHandlers).toEqual(
      expect.objectContaining({
        echo: expect.any(Function),
      }),
    );
    expect(exampleHandlers.echo('hello')).toBe('hello');
  });
});
