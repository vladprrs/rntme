import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { SqliteEventStore } from '@rntme/event-store';
import { compile, compileCommand, execute, executeCommand } from '../../src/index.js';
import { commercePdm, commerceQsm } from '../fixtures/validated-commerce.js';
import { RAW_ISSUE_PDM as RAW_PDM, RAW_ISSUE_QSM_EMPTY as RAW_QSM } from './fixtures/issue-pdm.js';
import { testCorrelation } from '../support/correlation.js';

const querySpec = {
  version: '1.0-rc7' as const,
  pdmRef: 'p',
  qsmRef: 'q',
  shapes: {},
  graphs: {
    listProductsForUser: {
      id: 'listProductsForUser',
      signature: {
        inputs: {},
        output: { type: 'rowset<Product>', from: 'owned' },
      },
      nodes: [
        { id: 'products', type: 'findMany' as const, config: { source: { entity: 'Product' } } },
        {
          id: 'owned',
          type: 'filter' as const,
          config: {
            input: 'products',
            expr: { eq: ['product.name', { $pre: 'session.user_id' }] },
          },
        },
      ],
    },
  },
};

const reportSpec = {
  version: '1.0-rc7' as const,
  pdmRef: 'p',
  qsmRef: 'q',
  shapes: {},
  graphs: {
    reportIssue: {
      id: 'reportIssue',
      signature: {
        inputs: {
          issueId: { type: 'integer' as const, mode: 'required' as const },
          projectId: { type: 'integer' as const, mode: 'required' as const },
          reporterId: { type: 'integer' as const, mode: 'required' as const },
          priority: { type: 'string' as const, mode: 'required' as const },
          storyPoints: { type: 'integer' as const, mode: 'required' as const },
        },
        output: { type: 'row<CommandResult>', from: 'e' },
      },
      nodes: [
        {
          id: 'e',
          type: 'emit' as const,
          config: {
            aggregate: 'Issue',
            aggregateId: { $param: 'issueId' },
            transition: 'report',
            payload: {
              title: { $pre: 'session.user_id' },
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

describe('$pre directive', () => {
  it('lowers $pre references in query filters and resolves them at execution time', () => {
    const compiled = compile(querySpec, commercePdm, commerceQsm);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    expect(compiled.value.paramOrder).toEqual(['pre.session.user_id']);

    const db = new Database(':memory:');
    db.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, category_id INTEGER, name TEXT, status TEXT)');
    db.prepare('INSERT INTO products (id, category_id, name, status) VALUES (?, ?, ?, ?)').run(1, 1, 'auth0|u1', 'active');
    db.prepare('INSERT INTO products (id, category_id, name, status) VALUES (?, ?, ?, ?)').run(2, 1, 'auth0|u2', 'active');

    const rows = execute(
      compiled.value,
      { pre: { session: { user_id: 'auth0|u1' } } },
      db,
    ) as Array<{ id: number; name: string }>;

    expect(rows).toEqual([{ id: 1, categoryId: 1, name: 'auth0|u1', status: 'active' }]);
    db.close();
  });

  it('resolves $pre references in command emit payloads', () => {
    const compiled = compileCommand(reportSpec, RAW_PDM, RAW_QSM);
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;

    const store = new SqliteEventStore({ filename: ':memory:', serviceName: 'test-service' });
    executeCommand(
      compiled.value,
      {
        issueId: 1,
        projectId: 7,
        reporterId: 2,
        priority: 'high',
        storyPoints: 5,
        pre: { session: { user_id: 'auth0|abc123' } },
      },
      {
        eventStore: store,
        qsmDb: null,
        now: () => '2026-04-29T10:00:00Z',
        nextId: () => '018e9d2a-aaaa-7000-8000-000000000001',
        actor: { kind: 'user', id: 'alice' },
        correlation: testCorrelation(),
      },
    );

    const events = store.readStream('Issue-1');
    expect((events[0]!.data as { after: { title: string } }).after.title).toBe('auth0|abc123');
    store.close();
  });

  it('rejects $pre in emit.aggregateId with a specific graph error', () => {
    const bad = structuredClone(reportSpec);
    bad.graphs.reportIssue.nodes[0]!.config.aggregateId = { $pre: 'session.issue_id' } as never;

    const compiled = compileCommand(bad, RAW_PDM, RAW_QSM);

    expect(compiled.ok).toBe(false);
    if (!compiled.ok) {
      expect(compiled.errors.map((e) => e.code)).toContain('GRAPH_IR_PRE_REF_NOT_ALLOWED_IN_AGGREGATE_ID');
    }
  });

  it('rejects $pre in emit.transition with a specific graph error', () => {
    const bad = structuredClone(reportSpec);
    bad.graphs.reportIssue.nodes[0]!.config.transition = { $pre: 'session.transition' } as never;

    const compiled = compileCommand(bad, RAW_PDM, RAW_QSM);

    expect(compiled.ok).toBe(false);
    if (!compiled.ok) {
      expect(compiled.errors.map((e) => e.code)).toContain('GRAPH_IR_PRE_REF_NOT_ALLOWED_IN_TRANSITION');
    }
  });

  it('rejects $pre in findMany source with a specific graph error', () => {
    const bad = structuredClone(querySpec);
    bad.graphs.listProductsForUser.nodes[0]!.config.source = { entity: { $pre: 'session.entity' } } as never;

    const compiled = compile(bad, commercePdm, commerceQsm);

    expect(compiled.ok).toBe(false);
    if (!compiled.ok) {
      expect(compiled.errors.map((e) => e.code)).toContain('GRAPH_IR_PRE_REF_NOT_ALLOWED_IN_SOURCE');
    }
  });
});
