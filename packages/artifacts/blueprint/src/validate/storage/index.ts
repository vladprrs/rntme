import { isOk, ok, type Result } from '../../types/result.js';
import {
  brandStorageJson,
  type ValidatedStorageJson,
} from '../../types/storage-json.js';
import { validateStorageJsonConsistency } from './consistency.js';
import { parseStorageJson } from './parse.js';
import {
  validateStorageJsonReferences,
  type PdmShape,
} from './references.js';
import { validateStorageJsonStructural } from './structural.js';

export type { PdmShape } from './references.js';

export function validateStorageJson(
  text: string,
  pdm: PdmShape,
): Result<ValidatedStorageJson> {
  const parsed = parseStorageJson(text);
  if (!isOk(parsed)) return parsed;

  const structural = validateStorageJsonStructural(parsed.value);
  if (!isOk(structural)) return structural;

  const references = validateStorageJsonReferences(structural.value, pdm);
  if (!isOk(references)) return references;

  const consistency = validateStorageJsonConsistency(references.value);
  if (!isOk(consistency)) return consistency;

  return ok(brandStorageJson(consistency.value));
}
