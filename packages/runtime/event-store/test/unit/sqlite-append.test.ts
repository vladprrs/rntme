import { describe, it, expect, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { assertSchemaD9Compatible } from '../../src/store/schema.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

let store: SqliteEventStore | null = null;
afterEach(() => { store?.close(); store = null; });

const SERVICE = 'test-service';

function newStore(): SqliteEventStore {
  return new SqliteEventStore({ filename: ':memory:', serviceName: SERVICE });
}

describe('SqliteEventStore constructor', () => {
  it('rejects missing serviceName', () => {
    expect(
      () => new SqliteEventStore({ filename: ':memory:', serviceName: '' }),
    ).toThrow(/serviceName is required/);
  });

  it('rejects pre-D9 schemas via assertSchemaD9Compatible', () => {
    const db = new Database(':memory:');
    db.exec(
      `CREATE TABLE event_log (
        id INTEGER PRIMARY KEY,
        stream TEXT,
        version INTEGER,
        event_type TEXT,
        event_id TEXT UNIQUE
      );`,
    );
    db.prepare(
      `INSERT INTO event_log (stream, version, event_type, event_id) VALUES ('s', 1, 't', 'e')`,
    ).run();
    expect(() => assertSchemaD9Compatible(db)).toThrow(/EVENT_STORE_SCHEMA_INCOMPATIBLE/);
  });
});

describe('SqliteEventStore.appendEvents — single subject', () => {
  it('appends a single event to a new subject as version 1', () => {
    store = newStore();
    const [result] = store.appendEvents([
      makeRequest('Issue-1', [makeEvent({ id: 'e1' })]),
    ]);
    expect(result).toBeDefined();
    expect(result!.subject).toBe('Issue-1');
    expect(result!.lastVersion).toBe(1);
    expect(result!.appendedEvents).toHaveLength(1);
    expect(result!.appendedEvents[0]!.id).toBe('e1');
    expect(result!.appendedEvents[0]!.version).toBe(1);
    expect(result!.appendedEvents[0]!.rowId).toBeGreaterThan(0);
  });

  it('assigns version = previous max + 1 across append calls', () => {
    store = newStore();
    const [r1] = store.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'e1' })])]);
    const [r2] = store.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'e2' })])]);
    expect(r1!.lastVersion).toBe(1);
    expect(r2!.lastVersion).toBe(2);
    expect(r2!.appendedEvents[0]!.version).toBe(2);
  });

  it('assigns monotonically increasing versions within one request', () => {
    store = newStore();
    const [r] = store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({ id: 'e1' }),
        makeEvent({ id: 'e2' }),
        makeEvent({ id: 'e3' }),
      ]),
    ]);
    expect(r!.lastVersion).toBe(3);
    expect(r!.appendedEvents.map((a) => a.version)).toEqual([1, 2, 3]);
    const rowIds = r!.appendedEvents.map((a) => a.rowId);
    expect(rowIds[0]! < rowIds[1]! && rowIds[1]! < rowIds[2]!).toBe(true);
  });

  it('persists all envelope fields (raw readback)', () => {
    store = newStore();
    store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({
          id: 'e1',
          eventType: 'IssueReport',
          actor: { kind: 'user', id: 'alice' },
          data: { before: null, after: { status: 'draft', title: 't' } },
          rntSchemaVersion: 1,
          correlationId: 'corr-1',
          causationId: 'cause-1',
          commandId: 'cmd-1',
          traceparent: '00-trace-span-01',
        }),
      ]),
    ]);
    const row = store.rawDb()
      .prepare('SELECT * FROM event_log WHERE event_id = ?')
      .get('e1') as {
        subject: string;
        aggregate_type: string;
        aggregate_id: string;
        version: number;
        event_type: string;
        actor_kind: string | null;
        actor_id: string | null;
        occurred_at: string;
        payload_json: string;
        schema_version: number;
        correlation_id: string;
        causation_id: string | null;
        command_id: string | null;
        traceparent: string | null;
      };
    expect(row.subject).toBe('Issue-1');
    expect(row.aggregate_type).toBe('Issue');
    expect(row.aggregate_id).toBe('1');
    expect(row.version).toBe(1);
    expect(row.event_type).toBe('IssueReport');
    expect(row.actor_kind).toBe('user');
    expect(row.actor_id).toBe('alice');
    expect(JSON.parse(row.payload_json)).toEqual({ before: null, after: { status: 'draft', title: 't' } });
    expect(row.schema_version).toBe(1);
    expect(row.correlation_id).toBe('corr-1');
    expect(row.causation_id).toBe('cause-1');
    expect(row.command_id).toBe('cmd-1');
    expect(row.traceparent).toBe('00-trace-span-01');
  });

  it('envelope read-back includes CE-derived fields (source / type / dataSchema / correlation)', () => {
    store = newStore();
    store.appendEvents([
      makeRequest('Issue-1', [
        makeEvent({
          id: 'e1',
          eventType: 'IssueReport',
          rntAggregateType: 'Issue',
          rntAggregateId: '1',
          rntSchemaVersion: 2,
          correlationId: 'corr-x',
          causationId: 'cause-x',
          commandId: 'cmd-x',
          traceparent: '00-t-s-01',
        }),
      ]),
    ]);
    const [env] = store.readStream('Issue-1');
    expect(env!.id).toBe('e1');
    expect(env!.source).toBe(`rntme://${SERVICE}/Issue`);
    expect(env!.type).toBe(`${SERVICE}.Issue.IssueReport`);
    expect(env!.dataSchema).toBe(`rntme://schemas/${SERVICE}/IssueReport.v2.json`);
    expect(env!.dataContentType).toBe('application/json');
    expect(env!.subject).toBe('Issue-1');
    expect(env!.correlationId).toBe('corr-x');
    expect(env!.causationId).toBe('cause-x');
    expect(env!.commandId).toBe('cmd-x');
    expect(env!.traceparent).toBe('00-t-s-01');
    expect(env!.rntAggregateType).toBe('Issue');
    expect(env!.rntAggregateId).toBe('1');
    expect(env!.rntVersion).toBe(1);
    expect(env!.rntSchemaVersion).toBe(2);
    expect(env!.rntActorKind).toBe('user');
    expect(env!.rntActorId).toBe('alice');
  });
});
