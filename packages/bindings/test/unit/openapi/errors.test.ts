import { describe, it, expect } from 'vitest';
import { ERROR_RESPONSE_SCHEMA_NAME, errorResponseSchema, standardErrorResponses } from '../../../src/openapi/errors.js';

describe('standard error responses', () => {
  it('exposes the schema name constant', () => {
    expect(ERROR_RESPONSE_SCHEMA_NAME).toBe('ErrorResponse');
  });

  it('builds ErrorResponse schema', () => {
    expect(errorResponseSchema()).toEqual({
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        details: {},
      },
    });
  });

  it('builds 400/422/500 referencing ErrorResponse', () => {
    const out = standardErrorResponses();
    expect(Object.keys(out)).toEqual(['400', '422', '500']);
    expect(out['400']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/ErrorResponse',
    });
    expect(out['422']?.description).toBe('Semantic error');
    expect(out['500']?.description).toBe('Internal error');
  });
});
