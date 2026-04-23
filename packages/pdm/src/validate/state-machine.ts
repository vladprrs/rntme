import type {
  StateMachine,
  StructurallyValidPdm,
  Transition,
  ValidatedPdm,
} from '../types/artifact.js';
import {
  err,
  ok,
  ERROR_CODES,
  type Result,
  type PdmError,
} from '../types/result.js';

export function validateStateMachine(
  artifact: StructurallyValidPdm,
): Result<ValidatedPdm> {
  const errors: PdmError[] = [];

  for (const [entityName, entity] of Object.entries(artifact.entities)) {
    if (entity.kind === 'root' && entity.stateMachine) {
      errors.push({
        layer: 'state-machine',
        code: ERROR_CODES.PDM_SM_ROOT_STATE_MACHINE_FORBIDDEN,
        message: `root entity "${entityName}" cannot declare stateMachine`,
        path: `entities.${entityName}.stateMachine`,
      });
      continue;
    }
    if (!entity.stateMachine) continue;
    const sm = entity.stateMachine;
    const entityPath = `entities.${entityName}.stateMachine`;
    const fieldNames = new Set(Object.keys(entity.fields));
    const keyNames = new Set(entity.keys);

    // stateField existence
    if (!fieldNames.has(sm.stateField)) {
      errors.push({
        layer: 'state-machine',
        code: ERROR_CODES.PDM_SM_STATE_FIELD_MISSING,
        message: `entity "${entityName}" stateMachine.stateField "${sm.stateField}" is not declared in fields`,
        path: `${entityPath}.stateField`,
      });
      // do not continue — allow transition/affects checks to proceed
    } else {
      // stateField type check (only when field exists)
      const stateFieldDecl = entity.fields[sm.stateField]!;
      if (stateFieldDecl.type !== 'string' || stateFieldDecl.nullable) {
        errors.push({
          layer: 'state-machine',
          code: ERROR_CODES.PDM_SM_STATE_FIELD_TYPE_INVALID,
          message: `stateField "${sm.stateField}" of "${entityName}" must be non-nullable string`,
          path: `${entityPath}.stateField`,
        });
      }
    }

    // states: non-empty, unique
    if (sm.states.length === 0) {
      errors.push({
        layer: 'state-machine',
        code: ERROR_CODES.PDM_SM_STATES_EMPTY,
        message: `stateMachine.states empty for "${entityName}"`,
        path: `${entityPath}.states`,
      });
    }
    const dup = findDuplicates(sm.states);
    if (dup.length > 0) {
      errors.push({
        layer: 'state-machine',
        code: ERROR_CODES.PDM_SM_STATES_DUPLICATE,
        message: `duplicate states in "${entityName}": ${dup.join(', ')}`,
        path: `${entityPath}.states`,
      });
    }
    const stateSet = new Set(sm.states);

    // transitions
    for (const [transitionName, t] of Object.entries(sm.transitions)) {
      const tPath = `${entityPath}.transitions.${transitionName}`;

      // from → states
      const fromStates = normalizeFrom(t.from);
      for (const s of fromStates) {
        if (s === null) continue;
        if (!stateSet.has(s)) {
          errors.push({
            layer: 'state-machine',
            code: ERROR_CODES.PDM_SM_UNKNOWN_STATE,
            message: `transition "${transitionName}" on "${entityName}" references unknown state "${s}" in from`,
            path: `${tPath}.from`,
          });
        }
      }

      // to → states
      if (!stateSet.has(t.to)) {
        errors.push({
          layer: 'state-machine',
          code: ERROR_CODES.PDM_SM_UNKNOWN_STATE,
          message: `transition "${transitionName}" on "${entityName}" references unknown state "${t.to}" in to`,
          path: `${tPath}.to`,
        });
      }

      // affects rules
      const isCreation = fromStates.some((s) => s === null);
      const isSelfLoop =
        !isCreation &&
        fromStates.length === 1 &&
        fromStates[0] === t.to;

      const affectsDeclared = t.affects !== undefined;
      const affects = t.affects ?? [];

      if (isCreation && !affectsDeclared) {
        errors.push({
          layer: 'state-machine',
          code: ERROR_CODES.PDM_SM_CREATION_MISSING_AFFECTS,
          message: `creation transition "${transitionName}" on "${entityName}" must declare affects explicitly`,
          path: `${tPath}.affects`,
        });
      }

      if (isSelfLoop && affects.length === 0) {
        errors.push({
          layer: 'state-machine',
          code: ERROR_CODES.PDM_SM_EMPTY_SELF_LOOP,
          message: `self-loop transition "${transitionName}" on "${entityName}" must declare non-empty affects`,
          path: `${tPath}.affects`,
        });
      }

      for (const f of affects) {
        if (!fieldNames.has(f)) {
          errors.push({
            layer: 'state-machine',
            code: ERROR_CODES.PDM_SM_UNKNOWN_AFFECTED_FIELD,
            message: `affects references unknown field "${f}" on "${entityName}" in transition "${transitionName}"`,
            path: `${tPath}.affects`,
          });
          continue;
        }
        if (keyNames.has(f)) {
          errors.push({
            layer: 'state-machine',
            code: ERROR_CODES.PDM_SM_AFFECTS_KEY,
            message: `affects cannot contain key field "${f}" on "${entityName}"`,
            path: `${tPath}.affects`,
          });
        }
        const field = entity.fields[f];
        if (field?.generated !== undefined) {
          errors.push({
            layer: 'state-machine',
            code: ERROR_CODES.PDM_SM_AFFECTS_GENERATED,
            message: `affects cannot contain generated field "${f}" on "${entityName}"`,
            path: `${tPath}.affects`,
          });
        }
      }
    }

    // reachability
    const reachable = computeReachable(sm);
    for (const s of sm.states) {
      if (!reachable.has(s)) {
        errors.push({
          layer: 'state-machine',
          code: ERROR_CODES.PDM_SM_UNREACHABLE_STATE,
          message: `state "${s}" is unreachable from initial in "${entityName}"`,
          path: `${entityPath}.states`,
        });
      }
    }
  }

  if (errors.length > 0) return err(errors);
  return ok(artifact as ValidatedPdm);
}

function normalizeFrom(from: Transition['from']): (string | null)[] {
  if (from === null) return [null];
  if (typeof from === 'string') return [from];
  return [...from];
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

function computeReachable(sm: StateMachine): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [];

  for (const t of Object.values(sm.transitions)) {
    const fromStates = normalizeFrom(t.from);
    if (fromStates.includes(null)) {
      if (sm.states.includes(t.to) && !reachable.has(t.to)) {
        reachable.add(t.to);
        queue.push(t.to);
      }
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const t of Object.values(sm.transitions)) {
      const fromStates = normalizeFrom(t.from);
      if (fromStates.includes(current) && sm.states.includes(t.to) && !reachable.has(t.to)) {
        reachable.add(t.to);
        queue.push(t.to);
      }
    }
  }

  return reachable;
}
