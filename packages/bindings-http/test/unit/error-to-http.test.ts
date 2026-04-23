import { describe, it, expect } from 'vitest';
import { errorToHttp } from '../../src/runtime/error-to-http.js';

describe('errorToHttp', () => {
  it('maps COMMAND_GUARD_REJECTED to 422', () => {
    expect(errorToHttp('COMMAND_GUARD_REJECTED').status).toBe(422);
  });

  it('maps COMMAND_CONCURRENCY_CONFLICT to 409', () => {
    expect(errorToHttp('COMMAND_CONCURRENCY_CONFLICT').status).toBe(409);
  });

  it('maps COMMAND_NOT_FOUND to 500', () => {
    expect(errorToHttp('COMMAND_NOT_FOUND').status).toBe(500);
  });

  it('maps COMMAND_HANDLER_ERROR to 400', () => {
    expect(errorToHttp('COMMAND_HANDLER_ERROR').status).toBe(400);
  });

  it('maps COMMAND_HANDLER_THREW to 500', () => {
    expect(errorToHttp('COMMAND_HANDLER_THREW').status).toBe(500);
  });

  it('maps unknown codes to 500 and exposes the code', () => {
    const result = errorToHttp('SOME_UNKNOWN_CODE');
    expect(result.status).toBe(500);
    expect(result.exposeCode).toBe(true);
  });
});
