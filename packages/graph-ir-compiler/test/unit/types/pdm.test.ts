import { describe, it, expect } from 'vitest';
import { PdmSchema } from '../../../src/types/pdm.js';
import pdm from '../../e2e/fixtures/commerce.pdm.json' with { type: 'json' };

describe('PDM', () => {
  it('accepts the commerce fixture', () => {
    expect(() => PdmSchema.parse(pdm)).not.toThrow();
  });

  it('rejects entity without a table', () => {
    const bad = { entities: { X: { fields: {}, relations: {}, keys: [] } } };
    expect(() => PdmSchema.parse(bad)).toThrow();
  });
});
