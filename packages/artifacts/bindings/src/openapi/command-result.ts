import type { ResolvedShape } from '../types/resolvers.js';
import type { JsonSchema } from '../types/openapi.js';

export const COMMAND_RESULT_SHAPE_NAME = 'CommandResult';

export function commandResultShape(): ResolvedShape {
  return {
    name: COMMAND_RESULT_SHAPE_NAME,
    origin: 'custom',
    fields: {
      aggregateId: {
        type: { kind: 'scalar', primitive: 'string' },
        nullable: false,
      },
      version: {
        type: { kind: 'scalar', primitive: 'integer' },
        nullable: false,
      },
      eventIds: {
        type: { kind: 'array', element: 'string' },
        nullable: false,
      },
      result: {
        type: { kind: 'json' },
        nullable: true,
      },
    },
  };
}

export function commandResultJsonSchema(): JsonSchema {
  return {
    type: 'object',
    required: ['aggregateId', 'version', 'eventIds'],
    properties: {
      aggregateId: { type: 'string' },
      version: { type: 'integer' },
      eventIds: { type: 'array', items: { type: 'string' } },
      result: {},
    },
  };
}
