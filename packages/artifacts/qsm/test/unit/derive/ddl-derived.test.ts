import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parsePdm,
  validatePdm,
  createPdmResolver,
} from '@rntme/pdm';
import { parseQsm } from '../../../src/parse/parse.js';
import { validateQsm } from '../../../src/validate/index.js';
import { generateProjectionDdl } from '../../../src/derive/ddl.js';
import type { DerivedTableSchemaLike as DerivedTableSchema } from '../../../src/derive/ddl.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(here, '..', '..', 'fixtures');

function setup(qsmInput: unknown) {
  const pdmRaw = parsePdm(readFileSync(join(fixtureDir, 'issue-tracker.pdm.json'), 'utf8'));
  if (!pdmRaw.ok) throw new Error('pdm parse');
  const pdm = validatePdm(pdmRaw.value);
  if (!pdm.ok) throw new Error('pdm validate');
  const resolver = createPdmResolver(pdm.value);

  const qsmRaw = parseQsm(qsmInput);
  if (!qsmRaw.ok) throw new Error('qsm parse: ' + JSON.stringify(qsmRaw.errors));
  const qsm = validateQsm(qsmRaw.value, resolver);
  if (!qsm.ok) throw new Error('qsm validate: ' + JSON.stringify(qsm.errors));
  return { qsm: qsm.value, resolver };
}

describe('generateProjectionDdl — derived branch', () => {
  it('generates CREATE TABLE for a derived projection from supplied DerivedTableSchema', () => {
    const { qsm, resolver } = setup({
      projections: {
        resolvedIssueCountByProject: {
          backing: 'derived',
          source: { graph: 'resolvedIssueCountByProject' },
          table: 'projection_resolved_count',
          keys: ['project_id'],
          grain: ['project_id'],
          exposed: ['project_id', 'n'],
        },
      },
    });

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
        {
          name: 'n',
          fn: 'count',
          sqlType: 'INTEGER',
          initialSql: '1',
          deltaSql: '"n" + 1',
        },
      ],
    };

    const specs = generateProjectionDdl(qsm, resolver, {
      derivedSchemas: { resolvedIssueCountByProject: schema },
    });

    const derived = specs.find((s) => s.projectionName === 'resolvedIssueCountByProject');
    expect(derived).toBeDefined();
    if (!derived) return;

    expect(derived.tableName).toBe('projection_resolved_count');
    expect(derived.createTableSql).toContain('"project_id" INTEGER NOT NULL');
    expect(derived.createTableSql).toContain('"n" INTEGER NOT NULL DEFAULT 0');
    expect(derived.createTableSql).toContain('"last_event_id" TEXT NOT NULL');
    expect(derived.createTableSql).toContain('"applied_at" TEXT NOT NULL');
    expect(derived.createTableSql).not.toContain('last_event_version');
    expect(derived.createTableSql).toMatch(/PRIMARY KEY\s*\(\s*"project_id"\s*\)/);
  });

  it('supports composite primary keys (2+ group columns)', () => {
    const { qsm, resolver } = setup({
      projections: {
        storyPointsByPriorityAndProject: {
          backing: 'derived',
          source: { graph: 'storyPointsByPriorityAndProject' },
          table: 'projection_sp_by_prio_proj',
          keys: ['project_id', 'priority'],
          grain: ['project_id', 'priority'],
          exposed: ['project_id', 'priority', 'total'],
        },
      },
    });

    const schema: DerivedTableSchema = {
      tableName: 'projection_sp_by_prio_proj',
      groupColumns: [
        {
          name: 'project_id',
          sqlType: 'INTEGER',
          nullable: false,
          binding: { kind: 'payloadField', fieldName: 'projectId', sqlType: 'INTEGER' },
        },
        {
          name: 'priority',
          sqlType: 'TEXT',
          nullable: false,
          binding: { kind: 'payloadField', fieldName: 'priority', sqlType: 'TEXT' },
        },
      ],
      measureColumns: [
        {
          name: 'total',
          fn: 'sum',
          sqlType: 'INTEGER',
          initialSql: '?',
          deltaSql: '"total" + ?',
        },
      ],
    };

    const specs = generateProjectionDdl(qsm, resolver, {
      derivedSchemas: { storyPointsByPriorityAndProject: schema },
    });
    const derived = specs.find((s) => s.projectionName === 'storyPointsByPriorityAndProject')!;
    expect(derived.createTableSql).toMatch(
      /PRIMARY KEY\s*\(\s*"project_id"\s*,\s*"priority"\s*\)/,
    );
    expect(derived.createTableSql).toContain('"total" INTEGER NOT NULL DEFAULT 0');
  });

  it('throws when derived projection lacks a schema entry', () => {
    const { qsm, resolver } = setup({
      projections: {
        resolvedIssueCountByProject: {
          backing: 'derived',
          source: { graph: 'resolvedIssueCountByProject' },
          table: 'projection_resolved_count',
          keys: ['project_id'],
          grain: ['project_id'],
          exposed: ['project_id', 'n'],
        },
      },
    });
    expect(() => generateProjectionDdl(qsm, resolver)).toThrow(/derivedSchemas/);
    expect(() => generateProjectionDdl(qsm, resolver, { derivedSchemas: {} })).toThrow(/derivedSchemas/);
  });

  it('existing entity-mirror DDL still generates correctly', () => {
    const { qsm, resolver } = setup({
      projections: {
        IssueView: {
          backing: 'entity-mirror',
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'title', 'status'],
        },
      },
    });
    const specs = generateProjectionDdl(qsm, resolver);
    expect(specs).toHaveLength(1);
    expect(specs[0]!.projectionName).toBe('IssueView');
    expect(specs[0]!.createTableSql).toContain('"last_event_version" INTEGER NOT NULL');
  });

  it('generates both mirror + derived DDL in one artifact', () => {
    const { qsm, resolver } = setup({
      projections: {
        IssueView: {
          backing: 'entity-mirror',
          source: { entity: 'Issue' },
          keys: ['id'],
          grain: ['id'],
          exposed: ['id', 'title', 'status'],
        },
        resolvedIssueCountByProject: {
          backing: 'derived',
          source: { graph: 'resolvedIssueCountByProject' },
          table: 'projection_resolved_count',
          keys: ['project_id'],
          grain: ['project_id'],
          exposed: ['project_id', 'n'],
        },
      },
    });

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
        {
          name: 'n',
          fn: 'count',
          sqlType: 'INTEGER',
          initialSql: '1',
          deltaSql: '"n" + 1',
        },
      ],
    };

    const specs = generateProjectionDdl(qsm, resolver, {
      derivedSchemas: { resolvedIssueCountByProject: schema },
    });
    expect(specs).toHaveLength(2);
    expect(specs.map((s) => s.projectionName).sort()).toEqual([
      'IssueView',
      'resolvedIssueCountByProject',
    ]);
  });
});
