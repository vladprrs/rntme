import { describe, it, expect } from 'vitest';
import { parsePdm } from '@rntme/pdm';
import { loadValidatedPdm } from '../../load-validated.js';
import pdm from '../../e2e/fixtures/commerce.pdm.json' with { type: 'json' };

describe('PDM', () => {
  it('accepts the commerce fixture', () => {
    expect(() => loadValidatedPdm(pdm)).not.toThrow();
  });

  it('rejects entity without a table', () => {
    const bad = { entities: { X: { fields: {}, relations: {}, keys: [] } } };
    const p = parsePdm(bad);
    expect(p.ok).toBe(false);
  });
});
