import { describe, it, expect } from 'bun:test';
import { createPdmResolver, parsePdm, validatePdm } from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import pdm from '../../e2e/fixtures/commerce.pdm.json' with { type: 'json' };
import qsm from '../../e2e/fixtures/commerce.qsm.json' with { type: 'json' };

describe('QSM', () => {
  it('accepts the commerce fixture against validated commerce PDM', () => {
    const pdmParsed = parsePdm(pdm);
    expect(pdmParsed.ok).toBe(true);
    if (!pdmParsed.ok) return;
    const pdmVal = validatePdm(pdmParsed.value);
    expect(pdmVal.ok).toBe(true);
    if (!pdmVal.ok) return;

    const qsmParsed = parseQsm(qsm);
    expect(qsmParsed.ok).toBe(true);
    if (!qsmParsed.ok) return;
    const qsmVal = validateQsm(qsmParsed.value, createPdmResolver(pdmVal.value));
    expect(qsmVal.ok).toBe(true);
  });
});
