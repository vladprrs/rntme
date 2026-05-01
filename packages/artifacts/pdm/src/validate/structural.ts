import type { PdmArtifact, StructurallyValidPdm } from '../types/artifact.js';
import {
  err,
  ok,
  ERROR_CODES,
  type Result,
  type PdmError,
} from '../types/result.js';

export function validateStructural(artifact: PdmArtifact): Result<StructurallyValidPdm> {
  const errors: PdmError[] = [];
  const entityNames = new Set(Object.keys(artifact.entities));

  for (const [entityName, entity] of Object.entries(artifact.entities)) {
    const fieldNames = new Set(Object.keys(entity.fields));

    // Keys → fields
    if (entity.keys.length === 0) {
      errors.push({
        layer: 'structural',
        code: ERROR_CODES.PDM_STRUCT_KEY_EMPTY,
        message: `entity "${entityName}" must declare at least one key`,
        path: `entities.${entityName}.keys`,
      });
    }
    entity.keys.forEach((key, idx) => {
      if (!fieldNames.has(key)) {
        errors.push({
          layer: 'structural',
          code: ERROR_CODES.PDM_STRUCT_KEY_UNKNOWN_FIELD,
          message: `entity "${entityName}" key "${key}" is not declared in fields`,
          path: `entities.${entityName}.keys[${idx}]`,
        });
      }
    });

    // Relations → entity existence, localKey, foreignKey
    const relations = entity.relations ?? {};
    for (const [relName, rel] of Object.entries(relations)) {
      const targetEntityKnown = entityNames.has(rel.to);
      if (!targetEntityKnown) {
        errors.push({
          layer: 'structural',
          code: ERROR_CODES.PDM_STRUCT_RELATION_UNKNOWN_ENTITY,
          message: `relation "${relName}" on "${entityName}" references unknown entity "${rel.to}"`,
          path: `entities.${entityName}.relations.${relName}.to`,
        });
      }
      if (!fieldNames.has(rel.localKey)) {
        errors.push({
          layer: 'structural',
          code: ERROR_CODES.PDM_STRUCT_RELATION_UNKNOWN_LOCAL_KEY,
          message: `relation "${relName}" on "${entityName}" localKey "${rel.localKey}" is not declared in fields`,
          path: `entities.${entityName}.relations.${relName}.localKey`,
        });
      }
      if (!targetEntityKnown) continue;
      const target = artifact.entities[rel.to];
      if (target && !(rel.foreignKey in target.fields)) {
        errors.push({
          layer: 'structural',
          code: ERROR_CODES.PDM_STRUCT_RELATION_UNKNOWN_FOREIGN_KEY,
          message: `relation "${relName}" on "${entityName}" foreignKey "${rel.foreignKey}" not found on "${rel.to}"`,
          path: `entities.${entityName}.relations.${relName}.foreignKey`,
        });
      }
    }
  }

  if (errors.length > 0) return err(errors);

  return ok(artifact as StructurallyValidPdm);
}
