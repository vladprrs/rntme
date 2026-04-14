import { describe, it, expect } from 'vitest';
import {
  pdm,
  validatedPdm,
  qsm,
  validatedQsm,
  qsmResolver,
  pdmResolver,
  projectionDdls,
  eventTypes,
} from '../src/artifacts.js';

describe('artifacts.ts — exports for mutation pipeline', () => {
  it('exports validated PDM including stateMachine on Issue', () => {
    const issue = validatedPdm.entities['Issue']!;
    expect(issue.stateMachine).toBeDefined();
    expect(issue.stateMachine!.transitions).toHaveProperty('assign');
  });

  it('PDM passed to compiler retains stateMachine (no strip)', () => {
    expect((pdm as unknown as { entities: Record<string, { stateMachine?: unknown }> })
      .entities['Issue']!.stateMachine).toBeDefined();
  });

  it('exports QSM with IssueView entity-mirror', () => {
    expect(qsm).toBeDefined();
    expect(validatedQsm.projections['IssueView']).toBeDefined();
    expect(qsmResolver.findEntityMirror('Issue')!.table).toBe('projection_issue');
  });

  it('derives projection DDLs and event types', () => {
    const ddl = projectionDdls.find((d) => d.projectionName === 'IssueView')!;
    expect(ddl.tableName).toBe('projection_issue');
    expect(ddl.createTableSql).toMatch(/CREATE TABLE "projection_issue"/);

    const assigned = eventTypes.find((e) => e.eventType === 'IssueAssign')!;
    expect(assigned.aggregateType).toBe('Issue');
    expect(assigned.affects).toContain('assigneeId');
  });

  it('exposes pdmResolver (already existed)', () => {
    expect(pdmResolver.resolveEntity('Issue')).not.toBeNull();
  });
});
