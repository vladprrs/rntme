import type { BindingArtifact, ValidatedBindings } from '../types/artifact.js';
import type { BindingResolvers } from '../types/resolvers.js';
import type { Result } from '../types/result.js';
import { validateStructural } from './structural.js';
import { validateReferences } from './references.js';
import { validateConsistency } from './consistency.js';

export function validateBindings(
  artifact: BindingArtifact,
  resolvers: BindingResolvers,
): Result<ValidatedBindings> {
  const s = validateStructural(artifact);
  if (!s.ok) return s;
  const r = validateReferences(s.value, resolvers);
  if (!r.ok) return r;
  return validateConsistency(r.value);
}

export { validateStructural } from './structural.js';
export { validateReferences } from './references.js';
export { validateConsistency } from './consistency.js';
