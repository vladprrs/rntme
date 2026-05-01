import type { PdmResolver } from '@rntme/pdm';
import type { QsmArtifact, ValidatedQsm } from '../types/artifact.js';
import type { Result } from '../types/result.js';
import { validateStructural } from './structural.js';
import { validateCrossRef } from './cross-ref.js';

export { validateStructural, validateCrossRef };

export function validateQsm(
  artifact: QsmArtifact,
  pdm: PdmResolver,
): Result<ValidatedQsm> {
  const s = validateStructural(artifact);
  if (!s.ok) return s;
  return validateCrossRef(s.value, pdm);
}
