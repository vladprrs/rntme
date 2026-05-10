import { describe, it, expect } from 'bun:test';
import { successResponse } from '../../../src/openapi/responses.js';

describe('successResponse', () => {
  it('emits an array schema for rowset outputs', () => {
    const res = successResponse('CategorySalesRow', 'rowset');
    expect(res).toEqual({
      description: 'OK',
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: { $ref: '#/components/schemas/CategorySalesRow' },
          },
        },
      },
    });
  });

  it('emits a single-object schema for row outputs', () => {
    const res = successResponse('CommandResult', 'row');
    expect(res).toEqual({
      description: 'OK',
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CommandResult' },
        },
      },
    });
  });
});
