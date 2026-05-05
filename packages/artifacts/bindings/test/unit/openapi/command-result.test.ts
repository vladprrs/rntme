import { describe, it, expect } from 'vitest';
import {
  COMMAND_RESULT_SHAPE_NAME,
  commandResultShape,
  commandResultJsonSchema,
} from '../../../src/openapi/command-result.js';

describe('CommandResult built-in', () => {
  it('uses the reserved name "CommandResult"', () => {
    expect(COMMAND_RESULT_SHAPE_NAME).toBe('CommandResult');
    expect(commandResultShape().name).toBe('CommandResult');
  });

  it('declares aggregateId / version / eventIds / result with correct nullability', () => {
    const shape = commandResultShape();
    expect(shape.fields.aggregateId).toEqual({
      type: { kind: 'scalar', primitive: 'string' },
      nullable: false,
    });
    expect(shape.fields.version).toEqual({
      type: { kind: 'scalar', primitive: 'integer' },
      nullable: false,
    });
    expect(shape.fields.eventIds).toEqual({
      type: { kind: 'array', element: 'string' },
      nullable: false,
    });
    expect(shape.fields.result).toEqual({
      type: { kind: 'json' },
      nullable: true,
    });
  });

  it('emits a stable JSON schema', () => {
    expect(commandResultJsonSchema()).toEqual({
      type: 'object',
      required: ['aggregateId', 'version', 'eventIds'],
      properties: {
        aggregateId: { type: 'string' },
        version: { type: 'integer' },
        eventIds: { type: 'array', items: { type: 'string' } },
        result: {},
      },
    });
  });
});
