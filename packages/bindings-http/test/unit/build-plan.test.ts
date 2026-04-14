import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBindings, parseBindingArtifact } from '@rntme/bindings';
import type { BindingResolvers, ValidatedBindings } from '@rntme/bindings';
import { buildPlan, type CommandBindingPlan } from '../../src/startup/compile-plan.js';
import { BindingsRuntimeError } from '../../src/errors.js';

const here = dirname(fileURLToPath(import.meta.url));
const compilerRoot = join(here, '..', '..', '..', 'graph-ir-compiler');
const loadJson = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T;

const spec = loadJson(join(compilerRoot, 'test', 'golden', 'category-sales', 'graph.json'));
const pdm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.pdm.json'));
const qsm = loadJson(join(compilerRoot, 'test', 'e2e', 'fixtures', 'commerce.qsm.json'));

const resolvers: BindingResolvers = {
  resolveGraphSignature: (id) =>
    id === 'getCategorySales'
      ? {
          id,
          inputs: {
            dateFrom: { type: { kind: 'scalar', primitive: 'datetime' }, mode: 'required' },
            dateTo: { type: { kind: 'scalar', primitive: 'datetime' }, mode: 'required' },
            minRevenue: { type: { kind: 'scalar', primitive: 'decimal' }, mode: 'predicate_optional' },
            limit: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'defaulted', default: 20 },
          },
          output: { type: { kind: 'rowset', shape: 'CategorySalesAgg' }, from: 'paged' },
        }
      : null,
  resolveShape: (name) =>
    name === 'CategorySalesAgg'
      ? {
          name,
          origin: 'custom',
          fields: {
            categoryId: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            revenue: { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
            totalQuantity: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            lineCount: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
            avgItemPrice: { type: { kind: 'scalar', primitive: 'decimal' }, nullable: false },
          },
        }
      : null,
};

function makeValidated(): ValidatedBindings {
  const artifact = {
    version: '1.0',
    graphSpecRef: 'commerce.graphs.v1',
    pdmRef: 'commerce.domain.v1',
    qsmRef: 'commerce.read.v1',
    bindings: {
      getCategorySalesHttp: {
        graph: 'getCategorySales',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: {
          method: 'GET',
          path: '/v1/analytics/category-sales',
          parameters: [
            { name: 'dateFrom', in: 'query', bindTo: 'dateFrom', required: true },
            { name: 'dateTo', in: 'query', bindTo: 'dateTo', required: true },
            { name: 'minRevenue', in: 'query', bindTo: 'minRevenue', required: false },
            { name: 'limit', in: 'query', bindTo: 'limit', required: false },
          ],
        },
      },
    },
  };
  const parsed = parseBindingArtifact(artifact);
  if (!parsed.ok) throw new Error('parse failed: ' + JSON.stringify(parsed.errors));
  const validated = validateBindings(parsed.value, resolvers);
  if (!validated.ok) throw new Error('validate failed: ' + JSON.stringify(validated.errors));
  return validated.value;
}

describe('buildPlan', () => {
  it('returns a plan for every binding with compiled SQL', () => {
    const validated = makeValidated();
    const plan = buildPlan(validated, spec, pdm, qsm);
    expect(Object.keys(plan)).toEqual(['getCategorySalesHttp']);
    const bp = plan.getCategorySalesHttp!;
    expect(bp.kind).toBe('query');
    expect(bp.compiled.sql.length).toBeGreaterThan(0);
    expect(bp.bindToMap).toEqual({
      dateFrom: 'dateFrom',
      dateTo: 'dateTo',
      minRevenue: 'minRevenue',
      limit: 'limit',
    });
    expect(bp.schemas.querySchema).toBeDefined();
  });

  it('throws BindingsRuntimeError when compile fails', () => {
    const validated = makeValidated();
    const brokenSpec = { version: '1.0-rc7', pdmRef: 'x', qsmRef: 'y', shapes: {}, graphs: {} };
    expect(() => buildPlan(validated, brokenSpec, pdm, qsm)).toThrow(BindingsRuntimeError);
  });
});

describe('buildPlan — command bindings', () => {
  const pdmIt = loadJson(
    join(compilerRoot, 'test', 'e2e', 'fixtures', 'issue-tracker.pdm.json'),
  );
  const qsmIt = loadJson(
    join(compilerRoot, 'test', 'e2e', 'fixtures', 'issue-tracker.qsm.json'),
  );
  const commandSpec = {
    version: '1.0-rc7',
    pdmRef: 'p',
    qsmRef: 'q',
    shapes: {},
    graphs: {
      reportIssue: {
        id: 'reportIssue',
        signature: {
          inputs: {
            issueId: { type: 'integer', mode: 'required' },
            projectId: { type: 'integer', mode: 'required' },
            reporterId: { type: 'integer', mode: 'required' },
            title: { type: 'string', mode: 'required' },
            priority: { type: 'string', mode: 'required' },
            storyPoints: { type: 'integer', mode: 'required' },
          },
          output: { type: 'row<CommandResult>', from: 'e' },
        },
        nodes: [
          {
            id: 'e',
            type: 'emit',
            config: {
              aggregate: 'Issue',
              aggregateId: { $param: 'issueId' },
              transition: 'report',
              payload: {
                title: { $param: 'title' },
                projectId: { $param: 'projectId' },
                reporterId: { $param: 'reporterId' },
                priority: { $param: 'priority' },
                storyPoints: { $param: 'storyPoints' },
              },
            },
          },
        ],
      },
    },
  };
  const cmdResolvers: BindingResolvers = {
    resolveGraphSignature: (id) =>
      id === 'reportIssue'
        ? {
            id,
            role: 'command',
            inputs: {
              issueId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
              projectId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
              reporterId: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
              title: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
              priority: { type: { kind: 'scalar', primitive: 'string' }, mode: 'required' },
              storyPoints: { type: { kind: 'scalar', primitive: 'integer' }, mode: 'required' },
            },
            output: { type: { kind: 'row', shape: 'CommandResult' }, from: 'e' },
          }
        : null,
    resolveShape: (name) =>
      name === 'CommandResult'
        ? {
            name,
            origin: 'custom',
            fields: {
              aggregateId: { type: { kind: 'scalar', primitive: 'string' }, nullable: false },
              version: { type: { kind: 'scalar', primitive: 'integer' }, nullable: false },
              eventIds: { type: { kind: 'array', element: 'string' }, nullable: false },
            },
          }
        : null,
  };
  const cmdArtifact = {
    version: '1.0',
    graphSpecRef: 'x',
    pdmRef: 'p',
    qsmRef: 'q',
    bindings: {
      reportIssueHttp: {
        kind: 'command',
        graph: 'reportIssue',
        target: { engine: 'sqlite', dialect: 'sqlite' },
        http: {
          method: 'POST',
          path: '/v1/issues/{issueId}/actions/report',
          parameters: [
            { name: 'issueId', in: 'path', bindTo: 'issueId', required: true },
            { name: 'projectId', in: 'body', bindTo: 'projectId', required: true },
            { name: 'reporterId', in: 'body', bindTo: 'reporterId', required: true },
            { name: 'title', in: 'body', bindTo: 'title', required: true },
            { name: 'priority', in: 'body', bindTo: 'priority', required: true },
            { name: 'storyPoints', in: 'body', bindTo: 'storyPoints', required: true },
          ],
        },
      },
    },
  };

  it('produces a CommandBindingPlan with compiled emits', () => {
    const parsed = parseBindingArtifact(cmdArtifact);
    if (!parsed.ok) throw new Error('parse fail');
    const v = validateBindings(parsed.value, cmdResolvers);
    if (!v.ok) throw new Error('validate fail');
    const plan = buildPlan(v.value, commandSpec, pdmIt, qsmIt);
    const bp = plan.reportIssueHttp;
    expect(bp).toBeDefined();
    expect(bp!.kind).toBe('command');
    const cmd = bp as CommandBindingPlan;
    expect(cmd.compiled.aggregate).toBe('Issue');
    expect(cmd.compiled.emits.length).toBe(1);
    expect(cmd.compiled.emits[0]!.eventType).toContain('Issue');
  });
});
