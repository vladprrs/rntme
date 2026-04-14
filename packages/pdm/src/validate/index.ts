import type { PdmArtifact, ValidatedPdm } from '../types/artifact.js';
import type { Result } from '../types/result.js';
import { validateStructural } from './structural.js';
import { validateStateMachine } from './state-machine.js';

export { validateStructural, validateStateMachine };

export function validatePdm(artifact: PdmArtifact): Result<ValidatedPdm> {
  const s = validateStructural(artifact);
  if (!s.ok) return s;
  return validateStateMachine(s.value);
}
