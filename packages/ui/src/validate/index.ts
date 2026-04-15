import { parseUiArtifact } from '../parse/parse.js';
import { validateStructural } from './structural.js';
import { validateReferences } from './references.js';
import { validateConsistency } from './consistency.js';
import type { UiResolvers } from '../types/resolvers.js';
import type { ValidatedUiArtifact } from '../types/artifact.js';
import type { Result } from '../types/result.js';

export function validateUi(raw: unknown, resolvers: UiResolvers): Result<ValidatedUiArtifact> {
  const p = parseUiArtifact(raw);
  if (!p.ok) return p;
  const s = validateStructural(p.value);
  if (!s.ok) return s;
  const r = validateReferences(s.value, resolvers);
  if (!r.ok) return r;
  return validateConsistency(r.value, resolvers);
}
