import type { PdmResolver, ResolvedEntity, ResolvedField } from '@rntme/pdm';
import type { StructurallyValidQsm, ValidatedQsm } from '../types/artifact.js';
import {
  err,
  ok,
  ERROR_CODES,
  type Result,
  type QsmError,
} from '../types/result.js';

export function validateCrossRef(
  artifact: StructurallyValidQsm,
  pdm: PdmResolver,
): Result<ValidatedQsm> {
  const errors: QsmError[] = [];
  const mirrorsByEntity = new Map<string, string>(); // entityName → projection claiming mirror

  for (const [projName, proj] of Object.entries(artifact.projections)) {
    const pPath = `projections.${projName}`;
    const backing = proj.backing ?? 'entity-mirror';

    if (backing === 'derived') {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_BACKING_DERIVED_NOT_SUPPORTED,
        message: `projection "${projName}": backing "derived" is not supported in MVP`,
        path: `${pPath}.backing`,
        hint: 'Use backing "entity-mirror" or wait for tier 2.',
      });
      continue;
    }

    const entity = pdm.resolveEntity(proj.source.entity);
    if (!entity) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_SOURCE_UNKNOWN_ENTITY,
        message: `projection "${projName}": source.entity "${proj.source.entity}" not found in PDM`,
        path: `${pPath}.source.entity`,
      });
      continue; // subsequent checks need the entity
    }

    const fieldIndex = indexFields(entity);

    checkFieldsExist(errors, projName, pPath, proj.keys, fieldIndex, 'keys', ERROR_CODES.QSM_XREF_KEY_UNKNOWN_FIELD);
    checkFieldsExist(errors, projName, pPath, proj.grain, fieldIndex, 'grain', ERROR_CODES.QSM_XREF_GRAIN_UNKNOWN_FIELD);
    checkFieldsExist(errors, projName, pPath, proj.exposed, fieldIndex, 'exposed', ERROR_CODES.QSM_XREF_EXPOSED_UNKNOWN_FIELD);

    for (const f of proj.exposed) {
      const field = fieldIndex.get(f);
      if (field && field.generated !== undefined) {
        errors.push({
          layer: 'cross-ref',
          code: ERROR_CODES.QSM_XREF_EXPOSED_INCLUDES_GENERATED,
          message: `projection "${projName}": exposed field "${f}" is generated (${field.generated}); generated fields are mirrored implicitly`,
          path: `${pPath}.exposed`,
        });
      }
    }

    if (backing === 'entity-mirror') {
      if (!entity.stateMachine) {
        errors.push({
          layer: 'cross-ref',
          code: ERROR_CODES.QSM_XREF_ENTITY_MIRROR_REQUIRES_STATE_MACHINE,
          message: `projection "${projName}": backing "entity-mirror" requires "${entity.name}" to declare a stateMachine`,
          path: `${pPath}.backing`,
          hint: 'Add stateMachine to the entity, or omit this projection.',
        });
      }

      if (!setEqual(proj.keys, entity.keys)) {
        errors.push({
          layer: 'cross-ref',
          code: ERROR_CODES.QSM_XREF_ENTITY_MIRROR_KEYS_MISMATCH,
          message: `projection "${projName}": entity-mirror keys must equal "${entity.name}" keys (expected [${entity.keys.join(', ')}], got [${proj.keys.join(', ')}])`,
          path: `${pPath}.keys`,
        });
      }

      const existingMirror = mirrorsByEntity.get(entity.name);
      if (existingMirror !== undefined) {
        errors.push({
          layer: 'cross-ref',
          code: ERROR_CODES.QSM_XREF_ENTITY_MIRROR_DUPLICATE,
          message: `entity "${entity.name}" has multiple entity-mirror projections ("${existingMirror}" and "${projName}")`,
          path: `${pPath}.source.entity`,
        });
      } else {
        mirrorsByEntity.set(entity.name, projName);
      }
    }
  }

  for (const key of Object.keys(artifact.relationRoles)) {
    const [entityName, relName] = key.split('.');
    if (!entityName || !relName) continue; // structural layer already flagged
    const entity = pdm.resolveEntity(entityName);
    if (!entity) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_ROLE_UNKNOWN_ENTITY,
        message: `relationRoles key "${key}" references unknown entity "${entityName}"`,
        path: `relationRoles.${key}`,
      });
      continue;
    }
    const rel = entity.relations.find((r) => r.name === relName);
    if (!rel) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_ROLE_UNKNOWN_RELATION,
        message: `relationRoles key "${key}" references unknown relation "${relName}" on "${entityName}"`,
        path: `relationRoles.${key}`,
      });
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(artifact as ValidatedQsm);
}

function indexFields(entity: ResolvedEntity): Map<string, ResolvedField> {
  const m = new Map<string, ResolvedField>();
  for (const f of entity.fields) m.set(f.name, f);
  return m;
}

function checkFieldsExist(
  errors: QsmError[],
  projName: string,
  pPath: string,
  names: readonly string[],
  fields: Map<string, ResolvedField>,
  label: 'keys' | 'grain' | 'exposed',
  code: 'QSM_XREF_KEY_UNKNOWN_FIELD' | 'QSM_XREF_GRAIN_UNKNOWN_FIELD' | 'QSM_XREF_EXPOSED_UNKNOWN_FIELD',
): void {
  for (const name of names) {
    if (!fields.has(name)) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES[code],
        message: `projection "${projName}": ${label} field "${name}" not found on source entity`,
        path: `${pPath}.${label}`,
      });
    }
  }
}

function setEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  for (const x of b) if (!s.has(x)) return false;
  return true;
}
