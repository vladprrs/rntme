import type { Pdm } from '../../types/pdm.js';
import type { Scope } from './scope.js';
import { ERROR_CODES, err, ok, type Result } from '../../types/result.js';

export type ResolvedField = {
  type: string;
  nullable: boolean;
  column: string;
  table: string;
};

export function resolveField(path: string, scope: Scope, pdm: Pdm): Result<ResolvedField> {
  const [head, ...rest] = path.split('.');
  if (!head) {
    return err([{ layer: 'semantic', code: ERROR_CODES.SEM_FIELD_NOT_FOUND, message: `empty field path` }]);
  }

  if (scope.shapeFields?.has(head) && rest.length === 0) {
    const f = scope.shapeFields.get(head)!;
    return ok({ type: f.type, nullable: f.nullable, column: head, table: '' });
  }

  const alias = scope.aliases.get(head);
  if (!alias) {
    return err([
      { layer: 'semantic', code: ERROR_CODES.SEM_FIELD_NOT_FOUND, message: `alias "${head}" not in scope` },
    ]);
  }
  if (rest.length === 0) {
    return err([
      {
        layer: 'semantic',
        code: ERROR_CODES.SEM_FIELD_NOT_FOUND,
        message: `field path "${path}" missing field name after alias`,
      },
    ]);
  }
  const fieldName = rest[0]!;
  if (rest.length > 1) {
    return err([
      {
        layer: 'semantic',
        code: ERROR_CODES.SEM_FIELD_NOT_FOUND,
        message: `dot-navigation (${path}) is not supported until Task 57`,
      },
    ]);
  }
  const entity = pdm.entities[alias.entity];
  const f = entity?.fields[fieldName];
  if (!f) {
    return err([
      {
        layer: 'semantic',
        code: ERROR_CODES.SEM_FIELD_NOT_FOUND,
        message: `field "${fieldName}" not found on entity "${alias.entity}"`,
      },
    ]);
  }
  return ok({ type: f.type, nullable: f.nullable, column: f.column, table: head });
}
