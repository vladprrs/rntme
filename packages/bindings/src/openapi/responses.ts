import type { ResponseObject } from '../types/openapi.js';

export function successResponse(shapeName: string): ResponseObject {
  return {
    description: 'OK',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: { $ref: `#/components/schemas/${shapeName}` },
        },
      },
    },
  };
}
