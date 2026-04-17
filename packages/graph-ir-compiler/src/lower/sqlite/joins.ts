import type { ValidatedPdm } from '@rntme/pdm';
import type { ValidatedQsm, QsmRelation } from '@rntme/qsm';
import { defaultTableName } from '@rntme/qsm';
import type { SqlExpr, SqlJoin } from './ast.js';

export type JoinChain = {
  from: string;
  fromProjection: string;
  steps: Array<{
    relation: string;
    fromProjection: string;
    toProjection: string;
    toAlias: string;
    localKey: string;    // column name
    foreignKey: string;  // column name
    cardinality: 'one' | 'many';
  }>;
};

/**
 * Walk QSM.relations starting from `startProjection`, stepping through `path[1..]`.
 * Resolves field→column via PDM for each hop.
 */
export function expandChain(
  startAlias: string,
  startProjection: string,
  path: string[],
  qsm: ValidatedQsm,
  pdm: ValidatedPdm,
): JoinChain {
  let curProjName = startProjection;
  const steps: JoinChain['steps'] = [];

  for (let i = 1; i < path.length; i++) {
    const relName = path[i]!;
    const key = `${curProjName}.${relName}`;
    const rel: QsmRelation | undefined = qsm.relations[key];
    if (!rel) {
      throw new Error(`NAV_NOT_ALLOWED: relation "${key}" not declared in QSM.relations`);
    }
    if (rel.cardinality === 'many') {
      throw new Error(`NAV_FAN_OUT_NOT_ALLOWED: relation "${key}" has cardinality "many"`);
    }

    const curProj = qsm.projections[curProjName];
    if (!curProj) throw new Error(`expandChain: unknown source projection "${curProjName}"`);
    const curEntity = pdm.entities[curProj.source.entity];
    if (!curEntity) throw new Error(`expandChain: unknown PDM entity "${curProj.source.entity}"`);

    const toProj = qsm.projections[rel.to];
    if (!toProj) throw new Error(`expandChain: unknown target projection "${rel.to}"`);
    const toEntity = pdm.entities[toProj.source.entity];
    if (!toEntity) throw new Error(`expandChain: unknown PDM entity "${toProj.source.entity}"`);

    const localField = curEntity.fields[rel.localKey];
    const foreignField = toEntity.fields[rel.foreignKey];
    if (!localField) throw new Error(`expandChain: field "${rel.localKey}" missing on ${curEntity.table}`);
    if (!foreignField) throw new Error(`expandChain: field "${rel.foreignKey}" missing on ${toEntity.table}`);

    steps.push({
      relation: relName,
      fromProjection: curProjName,
      toProjection: rel.to,
      toAlias: relName,
      localKey: localField.column,
      foreignKey: foreignField.column,
      cardinality: rel.cardinality,
    });

    curProjName = rel.to;
  }

  return { from: startAlias, fromProjection: startProjection, steps };
}

export function chainToSqlJoins(
  chain: JoinChain,
  qsm: ValidatedQsm,
): SqlJoin[] {
  const joins: SqlJoin[] = [];
  let fromAlias = chain.from;
  for (const step of chain.steps) {
    const toProj = qsm.projections[step.toProjection];
    if (!toProj) throw new Error(`chainToSqlJoins: unknown projection ${step.toProjection}`);
    const toTable = toProj.table ?? defaultTableName(step.toProjection);

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

