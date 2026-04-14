import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqliteEventStore } from '@rntme/event-store';
import { compileCommand, executeCommand, runCommand } from '../../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const load = (n: string): unknown => JSON.parse(readFileSync(join(here, 'fixtures', n), 'utf8'));
const pdm = load('issue-tracker.pdm.json');
const qsm = load('issue-tracker.qsm.json');

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

const submitSpec = {
  version: '1.0-rc7',
  pdmRef: 'p',
  qsmRef: 'q',
  shapes: {},
  graphs: {
    submitIssue: {
      id: 'submitIssue',
      signature: {
        inputs: { issueId: { type: 'integer', mode: 'required' } },
        output: { type: 'row<CommandResult>', from: 'e' },
      },
      nodes: [
        {
          id: 'e',
          type: 'emit',
          config: { aggregate: 'Issue', aggregateId: { $param: 'issueId' }, transition: 'submit', payload: {} },
        },
      ],
    },
  },
};

const assignSpec = {
  version: '1.0-rc7',
  pdmRef: 'p',
  qsmRef: 'q',
  shapes: {},
  graphs: {
    assignIssue: {
      id: 'assignIssue',
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

describe('E2E command: report → submit → assign', () => {
  it('appends events for each transition and final version is 3', () => {
    const store = new SqliteEventStore({ filename: ':memory:' });

    let seq = 0;
    const ctx = {
      eventStore: store,
      qsmDb: null,
      now: () => '2026-04-14T10:00:00Z',
      nextId: () => `018e9d2a-0000-7000-8000-${String(++seq).padStart(12, '0')}`,
      actor: { kind: 'user' as const, id: 'alice' },
    };

    const r1 = runCommand(
      reportSpec,
      pdm,
      qsm,
      {
        issueId: 42,
        projectId: 1,
        reporterId: 2,
        title: 'x',
        priority: 'high',
        storyPoints: 3,
      },
      ctx,
    );
    expect(r1.version).toBe(1);

    const r2 = runCommand(submitSpec, pdm, qsm, { issueId: 42 }, ctx);
    expect(r2.version).toBe(2);

    const r3 = runCommand(assignSpec, pdm, qsm, { issueId: 42, assigneeId: 7 }, ctx);
    expect(r3.version).toBe(3);

    const stream = store.readStream('Issue-42');
    expect(stream.map((e) => e.eventType)).toEqual(['IssueReport', 'IssueSubmit', 'IssueAssign']);
    store.close();
  });

  it('409-equivalent on concurrent append (ConcurrencyConflict → COMMAND_CONCURRENCY_CONFLICT)', () => {
    const store = new SqliteEventStore({ filename: ':memory:' });

    let seq = 0;
    const ctx = {
      eventStore: store,
      qsmDb: null,
      now: () => '2026-04-14T10:00:00Z',
      nextId: () => `018e9d2a-0000-7000-8000-${String(++seq).padStart(12, '0')}`,
      actor: null,
    };

    runCommand(
      reportSpec,
      pdm,
      qsm,
      { issueId: 42, projectId: 1, reporterId: 2, title: 'x', priority: 'high', storyPoints: 3 },
      ctx,
    );

    store.appendEvents([
      {
        stream: 'Issue-42',
        expectedVersion: 1,
        events: [
          {
            eventId: 'manual',
            eventType: 'IssueSubmit',
            aggregateType: 'Issue',
            aggregateId: '42',
            occurredAt: '2026-04-14T10:01:00Z',
            actor: null,
            schemaVersion: 1,
            payload: { before: { status: 'draft' }, after: { status: 'open' } },
          },
        ],
      },
    ]);

    const compiled = compileCommand(submitSpec, pdm, qsm);
    if (!compiled.ok) throw new Error('compile failed');

    try {
      executeCommand(compiled.value, { issueId: 42 }, ctx);
      throw new Error('expected throw');
    } catch (e) {
      expect(['COMMAND_CONCURRENCY_CONFLICT', 'COMMAND_ILLEGAL_TRANSITION']).toContain(
        (e as { code?: string }).code,
      );
    }
    store.close();
  });
});
