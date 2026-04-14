import type { Entity, Relation, ValidatedPdm } from '@rntme/pdm';
import type { SqlExpr, SqlJoin } from './ast.js';

export type JoinChain = {
  from: string;
  steps: Array<{
    relation: string;
    toEntity: string;
    toAlias: string;
    localKey: string;
    foreignKey: string;
  }>;
};

/** Build a relation chain from a path prefix `[rootAlias, rel1, rel2, ...]`. */
export function expandChain(
  startAlias: string,
  startEntity: string,
  path: string[],
  pdm: ValidatedPdm,
): JoinChain {
  const start = pdm.entities[startEntity];
  if (!start) throw new Error(`expandChain: unknown entity ${startEntity}`);
  let curEntity: Entity = start;
  const steps: JoinChain['steps'] = [];
  for (let i = 1; i < path.length; i++) {
    const relName = path[i]!;
    const rels = curEntity.relations;
    const rel: Relation | undefined = rels?.[relName];
    if (!rel) throw new Error(`expandChain: relation "${relName}" missing on ${curEntity.table}`);
    const next: Entity | undefined = pdm.entities[rel.to];
    if (!next) throw new Error(`expandChain: entity ${rel.to} missing`);
    const localField = curEntity.fields[rel.localKey];
    const foreignField = next.fields[rel.foreignKey];
    if (!localField || !foreignField) {
      throw new Error(`expandChain: bad keys on ${relName}`);
    }
    steps.push({
      relation: relName,
      toEntity: rel.to,
      toAlias: relName,
      localKey: localField.column,
      foreignKey: foreignField.column,
    });
    curEntity = next;
  }
  return { from: startAlias, steps };
}

export function chainToSqlJoins(chain: JoinChain, pdm: ValidatedPdm): SqlJoin[] {
  const joins: SqlJoin[] = [];
  let fromAlias = chain.from;
  for (const step of chain.steps) {
    const toTable = pdm.entities[step.toEntity]?.table;
    if (!toTable) throw new Error(`chainToSqlJoins: unknown entity ${step.toEntity}`);
    const on: SqlExpr = {
      kind: 'op',
      op: 'eq',
      args: [
        { kind: 'col', table: fromAlias, column: step.localKey },
        { kind: 'col', table: step.toAlias, column: step.foreignKey },
      ],
    };
    joins.push({ kind: 'left', table: toTable, alias: step.toAlias, on });
    fromAlias = step.toAlias;
  }
  return joins;
}
