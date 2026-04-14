import { createPdmResolver, parsePdm, validatePdm } from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';

export function loadValidatedPdm(raw: unknown): ValidatedPdm {
  const p = parsePdm(raw);
  if (!p.ok) throw new Error(p.errors[0]?.message ?? 'parsePdm failed');
  const v = validatePdm(p.value);
  if (!v.ok) throw new Error(v.errors[0]?.message ?? 'validatePdm failed');
  return v.value;
}

export function loadValidatedQsm(raw: unknown, pdm: ValidatedPdm): ValidatedQsm {
  const p = parseQsm(raw);
  if (!p.ok) throw new Error(p.errors[0]?.message ?? 'parseQsm failed');
  const v = validateQsm(p.value, createPdmResolver(pdm));
  if (!v.ok) throw new Error(v.errors[0]?.message ?? 'validateQsm failed');
  return v.value;
}

export function loadValidatedPdmAndQsm(
  rawPdm: unknown,
  rawQsm: unknown,
): { pdm: ValidatedPdm; qsm: ValidatedQsm } {
  const pdm = loadValidatedPdm(rawPdm);
  const qsm = loadValidatedQsm(rawQsm, pdm);
  return { pdm, qsm };
}
