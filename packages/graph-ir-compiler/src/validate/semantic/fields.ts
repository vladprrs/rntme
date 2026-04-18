import type { Entity, ValidatedPdm } from '@rntme/pdm';
import type { Scope } from './scope.js';
import { ERROR_CODES, err, ok, type Result } from '../../types/result.js';
import type { ScopeAlias } from './scope.js';

export type ResolvedField = {
  type: string;
  nullable: boolean;
  column: string;
  table: string;
  /** Alias chain from root through relations (join synthesis). Empty for shape fields. */
  path: string[];
};

function errField(msg: string) {
  return err([{ layer: 'semantic' as const, code: ERROR_CODES.SEM_FIELD_NOT_FOUND, message: msg }]);
}

function errProjField(msg: string) {
  return err([{ layer: 'semantic' as const, code: ERROR_CODES.PROJ_SEMANTIC_UNKNOWN_FIELD, message: msg }]);
}

function resolveEventField(alias: string, row: Extract<ScopeAlias, { kind: 'eventRow' }>, leaf: string, pdm: ValidatedPdm): Result<ResolvedField> {
  const ent = pdm.entities[row.aggregateType];
  if (!ent) return errProjField(`aggregate "${row.aggregateType}" not in PDM`);

  if (leaf === 'aggregateId') {
    const keyName = ent.keys[0];
    if (!keyName) return errProjField(`entity "${row.aggregateType}" has no keys for aggregateId typing`);
    const kf = ent.fields[keyName];
    if (!kf) return errProjField(`key field "${keyName}" missing on "${row.aggregateType}"`);
    return ok({
      type: kf.type,
      nullable: kf.nullable,
      column: keyName,
      table: alias,
      path: [alias],
    });
  }
  if (leaf === 'occurredAt') {
    return ok({ type: 'datetime', nullable: false, column: 'occurredAt', table: alias, path: [alias] });
  }
  if (leaf === 'actorId') {
    return ok({ type: 'string', nullable: true, column: 'actorId', table: alias, path: [alias] });
  }
  const pf = row.payloadFields[leaf];
  if (!pf) {
    return errProjField(`unknown field "${leaf}" on event row alias "${alias}"`);
  }
  return ok({
    type: pf.type,
    nullable: pf.nullable,
    column: leaf,
    table: alias,
    path: [alias],
  });
}

export function resolveField(path: string, scope: Scope, pdm: ValidatedPdm): Result<ResolvedField> {
  const parts = path.split('.');
  const head = parts[0];
  if (!head) return errField(`empty field path`);

  if (scope.shapeFields?.has(head) && parts.length === 1) {
    const f = scope.shapeFields.get(head)!;
    return ok({ type: f.type, nullable: f.nullable, column: head, table: '', path: [] });
  }

  const alias = scope.aliases.get(head);
  if (!alias) {
    return errField(`alias "${head}" not in scope`);
  }
  if (alias.kind === 'eventRow') {
    if (parts.length === 1) {
      return errProjField(`field path "${path}" missing field name after alias`);
    }
    const leaf = parts[1]!;
    if (parts.length > 2) {
      return errProjField(`dot-navigation beyond event row fields is not supported for "${path}"`);
    }
    return resolveEventField(head, alias, leaf, pdm);
  }
  const entity = pdm.entities[alias.entity];
  if (!entity) return errField(`entity "${alias.entity}" not in PDM`);

  if (parts.length === 1) {
    return errField(`field path "${path}" missing field name after alias`);
  }

  if (parts.length === 2) {
    const fieldName = parts[1]!;
    const f = entity.fields[fieldName];
    if (!f) {
      return errField(`field "${fieldName}" not found on entity "${alias.entity}"`);
    }
    return ok({
      type: f.type,
      nullable: f.nullable,
      column: f.column,
      table: head,
      path: [head],
    });
  }

  let curEntity: Entity = entity;
  const chain = [head];
  for (let i = 1; i < parts.length - 1; i++) {
    const step = parts[i]!;
    const rel = curEntity.relations?.[step];
    if (!rel) {
      return errField(`relation "${step}" not on entity "${curEntity.table}"`);
    }
    const next = pdm.entities[rel.to];
    if (!next) return errField(`related entity "${rel.to}" not in PDM`);
    chain.push(step);
    curEntity = next;
  }
  const leaf = parts[parts.length - 1]!;
  const f = curEntity.fields[leaf];
  if (!f) return errField(`field "${leaf}" not on entity "${curEntity.table}"`);

  const navigatedNullable = parts.length > 2;
  return ok({
    type: f.type,
    nullable: f.nullable || navigatedNullable,
    column: f.column,
    table: chain[chain.length - 1]!,
    path: chain,
  });
}
