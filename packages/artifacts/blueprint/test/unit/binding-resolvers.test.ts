import { SCALAR_PRIMITIVES } from '@rntme/bindings';
import type { PdmResolver } from '@rntme/pdm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'bun:test';
import { createServiceBindingResolvers } from '../../src/compose/binding-resolvers.js';
import type { ServiceGraphSpec } from '../../src/types/artifact.js';
import { ERROR_CODES } from '../../src/types/result.js';

const here = dirname(fileURLToPath(import.meta.url));

const emptyPdmResolver: PdmResolver = {
  listEntities: () => [],
  resolveEntity: () => null,
  resolveField: () => null,
  resolveStateMachine: () => null,
  resolveTransition: () => null,
};

function graphSpecWithScalar(primitive: string): ServiceGraphSpec {
  return {
    version: '1.0-rc7',
    shapes: {
      ScalarRow: {
        fields: {
          value: { type: primitive, nullable: false },
          values: { type: `array<${primitive}>`, nullable: true },
        },
      },
    },
    graphs: {
      readScalar: {
        id: 'readScalar',
        signature: {
          inputs: {
            value: { type: primitive, mode: 'required' },
          },
          output: { type: 'rowset<ScalarRow>', from: 'rows' },
        },
        nodes: [],
      },
    },
  };
}

describe('createServiceBindingResolvers scalar primitives', () => {
  it('delegates scalar validation to bindings without a local scalar set', () => {
    const source = readFileSync(
      join(here, '../../src/compose/binding-resolvers.ts'),
      'utf8',
    );

    expect(source).toContain('isScalarPrimitive');
    expect(source).not.toContain('const SCALARS');
    expect(source).not.toContain('new Set([');
  });

  it.each([...SCALAR_PRIMITIVES])(
    'accepts bindings scalar primitive %s in shapes and graph inputs',
    (primitive) => {
      const result = createServiceBindingResolvers({
        serviceSlug: 'catalog',
        graphSpec: graphSpecWithScalar(primitive),
        pdmResolver: emptyPdmResolver,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const shape = result.value.resolveShape('ScalarRow');
      expect(shape?.fields.value).toEqual({
        type: { kind: 'scalar', primitive },
        nullable: false,
      });
      expect(shape?.fields.values).toEqual({
        type: { kind: 'array', element: primitive },
        nullable: true,
      });

      const signature = result.value.resolveGraphSignature('readScalar');
      expect(signature?.inputs.value?.type).toEqual({
        kind: 'scalar',
        primitive,
      });
    },
  );

  it('rejects unsupported scalar primitives with a service graph error', () => {
    const result = createServiceBindingResolvers({
      serviceSlug: 'catalog',
      graphSpec: graphSpecWithScalar('uuid'),
      pdmResolver: emptyPdmResolver,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({
      layer: 'service',
      code: ERROR_CODES.BLUEPRINT_SERVICE_GRAPHS_INVALID,
      path: 'services/catalog/graphs',
    });
    expect(result.errors[0]?.message).toContain('uuid');
  });
});
