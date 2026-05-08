import {
  ERROR_CODES,
  err,
  ok,
  type BlueprintError,
  type Result,
} from '../../types/result.js';
import type { StorageJson } from '../../types/storage-json.js';

// Minimal structural shape we depend on. The real ValidatedPdm assigns this.
export interface PdmShape {
  readonly entities: Readonly<Record<string, unknown>>;
}

export function validateStorageJsonReferences(
  sj: StorageJson,
  pdm: PdmShape,
): Result<StorageJson> {
  const entityNames = new Set(Object.keys(pdm.entities));
  const errors: BlueprintError[] = [];
  for (const route of Object.values(sj.routes)) {
    if (!entityNames.has(route.owner.aggregate)) {
      errors.push({
        layer: 'references',
        code: ERROR_CODES.STORAGE_REFERENCES_AGGREGATE_NOT_FOUND,
        message: `route "${route.id}" owner.aggregate "${route.owner.aggregate}" is not declared in pdm.json`,
        path: `storage.json#routes.${route.id}.owner.aggregate`,
      });
    }
  }
  if (errors.length > 0) return err(errors);
  return ok(sj);
}
