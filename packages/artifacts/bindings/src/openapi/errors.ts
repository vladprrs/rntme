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

export function conflictResponse(): ResponseObject {
  return errorResponse('Concurrency conflict. Retry the command.');
}

export type StandardErrorOptions = { commandErrors?: boolean };

export function standardErrorResponses(
  options: StandardErrorOptions = {},
): Record<string, ResponseObject> {
  const base: Record<string, ResponseObject> = {
    '400': errorResponse('Validation error'),
    '422': errorResponse('Semantic error'),
    '500': errorResponse('Internal error'),
  };
  if (options.commandErrors === true) {
    base['409'] = conflictResponse();
  }
  return base;
}
