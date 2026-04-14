import { describe, it, expect } from 'vitest';
import { loadValidatedPdmAndQsm } from '../../load-validated.js';
import pdm from '../../e2e/fixtures/commerce.pdm.json' with { type: 'json' };
import qsm from '../../e2e/fixtures/commerce.qsm.json' with { type: 'json' };

describe('QSM', () => {
  it('accepts the commerce fixture', () => {
    expect(() => loadValidatedPdmAndQsm(pdm, qsm)).not.toThrow();
  });
});
