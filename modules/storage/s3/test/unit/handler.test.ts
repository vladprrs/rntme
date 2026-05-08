import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHandler, type Handler } from '../../src/handler.js';
import { createPendingStore, type DatabaseLike } from '../../src/pending-store.js';
import { createRouteResolver } from '../../src/route-resolver.js';

const sj = {
  version: '1.0' as const,
  routes: {
    img: {
      id: 'img',
      owner: { aggregate: 'a', association: 'b' },
      maxSize: 1_000,
      allowedTypes: ['image/*'],
      maxCount: 5,
      auth: { requireRole: null },
      lifecycle: { expirePendingMs: 60_000, retainCommittedMs: null },
    },
  },
};

let h: Handler;
const events: { type: string; payload: unknown }[] = [];
const presigns: string[] = [];

beforeEach(() => {
  events.length = 0;
  presigns.length = 0;
  const s3 = {
    presign: vi.fn((key: string) => {
      const url = `https://example.com/${key}?sig=x`;
      presigns.push(url);
      return url;
    }),
    exists: vi.fn(async () => true),
    size: vi.fn(async () => 42),
    deleteObject: vi.fn(async () => undefined),
  };
  h = createHandler({
    storage: sj,
    s3,
    pendingStore: createPendingStore({
      db: new Database(':memory:') as unknown as DatabaseLike,
      now: () => 1_000_000,
    }),
    routeResolver: createRouteResolver(sj),
    bus: {
      async publish(e) {
        events.push({ type: e.type, payload: e.payload });
      },
    },
    uuid: () => 'fixed-uuid',
    now: () => 1_000_000,
    presignTtlSec: 900,
  });
});

describe('handler.PrepareUpload', () => {
  it('returns presign + emits FileUploadInitiated', async () => {
    const r = await h.PrepareUpload({
      context: { idempotency_key: 'k', correlation_id: 'c', actor_user_id: 'u' },
      route_id: 'img',
      entity_id: 'e',
      filename: 'x.png',
      content_type: 'image/png',
      declared_size: 100,
    });
    expect(r.file_id).toBeDefined();
    expect(r.presigned.url).toContain('img/e/');
    expect(events.map((e) => e.type)).toEqual(['FileUploadInitiated']);
  });

  it('idempotency: same key returns same file_id, no duplicate event', async () => {
    const context = { idempotency_key: 'idem', correlation_id: 'c', actor_user_id: 'u' };
    const a = await h.PrepareUpload({
      context,
      route_id: 'img',
      entity_id: 'e',
      filename: 'x',
      content_type: 'image/png',
      declared_size: 1,
    });
    const b = await h.PrepareUpload({
      context,
      route_id: 'img',
      entity_id: 'e',
      filename: 'x',
      content_type: 'image/png',
      declared_size: 1,
    });
    expect(b.file_id).toBe(a.file_id);
    expect(events.filter((e) => e.type === 'FileUploadInitiated').length).toBe(1);
  });

  it('rejects unknown route', async () => {
    await expect(
      h.PrepareUpload({
        context: { idempotency_key: 'k', correlation_id: 'c', actor_user_id: 'u' },
        route_id: 'nope',
        entity_id: 'e',
        filename: 'x',
        content_type: 'image/png',
        declared_size: 1,
      }),
    ).rejects.toMatchObject({ storageCode: 'STORAGE_REFERENCES_ROUTE_NOT_FOUND' });
  });
});

describe('handler.CommitUpload', () => {
  it('happy path: HEAD verifies, marks committed, emits FileUploadCommitted', async () => {
    const init = await h.PrepareUpload({
      context: { idempotency_key: 'k', correlation_id: 'c', actor_user_id: 'u' },
      route_id: 'img',
      entity_id: 'e',
      filename: 'x',
      content_type: 'image/png',
      declared_size: 100,
    });
    const out = await h.CommitUpload({
      context: { idempotency_key: 'k2', correlation_id: 'c', actor_user_id: 'u' },
      file_id: init.file_id,
    });
    expect(out.file.state).toBe(2);
    expect(events.map((e) => e.type)).toEqual(['FileUploadInitiated', 'FileUploadCommitted']);
  });

  it('idempotent: second commit returns existing record, no duplicate event', async () => {
    const init = await h.PrepareUpload({
      context: { idempotency_key: 'k', correlation_id: 'c', actor_user_id: 'u' },
      route_id: 'img',
      entity_id: 'e',
      filename: 'x',
      content_type: 'image/png',
      declared_size: 100,
    });
    await h.CommitUpload({ context: { idempotency_key: 'c1', correlation_id: 'c' }, file_id: init.file_id });
    await h.CommitUpload({ context: { idempotency_key: 'c2', correlation_id: 'c' }, file_id: init.file_id });
    expect(events.filter((e) => e.type === 'FileUploadCommitted').length).toBe(1);
  });

  it('rejects unknown file_id', async () => {
    await expect(
      h.CommitUpload({
        context: { idempotency_key: 'k', correlation_id: 'c', actor_user_id: 'u' },
        file_id: 'unknown',
      }),
    ).rejects.toMatchObject({ storageCode: 'STORAGE_REFERENCES_FILE_NOT_FOUND' });
  });
});

describe('handler.ListFiles + DeleteFile + GetDownloadUrl', () => {
  it('listFiles returns committed entries; deleteFile transitions and emits FileDeleted; getDownloadUrl presigns GET', async () => {
    const init = await h.PrepareUpload({
      context: { idempotency_key: 'k', correlation_id: 'c', actor_user_id: 'u' },
      route_id: 'img',
      entity_id: 'e',
      filename: 'x',
      content_type: 'image/png',
      declared_size: 1,
    });
    await h.CommitUpload({ context: { idempotency_key: 'c1', correlation_id: 'c' }, file_id: init.file_id });

    const list = await h.ListFiles({
      context: { idempotency_key: 'l', correlation_id: 'c' },
      route_id: 'img',
      entity_id: 'e',
      limit: 10,
      page_token: '',
    });
    expect(list.files.length).toBe(1);

    const dl = await h.GetDownloadUrl({
      context: { idempotency_key: 'g', correlation_id: 'c' },
      file_id: init.file_id,
      ttl_sec: 60,
    });
    expect(dl.presigned.url).toContain(`img/e/${init.file_id}`);

    const del = await h.DeleteFile({
      context: { idempotency_key: 'd', correlation_id: 'c', actor_user_id: 'u' },
      file_id: init.file_id,
    });
    expect(del.file.state).toBe(4);
    expect(events.filter((e) => e.type === 'FileDeleted').length).toBe(1);
  });
});
