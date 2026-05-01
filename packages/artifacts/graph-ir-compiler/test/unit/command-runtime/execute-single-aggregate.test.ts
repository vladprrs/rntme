import { describe, it, expect } from 'vitest';
import { SqliteEventStore } from '@rntme/event-store';
import { compileCommand } from '../../../src/command-runtime/compile.js';
import { executeCommand } from '../../../src/command-runtime/execute.js';
import { testCorrelation } from '../../support/correlation.js';

import { RAW_ISSUE_PDM as RAW_PDM, RAW_ISSUE_QSM_EMPTY as RAW_QSM } from '../fixtures/issue-pdm.js';

const reportSpec = {
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

describe('executeCommand — creation transition', () => {
  it('appends one event and returns CommandResult with version=1', () => {
    const store = new SqliteEventStore({ filename: ':memory:', serviceName: 'test-service' });
    const r = compileCommand(reportSpec, RAW_PDM, RAW_QSM);
    if (!r.ok) throw new Error('compile failed');

    const out = executeCommand(
      r.value,
      {
        issueId: 1,
        projectId: 7,
        reporterId: 2,
        title: 'hi',
        priority: 'high',
        storyPoints: 5,
      },
      {
        eventStore: store,
        qsmDb: null,
        now: () => '2026-04-14T10:00:00Z',
        nextId: () => '018e9d2a-aaaa-7000-8000-000000000001',
        actor: { kind: 'user', id: 'alice' },
        correlation: testCorrelation(),
      },
    );
    expect(out.aggregateId).toBe('1');
    expect(out.version).toBe(1);
    expect(out.eventIds).toHaveLength(1);
    expect(out.commandId).toBe('cmd-test');
    expect(out.correlationId).toBe('corr-test');

    const events = store.readStream('Issue-1');
    expect(events[0]!.eventType).toBe('IssueReport');
    expect((events[0]!.data as { before: unknown }).before).toBeNull();
    store.close();
  });

  it('rejects illegal transition (assign on non-existent issue)', () => {
    const store = new SqliteEventStore({ filename: ':memory:', serviceName: 'test-service' });
    const assignSpec = {
      ...reportSpec,
      graphs: {
        assign: {
          id: 'assign',
          signature: {
            inputs: {
              issueId: { type: 'integer', mode: 'required' },
              assigneeId: { type: 'integer', mode: 'required' },
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
                transition: 'assign',
                payload: { assigneeId: { $param: 'assigneeId' } },
              },
            },
          ],
        },
      },
    };
    const r = compileCommand(assignSpec, RAW_PDM, RAW_QSM);
    if (!r.ok) throw new Error('compile failed');
    try {
      executeCommand(
        r.value,
        { issueId: 42, assigneeId: 7 },
        {
          eventStore: store,
          qsmDb: null,
          now: () => '2026-04-14T10:00:00Z',
          nextId: () => 'u',
          actor: null,
          correlation: testCorrelation(),
        },
      );
      throw new Error('expected throw');
    } catch (e) {
      expect((e as { code?: string }).code).toBe('COMMAND_ILLEGAL_TRANSITION');
    } finally {
      store.close();
    }
  });
});
