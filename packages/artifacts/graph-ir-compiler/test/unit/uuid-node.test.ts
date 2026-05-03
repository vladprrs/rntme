import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { UuidNodeSchema } from '../../src/canonical/uuid-node.js';
import { normalize } from '../../src/canonical/normalize.js';

describe('uuid node', () => {
  it('parses a valid uuid node spec', () => {
    expect(UuidNodeSchema.parse({ id: 'newId', type: 'uuid', config: {} })).toEqual({
      id: 'newId',
      type: 'uuid',
      config: {},
    });
  });

  it('rejects extra config keys', () => {
    expect(() =>
      UuidNodeSchema.parse({ id: 'x', type: 'uuid', config: { weird: true } }),
    ).toThrow();
  });
});

describe('uuid node in canonical form', () => {
  it('normalizes to kind uuid', () => {
    const result = normalize({
      version: '1.0-rc7',
      pdmRef: './pdm.json',
      qsmRef: './qsm.json',
      shapes: {},
      graphs: {
        testGraph: {
          id: 'testGraph',
          signature: {
            inputs: {},
            output: { type: 'row<CommandResult>', from: 'emit' },
          },
          nodes: [
            { id: 'newId', type: 'uuid', config: {} },
            {
              id: 'emit',
              type: 'emit',
              config: {
                aggregate: 'Note',
                aggregateId: { $node: 'newId' },
                transition: 'create',
                payload: {},
              },
            },
          ],
        },
      },
    });

    const graph = result.graphs.testGraph;
    expect(graph).toBeDefined();
    const uuidNode = graph!.nodes.find((n) => n.kind === 'uuid');
    expect(uuidNode).toEqual({ kind: 'uuid', id: 'newId', scope: expect.any(String) });
  });
});

describe('$node reference', () => {
  it('is accepted in emit.aggregateId when node exists', () => {
    const result = normalize({
      version: '1.0-rc7',
      pdmRef: './pdm.json',
      qsmRef: './qsm.json',
      shapes: {},
      graphs: {
        testGraph: {
          id: 'testGraph',
          signature: {
            inputs: {},
            output: { type: 'row<CommandResult>', from: 'emit' },
          },
          nodes: [
            { id: 'newId', type: 'uuid', config: {} },
            {
              id: 'emit',
              type: 'emit',
              config: {
                aggregate: 'Note',
                aggregateId: { $node: 'newId' },
                transition: 'create',
                payload: {},
              },
            },
          ],
        },
      },
    });

    const emitNode = result.graphs.testGraph!.nodes.find((n) => n.kind === 'emit') as {
      aggregateId: unknown;
    };
    expect(emitNode.aggregateId).toEqual({ $node: 'newId' });
  });
});

describe('uuid runtime', () => {
  it('generates a v4-like UUID string', () => {
    const uuid = randomUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});
