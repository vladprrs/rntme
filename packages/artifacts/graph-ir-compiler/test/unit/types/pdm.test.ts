import { describe, it, expect } from 'vitest';
import { parsePdm } from '@rntme/pdm';
import pdm from '../../e2e/fixtures/commerce.pdm.json' with { type: 'json' };

describe('PDM', () => {
  it('accepts the commerce fixture', () => {
    expect(parsePdm(pdm).ok).toBe(true);
  });

  it('rejects entity without a table', () => {
    const bad = { entities: { X: { fields: {}, relations: {}, keys: [] } } };
    expect(parsePdm(bad).ok).toBe(false);
  });
});
