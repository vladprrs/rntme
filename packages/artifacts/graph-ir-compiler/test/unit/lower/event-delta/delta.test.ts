import { describe, expect, it } from 'bun:test';
import { buildDeltaArtifact } from '../../../../src/lower/sqlite/event-delta/delta.js';
import type { DerivedTableSchema } from '../../../../src/types/projection.js';

describe('buildDeltaArtifact', () => {
  it('emits one-liner UPSERT with count + 1 and expected binding order', () => {
    const schema: DerivedTableSchema = {
      tableName: 'projection_resolved_count',
      groupColumns: [
        {
          name: 'project_id',
          sqlType: 'INTEGER',
          nullable: false,
          binding: { kind: 'payloadField', fieldName: 'projectId', sqlType: 'INTEGER' },
        },
      ],
      measureColumns: [
        { name: 'n', fn: 'count', sqlType: 'INTEGER', initialSql: '1', deltaSql: '"n" + 1', bindings: [] },
      ],
    };
    const { deltaSql, deltaBindings } = buildDeltaArtifact(schema);

    expect(deltaSql).toContain('INSERT INTO "projection_resolved_count"');
    expect(deltaSql).toContain('("project_id", "n", "last_event_id", "applied_at")');
    expect(deltaSql).toContain('VALUES (?, 1, ?, ?)');
    expect(deltaSql).toContain('ON CONFLICT("project_id") DO UPDATE SET');
    expect(deltaSql).toContain('"n" = "n" + 1');
    expect(deltaSql).toContain('"last_event_id" = excluded."last_event_id"');
    expect(deltaSql).toContain('"applied_at" = excluded."applied_at"');

    expect(deltaBindings).toEqual([
      { kind: 'payloadField', fieldName: 'projectId', sqlType: 'INTEGER' },
      { kind: 'eventId' },
      { kind: 'appliedAt' },
    ]);
  });

  it('threads sum measure bindings between group-col bindings and eventId/appliedAt tail', () => {
    const schema: DerivedTableSchema = {
      tableName: 'projection_revenue',
      groupColumns: [
        {
          name: 'agg_id',
          sqlType: 'INTEGER',
          nullable: false,
          binding: { kind: 'aggregateId', sqlType: 'INTEGER' },
        },
      ],
      measureColumns: [
        {
          name: 'total',
          fn: 'sum',
          sqlType: 'REAL',
          initialSql: '(? * ?)',
          deltaSql: '"total" + excluded."total"',
          bindings: [
            { kind: 'payloadField', fieldName: 'price', sqlType: 'REAL' },
            { kind: 'payloadField', fieldName: 'quantity', sqlType: 'INTEGER' },
          ],
        },
        { name: 'lines', fn: 'count', sqlType: 'INTEGER', initialSql: '1', deltaSql: '"lines" + 1', bindings: [] },
      ],
    };
    const { deltaSql, deltaBindings } = buildDeltaArtifact(schema);

    expect(deltaSql).toContain('VALUES (?, (? * ?), 1, ?, ?)');
    expect(deltaSql).toContain('"total" = "total" + excluded."total"');
    expect(deltaSql).toContain('"lines" = "lines" + 1');

    expect(deltaBindings).toEqual([
      { kind: 'aggregateId', sqlType: 'INTEGER' },
      { kind: 'payloadField', fieldName: 'price', sqlType: 'REAL' },
      { kind: 'payloadField', fieldName: 'quantity', sqlType: 'INTEGER' },
      { kind: 'eventId' },
      { kind: 'appliedAt' },
    ]);
  });
});
