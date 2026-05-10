import { describe, expect, it } from 'bun:test';
import { ERROR_CODES, err, isErr, isOk, ok } from '../../src/index.js';

describe('@rntme/init result helpers', () => {
  it('exports shared result helpers and stable error codes', () => {
    const success = ok({ value: 1 });
    const failure = err([
      {
        layer: 'parse',
        code: ERROR_CODES.INIT_PARSE_SCHEMA_VIOLATION,
        message: 'bad init artifact',
      },
    ]);

    expect(isOk(success)).toBe(true);
    expect(isErr(failure)).toBe(true);
    expect(ERROR_CODES.INIT_XREF_SEED_INVALID).toBe('INIT_XREF_SEED_INVALID');
  });
});
