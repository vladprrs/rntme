import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parsePdm, validatePdm, createPdmResolver, deriveEventTypes,
} from '@rntme/pdm';
import { parseQsm, validateQsm } from '@rntme/qsm';
import { compileApplyPlan } from '../../../src/apply/compile.js';
import type { DerivedHandler } from '../../../src/types/apply.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', '..', 'fixtures');

function setup() {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error('pdm parse');
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error('pdm validate');
  const resolver = createPdmResolver(pdm.value);
  const events = deriveEventTypes(pdm.value);
  const qsmRaw = parseQsm(readFileSync(join(fixtureDir, 'issue-tracker.qsm.json'), 'utf8'));
  if (!qsmRaw.ok) throw new Error('qsm parse');
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error('qsm validate');
  return { pdm: resolver, qsm: qsm.value, events };
}

function makeDerived(partial: Partial<DerivedHandler> & Pick<DerivedHandler, 'projectionName' | 'eventType'>): DerivedHandler {
  return {
    kind: 'derived',
    projectionName: partial.projectionName,
    tableName: partial.tableName ?? `projection_${partial.projectionName.toLowerCase()}`,
    aggregateType: partial.aggregateType ?? 'Issue',
    eventType: partial.eventType,
    deltaSql: partial.deltaSql ?? 'INSERT INTO t (x) VALUES (?)',
    bootstrapSql: partial.bootstrapSql ?? 'INSERT INTO t SELECT 1',
    deltaBindings: partial.deltaBindings ?? [{ kind: 'aggregateId', sqlType: 'INTEGER' }],
    filter: partial.filter ?? null,
  };
}

describe('compileApplyPlan — derivedHandlers (D5 Task 19)', () => {
  it('mirror + derived handlers coexist in the plan for the same eventType', () => {
    const { pdm, qsm, events } = setup();
    const derived: DerivedHandler = makeDerived({
      projectionName: 'IssueByDayCount',
      eventType: 'IssueResolve',
    });
    const plan = compileApplyPlan({ pdm, qsm, events, derivedHandlers: [derived] });
    const list = plan.handlersByEventType.get('IssueResolve');
    expect(list).toBeDefined();
    expect(list!).toHaveLength(2);
    // Mirror-first ordering
    expect(list![0]!.kind).toBe('update');
    expect(list![1]!.kind).toBe('derived');
    expect(list![1]!.projectionName).toBe('IssueByDayCount');
  });

  it('multiple derived handlers for the same eventType are sorted by projectionName', () => {
    const { pdm, qsm, events } = setup();
    const a = makeDerived({ projectionName: 'ZProj', eventType: 'IssueResolve' });
    const b = makeDerived({ projectionName: 'AProj', eventType: 'IssueResolve' });
    const c = makeDerived({ projectionName: 'MProj', eventType: 'IssueResolve' });
    const plan = compileApplyPlan({ pdm, qsm, events, derivedHandlers: [a, b, c] });
    const list = plan.handlersByEventType.get('IssueResolve')!;
    // 1 mirror + 3 derived
    expect(list).toHaveLength(4);
    expect(list[0]!.kind).toBe('update');
    expect(list.slice(1).map((h) => h.projectionName)).toEqual(['AProj', 'MProj', 'ZProj']);
  });

  it('derived handler for an eventType without a mirror registers a new entry', () => {
    const { pdm, qsm, events } = setup();
    const derived = makeDerived({
      projectionName: 'FooProj',
      aggregateType: 'Foo',
      eventType: 'FooHappened',
    });
    const plan = compileApplyPlan({ pdm, qsm, events, derivedHandlers: [derived] });
    const list = plan.handlersByEventType.get('FooHappened')!;
    expect(list).toHaveLength(1);
    expect(list[0]!.kind).toBe('derived');
  });

  it('omitting derivedHandlers preserves existing mirror-only plan shape', () => {
    const { pdm, qsm, events } = setup();
    const plan = compileApplyPlan({ pdm, qsm, events });
    const list = plan.handlersByEventType.get('IssueReport')!;
    expect(list).toHaveLength(1);
    expect(list[0]!.kind).toBe('insert');
  });
});
