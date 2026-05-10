/**
 * Tests for bug_007 (alias collision) and bug_010 (duplicate JOIN emission).
 *
 * Uses a three-entity PDM: Issue → Sprint → Project and Issue → Project directly.
 * This is the canonical collision scenario: both `issue.sprint.project.name` and
 * `issue.project.name` previously resolved to alias "project", causing the second
 * join to be silently skipped and the column to resolve against the wrong table.
 */
import { describe, it, expect } from 'bun:test';
import { lowerToSqlite } from '../../../../src/lower/sqlite/lower.js';
import { emitSql } from '../../../../src/lower/sqlite/emit.js';
import type { RelOp } from '../../../../src/types/relational.js';
import type { Expr } from '../../../../src/types/authoring.js';
import { issueSprintProjectFixtures } from './fixtures/issue-sprint-project.js';

const { pdm, qsm } = issueSprintProjectFixtures;

const issueScan: RelOp = {
  op: 'Scan',
  table: 'issues',
  alias: 'issue',
  entity: 'Issue',
  fields: [
    { name: 'id', column: 'id', type: 'integer', nullable: false },
    { name: 'projectId', column: 'project_id', type: 'integer', nullable: false },
    { name: 'sprintId', column: 'sprint_id', type: 'integer', nullable: false },
    { name: 'title', column: 'title', type: 'string', nullable: false },
  ],
};

// ── bug_010: shared dedup across Filter + Project ────────────────────────────

describe('bug_010: duplicate JOIN dedup across operators', () => {
  it('Filter+Project both referencing issue.project.name produce exactly one project JOIN', () => {
    // Filter: issue.project.name = 'ACME'
    // Project: { projectName: issue.project.name, issueKey: issue.project.key }
    const rel: RelOp = {
      op: 'Project',
      into: 'IssueRow',
      cols: {
        projectName: { expr: 'issue.project.name' as unknown as Expr },
        issueKey: { expr: 'issue.project.key' as unknown as Expr },
      },
      child: {
        op: 'Filter',
        predicate: {
          eq: ['issue.project.name', { $literal: 'ACME' }],
        } as unknown as Expr,
        child: issueScan,
      },
    };

    const { ast } = lowerToSqlite(rel, { predicateOptionalParams: new Set(), pdm, qsm });
    const projectJoins = ast.joins.filter((j) => j.alias === 'project');
    expect(projectJoins).toHaveLength(1);
  });

  it('total join count is 1 when Filter and Project share the same single dot-nav relation', () => {
    const rel: RelOp = {
      op: 'Project',
      into: 'IssueRow',
      cols: {
        projectName: { expr: 'issue.project.name' as unknown as Expr },
      },
      child: {
        op: 'Filter',
        predicate: {
          eq: ['issue.project.key', { $literal: 'ACME' }],
        } as unknown as Expr,
        child: issueScan,
      },
    };

    const { ast } = lowerToSqlite(rel, { predicateOptionalParams: new Set(), pdm, qsm });
    expect(ast.joins).toHaveLength(1);
    expect(ast.joins[0]!.alias).toBe('project');
  });
});

// ── bug_007: alias collision — two paths both reach ProjMirror ────────────────

describe('bug_007: alias collision — issue.sprint.project vs issue.project', () => {
  it('lowering Filter on issue.sprint.project.name produces sprint and sprint_project joins', () => {
    const rel: RelOp = {
      op: 'Filter',
      predicate: {
        eq: ['issue.sprint.project.name', { $literal: 'Sprint-Project' }],
      } as unknown as Expr,
      child: issueScan,
    };

    const { ast } = lowerToSqlite(rel, { predicateOptionalParams: new Set(), pdm, qsm });
    const aliases = ast.joins.map((j) => j.alias);
    expect(aliases).toContain('sprint');
    expect(aliases).toContain('sprint_project');
    expect(aliases).not.toContain('project'); // only sprint path, no direct project join
  });

  it('three distinct aliases when both issue.sprint.project.name and issue.project.name appear', () => {
    // Both Filter (sprint path) and Project (direct path) reference ProjMirror
    // Previously both generated alias "project"; the second was silently dropped.
    const rel: RelOp = {
      op: 'Project',
      into: 'IssueRow',
      cols: {
        directProjectName: { expr: 'issue.project.name' as unknown as Expr },
      },
      child: {
        op: 'Filter',
        predicate: {
          eq: ['issue.sprint.project.name', { $literal: 'Sprint-Project' }],
        } as unknown as Expr,
        child: issueScan,
      },
    };

    const { ast } = lowerToSqlite(rel, { predicateOptionalParams: new Set(), pdm, qsm });
    const aliases = ast.joins.map((j) => j.alias);

    // Must have all three: sprint, sprint_project (two-hop path), project (direct path)
    expect(aliases).toContain('sprint');
    expect(aliases).toContain('sprint_project');
    expect(aliases).toContain('project');
    expect(new Set(aliases).size).toBe(aliases.length); // all unique
    expect(aliases).toHaveLength(3);

    // Verify the leafAlias fix: the sprint path's final hop must be qualified by
    // "sprint_project", not "project". Without the fix at lower.ts:290, both paths
    // would use alias "project" and the WHERE clause would reference the wrong table.
    const sql = emitSql(ast);
    expect(sql).toContain('"sprint_project"."name"');
    // The direct path must still be qualified by "project"
    expect(sql).toContain('"project"."name"');
  });
});
