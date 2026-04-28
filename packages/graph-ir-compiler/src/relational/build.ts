import type { SemanticPlan } from '../types/semantic-plan.js';
import type { RelOp } from '../types/relational.js';
import { internalError } from '../types/errors.js';

export function buildRelational(plan: SemanticPlan): RelOp {
  let acc: RelOp | undefined;
  for (const step of plan.steps) {
    switch (step.kind) {
      case 'scan':
        acc = {
          op: 'Scan',
          table: step.table,
          alias: step.alias,
          fields: step.fields,
          entity: step.entity,
          ...(step.where !== undefined ? { where: step.where } : {}),
        };
        break;
      case 'filter':
        if (!acc) throw internalError('relational', 'filter without prior step');
        acc = { op: 'Filter', child: acc, predicate: step.predicate };
        break;
      case 'project':
        if (!acc) throw internalError('relational', 'project without prior step');
        acc = { op: 'Project', child: acc, into: step.into, cols: step.fields };
        break;
      case 'aggregate':
        if (!acc) throw internalError('relational', 'aggregate without prior step');
        acc = {
          op: 'Aggregate',
          child: acc,
          into: step.into,
          group: step.group,
          measures: step.measures,
        };
        break;
      case 'sort':
        if (!acc) throw internalError('relational', 'sort without prior step');
        acc = { op: 'Sort', child: acc, keys: step.by };
        break;
      case 'limit':
        if (!acc) throw internalError('relational', 'limit without prior step');
        acc = { op: 'Limit', child: acc, count: step.count };
        break;
    }
  }
  if (!acc) throw internalError('relational', 'empty plan');
  return acc;
}
