import { v7 as uuidv7 } from 'uuid';
import { mapS3ErrorToStorageCode } from './error-mapper.js';
import { GrpcStatus, StorageS3Error } from './errors.js';
import type { EventBusLike } from './event-bus.js';
import type { FileRow, PendingStore } from './pending-store.js';
import type { RouteResolver, StorageJsonLike } from './route-resolver.js';
import type { S3ClientLike } from './s3-client.js';

const FILE_STATE = {
  PENDING: 1,
  COMMITTED: 2,
  ABORTED: 3,
  DELETED: 4,
} as const;

interface RequestContext {
  idempotency_key: string;
  correlation_id: string;
  actor_user_id?: string;
}

type ProtoTimestamp = { seconds: number; nanos: number };

function tsFromMs(ms: number | null | undefined): ProtoTimestamp | undefined {
  if (ms === null || ms === undefined) return undefined;
  return { seconds: Math.floor(ms / 1000), nanos: (ms % 1000) * 1_000_000 };
}

function int64ToNumber(value: unknown, field: string): number {
  if (typeof value === 'number') return checkedInt64Number(value, field);
  if (typeof value === 'bigint') return checkedInt64Number(Number(value), field);
  if (typeof value === 'string' && value.trim() !== '') return checkedInt64Number(Number(value), field);
  if (value !== null && typeof value === 'object') {
    const withToNumber = value as { toNumber?: unknown };
    if (typeof withToNumber.toNumber === 'function') {
      return checkedInt64Number(withToNumber.toNumber(), field);
    }

    const bits = value as { low?: unknown; high?: unknown; unsigned?: unknown };
    if (typeof bits.low === 'number' && typeof bits.high === 'number') {
      const low = bits.low >>> 0;
      const high = bits.unsigned === true ? bits.high >>> 0 : bits.high | 0;
      return checkedInt64Number(high * 0x1_0000_0000 + low, field);
    }
  }

  throw new TypeError(`${field} must be an int64-compatible value`);
}

function checkedInt64Number(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative safe integer`);
  }
  return value;
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeContext(value: unknown): RequestContext {
  const raw = value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    idempotency_key: stringField(raw.idempotency_key ?? raw.idempotencyKey),
    correlation_id: stringField(raw.correlation_id ?? raw.correlationId),
    ...(raw.actor_user_id !== undefined || raw.actorUserId !== undefined
      ? { actor_user_id: stringField(raw.actor_user_id ?? raw.actorUserId) }
      : {}),
  };
}

function fileToProto(row: FileRow): Record<string, unknown> {
  return {
    file_id: row.fileId,
    route_id: row.routeId,
    entity_id: row.entityId,
    owner_principal_id: row.ownerPrincipal,
    state:
      row.state === 'pending'
        ? FILE_STATE.PENDING
        : row.state === 'committed'
          ? FILE_STATE.COMMITTED
          : row.state === 'aborted'
            ? FILE_STATE.ABORTED
            : FILE_STATE.DELETED,
    content_type: row.contentType,
    declared_size: row.declaredSize ?? 0,
    actual_size: row.actualSize ?? 0,
    sha256: row.sha256 ?? '',
    object_key: row.objectKey,
    initiated_at: tsFromMs(row.initiatedAt),
    expires_at: tsFromMs(row.expiresAt),
    committed_at: tsFromMs(row.committedAt),
    deleted_at: tsFromMs(row.deletedAt),
  };
}

export interface HandlerDeps {
  storage: StorageJsonLike;
  s3: S3ClientLike;
  pendingStore: PendingStore;
  routeResolver: RouteResolver;
  bus: EventBusLike;
  uuid?: () => string;
  now?: () => number;
  presignTtlSec: number;
}

type Presigned = {
  url: string;
  headers: Record<string, string>;
  expires_at: ProtoTimestamp;
};

export interface Handler {
  PrepareUpload(req: {
    context: RequestContext;
    route_id: string;
    entity_id: string;
    filename: string;
    content_type: string;
    declared_size: number;
  }): Promise<{ file_id: string; object_key: string; presigned: Presigned }>;
  CommitUpload(req: { context: RequestContext; file_id: string }): Promise<{ file: Record<string, unknown> }>;
  AbortUpload(req: {
    context: RequestContext;
    file_id: string;
    reason?: string;
  }): Promise<{ file: Record<string, unknown> }>;
  GetFile(req: { context: RequestContext; file_id: string }): Promise<{ file: Record<string, unknown> }>;
  ListFiles(req: {
    context: RequestContext;
    route_id: string;
    entity_id: string;
    limit: number;
    page_token: string;
  }): Promise<{ files: Record<string, unknown>[]; next_page_token: string }>;
  GetDownloadUrl(req: {
    context: RequestContext;
    file_id: string;
    ttl_sec: number;
  }): Promise<{ presigned: Presigned }>;
  DeleteFile(req: { context: RequestContext; file_id: string }): Promise<{ file: Record<string, unknown> }>;
}

export function createHandler(deps: HandlerDeps): Handler {
  const uuid = deps.uuid ?? uuidv7;
  const now = deps.now ?? (() => Date.now());

  async function makePresign(key: string, method: 'PUT' | 'GET', expiresIn: number, contentType?: string): Promise<Presigned> {
    try {
      const url = await deps.s3.presign(key, { method, expiresIn, contentType });
      return {
        url,
        headers: {},
        expires_at: tsFromMs(now() + expiresIn * 1000) ?? { seconds: 0, nanos: 0 },
      };
    } catch (error) {
      const code = mapS3ErrorToStorageCode(error);
      throw new StorageS3Error(
        code === 'STORAGE_VENDOR_NETWORK_ERROR' ? 'STORAGE_VENDOR_PRESIGN_FAILED' : code,
        'failed to create presigned URL',
        GrpcStatus.UNAVAILABLE,
        error,
      );
    }
  }

  function findRequired(fileId: string): FileRow {
    const row = deps.pendingStore.findById(fileId);
    if (row === null) {
      throw new StorageS3Error('STORAGE_REFERENCES_FILE_NOT_FOUND', 'file not found', GrpcStatus.NOT_FOUND);
    }
    return row;
  }

  return {
    async PrepareUpload(req) {
      const context = normalizeContext(req.context);
      const declaredSize = int64ToNumber(req.declared_size, 'declared_size');
      const currentCount = deps.pendingStore.countCommitted(req.route_id, req.entity_id);
      const allowed = deps.routeResolver.checkUploadAllowed(req.route_id, {
        contentType: req.content_type,
        declaredSize,
        currentCount,
      });
      if (allowed.ok !== true) {
        throw new StorageS3Error(allowed.error, allowed.message, GrpcStatus.FAILED_PRECONDITION);
      }

      const fileId = uuid();
      const objectKey = `${req.route_id}/${req.entity_id}/${fileId}`;
      const insert = deps.pendingStore.insertPending({
        fileId,
        routeId: req.route_id,
        entityId: req.entity_id,
        ownerPrincipal: context.actor_user_id ?? '',
        contentType: req.content_type,
        declaredSize,
        objectKey,
        ttlMs: allowed.route.lifecycle.expirePendingMs,
        idempotencyKey: context.idempotency_key,
      });

      const presigned = await makePresign(
        insert.objectKey,
        'PUT',
        Math.min(deps.presignTtlSec, Math.floor(allowed.route.lifecycle.expirePendingMs / 1000)),
        req.content_type,
      );

      if (!insert.deduped) {
        await deps.bus.publish({
          type: 'FileUploadInitiated',
          subject: insert.fileId,
          payload: {
            file_id: insert.fileId,
            route_id: req.route_id,
            entity_id: req.entity_id,
            owner_principal_id: context.actor_user_id ?? '',
            content_type: req.content_type,
            declared_size: declaredSize,
            expires_at: tsFromMs(insert.expiresAt),
          },
          extensions: {
            correlation_id: context.correlation_id,
            idempotency_key: context.idempotency_key,
          },
        });
      }

      return { file_id: insert.fileId, object_key: insert.objectKey, presigned };
    },

    async CommitUpload(req) {
      const row = findRequired(req.file_id);
      if (row.state === 'committed') return { file: fileToProto(row) };
      if (row.state !== 'pending') {
        throw new StorageS3Error(
          'STORAGE_CONSISTENCY_FILE_ALREADY_COMMITTED',
          `file is ${row.state}`,
          GrpcStatus.FAILED_PRECONDITION,
        );
      }
      if (row.expiresAt < now()) {
        throw new StorageS3Error(
          'STORAGE_CONSISTENCY_UPLOAD_EXPIRED',
          'upload expired',
          GrpcStatus.FAILED_PRECONDITION,
        );
      }

      try {
        const exists = await deps.s3.exists(row.objectKey);
        if (!exists) {
          throw new StorageS3Error(
            'STORAGE_VENDOR_OBJECT_NOT_FOUND',
            'object missing',
            GrpcStatus.NOT_FOUND,
          );
        }
        const actualSize = await deps.s3.size(row.objectKey);
        deps.pendingStore.markCommitted(req.file_id, { actualSize, sha256: '' });
      } catch (error) {
        if (error instanceof StorageS3Error) throw error;
        throw new StorageS3Error(
          mapS3ErrorToStorageCode(error),
          'vendor object verification failed',
          GrpcStatus.UNAVAILABLE,
          error,
        );
      }

      const updated = findRequired(req.file_id);
      await deps.bus.publish({
        type: 'FileUploadCommitted',
        subject: updated.fileId,
        payload: {
          file_id: updated.fileId,
          object_key: updated.objectKey,
          sha256: updated.sha256 ?? '',
          size_bytes: updated.actualSize ?? 0,
          committed_at: tsFromMs(updated.committedAt),
        },
        extensions: { correlation_id: req.context.correlation_id },
      });
      return { file: fileToProto(updated) };
    },

    async AbortUpload(req) {
      const row = findRequired(req.file_id);
      if (row.state === 'aborted' || row.state === 'deleted') return { file: fileToProto(row) };
      deps.pendingStore.markAborted(req.file_id, req.reason);
      try {
        await deps.s3.deleteObject(row.objectKey);
      } catch {
        // best-effort cleanup
      }
      const updated = findRequired(req.file_id);
      await deps.bus.publish({
        type: 'FileUploadAborted',
        subject: req.file_id,
        payload: {
          file_id: req.file_id,
          reason: req.reason ?? 'client_abort',
          aborted_at: tsFromMs(now()),
        },
      });
      return { file: fileToProto(updated) };
    },

    async GetFile(req) {
      return { file: fileToProto(findRequired(req.file_id)) };
    },

    async ListFiles(req) {
      const limit = req.limit > 0 ? Math.min(req.limit, 100) : 100;
      return {
        files: deps.pendingStore.listCommitted(req.route_id, req.entity_id, limit).map(fileToProto),
        next_page_token: '',
      };
    },

    async GetDownloadUrl(req) {
      const row = findRequired(req.file_id);
      if (row.state !== 'committed') {
        throw new StorageS3Error('STORAGE_REFERENCES_FILE_NOT_FOUND', 'file not committed', GrpcStatus.NOT_FOUND);
      }
      return { presigned: await makePresign(row.objectKey, 'GET', req.ttl_sec > 0 ? req.ttl_sec : deps.presignTtlSec) };
    },

    async DeleteFile(req) {
      const row = findRequired(req.file_id);
      if (row.state === 'deleted') return { file: fileToProto(row) };
      try {
        await deps.s3.deleteObject(row.objectKey);
      } catch {
        // deletion is idempotent; missing vendor object still leaves metadata deleted
      }
      deps.pendingStore.markDeleted(req.file_id);
      const updated = findRequired(req.file_id);
      await deps.bus.publish({
        type: 'FileDeleted',
        subject: req.file_id,
        payload: {
          file_id: req.file_id,
          deleted_by: req.context.actor_user_id ?? '',
          deleted_at: tsFromMs(now()),
        },
      });
      return { file: fileToProto(updated) };
    },
  };
}
