import type { JsonSchema, ResponseObject } from '../types/openapi.js';

export const ERROR_RESPONSE_SCHEMA_NAME = 'ErrorResponse';

export function errorResponseSchema(): JsonSchema {
  return {
    type: 'object',
    required: ['code', 'message'],
    properties: {
      code: { type: 'string' },
      message: { type: 'string' },
      details: {},
    },
  };
}

function errorResponse(description: string): ResponseObject {
  return {
    description,
    content: {
      'application/json': {
        schema: { $ref: `#/components/schemas/${ERROR_RESPONSE_SCHEMA_NAME}` },
      },
    },
  };
}

export function standardErrorResponses(): Record<'400' | '422' | '500', ResponseObject> {
  return {
    '400': errorResponse('Validation error'),
    '422': errorResponse('Semantic error'),
    '500': errorResponse('Internal error'),
  };
}
