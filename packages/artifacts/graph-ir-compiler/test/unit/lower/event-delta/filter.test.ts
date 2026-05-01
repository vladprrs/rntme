import { describe, expect, it } from 'vitest';
import { buildFilterArtifact, type EventSourceFilterColumn } from '../../../../src/lower/sqlite/event-delta/filter.js';
import type { Expr } from '../../../../src/types/authoring.js';

const cols: Record<string, EventSourceFilterColumn> = {
  aggregateId: { sqlType: 'INTEGER', binding: { kind: 'aggregateId', sqlType: 'INTEGER' } },
  occurredAt: { sqlType: 'TEXT', binding: { kind: 'eventOccurredAt' } },
  status: {
    sqlType: 'TEXT',
    binding: { kind: 'payloadField', fieldName: 'status', sqlType: 'TEXT' },
  },
  amount: {
    sqlType: 'REAL',
    binding: { kind: 'payloadField', fieldName: 'amount', sqlType: 'REAL' },
  },
};

describe('buildFilterArtifact', () => {
  it('returns null when filterExpr is null', () => {
    expect(buildFilterArtifact(null, cols)).toBeNull();
  });

  it("lifts { eq: ['ev.status', { $literal: 'Done' }] } with inlined literal and no bindings", () => {
    const expr = { eq: ['ev.status', { $literal: 'Done' }] } as unknown as Expr;
    const r = buildFilterArtifact(expr, cols);
    expect(r).not.toBeNull();
    expect(r!.sql).toBe("(json_extract(payload_json, '$.status') = 'Done')");
    expect(r!.bindings).toEqual([]);
  });

  it('lifts AND-composed predicates with numeric literals inlined', () => {
    const expr = {
      and: [
        { gt: ['ev.amount', 100] },
        { eq: ['ev.status', { $literal: 'Open' }] },
      ],
    } as unknown as Expr;
    const r = buildFilterArtifact(expr, cols);
    expect(r).not.toBeNull();
    expect(r!.sql).toBe(
      "((json_extract(payload_json, '$.amount') > 100) AND (json_extract(payload_json, '$.status') = 'Open'))",
    );
    expect(r!.bindings).toEqual([]);
  });
});
