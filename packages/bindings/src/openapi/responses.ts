import type { ResponseObject } from '../types/openapi.js';

export type SuccessResponseKind = 'row' | 'rowset';

export function successResponse(shapeName: string, kind: SuccessResponseKind): ResponseObject {
  const ref = { $ref: `#/components/schemas/${shapeName}` };
  return {
    description: 'OK',
    content: {
      'application/json': {
        schema: kind === 'row' ? ref : { type: 'array', items: ref },
      },
    },
  };
}
