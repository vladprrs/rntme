import { describe, expect, it } from 'vitest';
import { ERROR_CODES, err, isErr, isOk, ok } from '../../src/index.js';

describe('workflow result helpers', () => {
  it('construct and inspect ok/err results', () => {
    const good = ok({ value: 1 });
    expect(isOk(good)).toBe(true);
    expect(isErr(good)).toBe(false);

    const bad = err([
      {
        layer: 'parse',
        code: ERROR_CODES.WORKFLOWS_PARSE_SCHEMA_VIOLATION,
        message: 'bad',
      },
    ]);
    expect(isErr(bad)).toBe(true);
    expect(bad.errors[0]?.code).toBe('WORKFLOWS_PARSE_SCHEMA_VIOLATION');
  });
});
