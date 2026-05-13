import { describe, it, expect } from 'bun:test';
import { createHash } from 'node:crypto';
import { ApiTokenProvider } from '@rntme/platform-core';
import { FakeStore } from '@rntme/platform-core/testing';
import {
  openSqliteDatabase,
  type SqliteDatabase,
} from '../../../../packages/runtime/sqlite/src/index.js';
import { createTokenHandler } from '../services/tokens/handlers/create-token.js';
import { introspectTokenHandler } from '../services/tokens/handlers/introspect-token.js';

type AppendRequest = {
  readonly subject: string;
  readonly expectedVersion?: number;
  readonly events: readonly {
    readonly id: string;
    readonly eventType: string;
    readonly rntAggregateType: string;
    readonly rntAggregateId: string;
    readonly time: string;
    readonly data: unknown;
  }[];
};

async function setup() {
  const store = new FakeStore();
  const org = await store.seedOrg({ slug: 'o', workosOrganizationId: 'org_1', displayName: 'O' });
  const acct = await store.seedAccount({ workosUserId: 'u', email: null, displayName: 'U' });
  await store.membershipMirror.upsert({ orgId: org.id, accountId: acct.id, role: 'member' });
  const plain = 'rntme_pat_' + 'a'.repeat(22);
  const hash = new Uint8Array(createHash('sha256').update(plain).digest());
  await store.tokensRepo.create({
    id: 'tid-1',
    orgId: org.id,
    accountId: acct.id,
    name: 'cli',
    tokenHash: hash,
    prefix: plain.slice(0, 12),
    scopes: ['project:read'],
    expiresAt: null,
  });
  const provider = new ApiTokenProvider({
    tokens: store.tokensRepo,
    organizations: store.organizations,
    accounts: store.accountsRepo,
    memberships: store.membershipMirror,
  });
  return { provider, plain };
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
    return null;
  } catch (err) {
    return err;
  }
}

function createTokenDb(): SqliteDatabase {
  const db = openSqliteDatabase({ filename: ':memory:' });
  db.exec(`
    CREATE TABLE api_tokens (
      id TEXT NOT NULL PRIMARY KEY,
      organization_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      prefix TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      scopes_json TEXT NOT NULL,
      status TEXT NOT NULL,
      expires_at TEXT NULL,
      last_used_at TEXT NULL,
      revoked_at TEXT NULL,
      created_at TEXT NOT NULL,
      last_event_id TEXT NOT NULL,
      last_event_version INTEGER NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
  return db;
}

function createFakeEventStore() {
  const versions = new Map<string, number>();
  const requests: AppendRequest[] = [];
  return {
    requests,
    appendEvents(input: readonly AppendRequest[]) {
      return input.map((request) => {
        requests.push(request);
        const current = versions.get(request.subject) ?? 0;
        if (request.expectedVersion !== undefined && request.expectedVersion !== current) {
          throw new Error(`expected ${request.expectedVersion}, got ${current}`);
        }
        const appendedEvents = request.events.map((event, index) => ({
          id: event.id,
          version: current + index + 1,
          rowId: current + index + 1,
        }));
        versions.set(request.subject, current + request.events.length);
        return {
          subject: request.subject,
          lastVersion: current + request.events.length,
          appendedEvents,
        };
      });
    },
  };
}

describe('introspectTokenHandler', () => {
  it('mints a runtime-native PAT, stores only its hash, and introspects it from SQLite', async () => {
    const db = createTokenDb();
    try {
      const ids = ['tok-runtime-1', 'evt-create-1', 'evt-touch-1'];
      const eventStore = createFakeEventStore();
      const ctx = {
        qsmDb: db,
        eventStore,
        now: () => '2026-05-13T00:00:00.000Z',
        nextId: () => ids.shift() ?? 'unexpected-id',
        actor: { kind: 'user', id: 'auth0|alice' },
        correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null },
      };

      const created = await createTokenHandler(
        {
          organizationId: 'org_uZUWhpWgK54VWC2X',
          name: 'cli',
          scopesJson: JSON.stringify(['project:read']),
          sessionSubject: 'auth0|alice',
          sessionStatus: 'ACTIVE',
        },
        ctx as never,
      );

      expect(created.status).toBe('created');
      if (created.status !== 'created') return;
      expect(created.plaintext).toMatch(/^rntme_pat_/);
      expect(created.token.prefix).toBe(created.plaintext.slice(0, 12));

      const row = db.prepare('SELECT token_hash, prefix FROM api_tokens WHERE id = ?').get('tok-runtime-1') as
        | { token_hash: string; prefix: string }
        | undefined;
      expect(row).toBeDefined();
      expect(row?.token_hash).not.toBe(created.plaintext);
      expect(row?.token_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(eventStore.requests[0]?.subject).toBe('ApiToken-tok-runtime-1');
      expect(eventStore.requests[0]?.expectedVersion).toBe(0);
      expect(eventStore.requests[0]?.events[0]?.eventType).toBe('ApiTokenCreate');

      const out = await introspectTokenHandler(
        { bearerToken: `Bearer ${created.plaintext}` },
        ctx as never,
      );
      expect(out.status).toBe('active');
      if (out.status === 'active') {
        expect(out.subject.account.id).toBe('auth0|alice');
        expect(out.subject.org.id).toBe('org_uZUWhpWgK54VWC2X');
        expect(out.subject.tokenId).toBe('tok-runtime-1');
      }
      const touched = db.prepare('SELECT last_used_at FROM api_tokens WHERE id = ?').get('tok-runtime-1') as
        | { last_used_at: string | null }
        | undefined;
      expect(touched?.last_used_at).toBe('2026-05-13T00:00:00.000Z');
      expect(eventStore.requests[1]?.subject).toBe('ApiToken-tok-runtime-1');
      expect(eventStore.requests[1]?.events[0]?.eventType).toBe('ApiTokenTouchLastUsed');
    } finally {
      db.close();
    }
  });

  it('returns a typed PLATFORM_AUTH_* error when invoked with the runtime-native call shape', async () => {
    const thrown = await captureError(
      introspectTokenHandler(
        { bearerToken: `Bearer rntme_pat_${'z'.repeat(22)}` },
        { correlation: { commandId: 'cmd-1', correlationId: 'corr-1', traceparent: null } } as never,
      ),
    );

    expect(thrown).toBeInstanceOf(Error);
    if (thrown instanceof Error) {
      expect((thrown as Error & { code?: string }).code).toBe('PLATFORM_AUTH_INVALID');
      expect(thrown.message).toBe('invalid token');
    }
  });

  it('returns active status for a valid PAT', async () => {
    const { provider, plain } = await setup();
    const out = await introspectTokenHandler(
      { provider },
      { bearerToken: `Bearer ${plain}` },
    );
    expect(out.status).toBe('active');
    if (out.status === 'active') {
      expect(out.subject.account.id).toBeDefined();
      expect(out.subject.tokenId).toBe('tid-1');
    }
  });

  it('throws PLATFORM_AUTH_* with typed code for an unknown PAT', async () => {
    const { provider } = await setup();
    let thrown: unknown = null;
    try {
      await introspectTokenHandler(
        { provider },
        { bearerToken: `Bearer rntme_pat_${'z'.repeat(22)}` },
      );
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(Error);
    if (thrown instanceof Error) {
      const code = (thrown as Error & { code?: string }).code;
      expect(typeof code).toBe('string');
      expect(code?.startsWith('PLATFORM_AUTH_')).toBe(true);
      expect(code).toBe('PLATFORM_AUTH_INVALID');
    }
  });
});
