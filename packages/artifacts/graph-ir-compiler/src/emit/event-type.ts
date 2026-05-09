import { deriveEventTypes } from '@rntme/pdm';
import type { ValidatedPdm } from '@rntme/pdm';
import { pascalCase } from '../types/strings.js';

export function deriveEventTypeName(aggregate: string, transition: string): string {
  return pascalCase(aggregate) + pascalCase(transition);
}

export function lookupEventTypeSpec(pdm: ValidatedPdm, aggregate: string, transition: string) {
  const all = deriveEventTypes(pdm);
  return all.find((e) => e.aggregateType === aggregate && e.transition === transition);
}
