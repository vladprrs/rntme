import {
  ERROR_CODES,
  err,
  ok,
  type BlueprintError,
  type Result,
} from '../../types/result.js';
import type { StorageJson } from '../../types/storage-json.js';

const ONE_MINUTE_MS = 60_000;
const SEVEN_DAYS_MS = 7 * 86_400_000;
const FIVE_GB_BYTES = 5 * 1024 * 1024 * 1024;

export function validateStorageJsonConsistency(sj: StorageJson): Result<StorageJson> {
  const errors: BlueprintError[] = [];
  const seenAssociations = new Map<string, string>();

  for (const route of Object.values(sj.routes)) {
    const assocKey = `${route.owner.aggregate}#${route.owner.association}`;
    const prior = seenAssociations.get(assocKey);
    if (prior !== undefined) {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.STORAGE_CONSISTENCY_DUPLICATE_ASSOCIATION,
        message: `routes "${prior}" and "${route.id}" both claim association "${assocKey}"`,
        path: `storage.json#routes.${route.id}.owner`,
      });
    } else {
      seenAssociations.set(assocKey, route.id);
    }

    if (
      route.lifecycle.expirePendingMs < ONE_MINUTE_MS ||
      route.lifecycle.expirePendingMs > SEVEN_DAYS_MS
    ) {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.STORAGE_CONSISTENCY_PENDING_TTL_OUT_OF_RANGE,
        message: `route "${route.id}" lifecycle.expirePending must be between 1m and 7d`,
        path: `storage.json#routes.${route.id}.lifecycle.expirePending`,
      });
    }

    if (route.maxSize > FIVE_GB_BYTES) {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.STORAGE_CONSISTENCY_MAX_SIZE_TOO_LARGE,
        message: `route "${route.id}" maxSize ${route.maxSize} exceeds S3 single-PUT limit (5GB)`,
        path: `storage.json#routes.${route.id}.maxSize`,
      });
    }

    if (route.maxCount !== null && route.maxCount < 1) {
      errors.push({
        layer: 'consistency',
        code: ERROR_CODES.STORAGE_CONSISTENCY_MAX_COUNT_INVALID,
        message: `route "${route.id}" maxCount must be null or >= 1`,
        path: `storage.json#routes.${route.id}.maxCount`,
      });
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(sj);
}
