import type { QsmArtifact, StructurallyValidQsm } from '../types/artifact.js';
import {
  err,
  ok,
  ERROR_CODES,
  type Result,
  type QsmError,
} from '../types/result.js';

const RELATION_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/;

export function validateStructural(
  artifact: QsmArtifact,
): Result<StructurallyValidQsm> {
  const errors: QsmError[] = [];
  const seenTables = new Map<string, string>();

  for (const [projName, proj] of Object.entries(artifact.projections)) {
    const pPath = `projections.${projName}`;

    if (proj.keys.length === 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_STRUCT_PROJECTION_KEYS_EMPTY,
        message: `projection "${projName}" must declare at least one key`,
        path: `${pPath}.keys`,
      });
    }
    if (proj.grain.length === 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_STRUCT_PROJECTION_GRAIN_EMPTY,
        message: `projection "${projName}" must declare at least one grain column`,
        path: `${pPath}.grain`,
      });
    }
    if (proj.exposed.length === 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_STRUCT_PROJECTION_EXPOSED_EMPTY,
        message: `projection "${projName}" must declare at least one exposed column`,
        path: `${pPath}.exposed`,
      });
    }

    const kDup = findDuplicates(proj.keys);
    if (kDup.length > 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_STRUCT_PROJECTION_DUPLICATE_KEY,
        message: `duplicate keys in "${projName}": ${kDup.join(', ')}`,
        path: `${pPath}.keys`,
      });
    }
    const gDup = findDuplicates(proj.grain);
    if (gDup.length > 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_STRUCT_PROJECTION_DUPLICATE_GRAIN,
        message: `duplicate grain in "${projName}": ${gDup.join(', ')}`,
        path: `${pPath}.grain`,
      });
    }
    const eDup = findDuplicates(proj.exposed);
    if (eDup.length > 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_STRUCT_PROJECTION_DUPLICATE_EXPOSED,
        message: `duplicate exposed in "${projName}": ${eDup.join(', ')}`,
        path: `${pPath}.exposed`,
      });
    }

    const table = proj.table ?? defaultTableName(projName);
    const existing = seenTables.get(table);
    if (existing !== undefined) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_STRUCT_DUPLICATE_TABLE,
        message: `projections "${existing}" and "${projName}" both resolve to table "${table}"`,
        path: `${pPath}.table`,
      });
    } else {
      seenTables.set(table, projName);
    }
  }

  for (const [key, rel] of Object.entries(artifact.relations)) {
    const rPath = `relations["${key}"]`;
    if (!RELATION_KEY_RE.test(key)) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_RELATION_KEY_MALFORMED,
        message: `relation key "${key}" must match "<projectionName>.<relationName>" (identifier.identifier, no digit-leading segments)`,
        path: rPath,
      });
      continue; // further checks are meaningless if key malformed
    }
    if (!rel.to || rel.to.length === 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_RELATION_TO_MISSING,
        message: `relation "${key}" missing "to"`,
        path: `${rPath}.to`,
      });
    }
    if (!rel.localKey || rel.localKey.length === 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_RELATION_KEY_MISSING,
        message: `relation "${key}" missing "localKey"`,
        path: `${rPath}.localKey`,
      });
    }
    if (!rel.foreignKey || rel.foreignKey.length === 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.QSM_RELATION_KEY_MISSING,
        message: `relation "${key}" missing "foreignKey"`,
        path: `${rPath}.foreignKey`,
      });
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(artifact as StructurallyValidQsm);
}

export function defaultTableName(projectionName: string): string {
  return `projection_${projectionName.toLowerCase()}`;
}

function findDuplicates(xs: readonly string[]): string[] {
  const seen = new Set<string>();
  const dup: string[] = [];
  for (const x of xs) {
    if (seen.has(x)) dup.push(x);
    seen.add(x);
  }
  return dup;
}
