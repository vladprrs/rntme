import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { AuthSubject } from './types.js';

type SqliteDatabaseLike = {
  readonly prepare: <P = unknown, R = unknown>(sql: string) => {
    readonly run: (...args: unknown[]) => unknown;
    readonly all: (...args: unknown[]) => R[];
  };
};

type AppendEventInputLike = {
  readonly id: string;
  readonly eventType: string;
  readonly rntAggregateType: string;
  readonly rntAggregateId: string;
  readonly time: string;
  readonly actor: { readonly kind: 'user' | 'system' | 'service'; readonly id: string } | null;
  readonly data: unknown;
  readonly rntSchemaVersion: number;
  readonly correlationId: string;
  readonly causationId: string | null;
  readonly commandId: string | null;
  readonly traceparent: string | null;
};

type EventStoreLike = {
  readonly appendEvents: (requests: readonly {
    readonly subject: string;
    readonly expectedVersion?: number;
    readonly events: readonly AppendEventInputLike[];
  }[]) => readonly {
    readonly subject: string;
    readonly lastVersion: number;
    readonly appendedEvents: readonly { readonly id: string; readonly version: number; readonly rowId: number }[];
  }[];
};

type RuntimeCtx = {
  readonly qsmDb: SqliteDatabaseLike;
  readonly eventStore?: EventStoreLike | null;
  readonly now: () => string;
  readonly nextId: () => string;
  readonly actor?: { readonly kind: 'user' | 'system' | 'service'; readonly id: string } | null;
  readonly correlation?: {
    readonly commandId?: string | null;
    readonly correlationId?: string | null;
    readonly traceparent?: string | null;
  };
};

export type RuntimeApiToken = {
  readonly id: string;
  readonly organizationId: string;
  readonly accountId: string;
  readonly name: string;
  readonly prefix: string;
  readonly scopesJson: string;
  readonly status: 'active' | 'revoked';
  readonly expiresAt: string | null;
  readonly lastUsedAt: string | null;
  readonly revokedAt: string | null;
  readonly createdAt: string;
};

type ApiTokenRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly account_id: string;
  readonly name: string;
  readonly prefix: string;
  readonly token_hash: string | Uint8Array;
  readonly scopes_json: string;
  readonly status: string;
  readonly expires_at: string | null;
  readonly last_used_at: string | null;
  readonly revoked_at: string | null;
  readonly created_at: string;
  readonly last_event_version: number;
};

const PAT_PREFIX = 'rntme_pat_';
const BEARER_PREFIX = 'Bearer ';
const ALLOWED_SCOPES = new Set([
  'project:read',
  'project:write',
  'project:delete',
  'version:publish',
  'member:read',
  'token:manage',
  'deploy:target:manage',
  'deploy:execute',
]);

export function isRuntimeCtx(value: unknown): value is RuntimeCtx {
  return value !== null
    && typeof value === 'object'
    && 'qsmDb' in value
    && typeof (value as { qsmDb?: { prepare?: unknown } }).qsmDb?.prepare === 'function';
}

export function normalizeBearerToken(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function platformAuthError(code: string, message: string): Error {
  const error = new Error(message);
  (error as Error & { code?: string }).code = code;
  return error;
}

export function createRuntimeToken(
  ctx: RuntimeCtx,
  input: {
    readonly organizationId: unknown;
    readonly accountId: unknown;
    readonly name: unknown;
    readonly scopesJson: unknown;
    readonly expiresAt?: unknown;
  },
): { readonly token: RuntimeApiToken; readonly plaintext: string } {
  const organizationId = requireNonEmptyString(input.organizationId, 'organizationId');
  const accountId = requireNonEmptyString(input.accountId, 'accountId');
  const name = requireNonEmptyString(input.name, 'name');
  const scopes = parseScopes(input.scopesJson);
  const expiresAt = parseOptionalIso(input.expiresAt);
  const plaintext = `${PAT_PREFIX}${randomBytes(24).toString('base64url')}`;
  const tokenHash = createHash('sha256').update(plaintext, 'utf8').digest('hex');
  const now = ctx.now();
  const id = ctx.nextId();
  const eventId = ctx.nextId();
  const prefix = plaintext.slice(0, 12);
  appendTokenEvent(ctx, {
    aggregateId: id,
    eventId,
    eventType: 'ApiTokenCreate',
    expectedVersion: 0,
    time: now,
    data: {
      before: null,
      after: {
        organizationId,
        accountId,
        name,
        prefix,
        tokenHash,
        scopesJson: JSON.stringify(scopes),
        expiresAt,
        lastUsedAt: null,
        revokedAt: null,
      },
    },
  });

  ctx.qsmDb.prepare(`
    INSERT INTO api_tokens (
      id,
      organization_id,
      account_id,
      name,
      prefix,
      token_hash,
      scopes_json,
      status,
      expires_at,
      last_used_at,
      revoked_at,
      created_at,
      last_event_id,
      last_event_version,
      applied_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, NULL, NULL, ?, ?, 1, ?)
  `).run(
    id,
    organizationId,
    accountId,
    name,
    prefix,
    tokenHash,
    JSON.stringify(scopes),
    expiresAt,
    now,
    eventId,
    now,
  );

  return {
    plaintext,
    token: {
      id,
      organizationId,
      accountId,
      name,
      prefix,
      scopesJson: JSON.stringify(scopes),
      status: 'active',
      expiresAt,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: now,
    },
  };
}

export function introspectRuntimeToken(ctx: RuntimeCtx, bearerToken: unknown): AuthSubject {
  const bearer = normalizeBearerToken(bearerToken);
  if (bearer === null) throw platformAuthError('PLATFORM_AUTH_MISSING', 'no bearer token');
  const plaintext = bearer.startsWith(BEARER_PREFIX) ? bearer.slice(BEARER_PREFIX.length) : bearer;
  if (!plaintext.startsWith(PAT_PREFIX)) {
    throw platformAuthError('PLATFORM_AUTH_MISSING', 'no bearer token');
  }

  const prefix = plaintext.slice(0, 12);
  const rows = ctx.qsmDb.prepare<[string], ApiTokenRow>(`
    SELECT
      id,
      organization_id,
      account_id,
      name,
      prefix,
      token_hash,
      scopes_json,
      status,
      expires_at,
      last_used_at,
      revoked_at,
      created_at,
      last_event_version
    FROM api_tokens
    WHERE prefix = ?
    ORDER BY created_at DESC
  `).all(prefix);

  const actual = createHash('sha256').update(plaintext, 'utf8').digest();
  const row = rows.find((candidate) => hashMatches(candidate.token_hash, actual));
  if (row === undefined) {
    throw platformAuthError('PLATFORM_AUTH_INVALID', 'invalid token');
  }
  if (row.status !== 'active' || row.revoked_at !== null) {
    throw platformAuthError('PLATFORM_AUTH_TOKEN_REVOKED', 'token revoked');
  }
  if (row.expires_at !== null && Date.parse(row.expires_at) <= Date.parse(ctx.now())) {
    throw platformAuthError('PLATFORM_AUTH_TOKEN_EXPIRED', 'token expired');
  }

  const usedAt = ctx.now();
  const touchEventId = ctx.nextId();
  const touchResult = appendTokenEvent(ctx, {
    aggregateId: row.id,
    eventId: touchEventId,
    eventType: 'ApiTokenTouchLastUsed',
    time: usedAt,
    data: {
      before: { lastUsedAt: row.last_used_at },
      after: { lastUsedAt: usedAt },
    },
  });
  const touchVersion = touchResult.appendedEvents[0]?.version ?? row.last_event_version + 1;
  ctx.qsmDb.prepare(`
    UPDATE api_tokens
    SET last_used_at = ?, last_event_id = ?, last_event_version = ?, applied_at = ?
    WHERE id = ?
  `).run(usedAt, touchEventId, touchVersion, usedAt, row.id);
  const scopes = parseScopes(row.scopes_json);
  return {
    account: {
      id: row.account_id,
      workosUserId: row.account_id,
      displayName: row.account_id,
      email: null,
    },
    org: {
      id: row.organization_id,
      workosOrgId: row.organization_id,
      slug: row.organization_id,
    },
    role: scopes.includes('token:manage') ? 'admin' : 'member',
    scopes,
    tokenId: row.id,
  };
}

function appendTokenEvent(
  ctx: RuntimeCtx,
  input: {
    readonly aggregateId: string;
    readonly eventId: string;
    readonly eventType: string;
    readonly expectedVersion?: number;
    readonly time: string;
    readonly data: unknown;
  },
): { readonly appendedEvents: readonly { readonly id: string; readonly version: number; readonly rowId: number }[] } {
  if (!isEventStoreLike(ctx.eventStore)) {
    throw platformAuthError('PLATFORM_AUTH_FORBIDDEN', 'runtime token event store is not available');
  }
  const result = ctx.eventStore.appendEvents([
    {
      subject: `ApiToken-${input.aggregateId}`,
      ...(input.expectedVersion !== undefined ? { expectedVersion: input.expectedVersion } : {}),
      events: [
        {
          id: input.eventId,
          eventType: input.eventType,
          rntAggregateType: 'ApiToken',
          rntAggregateId: input.aggregateId,
          time: input.time,
          actor: ctx.actor ?? null,
          data: input.data,
          rntSchemaVersion: 1,
          correlationId: ctx.correlation?.correlationId ?? input.eventId,
          causationId: null,
          commandId: ctx.correlation?.commandId ?? null,
          traceparent: ctx.correlation?.traceparent ?? null,
        },
      ],
    },
  ])[0];
  if (result === undefined) {
    throw platformAuthError('PLATFORM_AUTH_FORBIDDEN', 'token event append failed');
  }
  return result;
}

function isEventStoreLike(value: unknown): value is EventStoreLike {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { appendEvents?: unknown }).appendEvents === 'function';
}

function hashMatches(stored: string | Uint8Array, actual: Buffer): boolean {
  const expected = typeof stored === 'string' ? Buffer.from(stored, 'hex') : Buffer.from(stored);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function parseScopes(value: unknown): string[] {
  const raw = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(raw) || raw.length === 0) {
    throw platformAuthError('PLATFORM_AUTH_FORBIDDEN', 'token scopes are required');
  }
  const scopes = raw.map((item) => requireNonEmptyString(item, 'scope'));
  for (const scope of scopes) {
    if (!ALLOWED_SCOPES.has(scope)) {
      throw platformAuthError('PLATFORM_AUTH_FORBIDDEN', 'token scope is not allowed');
    }
  }
  return scopes;
}

function parseOptionalIso(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  const s = requireNonEmptyString(value, 'expiresAt');
  if (Number.isNaN(Date.parse(s))) {
    throw platformAuthError('PLATFORM_AUTH_FORBIDDEN', 'expiresAt must be an ISO timestamp');
  }
  return s;
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw platformAuthError('PLATFORM_AUTH_FORBIDDEN', `${field} is required`);
  }
  return value.trim();
}
