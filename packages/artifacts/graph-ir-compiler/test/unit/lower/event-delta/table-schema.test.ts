import { describe, expect, it } from 'bun:test';
import { buildDerivedTableSchema, type EventSourceColumnMeta } from '../../../../src/lower/sqlite/event-delta/table-schema.js';
import type { RelOp } from '../../../../src/types/relational.js';

function makeScan(alias: string): RelOp {
  return {
    op: 'Scan',
    table: 'event_log',
    alias,
    entity: 'Order',
    fields: [
      { name: 'aggregateId', column: 'aggregate_id', type: 'integer', nullable: false },
      { name: 'occurredAt', column: 'occurred_at', type: 'datetime', nullable: false },
      { name: 'actorId', column: 'actor_id', type: 'string', nullable: true },
      {
        name: 'createdAt',
        column: 'payload_json',
        type: 'datetime',
        nullable: false,
        sql: { fn: 'json_extract', column: 'payload_json', jsonPath: '$.createdAt' },
      },
    ],
    where: { kind: 'eq_literal', column: 'event_type', value: 'OrderCreate' },
  };
}

const columnMeta: Record<string, EventSourceColumnMeta> = {
  aggregateId: {
    sqlType: 'INTEGER',
    nullable: false,
    binding: { kind: 'aggregateId', sqlType: 'INTEGER' },
  },
  occurredAt: {
    sqlType: 'TEXT',
    nullable: false,
    binding: { kind: 'eventOccurredAt' },
  },
  actorId: {
    sqlType: 'TEXT',
    nullable: true,
    binding: { kind: 'eventActorId' },
  },
  createdAt: {
    sqlType: 'TEXT',
    nullable: false,
    binding: { kind: 'payloadField', fieldName: 'createdAt', sqlType: 'TEXT' },
  },
};

describe('buildDerivedTableSchema', () => {
  it('count with single group key → one INTEGER measure, one group col', () => {
    const rel: RelOp = {
      op: 'Aggregate',
      child: makeScan('ev'),
      into: 'Counts',
      group: { agg: 'ev.aggregateId' },
      measures: { n: { fn: 'count' } },
    };
    const schema = buildDerivedTableSchema(rel, 'projection_order_count', columnMeta);

    expect(schema.tableName).toBe('projection_order_count');
    expect(schema.groupColumns).toHaveLength(1);
    expect(schema.groupColumns[0]).toEqual({
      name: 'agg',
      sqlType: 'INTEGER',
      nullable: false,
      binding: { kind: 'aggregateId', sqlType: 'INTEGER' },
    });

    expect(schema.measureColumns).toHaveLength(1);
    expect(schema.measureColumns[0]).toEqual({
      name: 'n',
      fn: 'count',
      sqlType: 'INTEGER',
      initialSql: '1',
      deltaSql: '"n" + 1',
      bindings: [],
    });
  });

  it('sum with payload field expression → REAL measure with payloadField binding', () => {
    const extended: Record<string, EventSourceColumnMeta> = {
      ...columnMeta,
      price: {
        sqlType: 'REAL',
        nullable: false,
        binding: { kind: 'payloadField', fieldName: 'price', sqlType: 'REAL' },
      },
      quantity: {
        sqlType: 'INTEGER',
        nullable: false,
        binding: { kind: 'payloadField', fieldName: 'quantity', sqlType: 'INTEGER' },
      },
    };
    const rel: RelOp = {
      op: 'Aggregate',
      child: {
        op: 'Scan',
        table: 'event_log',
        alias: 'ev',
        entity: 'OrderItem',
        fields: [
          { name: 'aggregateId', column: 'aggregate_id', type: 'integer', nullable: false },
          {
            name: 'price',
            column: 'payload_json',
            type: 'decimal',
            nullable: false,
            sql: { fn: 'json_extract', column: 'payload_json', jsonPath: '$.price' },
          },
          {
            name: 'quantity',
            column: 'payload_json',
            type: 'integer',
            nullable: false,
            sql: { fn: 'json_extract', column: 'payload_json', jsonPath: '$.quantity' },
          },
        ],
        where: { kind: 'eq_literal', column: 'event_type', value: 'OrderItemPlace' },
      },
      into: 'Revenue',
      group: { agg: 'ev.aggregateId', occurred: 'ev.occurredAt' },
      measures: {
        total: {
          fn: 'sum',
          expr: { mul: ['ev.price', 'ev.quantity'] as never } as never,
        },
        lines: { fn: 'count' },
      },
    };
    const schema = buildDerivedTableSchema(rel, 'projection_revenue', extended);

    expect(schema.groupColumns).toHaveLength(2);
    expect(schema.groupColumns.map((c) => c.name)).toEqual(['agg', 'occurred']);
    expect(schema.groupColumns[0]!.sqlType).toBe('INTEGER');
    expect(schema.groupColumns[1]!.sqlType).toBe('TEXT');

    expect(schema.measureColumns).toHaveLength(2);
    const total = schema.measureColumns.find((m) => m.name === 'total')!;
    expect(total.fn).toBe('sum');
    expect(total.sqlType).toBe('REAL');
    expect(total.initialSql).toBe('(? * ?)');
    expect(total.deltaSql).toBe('"total" + excluded."total"');
    expect(total.bindings).toEqual([
      { kind: 'payloadField', fieldName: 'price', sqlType: 'REAL' },
      { kind: 'payloadField', fieldName: 'quantity', sqlType: 'INTEGER' },
    ]);

    const lines = schema.measureColumns.find((m) => m.name === 'lines')!;
    expect(lines.initialSql).toBe('1');
    expect(lines.deltaSql).toBe('"lines" + 1');
  });
});
