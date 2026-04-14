import type { CanonicalEmit, CanonicalGraph } from '../../types/canonical.js';
import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm } from '@rntme/qsm';
import { createPdmResolver } from '@rntme/pdm';
import { inferExprType, type ParamMap } from './types.js';
import { ERROR_CODES, type GraphIrError } from '../../types/result.js';

export function checkEmit(graph: CanonicalGraph, pdm: ValidatedPdm, _qsm: ValidatedQsm): GraphIrError[] {
  const errs: GraphIrError[] = [];
  const resolver = createPdmResolver(pdm);
  const emits = graph.nodes.filter((n): n is CanonicalEmit => n.kind === 'emit');
  if (emits.length === 0) return errs;

  const params: ParamMap = new Map();
  for (const [name, decl] of Object.entries(graph.signature.inputs)) {
    if (decl.mode === 'root') continue;
    if (typeof decl.type !== 'string') continue;
    const nullable = decl.mode === 'nullable' || decl.mode === 'predicate_optional';
    params.set(name, { type: decl.type, nullable });
  }

  const aggregates = new Set<string>();
  const emptyScope = { aliases: new Map() };

  for (const emit of emits) {
    const entity = pdm.entities[emit.aggregate];
    if (!entity) {
      errs.push({
        layer: 'semantic',
        code: ERROR_CODES.CMD_UNKNOWN_AGGREGATE,
        message: `emit.aggregate "${emit.aggregate}" not in PDM`,
        location: { graphId: graph.id, nodeId: emit.id },
      });
      continue;
    }
    if (!entity.stateMachine) {
      errs.push({
        layer: 'semantic',
        code: ERROR_CODES.CMD_AGGREGATE_WITHOUT_STATE_MACHINE,
        message: `aggregate "${emit.aggregate}" has no stateMachine`,
        location: { graphId: graph.id, nodeId: emit.id },
      });
      continue;
    }
    const transition = resolver.resolveTransition(emit.aggregate, emit.transition);
    if (!transition) {
      errs.push({
        layer: 'semantic',
        code: ERROR_CODES.CMD_UNKNOWN_TRANSITION,
        message: `transition "${emit.transition}" not in stateMachine of "${emit.aggregate}"`,
        location: { graphId: graph.id, nodeId: emit.id },
      });
      continue;
    }

    const affectsWithoutState = transition.affects.filter((f) => f !== entity.stateMachine!.stateField);
    const payloadKeys = Object.keys(emit.payload);
    for (const f of affectsWithoutState) {
      if (!payloadKeys.includes(f)) {
        errs.push({
          layer: 'semantic',
          code: ERROR_CODES.CMD_PAYLOAD_MISSING_FIELD,
          message: `payload missing field "${f}" required by transition "${emit.transition}"`,
          location: { graphId: graph.id, nodeId: emit.id, path: `payload.${f}` },
        });
      }
    }
    for (const k of payloadKeys) {
      if (!affectsWithoutState.includes(k)) {
        errs.push({
          layer: 'semantic',
          code: ERROR_CODES.CMD_PAYLOAD_EXTRANEOUS_FIELD,
          message: `payload has field "${k}" not in transition.affects`,
          location: { graphId: graph.id, nodeId: emit.id, path: `payload.${k}` },
        });
      }
    }

    const idR = inferExprType(emit.aggregateId as unknown, emptyScope, pdm, params);
    if (idR.ok) {
      const primary = entity.keys[0];
      const primaryType = primary ? entity.fields[primary]?.type : undefined;
      if (primaryType && idR.value.type !== primaryType) {
        errs.push({
          layer: 'semantic',
          code: ERROR_CODES.CMD_AGGREGATE_ID_TYPE_MISMATCH,
          message: `aggregateId type ${idR.value.type} != primary key type ${primaryType}`,
          location: { graphId: graph.id, nodeId: emit.id },
        });
      }
    }

    for (const [fname, expr] of Object.entries(emit.payload)) {
      const field = entity.fields[fname];
      if (!field) continue;
      const tR = inferExprType(expr as unknown, emptyScope, pdm, params);
      if (tR.ok && tR.value.type !== field.type) {
        errs.push({
          layer: 'semantic',
          code: ERROR_CODES.CMD_PAYLOAD_TYPE_MISMATCH,
          message: `payload.${fname} type ${tR.value.type} != field type ${field.type}`,
          location: { graphId: graph.id, nodeId: emit.id, path: `payload.${fname}` },
        });
      }
    }

    aggregates.add(`${emit.aggregate}|${JSON.stringify(emit.aggregateId)}`);
  }

  if (aggregates.size > 1) {
    errs.push({
      layer: 'semantic',
      code: ERROR_CODES.CMD_MULTI_AGGREGATE_NOT_ALLOWED,
      message: 'MVP: all emit nodes in a command must reference the same (aggregate, aggregateId)',
      location: { graphId: graph.id },
    });
  }

  return errs;
}
