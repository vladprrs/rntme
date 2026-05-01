import { describe, expect, it } from 'vitest';
import { buildBootstrapSql } from '../../../../src/lower/sqlite/event-delta/bootstrap.js';
import type { DerivedTableSchema } from '../../../../src/types/projection.js';

describe('buildBootstrapSql', () => {
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

  it('builds bootstrap SQL without filter and with literal event-type predicate', () => {
    const sql = buildBootstrapSql(
      schema,
      'IssueResolved',
      null,
      { project_id: "json_extract(payload_json, '$.projectId')" },
      { n: 'COUNT(*)' },
    );

    expect(sql).toContain('INSERT INTO "projection_resolved_count"');
    expect(sql).toContain('"project_id", "n", "last_event_id", "applied_at"');
    expect(sql).toContain("json_extract(payload_json, '$.projectId') AS \"project_id\"");
    expect(sql).toContain('COUNT(*) AS "n"');
    expect(sql).toContain(`'' AS "last_event_id"`);
    expect(sql).toContain(`strftime('%Y-%m-%dT%H:%M:%fZ','now') AS "applied_at"`);
    expect(sql).toContain('FROM event_log');
    expect(sql).toContain(`WHERE "event_type" = 'IssueResolved'`);
    expect(sql).not.toContain(' AND ');
    expect(sql).toContain('GROUP BY "project_id"');
  });

  it('AND-chains the filter predicate after the event-type predicate', () => {
    const sql = buildBootstrapSql(
      schema,
      'IssueResolved',
      "json_extract(payload_json, '$.status') = 'Done'",
      { project_id: "json_extract(payload_json, '$.projectId')" },
      { n: 'COUNT(*)' },
    );

    expect(sql).toContain(`WHERE "event_type" = 'IssueResolved'`);
    expect(sql).toMatch(
      /WHERE "event_type" = 'IssueResolved'\s*\n\s*AND json_extract\(payload_json, '\$\.status'\) = 'Done'/,
    );
  });
});
