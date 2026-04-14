import type { Entity, ValidatedPdm } from '@rntme/pdm';
import type { Scope } from './scope.js';
import { ERROR_CODES, err, ok, type Result } from '../../types/result.js';

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
