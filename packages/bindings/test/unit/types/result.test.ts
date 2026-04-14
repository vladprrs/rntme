import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, ERROR_CODES } from '../../../src/types/result.js';

describe('result', () => {
  it('ok wraps a value', () => {
    const r = ok(42);
    expect(r.ok).toBe(true);
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (r.ok) expect(r.value).toBe(42);
  });

  it('err wraps errors', () => {
    const r = err([
      { layer: 'parse', code: 'BINDINGS_PARSE_SCHEMA_VIOLATION', message: 'boom' },
    ]);
    expect(r.ok).toBe(false);
    expect(isErr(r)).toBe(true);
    if (!r.ok) expect(r.errors).toHaveLength(1);
  });

  it('ERROR_CODES contains every documented code', () => {
    const expected = [
      'BINDINGS_PARSE_SCHEMA_VIOLATION',
      'BINDINGS_DUPLICATE_BINDING_ID',
      'BINDINGS_DUPLICATE_METHOD_PATH',
      'BINDINGS_DUPLICATE_PARAM_NAME',
      'BINDINGS_DUPLICATE_BIND_TO',
      'BINDINGS_PATH_PLACEHOLDER_MISMATCH',
      'BINDINGS_BODY_ON_GET',
      'BINDINGS_PATH_NOT_REQUIRED',
      'BINDINGS_UNRESOLVED_GRAPH',
      'BINDINGS_UNKNOWN_BIND_TO',
      'BINDINGS_UNRESOLVED_OUTPUT_SHAPE',
      'BINDINGS_GRAPH_HAS_ROOT_INPUT',
      'BINDINGS_UNSUPPORTED_OUTPUT_TYPE',
      'BINDINGS_REQUIRED_MISMATCH',
      'BINDINGS_TYPE_LOCATION_INVALID',
      'BINDINGS_UNBOUND_INPUT',
      'BINDINGS_INTERNAL',
    ];
    for (const code of expected) {
      expect(ERROR_CODES[code as keyof typeof ERROR_CODES]).toBe(code);
    }
  });
});
