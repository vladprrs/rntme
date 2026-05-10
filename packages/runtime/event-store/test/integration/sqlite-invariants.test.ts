import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'bun:test';
import { SqliteEventStore } from '../../src/store/sqlite.js';
import { makeEvent, makeRequest } from '../fixtures/sample-events.js';

const openStores: SqliteEventStore[] = [];
const tempDirs: string[] = [];

afterEach(() => {
  while (openStores.length > 0) {
    openStores.pop()?.close();
  }
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

function tempDbPath(name = 'events.db'): string {
  const dir = mkdtempSync(join(tmpdir(), 'rntme-event-store-'));
  tempDirs.push(dir);
  return join(dir, name);
}

function open(filename: string, serviceName = 'issue-tracker'): SqliteEventStore {
  const store = new SqliteEventStore({ filename, serviceName });
  openStores.push(store);
  return store;
}

describe('SqliteEventStore integration invariants', () => {
  it('persists serviceName per database and rejects reopening with a different serviceName', () => {
    const filename = tempDbPath();
    const first = open(filename, 'issue-tracker');
    first.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'e1' })], 0)]);
    first.close();
    openStores.pop();

    const same = open(filename, 'issue-tracker');
    expect(same.readStream('Issue-1')[0]?.source).toBe('rntme://issue-tracker/Issue');
    same.close();
    openStores.pop();

    expect(() => open(filename, 'renamed-service')).toThrow(/EVENT_STORE_SERVICE_NAME_MISMATCH/);
  });

  it('rejects existing event logs that predate persisted serviceName metadata', () => {
    const filename = tempDbPath();
    const store = open(filename, 'issue-tracker');
    store.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'legacy-e1' })], 0)]);
    store.rawDb().prepare("DELETE FROM event_store_metadata WHERE key = 'service_name'").run();
    store.close();
    openStores.pop();

    expect(() => open(filename, 'issue-tracker')).toThrow(
      /EVENT_STORE_SERVICE_NAME_UNINITIALIZED/,
    );
  });

  it('allows only one live SqliteEventStore writer per file in this process', () => {
    const filename = tempDbPath();
    const first = open(filename);

    expect(() => new SqliteEventStore({ filename, serviceName: 'issue-tracker' })).toThrow(
      /EVENT_STORE_SQLITE_SINGLE_WRITER/,
    );

    first.close();
    openStores.pop();

    const reopened = open(filename);
    expect(reopened.readFrom({ afterId: 0, limit: 10 })).toEqual([]);
  });

  it('does not apply the single-writer guard to independent in-memory databases', () => {
    const a = open(':memory:');
    const b = open(':memory:');

    a.appendEvents([makeRequest('Issue-1', [makeEvent({ id: 'a' })], 0)]);

    expect(a.readStream('Issue-1')).toHaveLength(1);
    expect(b.readStream('Issue-1')).toHaveLength(0);
  });

  it('keeps raw replay idempotent by event_id and preserves monotonic relay cursors', () => {
    const store = open(tempDbPath());
    const [first] = store.appendEvents([
      makeRequest('Issue-1', [makeEvent({ id: 'e1' }), makeEvent({ id: 'e2' })], 0),
    ]);
    const [e1, e2] = store.readStream('Issue-1');

    store.appendRaw([e1!, e2!], { ignoreDuplicates: true });

    expect(store.readStream('Issue-1').map((event) => event.id)).toEqual(['e1', 'e2']);
    expect(first?.appendedEvents.map((event) => event.rowId)).toEqual([1, 2]);

    store.writeCursor('relay-main', 2);
    expect(() => store.writeCursor('relay-main', 1)).toThrow(/monotonic/i);
    expect(store.readCursor('relay-main')).toBe(2);
  });
});
