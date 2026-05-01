import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  BindingsRuntimeError,
  validationErrorBody,
  invalidBodyErrorBody,
  internalErrorBody,
} from '../../src/errors.js';

describe('BindingsRuntimeError', () => {
  it('carries aggregated errors', () => {
    const err = new BindingsRuntimeError([
      { bindingId: 'a', graphId: 'g1', cause: new Error('x') },
      { bindingId: 'b', graphId: 'g2', cause: { code: 'CompileFail' } },
    ]);
    expect(err.name).toBe('BindingsRuntimeError');
    expect(err.errors).toHaveLength(2);
    expect(err.errors[0]!.graphId).toBe('g1');
    expect(err.message).toMatch(/2 binding/);
  });
});

describe('validationErrorBody', () => {
  it('converts ZodError into { code, message, details }', () => {
    const schema = z.object({ a: z.coerce.number().int() });
    const r = schema.safeParse({ a: 'nope' });
    if (r.success) throw new Error('expected fail');
    const body = validationErrorBody(r.error);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('Invalid request parameters');
    expect(body.details).toBeInstanceOf(Array);
    expect(body.details[0]).toMatchObject({ path: 'a' });
    expect(typeof body.details[0]!.code).toBe('string');
    expect(typeof body.details[0]!.message).toBe('string');
  });
});

describe('invalidBodyErrorBody', () => {
  it('returns fixed shape without details', () => {
    const body = invalidBodyErrorBody('malformed JSON');
    expect(body).toEqual({ code: 'INVALID_BODY', message: 'malformed JSON' });
  });
});

describe('internalErrorBody', () => {
  it('never leaks message or stack', () => {
    const body = internalErrorBody();
    expect(body).toEqual({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
  });
});
