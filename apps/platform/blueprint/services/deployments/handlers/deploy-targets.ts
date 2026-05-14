import {
  CreateDeployTargetRequestSchema,
  UpdateDeployTargetRequestSchema,
  createDeployTarget,
  deleteDeployTarget,
  getDeployTarget,
  isOk,
  listDeployTargets,
  updateDeployTarget,
  type PlatformError,
} from '@rntme/platform-core';
import { requireActiveRuntimeSession, resolveAuthorizedOrg } from './shared.js';
import type {
  CreateDeployTargetInput,
  CreateDeployTargetOutput,
  DeleteDeployTargetInput,
  DeleteDeployTargetOutput,
  DeployTargetCrudDeps,
  GetDeployTargetInput,
  GetDeployTargetOutput,
  ListDeployTargetsInput,
  ListDeployTargetsOutput,
  UpdateDeployTargetInput,
  UpdateDeployTargetOutput,
} from './types.js';
import {
  isRuntimeCtx,
} from '../../tokens/handlers/runtime-token-store.js';
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';

type RuntimeCtx = {
  readonly qsmDb: {
    readonly exec?: (sql: string) => unknown;
    readonly prepare: <P = unknown, R = unknown>(sql: string) => {
      readonly get: (...args: unknown[]) => R | undefined;
      readonly all: (...args: unknown[]) => R[];
      readonly run: (...args: unknown[]) => unknown;
    };
  };
  readonly nextId?: () => string;
  readonly now?: () => string;
};

type DeployTargetRow = {
  readonly id: string;
  readonly organization_id: string;
  readonly slug: string;
  readonly provider: string;
  readonly environment: string;
  readonly config_json: string;
  readonly status: string;
  readonly created_at: string;
};

/** GET /api/deployments/targets — list deploy targets for the authorized org. */
export async function listDeployTargetsHandler(
  depsOrInput: DeployTargetCrudDeps | ListDeployTargetsInput,
  inputOrCtx: ListDeployTargetsInput | RuntimeCtx,
): Promise<ListDeployTargetsOutput> {
  if (!isDeps(depsOrInput)) {
    return listDeployTargetsRuntimeNative(depsOrInput, inputOrCtx as RuntimeCtx);
  }
  const deps = depsOrInput;
  const input = inputOrCtx as ListDeployTargetsInput;
  const authz = await resolveAuthorizedOrg({
    provider: deps.provider,
    organizations: deps.repos.organizations,
    authorization: input.authorization,
    organizationId: input.organizationId,
  });
  if (authz.status !== 'ok') return { status: 'error', errors: authz.errors };

  const result = await listDeployTargets({ repos: { deployTargets: deps.repos.deployTargets } }, {
    orgId: authz.orgId,
  });
  if (!isOk(result)) return { status: 'error', errors: result.errors };
  return { status: 'ok', targets: result.value };
}

function listDeployTargetsRuntimeNative(
  input: ListDeployTargetsInput,
  ctx: RuntimeCtx,
): ListDeployTargetsOutput {
  if (!isRuntimeCtx(ctx)) {
    return {
      status: 'error',
      errors: [{ code: 'PLATFORM_AUTH_INVALID', message: 'runtime deploy-target storage is not available' }],
    };
  }
  const session = requireActiveRuntimeSession(input);
  if (session.status !== 'ok') return { status: 'error', errors: session.errors };
  const rows = ctx.qsmDb.prepare<[string], DeployTargetRow>(`
    SELECT
      id,
      organization_id,
      slug,
      provider,
      environment,
      config_json,
      status,
      created_at
    FROM deploy_targets
    WHERE organization_id = ? AND status = 'active'
    ORDER BY created_at DESC
  `).all(input.organizationId);

  return {
    status: 'ok',
    targets: rows.map(runtimeRowToDeployTarget),
  };
}

function runtimeRowToDeployTarget(row: DeployTargetRow): ListDeployTargetsOutput extends { targets: readonly (infer T)[] } ? T : never {
  const config = parseConfigJson(row.config_json);
  return {
    id: row.id,
    orgId: row.organization_id,
    slug: row.slug,
    displayName: readString(config.displayName) ?? row.slug,
    kind: readString(config.kind) ?? row.provider,
    dokployUrl: readString(config.dokployUrl) ?? '',
    publicBaseUrl: readNullableString(config.publicBaseUrl),
    dokployProjectId: readNullableString(config.dokployProjectId),
    dokployProjectName: readNullableString(config.dokployProjectName),
    allowCreateProject: readBoolean(config.allowCreateProject) ?? false,
    apiTokenRedacted: '***',
    eventBus: readRecord(config.eventBus) ?? { kind: 'kafka', mode: 'external', brokers: [] },
    modules: readRecord(config.modules) ?? {},
    workflows: readRecord(config.workflows) ?? null,
    storage: readRecord(config.storage) ?? { mode: 'external' },
    auth: readRecord(config.auth) ?? {},
    policyValues: readRecord(config.policyValues) ?? {},
    manualAccess: readRecord(config.manualAccess) ?? {},
    isDefault: readBoolean(config.isDefault) ?? false,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.created_at),
  } as never;
}

function parseConfigJson(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : readString(value);
}

function readBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function isDeps(value: unknown): value is DeployTargetCrudDeps {
  return value !== null
    && typeof value === 'object'
    && typeof (value as { provider?: unknown }).provider === 'object'
    && typeof (value as { repos?: unknown }).repos === 'object';
}

/** GET /api/deployments/targets/{slug} — fetch one deploy target. */
export async function getDeployTargetHandler(
  deps: DeployTargetCrudDeps,
  input: GetDeployTargetInput,
): Promise<GetDeployTargetOutput> {
  const auth = await deps.provider.authenticate({
    authorizationHeader: input.authorization,
    cookieHeader: undefined,
  });
  if (!isOk(auth)) return { status: 'error', errors: auth.errors };

  const result = await getDeployTarget({ repos: { deployTargets: deps.repos.deployTargets } }, {
    orgId: auth.value.org.id,
    slug: input.slug,
  });
  if (!isOk(result)) return { status: 'error', errors: result.errors };
  if (result.value === null) return { status: 'not_found', slug: input.slug };
  return { status: 'ok', target: result.value };
}

/** POST /api/deployments/targets — create a deploy target. */
export async function createDeployTargetHandler(
  depsOrInput: DeployTargetCrudDeps | CreateDeployTargetInput,
  inputOrCtx: CreateDeployTargetInput | RuntimeCtx,
): Promise<CreateDeployTargetOutput> {
  if (!isDeps(depsOrInput)) {
    return createDeployTargetRuntimeNative(depsOrInput, inputOrCtx as RuntimeCtx);
  }
  const deps = depsOrInput;
  const input = inputOrCtx as CreateDeployTargetInput;
  const authz = await resolveAuthorizedOrg({
    provider: deps.provider,
    organizations: deps.repos.organizations,
    authorization: input.authorization,
    organizationId: input.organizationId,
  });
  if (authz.status !== 'ok') return { status: 'error', errors: authz.errors };

  const result = await createDeployTarget(
    {
      repos: { deployTargets: deps.repos.deployTargets },
      cipher: deps.cipher,
      ids: deps.ids,
    },
    {
      orgId: authz.orgId,
      accountId: authz.subject.account.id,
      tokenId: authz.subject.tokenId ?? null,
      req: input.body,
    },
  );
  if (!isOk(result)) return { status: 'error', errors: result.errors };
  return { status: 'created', target: result.value };
}

function createDeployTargetRuntimeNative(
  input: CreateDeployTargetInput,
  ctx: RuntimeCtx,
): CreateDeployTargetOutput {
  if (!isRuntimeCtx(ctx)) {
    return {
      status: 'error',
      errors: [{ code: 'PLATFORM_AUTH_INVALID', message: 'runtime deploy-target storage is not available' }],
    };
  }
  const session = requireActiveRuntimeSession(input);
  if (session.status !== 'ok') return { status: 'error', errors: session.errors };
  const body = normalizeBodyEnvelope(input.body);
  const parsed = CreateDeployTargetRequestSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 'error',
      errors: [{
        code: 'PLATFORM_PARSE_BODY_INVALID',
        message: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
      }],
    };
  }
  const key = readRuntimeSecretKey();
  if (key.status === 'error') return key.output;

  ensureRuntimeSecretTable(ctx);
  const existing = ctx.qsmDb.prepare<[string, string], DeployTargetRow>(`
    SELECT
      id,
      organization_id,
      slug,
      provider,
      environment,
      config_json,
      status,
      created_at
    FROM deploy_targets
    WHERE organization_id = ? AND slug = ? AND status = 'active'
    LIMIT 1
  `).get(input.organizationId, parsed.data.slug);
  if (existing !== undefined) {
    return {
      status: 'error',
      errors: [{ code: 'DEPLOY_TARGET_SLUG_TAKEN', message: parsed.data.slug }],
    };
  }

  const targetId = nextId(ctx);
  const eventId = nextId(ctx);
  const now = nowIso(ctx);
  const config = runtimeConfigFromCreateRequest(parsed.data);
  ctx.qsmDb.prepare(`
    INSERT INTO deploy_targets (
      id,
      organization_id,
      slug,
      provider,
      environment,
      config_json,
      status,
      created_at,
      last_event_id,
      last_event_version,
      applied_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    targetId,
    input.organizationId,
    parsed.data.slug,
    parsed.data.kind,
    'default',
    JSON.stringify(config),
    'active',
    now,
    eventId,
    1,
    now,
  );

  const apiToken = encryptString(parsed.data.apiToken, key.value);
  const targetSecrets = encryptJson(readTargetSecrets(body), key.value);
  ctx.qsmDb.prepare(`
    INSERT INTO deploy_target_secrets (
      target_id,
      api_token_ciphertext,
      api_token_nonce,
      api_token_key_version,
      target_secrets_ciphertext,
      target_secrets_nonce,
      target_secrets_key_version,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    targetId,
    apiToken.ciphertext,
    apiToken.nonce,
    apiToken.keyVersion,
    targetSecrets.ciphertext,
    targetSecrets.nonce,
    targetSecrets.keyVersion,
    now,
  );

  return {
    status: 'created',
    target: runtimeRowToDeployTarget({
      id: targetId,
      organization_id: input.organizationId,
      slug: parsed.data.slug,
      provider: parsed.data.kind,
      environment: 'default',
      config_json: JSON.stringify(config),
      status: 'active',
      created_at: now,
    }),
  };
}

function ensureRuntimeSecretTable(ctx: RuntimeCtx): void {
  const sql = `
    CREATE TABLE IF NOT EXISTS deploy_target_secrets (
      target_id TEXT NOT NULL PRIMARY KEY,
      api_token_ciphertext TEXT NOT NULL,
      api_token_nonce TEXT NOT NULL,
      api_token_key_version INTEGER NOT NULL,
      target_secrets_ciphertext TEXT NOT NULL,
      target_secrets_nonce TEXT NOT NULL,
      target_secrets_key_version INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
  if (ctx.qsmDb.exec !== undefined) {
    ctx.qsmDb.exec(sql);
    return;
  }
  ctx.qsmDb.prepare(sql).run();
}

function runtimeConfigFromCreateRequest(req: CreateDeployTargetInput['body']): Record<string, unknown> {
  return {
    displayName: req.displayName,
    kind: req.kind,
    dokployUrl: req.dokployUrl,
    publicBaseUrl: req.publicBaseUrl ?? null,
    dokployProjectId: req.dokployProjectId ?? null,
    dokployProjectName: req.dokployProjectName ?? null,
    allowCreateProject: req.allowCreateProject,
    apiTokenRedacted: '***',
    eventBus: req.eventBus,
    modules: req.modules,
    workflows: req.workflows,
    storage: req.storage,
    auth: req.auth,
    policyValues: req.policyValues,
    manualAccess: req.manualAccess,
    isDefault: req.isDefault,
  };
}

function normalizeBodyEnvelope<T>(body: T): T {
  if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
    const inner = (body as { readonly body?: unknown }).body;
    if (inner !== null && typeof inner === 'object' && !Array.isArray(inner)) return inner as T;
  }
  return body;
}

function readTargetSecrets(req: CreateDeployTargetInput['body'] | UpdateDeployTargetInput['body']): Record<string, unknown> {
  const value = (req as { readonly targetSecrets?: unknown }).targetSecrets;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function readRuntimeSecretKey():
  | { readonly status: 'ok'; readonly value: Buffer }
  | { readonly status: 'error'; readonly output: Extract<CreateDeployTargetOutput, { readonly status: 'error' }> } {
  const raw = process.env.PLATFORM_SECRET_ENCRYPTION_KEY;
  if (typeof raw !== 'string' || raw.trim() === '') {
    return unavailableSecretStorage();
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw.trim())) {
    return {
      status: 'error',
      output: {
        status: 'error',
        errors: [{
          code: 'PLATFORM_STORAGE_DB_UNAVAILABLE',
          message: 'runtime-native deploy target creation requires a 32-byte hex PLATFORM_SECRET_ENCRYPTION_KEY',
        }],
      },
    };
  }
  return { status: 'ok', value: Buffer.from(raw.trim(), 'hex') };
}

function unavailableSecretStorage(): { readonly status: 'error'; readonly output: Extract<CreateDeployTargetOutput, { readonly status: 'error' }> } {
  return {
    status: 'error',
    output: {
      status: 'error',
      errors: [{
        code: 'PLATFORM_STORAGE_DB_UNAVAILABLE',
        message: 'runtime-native deploy target creation requires encrypted target-secret storage',
      }],
    },
  };
}

function encryptJson(value: unknown, key: Buffer): { readonly ciphertext: string; readonly nonce: string; readonly keyVersion: 1 } {
  return encryptString(JSON.stringify(value), key);
}

function encryptString(plaintext: string, key: Buffer): { readonly ciphertext: string; readonly nonce: string; readonly keyVersion: 1 } {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: Buffer.concat([encrypted, cipher.getAuthTag()]).toString('base64'),
    nonce: nonce.toString('base64'),
    keyVersion: 1,
  };
}

function nextId(ctx: RuntimeCtx): string {
  return ctx.nextId?.() ?? randomUUID();
}

function nowIso(ctx: RuntimeCtx): string {
  return ctx.now?.() ?? new Date().toISOString();
}

/** PUT /api/deployments/targets/{slug} — patch a deploy target. */
export async function updateDeployTargetHandler(
  depsOrInput: DeployTargetCrudDeps | UpdateDeployTargetInput,
  inputOrCtx: UpdateDeployTargetInput | RuntimeCtx,
): Promise<UpdateDeployTargetOutput> {
  if (!isDeps(depsOrInput)) {
    return updateDeployTargetRuntimeNative(depsOrInput, inputOrCtx as RuntimeCtx);
  }
  const deps = depsOrInput;
  const input = inputOrCtx as UpdateDeployTargetInput;
  const auth = await deps.provider.authenticate({
    authorizationHeader: input.authorization,
    cookieHeader: undefined,
  });
  if (!isOk(auth)) return { status: 'error', errors: auth.errors };

  const result = await updateDeployTarget(
    { repos: { deployTargets: deps.repos.deployTargets } },
    {
      orgId: auth.value.org.id,
      accountId: auth.value.account.id,
      tokenId: auth.value.tokenId ?? null,
      slug: input.slug,
      patch: input.body,
    },
  );
  if (!isOk(result)) return { status: 'error', errors: result.errors };
  return { status: 'updated', target: result.value };
}

function updateDeployTargetRuntimeNative(
  input: UpdateDeployTargetInput,
  ctx: RuntimeCtx,
): UpdateDeployTargetOutput {
  if (!isRuntimeCtx(ctx)) {
    return {
      status: 'error',
      errors: [{ code: 'PLATFORM_AUTH_INVALID', message: 'runtime deploy-target storage is not available' }],
    };
  }
  const session = requireActiveRuntimeSession(input);
  if (session.status !== 'ok') return { status: 'error', errors: session.errors };
  if (typeof input.organizationId !== 'string' || input.organizationId.length === 0) {
    return {
      status: 'error',
      errors: [{ code: 'PLATFORM_PARSE_BODY_INVALID', message: 'organizationId is required' }],
    };
  }

  const body = normalizeBodyEnvelope(input.body);
  const patchCandidate = stripUpdateExtensions(body);
  const parsed = UpdateDeployTargetRequestSchema.safeParse(patchCandidate);
  if (!parsed.success) {
    return {
      status: 'error',
      errors: [{
        code: 'PLATFORM_PARSE_BODY_INVALID',
        message: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
      }],
    };
  }

  const row = ctx.qsmDb.prepare<[string, string], DeployTargetRow>(`
    SELECT
      id,
      organization_id,
      slug,
      provider,
      environment,
      config_json,
      status,
      created_at
    FROM deploy_targets
    WHERE organization_id = ? AND slug = ? AND status = 'active'
    LIMIT 1
  `).get(input.organizationId, input.slug);
  if (row === undefined) {
    return {
      status: 'error',
      errors: [{ code: 'DEPLOY_TARGET_NOT_FOUND', message: input.slug }],
    };
  }

  const now = nowIso(ctx);
  const config = mergeRuntimeTargetConfig(parseConfigJson(row.config_json), parsed.data);
  ctx.qsmDb.prepare(`
    UPDATE deploy_targets
    SET config_json = ?,
        last_event_id = ?,
        last_event_version = last_event_version + 1,
        applied_at = ?
    WHERE id = ?
  `).run(JSON.stringify(config), nextId(ctx), now, row.id);

  const secretUpdate = updateRuntimeTargetSecrets(ctx, row.id, body, now);
  if (secretUpdate.status === 'error') return { status: 'error', errors: secretUpdate.errors };

  return {
    status: 'updated',
    target: runtimeRowToDeployTarget({
      ...row,
      config_json: JSON.stringify(config),
    }),
  };
}

function stripUpdateExtensions(body: UpdateDeployTargetInput['body']): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return {};
  const record = body as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== 'organizationId' && key !== 'targetSecrets' && key !== 'apiToken'),
  );
}

function mergeRuntimeTargetConfig(
  current: Record<string, unknown>,
  patch: ReturnType<typeof UpdateDeployTargetRequestSchema.parse>,
): Record<string, unknown> {
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) next[key] = value;
  }
  return next;
}

function updateRuntimeTargetSecrets(
  ctx: RuntimeCtx,
  targetId: string,
  body: UpdateDeployTargetInput['body'],
  now: string,
): { readonly status: 'ok' } | { readonly status: 'error'; readonly errors: readonly PlatformError[] } {
  const record = body !== null && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const hasTargetSecrets = Object.prototype.hasOwnProperty.call(record, 'targetSecrets');
  const hasApiToken = Object.prototype.hasOwnProperty.call(record, 'apiToken');
  if (!hasTargetSecrets && !hasApiToken) return { status: 'ok' };

  const key = readRuntimeSecretKey();
  if (key.status === 'error') return { status: 'error', errors: key.output.errors };
  ensureRuntimeSecretTable(ctx);

  const existing = ctx.qsmDb.prepare<[string], {
    readonly api_token_ciphertext: string;
    readonly api_token_nonce: string;
    readonly api_token_key_version: number;
    readonly target_secrets_ciphertext: string;
    readonly target_secrets_nonce: string;
    readonly target_secrets_key_version: number;
  }>(`
    SELECT
      api_token_ciphertext,
      api_token_nonce,
      api_token_key_version,
      target_secrets_ciphertext,
      target_secrets_nonce,
      target_secrets_key_version
    FROM deploy_target_secrets
    WHERE target_id = ?
    LIMIT 1
  `).get(targetId);

  if (existing === undefined && !hasApiToken) {
    return {
      status: 'error',
      errors: [{ code: 'DEPLOY_EXECUTOR_TARGET_SECRET_MISSING', message: 'apiToken is required before target secrets can be stored' }],
    };
  }

  const apiToken = hasApiToken
    ? encryptString(String(record.apiToken ?? ''), key.value)
    : {
        ciphertext: existing?.api_token_ciphertext ?? '',
        nonce: existing?.api_token_nonce ?? '',
        keyVersion: existing?.api_token_key_version ?? 1,
      };
  const emptyTargetSecrets = existing === undefined ? encryptJson({}, key.value) : null;
  const targetSecrets = hasTargetSecrets
    ? encryptJson(readTargetSecrets(body), key.value)
    : {
        ciphertext: existing?.target_secrets_ciphertext ?? emptyTargetSecrets!.ciphertext,
        nonce: existing?.target_secrets_nonce ?? emptyTargetSecrets!.nonce,
        keyVersion: existing?.target_secrets_key_version ?? 1,
      };

  ctx.qsmDb.prepare(`
    INSERT OR REPLACE INTO deploy_target_secrets (
      target_id,
      api_token_ciphertext,
      api_token_nonce,
      api_token_key_version,
      target_secrets_ciphertext,
      target_secrets_nonce,
      target_secrets_key_version,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    targetId,
    apiToken.ciphertext,
    apiToken.nonce,
    apiToken.keyVersion,
    targetSecrets.ciphertext,
    targetSecrets.nonce,
    targetSecrets.keyVersion,
    now,
  );
  return { status: 'ok' };
}

/** DELETE /api/deployments/targets/{slug} — soft-delete a deploy target. */
export async function deleteDeployTargetHandler(
  deps: DeployTargetCrudDeps,
  input: DeleteDeployTargetInput,
): Promise<DeleteDeployTargetOutput> {
  const auth = await deps.provider.authenticate({
    authorizationHeader: input.authorization,
    cookieHeader: undefined,
  });
  if (!isOk(auth)) return { status: 'error', errors: auth.errors };

  const result = await deleteDeployTarget(
    { repos: { deployTargets: deps.repos.deployTargets } },
    {
      orgId: auth.value.org.id,
      accountId: auth.value.account.id,
      tokenId: auth.value.tokenId ?? null,
      slug: input.slug,
    },
  );
  if (!isOk(result)) return { status: 'error', errors: result.errors };
  return { status: 'deleted', slug: input.slug };
}
