import { describe, expect, it } from 'bun:test';
import { lowerToEventDelta } from '../../../../src/lower/sqlite/event-delta/lower.js';
import { buildSemanticPlan } from '../../../../src/semantic-plan/build.js';
import { resolveSources } from '../../../../src/validate/semantic/sources.js';
import { commercePdm, commerceQsm } from '../../../fixtures/validated-commerce.js';
import type { CanonicalGraph } from '../../../../src/types/canonical.js';

describe('lowerToEventDelta', () => {
  it('end-to-end: findMany { eventType: OrderCreate } → reduce count → derived compile result', () => {
    const graph: CanonicalGraph = {
      id: 'orderCreateCount',
      signature: {
        inputs: {},
        output: { type: 'rowset<OrderCounts>', from: 'r' },
      },
      nodes: [
        {
          kind: 'findMany',
          id: 's',
          scope: 'default',
          source: { eventType: 'OrderCreate' },
          alias: 'ev',
        },
        {
          kind: 'reduce',
          id: 'r',
          scope: 'default',
          input: 's',
          into: 'OrderCounts',
          group: { agg: 'ev.aggregateId' },
          measures: { n: { fn: 'count' } },
        },
      ],
      outputFrom: 'r',
    };

    const sourcesR = resolveSources(graph, commercePdm, commerceQsm);
    expect(sourcesR.ok).toBe(true);
    if (!sourcesR.ok) return;
    const eventSource = sourcesR.value.get('s');
    expect(eventSource?.kind).toBe('eventType');
    if (!eventSource || eventSource.kind !== 'eventType') return;

    const planR = buildSemanticPlan(graph, commercePdm, commerceQsm);
    expect(planR.ok).toBe(true);
    if (!planR.ok) return;

    const result = lowerToEventDelta(
      planR.value,
      commercePdm,
      eventSource,
      'projection_order_create_count',
      null,
    );

    expect(result.filter).toBeNull();
    expect(result.eventType).toBe('OrderCreate');
    expect(result.aggregateType).toBe('Order');
    expect(result.tableSchema.tableName).toBe('projection_order_create_count');
    expect(result.tableSchema.groupColumns).toHaveLength(1);
    expect(result.tableSchema.groupColumns[0]!.name).toBe('agg');
    expect(result.tableSchema.groupColumns[0]!.binding.kind).toBe('aggregateId');
    expect(result.tableSchema.measureColumns).toHaveLength(1);
    expect(result.tableSchema.measureColumns[0]).toMatchObject({
      name: 'n',
      fn: 'count',
      sqlType: 'INTEGER',
      initialSql: '1',
      deltaSql: '"n" + 1',
    });

    expect(result.deltaSql).toContain('INSERT INTO "projection_order_create_count"');
    expect(result.deltaSql).toContain('ON CONFLICT("agg") DO UPDATE SET');
    expect(result.deltaBindings).toEqual([
      { kind: 'aggregateId', sqlType: 'INTEGER' },
      { kind: 'eventId' },
      { kind: 'appliedAt' },
    ]);

    expect(result.bootstrapSql).toContain('FROM event_log');
    expect(result.bootstrapSql).toContain(`WHERE "event_type" = 'OrderCreate'`);
    expect(result.bootstrapSql).toContain('GROUP BY "agg"');
    expect(result.bootstrapSql).toContain('aggregate_id AS "agg"');
    expect(result.bootstrapSql).toContain('COUNT(*) AS "n"');
  });
});
