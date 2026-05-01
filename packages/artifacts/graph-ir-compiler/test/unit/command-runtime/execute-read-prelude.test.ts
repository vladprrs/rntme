import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteEventStore } from '@rntme/event-store';
import { compileCommand } from '../../../src/command-runtime/compile.js';
import { executeCommand } from '../../../src/command-runtime/execute.js';
import { testCorrelation } from '../../support/correlation.js';
import { RAW_ISSUE_PDM } from '../fixtures/issue-pdm.js';

const RAW_QSM = {
  projections: {
    IssueView: {
      backing: 'entity-mirror',
      source: { entity: 'Issue' },
      keys: ['id'],
      grain: ['id'],
      exposed: [
        'id',
        'title',
        'status',
        'priority',
        'storyPoints',
        'assigneeId',
        'reporterId',
        'projectId',
        'resolvedAt',
      ],
      table: 'projection_issue',
    },
  },
  relations: {},
};

const assignWithCapacitySpec = {
  version: '1.0-rc7',
  pdmRef: 'p',
  qsmRef: 'q',
  shapes: { LoadCount: { fields: { count: { type: 'integer', nullable: false } } } },
  graphs: {
    assignIssueSafe: {
      id: 'assignIssueSafe',
      signature: {
        inputs: {
          issueId: { type: 'integer', mode: 'required' },
          assigneeId: { type: 'integer', mode: 'required' },
        },
        output: { type: 'row<CommandResult>', from: 'emitAssign' },
      },
      nodes: [
        { id: 'currentLoad', type: 'findMany', config: { source: { entity: 'Issue' } } },
        {
          id: 'loadFiltered',
          type: 'filter',
          config: {
            input: 'currentLoad',
            expr: {
              and: [
                { eq: ['issue.assigneeId', { $param: 'assigneeId' }] },
                { eq: ['issue.status', { $literal: 'in_progress' }] },
              ],
            },
          },
        },
        {
          id: 'loadCount',
          type: 'reduce',
          config: {
            input: 'loadFiltered',
            into: 'LoadCount',
            group: {},
            measures: { count: { fn: 'count' } },
          },
        },
        {
          id: 'guardCapacity',
          type: 'filter',
          config: { input: 'loadCount', expr: { lt: ['count', 5] } },
        },
        {
          id: 'emitAssign',
          type: 'emit',
          config: {
            aggregate: 'Issue',
            aggregateId: { $param: 'issueId' },
            transition: 'assign',
            payload: { assigneeId: { $param: 'assigneeId' } },
          },
        },
      ],
    },
  },
};

describe('executeCommand — read-prelude guard', () => {
  it('throws COMMAND_GUARD_REJECTED when guard filter returns empty (5 matching rows, threshold 5)', () => {
    const qsmDb = new Database(':memory:');
    qsmDb.exec(`CREATE TABLE projection_issue (
      id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, reporter_id INTEGER NOT NULL,
      assignee_id INTEGER, title TEXT NOT NULL, priority TEXT NOT NULL, story_points INTEGER NOT NULL,
      status TEXT NOT NULL, resolved_at TEXT
    );`);
    const ins = qsmDb.prepare(`INSERT INTO projection_issue (id, project_id, reporter_id, assignee_id,
      title, priority, story_points, status) VALUES (?, 1, 1, ?, 't', 'high', 1, ?)`);
    for (let i = 1; i <= 5; i++) ins.run(i, 99, 'in_progress');

    const store = new SqliteEventStore({ filename: ':memory:', serviceName: 'test-service' });

    store.appendEvents([
      {
        subject: 'Issue-10',
        events: [
          {
            id: 'u1',
            eventType: 'IssueSubmit',
            rntAggregateType: 'Issue',
            rntAggregateId: '10',
            time: '2026-04-14T09:00:00Z',
            actor: null,
            rntSchemaVersion: 1,
            data: {
              before: null,
              after: {
                status: 'open',
                title: 'x',
                projectId: 1,
                reporterId: 1,
                priority: 'high',
                storyPoints: 1,
              },
            },
            correlationId: 'seed-corr-1',
            causationId: null,
            commandId: null,
            traceparent: null,
          },
        ],
      },
    ]);

    const compiled = compileCommand(assignWithCapacitySpec, RAW_ISSUE_PDM, RAW_QSM);
    if (!compiled.ok) throw new Error(`compile failed: ${JSON.stringify(compiled.errors)}`);
    expect(compiled.value.readPrelude).not.toBeNull();

    let seq = 0;
    try {
      executeCommand(compiled.value, { issueId: 10, assigneeId: 99 }, {
        eventStore: store,
        qsmDb,
        now: () => '2026-04-14T10:00:00Z',
        nextId: () => `id-${++seq}`,
        actor: null,
        correlation: testCorrelation(),
      });
      throw new Error('expected throw');
    } catch (e) {
      expect((e as { code?: string }).code).toBe('COMMAND_GUARD_REJECTED');
    }

    qsmDb.close();
    store.close();
  });

  it('passes guard and appends event when count < threshold', () => {
    const qsmDb = new Database(':memory:');
    qsmDb.exec(`CREATE TABLE projection_issue (
      id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL, reporter_id INTEGER NOT NULL,
      assignee_id INTEGER, title TEXT NOT NULL, priority TEXT NOT NULL, story_points INTEGER NOT NULL,
      status TEXT NOT NULL, resolved_at TEXT
    );`);

    const store = new SqliteEventStore({ filename: ':memory:', serviceName: 'test-service' });

    store.appendEvents([
      {
        subject: 'Issue-10',
        events: [
          {
            id: 'u1',
            eventType: 'IssueSubmit',
            rntAggregateType: 'Issue',
            rntAggregateId: '10',
            time: '2026-04-14T09:00:00Z',
            actor: null,
            rntSchemaVersion: 1,
            data: {
              before: null,
              after: {
                status: 'open',
                title: 'x',
                projectId: 1,
                reporterId: 1,
                priority: 'high',
                storyPoints: 1,
              },
            },
            correlationId: 'seed-corr-2',
            causationId: null,
            commandId: null,
            traceparent: null,
          },
        ],
      },
    ]);

    const compiled = compileCommand(assignWithCapacitySpec, RAW_ISSUE_PDM, RAW_QSM);
    if (!compiled.ok) throw new Error(`compile failed: ${JSON.stringify(compiled.errors)}`);

    let seq = 0;
    const out = executeCommand(compiled.value, { issueId: 10, assigneeId: 99 }, {
      eventStore: store,
      qsmDb,
      now: () => '2026-04-14T10:00:00Z',
      nextId: () => `id-${++seq}`,
      actor: null,
      correlation: testCorrelation(),
    });
    expect(out.version).toBe(2);
    const stream = store.readStream('Issue-10');
    expect(stream.map((e) => e.eventType)).toEqual(['IssueSubmit', 'IssueAssign']);

    qsmDb.close();
    store.close();
  });
});
