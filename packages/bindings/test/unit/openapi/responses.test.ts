import { describe, it, expect } from 'vitest';
import { successResponse } from '../../../src/openapi/responses.js';

describe('successResponse', () => {
  it('produces 200 with array of $ref for rowset output', () => {
    const resp = successResponse('CategorySalesRow');
    expect(resp).toEqual({
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
});
