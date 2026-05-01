import { createPdmResolver, parsePdm, validatePdm } from '@rntme/pdm';
import type { ValidatedPdm } from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import type { ValidatedQsm } from '@rntme/qsm';
import pdm from '../e2e/fixtures/commerce.pdm.json' with { type: 'json' };
import qsm from '../e2e/fixtures/commerce.qsm.json' with { type: 'json' };

function unwrap<T>(r: { ok: true; value: T } | { ok: false; errors?: { message?: string }[] }, label: string): T {
  if (!r.ok) {
    const msg = r.errors?.map((e) => e.message).join('; ') ?? 'unknown error';
    throw new Error(`${label}: ${msg}`);
  }
  return r.value;
}

const pdmParsed = unwrap(parsePdm(pdm), 'parsePdm');
export const commercePdm: ValidatedPdm = unwrap(validatePdm(pdmParsed), 'validatePdm');
const qsmParsed = unwrap(parseQsm(qsm), 'parseQsm');
export const commerceQsm: ValidatedQsm = unwrap(
  validateQsm(qsmParsed, createPdmResolver(commercePdm)),
  'validateQsm',
);
