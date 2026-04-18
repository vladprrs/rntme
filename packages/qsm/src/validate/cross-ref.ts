import type { PdmResolver, ResolvedEntity, ResolvedField } from '@rntme/pdm';
import type { StructurallyValidQsm, ValidatedQsm } from '../types/artifact.js';
import { isEntityMirrorSource } from '../types/artifact.js';
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
      // Derived projections have source: { graph }. Cross-artifact graph
      // existence / role / keys-match checks are performed by @rntme/runtime
      // (D5 Task 21) where the graph map is in scope; QSM cross-ref only
      // needs to skip entity-mirror rules here.
      continue;
    }

    // Narrowing: structural layer ensures entity-mirror → entity source.
    if (!isEntityMirrorSource(proj.source)) continue;

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

      if (!setEqual(proj.grain, proj.keys)) {
        errors.push({
          layer: 'cross-ref',
          code: ERROR_CODES.QSM_XREF_ENTITY_MIRROR_GRAIN_MISMATCH,
          message: `projection "${projName}": entity-mirror grain must equal keys (keys: [${proj.keys.join(', ')}], grain: [${proj.grain.join(', ')}])`,
          path: `${pPath}.grain`,
          hint: 'Entity-mirror projections have per-key granularity by construction.',
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

  for (const [key, rel] of Object.entries(artifact.relations)) {
    const rPath = `relations["${key}"]`;
    const [sourceProjName, relName] = key.split('.');
    if (!sourceProjName || !relName) continue; // structural layer already flagged

    const sourceProj = artifact.projections[sourceProjName];
    if (!sourceProj) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_UNKNOWN_SOURCE_PROJECTION,
        message: `relation "${key}": source projection "${sourceProjName}" not found in QSM`,
        path: rPath,
      });
      continue;
    }
    // Relations only apply to entity-mirror projections; derived projections
    // express their joins inside the graph-IR spec. Skip cross-ref checks
    // when either end is derived.
    if (!isEntityMirrorSource(sourceProj.source)) continue;
    const sourceEntity = pdm.resolveEntity(sourceProj.source.entity);
    if (!sourceEntity) continue; // flagged earlier as projection source unknown

    const targetProj = artifact.projections[rel.to];
    if (!targetProj) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_UNKNOWN_TARGET_PROJECTION,
        message: `relation "${key}": target projection "${rel.to}" not found in QSM`,
        path: `${rPath}.to`,
      });
      continue;
    }
    if (!isEntityMirrorSource(targetProj.source)) continue;
    const targetEntity = pdm.resolveEntity(targetProj.source.entity);
    // flagged earlier as projection source unknown
    if (!targetEntity) continue;

    const pdmRel = sourceEntity.relations.find((r) => r.name === relName);
    if (!pdmRel) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_NOT_IN_PDM,
        message: `relation "${key}" requires PDM relation "${sourceEntity.name}.${relName}"; add it to PDM or check the name`,
        path: rPath,
      });
      continue;
    }

    // B2 — strict cross-validation against PDM (PDM is the source of truth)
    if (pdmRel.to !== targetEntity.name) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_TO_MISMATCH,
        message: `relation "${key}": "to" projects to entity "${targetEntity.name}" but PDM says "${pdmRel.to}"`,
        path: `${rPath}.to`,
      });
    }
    if (rel.localKey !== pdmRel.localKey) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_LOCAL_KEY_MISMATCH,
        message: `relation "${key}": localKey "${rel.localKey}" does not match PDM "${pdmRel.localKey}"`,
        path: `${rPath}.localKey`,
      });
    }
    if (rel.foreignKey !== pdmRel.foreignKey) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_FOREIGN_KEY_MISMATCH,
        message: `relation "${key}": foreignKey "${rel.foreignKey}" does not match PDM "${pdmRel.foreignKey}"`,
        path: `${rPath}.foreignKey`,
      });
    }
    if (rel.cardinality !== pdmRel.cardinality) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_CARDINALITY_MISMATCH,
        message: `relation "${key}": cardinality "${rel.cardinality}" does not match PDM "${pdmRel.cardinality}"`,
        path: `${rPath}.cardinality`,
      });
    }

    // Sanity checks
    if (!sourceEntity.fields.find((f) => f.name === rel.localKey)) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_LOCAL_KEY_UNKNOWN_FIELD,
        message: `relation "${key}": localKey "${rel.localKey}" not a field on "${sourceEntity.name}"`,
        path: `${rPath}.localKey`,
      });
    }
    const foreignField = targetEntity.fields.find((f) => f.name === rel.foreignKey);
    if (!foreignField) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_FOREIGN_KEY_UNKNOWN_FIELD,
        message: `relation "${key}": foreignKey "${rel.foreignKey}" not a field on "${targetEntity.name}"`,
        path: `${rPath}.foreignKey`,
      });
    } else if (!targetEntity.keys.includes(rel.foreignKey)) {
      errors.push({
        layer: 'cross-ref',
        code: ERROR_CODES.QSM_XREF_RELATION_FOREIGN_KEY_NOT_A_KEY,
        message: `relation "${key}": foreignKey "${rel.foreignKey}" is not a key of "${targetEntity.name}" (keys: [${targetEntity.keys.join(', ')}])`,
        path: `${rPath}.foreignKey`,
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
