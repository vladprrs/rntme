import { describe, it, expect } from 'vitest';
import {
  conflictResponse,
  ERROR_RESPONSE_SCHEMA_NAME,
  errorResponseSchema,
  standardErrorResponses,
} from '../../../src/openapi/errors.js';

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
    expect(Object.keys(out).sort()).toEqual(['400', '422', '500']);
    expect(out['400']?.content?.['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/ErrorResponse',
    });
    expect(out['422']?.description).toBe('Semantic error');
    expect(out['500']?.description).toBe('Internal error');
  });

  it('emits a 409 Conflict response for commands', () => {
    expect(conflictResponse()).toEqual({
      description: 'Concurrency conflict. Retry the command.',
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${ERROR_RESPONSE_SCHEMA_NAME}` },
        },
      },
    });
  });

  it('includes 409 when commandErrors=true', () => {
    const r = standardErrorResponses({ commandErrors: true });
    expect(Object.keys(r).sort()).toEqual(['400', '409', '422', '500']);
  });

  it('omits 409 by default', () => {
    const r = standardErrorResponses();
    expect(Object.keys(r).sort()).toEqual(['400', '422', '500']);
  });
});
