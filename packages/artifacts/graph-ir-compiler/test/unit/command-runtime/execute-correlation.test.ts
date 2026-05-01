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

describe('executeCommand — correlation propagation', () => {
  it('stamps every appended event with correlationId, causationId=commandId, commandId, traceparent', () => {
    const store = new SqliteEventStore({ filename: ':memory:', serviceName: 'test-service' });
    const r = compileCommand(reportSpec, RAW_PDM, RAW_QSM);
    if (!r.ok) throw new Error('compile failed');

    const correlation = testCorrelation({
      commandId: 'cmd-corr-1',
      correlationId: 'corr-xyz-1',
      traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
    });

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
        correlation,
      },
    );

    // CommandResult echoes commandId + correlationId.
    expect(out.commandId).toBe('cmd-corr-1');
    expect(out.correlationId).toBe('corr-xyz-1');

    // Persisted envelopes carry correlation fields.
    const events = store.readStream('Issue-1');
    expect(events).toHaveLength(1);
    const envelope = events[0]!;
    expect(envelope.correlationId).toBe('corr-xyz-1');
    expect(envelope.causationId).toBe('cmd-corr-1');
    expect(envelope.commandId).toBe('cmd-corr-1');
    expect(envelope.traceparent).toBe('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');
    store.close();
  });

  it('propagates null traceparent end-to-end', () => {
    const store = new SqliteEventStore({ filename: ':memory:', serviceName: 'test-service' });
    const r = compileCommand(reportSpec, RAW_PDM, RAW_QSM);
    if (!r.ok) throw new Error('compile failed');

    executeCommand(
      r.value,
      {
        issueId: 2,
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
        nextId: () => '018e9d2a-aaaa-7000-8000-000000000002',
        actor: null,
        correlation: testCorrelation({ commandId: 'cmd-2', correlationId: 'corr-2', traceparent: null }),
      },
    );

    const envelope = store.readStream('Issue-2')[0]!;
    expect(envelope.traceparent).toBeNull();
    expect(envelope.causationId).toBe('cmd-2');
    expect(envelope.commandId).toBe('cmd-2');
    expect(envelope.correlationId).toBe('corr-2');
    store.close();
  });
});
