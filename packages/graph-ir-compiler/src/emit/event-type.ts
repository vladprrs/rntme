import { deriveEventTypes } from '@rntme/pdm';
import type { ValidatedPdm } from '@rntme/pdm';

function pascalCase(s: string): string {
  if (s.length === 0) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function deriveEventTypeName(aggregate: string, transition: string): string {
  return pascalCase(aggregate) + pascalCase(transition);
}

export function lookupEventTypeSpec(pdm: ValidatedPdm, aggregate: string, transition: string) {
  const all = deriveEventTypes(pdm);
  return all.find((e) => e.aggregateType === aggregate && e.transition === transition);
}
