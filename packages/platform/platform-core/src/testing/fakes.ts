import { ok, err, type PlatformError } from '../types/result.js';
import type {
  Organization,
  Account,
  MembershipMirror,
  Project,
  ProjectStatus,
  ApiToken,
  AuditLogEntry,
} from '../schemas/entities.js';
import type { OrganizationRepo } from '../repos/org-repo.js';
import type { AccountRepo } from '../repos/account-repo.js';
import type { MembershipMirrorRepo } from '../repos/membership-mirror-repo.js';
import type { WorkosEventLogRepo } from '../repos/workos-event-log-repo.js';
import type { ProjectRepo } from '../repos/project-repo.js';
import type { ProjectVersionRepo } from '../repos/project-version-repo.js';
import type { DeployTargetRepo } from '../repos/deploy-target-repo.js';
import type { DeploymentRepo } from '../repos/deployment-repo.js';
import type { ProjectOperationRepo } from '../repos/project-operation-repo.js';
import type { TokenRepo } from '../repos/token-repo.js';
import type { AuditRepo } from '../repos/audit-repo.js';
import type { OutboxRepo } from '../repos/outbox-repo.js';
import type { BlobStore } from '../blob/store.js';
import type { ProjectOperation, ProjectOperationLogLine } from '../schemas/project-operation.js';
import type { Deployment, DeploymentLogLine } from '../schemas/deployment.js';
import type { DeployTarget, DeployTargetWithSecret } from '../schemas/deploy-target.js';
import type { ProjectVersion } from '../schemas/project-version.js';

function notFound(code: PlatformError['code'], message: string): PlatformError {
  return { code, message };
}

export class FakeStore {
  public orgs = new Map<string, Organization>();
  public accounts = new Map<string, Account>();
  public memberships = new Map<string, MembershipMirror>();
  public projectsByOrg = new Map<string, Project[]>();
  public tokens = new Map<string, ApiToken>();
  public audit: AuditLogEntry[] = [];
  public outbox: { id: bigint; eventType: string; payload: Record<string, unknown>; deliveredAt: Date | null }[] = [];
  public workosEvents = new Set<string>();
  public blobs = new Map<string, Buffer>();
  /** Alias for `blobs`; reads the same map so tests can spell it either way. */
  public get uploads(): Map<string, Buffer> {
    return this.blobs;
  }

  public projectVersionsByProject = new Map<string, ProjectVersion[]>();
  public deployTargetsByOrg = new Map<string, DeployTargetWithSecret[]>();
  public deploymentsByProject = new Map<string, Deployment[]>();
  public deploymentLogsByDeployment = new Map<string, DeploymentLogLine[]>();
  public projectOperationRows = new Map<string, ProjectOperation>();
  public projectOperationLogsByOperation = new Map<string, ProjectOperationLogLine[]>();

  private autoId = 1;
  private now = () => new Date();
  private nextOutboxId = 1n;

  async seedOrg(args: { slug: string; workosOrganizationId: string; displayName: string }): Promise<Organization> {
    const o: Organization = {
      id: `org-${this.autoId++}`,
      workosOrganizationId: args.workosOrganizationId,
      slug: args.slug,
      displayName: args.displayName,
      archivedAt: null,
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.orgs.set(o.id, o);
    return o;
  }

  async seedAccount(args: { workosUserId: string; displayName: string; email: string | null }): Promise<Account> {
    const a: Account = {
      id: `acc-${this.autoId++}`,
      workosUserId: args.workosUserId,
      email: args.email,
      displayName: args.displayName,
      deletedAt: null,
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.accounts.set(a.id, a);
    return a;
  }

  readonly organizations: OrganizationRepo = {
    findById: async (id) => {
      const o = this.orgs.get(id);
      return ok(o && !o.archivedAt ? o : null);
    },
    findBySlug: async (slug) =>
      ok([...this.orgs.values()].find((o) => o.slug === slug && !o.archivedAt) ?? null),
    findByWorkosId: async (wid) =>
      ok([...this.orgs.values()].find((o) => o.workosOrganizationId === wid && !o.archivedAt) ?? null),
    findByIdIncludingArchived: async (id) => ok(this.orgs.get(id) ?? null),
    findBySlugIncludingArchived: async (slug) =>
      ok([...this.orgs.values()].find((o) => o.slug === slug) ?? null),
    findByWorkosIdIncludingArchived: async (wid) =>
      ok([...this.orgs.values()].find((o) => o.workosOrganizationId === wid) ?? null),
    listForAccount: async (accountId) => {
      const ids = new Set(
        [...this.memberships.values()].filter((m) => m.accountId === accountId).map((m) => m.orgId),
      );
      return ok([...this.orgs.values()].filter((o) => ids.has(o.id) && !o.archivedAt));
    },
    upsertFromWorkos: async (a) => {
      const existing = [...this.orgs.values()].find((o) => o.workosOrganizationId === a.workosOrganizationId);
      if (existing) {
        const updated = { ...existing, displayName: a.displayName, updatedAt: this.now() };
        this.orgs.set(existing.id, updated);
        return ok(updated);
      }
      const o = await this.seedOrg(a);
      return ok(o);
    },
    archive: async (id) => {
      const existing = this.orgs.get(id);
      if (existing) {
        this.orgs.set(id, { ...existing, archivedAt: this.now(), updatedAt: this.now() });
      }
      return ok(undefined);
    },
  };

  readonly accountsRepo: AccountRepo = {
    findById: async (id) => ok(this.accounts.get(id) ?? null),
    findByWorkosUserId: async (wid) => ok([...this.accounts.values()].find((a) => a.workosUserId === wid) ?? null),
    upsertFromWorkos: async (a) => {
      const existing = [...this.accounts.values()].find((x) => x.workosUserId === a.workosUserId);
      if (existing) {
        const u = { ...existing, email: a.email, displayName: a.displayName, updatedAt: this.now() };
        this.accounts.set(existing.id, u);
        return ok(u);
      }
      return ok(await this.seedAccount(a));
    },
    markDeleted: async (wid) => {
      const x = [...this.accounts.values()].find((a) => a.workosUserId === wid);
      if (x) this.accounts.set(x.id, { ...x, deletedAt: this.now() });
      return ok(undefined);
    },
  };

  readonly membershipMirror: MembershipMirrorRepo = {
    find: async (o, a) => ok(this.memberships.get(`${o}:${a}`) ?? null),
    upsert: async (row) => {
      const m: MembershipMirror = { ...row, updatedAt: this.now() };
      this.memberships.set(`${row.orgId}:${row.accountId}`, m);
      return ok(m);
    },
    delete: async (o, a) => {
      this.memberships.delete(`${o}:${a}`);
      return ok(undefined);
    },
    listForAccount: async (a) => ok([...this.memberships.values()].filter((m) => m.accountId === a)),
  };

  readonly workosEventLog: WorkosEventLogRepo = {
    hasProcessed: async (id) => ok(this.workosEvents.has(id)),
    markProcessed: async (eventId, _eventType) => {
      this.workosEvents.add(eventId);
      return ok(undefined);
    },
  };

  readonly projects: ProjectRepo = {
    create: async (r) => {
      const list = this.projectsByOrg.get(r.orgId) ?? [];
      if (list.some((p) => p.slug === r.slug && p.archivedAt === null)) {
        return err([notFound('PLATFORM_CONFLICT_SLUG_TAKEN', `project slug ${r.slug} taken`)]);
      }
      const p: Project = { ...r, status: 'active', archivedAt: null, createdAt: this.now(), updatedAt: this.now() };
      this.projectsByOrg.set(r.orgId, [...list, p]);
      return ok(p);
    },
    findBySlug: async (o, s) => ok((this.projectsByOrg.get(o) ?? []).find((p) => p.slug === s) ?? null),
    findById: async (o, id) => ok((this.projectsByOrg.get(o) ?? []).find((p) => p.id === id) ?? null),
    list: async (o, opts) => {
      const all = this.projectsByOrg.get(o) ?? [];
      if (opts.includeArchived || opts.includeInactive) return ok(all);
      return ok(all.filter((p) => !p.archivedAt && p.status === 'active'));
    },
    setStatus: async (o, id, status: ProjectStatus) => {
      const list = this.projectsByOrg.get(o) ?? [];
      const idx = list.findIndex((p) => p.id === id);
      if (idx < 0) return err([notFound('PLATFORM_TENANCY_PROJECT_NOT_FOUND', id)]);
      const u = { ...list[idx]!, status, updatedAt: this.now() };
      list[idx] = u;
      this.projectsByOrg.set(o, list);
      return ok(u);
    },
    patch: async (o, id, patch) => {
      const list = this.projectsByOrg.get(o) ?? [];
      const idx = list.findIndex((p) => p.id === id);
      if (idx < 0) return err([notFound('PLATFORM_TENANCY_PROJECT_NOT_FOUND', id)]);
      const u = { ...list[idx]!, displayName: patch.displayName, updatedAt: this.now() };
      list[idx] = u;
      this.projectsByOrg.set(o, list);
      return ok(u);
    },
    archive: async (o, id) => {
      const list = this.projectsByOrg.get(o) ?? [];
      const idx = list.findIndex((p) => p.id === id);
      if (idx < 0) return err([notFound('PLATFORM_TENANCY_PROJECT_NOT_FOUND', id)]);
      const u = { ...list[idx]!, archivedAt: this.now(), updatedAt: this.now() };
      list[idx] = u;
      this.projectsByOrg.set(o, list);
      return ok(u);
    },
  };

  readonly tokensRepo: TokenRepo = {
    create: async (r) => {
      const t: ApiToken = {
        ...r,
        tokenHash: new Uint8Array(r.tokenHash),
        scopes: [...r.scopes],
        lastUsedAt: null,
        expiresAt: r.expiresAt,
        revokedAt: null,
        createdAt: this.now(),
      };
      this.tokens.set(t.id, t);
      return ok(t);
    },
    findByPrefix: async (p) => ok([...this.tokens.values()].find((t) => t.prefix === p && !t.revokedAt) ?? null),
    list: async (o) => ok([...this.tokens.values()].filter((t) => t.orgId === o)),
    revoke: async (_o, id) => {
      const t = this.tokens.get(id);
      if (t) this.tokens.set(id, { ...t, revokedAt: this.now() });
      return ok(undefined);
    },
    revokeAllForOrg: async (orgId) => {
      let n = 0;
      for (const [id, t] of this.tokens) {
        if (t.orgId === orgId && !t.revokedAt) {
          this.tokens.set(id, { ...t, revokedAt: this.now() });
          n++;
        }
      }
      return ok(n);
    },
    touchLastUsed: async (id) => {
      const t = this.tokens.get(id);
      if (t) this.tokens.set(id, { ...t, lastUsedAt: this.now() });
      return ok(undefined);
    },
  };

  readonly auditRepo: AuditRepo = {
    list: async (o, opts) => {
      let list = this.audit.filter((a) => a.orgId === o);
      if (opts.resourceKind) list = list.filter((a) => a.resourceKind === opts.resourceKind);
      if (opts.actorAccountId) list = list.filter((a) => a.actorAccountId === opts.actorAccountId);
      if (opts.action) list = list.filter((a) => a.action === opts.action);
      if (opts.since) list = list.filter((a) => a.createdAt >= opts.since!);
      return ok(list.slice(-opts.limit).reverse());
    },
  };

  readonly outboxRepo: OutboxRepo = {
    pending: async (limit) =>
      ok(
        this.outbox
          .filter((o) => o.deliveredAt === null)
          .slice(0, limit)
          .map((o) => ({ id: o.id, eventType: o.eventType, payload: o.payload })),
      ),
    markDelivered: async (id) => {
      const r = this.outbox.find((o) => o.id === id);
      if (r) r.deliveredAt = this.now();
      return ok(undefined);
    },
  };

  readonly blob: BlobStore = {
    putIfAbsent: async (key, body) => {
      if (!this.blobs.has(key)) this.blobs.set(key, Buffer.from(body));
      return ok(undefined);
    },
    presignedGet: async (key, _expiresSeconds) => ok(`memory://${key}`),
    getJson: async <T = unknown>(key: string) => {
      const b = this.blobs.get(key);
      if (!b) return err([notFound('PLATFORM_INTERNAL', `blob ${key} missing`)]);
      return ok(JSON.parse(b.toString('utf8')) as T);
    },
    getRaw: async (key: string) => {
      const b = this.blobs.get(key);
      if (!b) return err([notFound('PLATFORM_INTERNAL', `blob ${key} missing`)]);
      return ok(Buffer.from(b));
    },
  };

  readonly projectVersions: ProjectVersionRepo = {
    create: async (args) => {
      const list = this.projectVersionsByProject.get(args.projectId) ?? [];
      const existing = list.find((v) => v.bundleDigest === args.row.bundleDigest);
      if (existing) return ok(existing);
      const v: ProjectVersion = {
        ...args.row,
        projectId: args.projectId,
        seq: list.length + 1,
        createdAt: this.now(),
      };
      this.projectVersionsByProject.set(args.projectId, [...list, v]);
      return ok(v);
    },
    findByDigest: async (projectId, digest) =>
      ok((this.projectVersionsByProject.get(projectId) ?? []).find((v) => v.bundleDigest === digest) ?? null),
    getBySeq: async (projectId, seq) =>
      ok((this.projectVersionsByProject.get(projectId) ?? []).find((v) => v.seq === seq) ?? null),
    getById: async (id) =>
      ok([...this.projectVersionsByProject.values()].flat().find((v) => v.id === id) ?? null),
    listByProject: async (projectId, opts) => {
      const list = [...(this.projectVersionsByProject.get(projectId) ?? [])].sort((a, b) => b.seq - a.seq);
      const filtered = opts.cursor === undefined ? list : list.filter((v) => v.seq < opts.cursor!);
      return ok(filtered.slice(0, opts.limit));
    },
  };

  readonly deployTargets: DeployTargetRepo = {
    create: async (args) => {
      const list = this.deployTargetsByOrg.get(args.row.orgId) ?? [];
      if (list.some((target) => target.slug === args.row.slug)) {
        return err([notFound('DEPLOY_TARGET_SLUG_TAKEN', args.row.slug)]);
      }
      const stored: DeployTargetWithSecret = {
        id: args.row.id,
        orgId: args.row.orgId,
        slug: args.row.slug,
        displayName: args.row.displayName,
        kind: args.row.kind,
        dokployUrl: args.row.dokployUrl,
        publicBaseUrl: args.row.publicBaseUrl,
        dokployProjectId: args.row.dokployProjectId,
        dokployProjectName: args.row.dokployProjectName,
        allowCreateProject: args.row.allowCreateProject,
        apiTokenCiphertext: args.row.apiTokenCiphertext,
        apiTokenNonce: args.row.apiTokenNonce,
        apiTokenKeyVersion: args.row.apiTokenKeyVersion,
        eventBus: args.row.eventBusConfig,
        modules: args.row.modules,
        workflows: args.row.workflows,
        auth: args.row.auth,
        manualAccess: args.row.manualAccess,
        policyValues: args.row.policyValues,
        isDefault: args.row.isDefault,
        createdAt: this.now(),
        updatedAt: this.now(),
      };
      this.deployTargetsByOrg.set(args.row.orgId, [...list.filter((target) => !stored.isDefault || !target.isDefault), stored]);
      return ok(publicTarget(stored));
    },
    update: async () => err([notFound('DEPLOY_TARGET_NOT_FOUND', 'update not implemented in fake')]),
    rotateApiToken: async () => err([notFound('DEPLOY_TARGET_NOT_FOUND', 'rotate not implemented in fake')]),
    setDefault: async (args) => {
      const list = this.deployTargetsByOrg.get(args.orgId) ?? [];
      const target = list.find((item) => item.slug === args.slug);
      if (!target) return err([notFound('DEPLOY_TARGET_NOT_FOUND', args.slug)]);
      const updated = list.map((item) => ({ ...item, isDefault: item.slug === args.slug }));
      this.deployTargetsByOrg.set(args.orgId, updated);
      return ok(publicTarget(updated.find((item) => item.slug === args.slug)!));
    },
    delete: async () => ok(undefined),
    list: async (orgId) => ok((this.deployTargetsByOrg.get(orgId) ?? []).map(publicTarget)),
    getBySlug: async (orgId, slug) => ok(publicTargetOrNull((this.deployTargetsByOrg.get(orgId) ?? []).find((target) => target.slug === slug) ?? null)),
    getDefault: async (orgId) => ok(publicTargetOrNull((this.deployTargetsByOrg.get(orgId) ?? []).find((target) => target.isDefault) ?? null)),
    getWithSecretById: async (id) =>
      ok([...this.deployTargetsByOrg.values()].flat().find((target) => target.id === id) ?? null),
  };

  readonly deployments: DeploymentRepo = {
    create: async (args) => {
      const list = this.deploymentsByProject.get(args.row.projectId) ?? [];
      const deployment: Deployment = {
        id: args.row.id,
        projectId: args.row.projectId,
        orgId: args.row.orgId,
        projectVersionId: args.row.projectVersionId,
        targetId: args.row.targetId,
        status: 'queued',
        configOverrides: args.row.configOverrides,
        renderedPlanDigest: null,
        applyResult: null,
        verificationReport: null,
        warnings: [],
        errorCode: null,
        errorMessage: null,
        errorTree: null,
        startedByAccountId: args.row.startedByAccountId,
        queuedAt: this.now(),
        startedAt: null,
        finishedAt: null,
        lastHeartbeatAt: null,
      };
      this.deploymentsByProject.set(args.row.projectId, [...list, deployment]);
      return ok(deployment);
    },
    getById: async (id) => ok([...this.deploymentsByProject.values()].flat().find((d) => d.id === id) ?? null),
    listByProject: async (projectId, opts) => ok((this.deploymentsByProject.get(projectId) ?? []).slice(0, opts.limit)),
    transition: async () => ok(undefined),
    setRenderedDigest: async () => ok(undefined),
    setApplyResult: async (id, applyResult) => {
      for (const [projectId, list] of this.deploymentsByProject.entries()) {
        const idx = list.findIndex((d) => d.id === id);
        if (idx >= 0) {
          list[idx] = { ...list[idx]!, applyResult };
          this.deploymentsByProject.set(projectId, list);
        }
      }
      return ok(undefined);
    },
    setProvisionResult: async () => undefined,
    finalize: async (id, args) => {
      for (const [projectId, list] of this.deploymentsByProject.entries()) {
        const idx = list.findIndex((d) => d.id === id);
        if (idx >= 0) {
          list[idx] = { ...list[idx]!, status: args.status, finishedAt: this.now(), errorCode: args.errorCode ?? null, errorMessage: args.errorMessage ?? null, errorTree: args.errorTree ?? null };
          this.deploymentsByProject.set(projectId, list);
        }
      }
      return ok(undefined);
    },
    touchHeartbeat: async () => ok(undefined),
    appendLog: async () => ok(undefined),
    readLogs: async (args) => ok({ lines: this.deploymentLogsByDeployment.get(args.deploymentId) ?? [], lastLineId: args.sinceLineId }),
    findStaleRunning: async () => ok([]),
    hasActiveForProject: async (projectId) =>
      ok((this.deploymentsByProject.get(projectId) ?? []).some((d) => d.status === 'queued' || d.status === 'running')),
    hasActiveForProjectTarget: async (projectId, targetId) =>
      ok((this.deploymentsByProject.get(projectId) ?? []).some((d) => d.targetId === targetId && (d.status === 'queued' || d.status === 'running'))),
    listAppliedResourcesByProject: async (projectId) =>
      ok((this.deploymentsByProject.get(projectId) ?? []).flatMap((d) => {
        const resources = Array.isArray(d.applyResult?.resources) ? d.applyResult.resources : [];
        const parsed = resources.filter((r): r is { resourceKind: 'application' | 'compose'; targetResourceId: string; targetResourceName: string } =>
          !!r && typeof r === 'object' &&
          ((r as { resourceKind?: unknown }).resourceKind === 'application' || (r as { resourceKind?: unknown }).resourceKind === 'compose') &&
          typeof (r as { targetResourceId?: unknown }).targetResourceId === 'string' &&
          typeof (r as { targetResourceName?: unknown }).targetResourceName === 'string',
        );
        return parsed.length === 0 ? [] : [{ deploymentId: d.id, targetId: d.targetId, resources: parsed }];
      })),
    findLastSuccessfulForProjectTarget: async () => ok(null),
  };

  readonly projectOperations: ProjectOperationRepo = {
    create: async (args) => {
      const hasLiveOperation = [...this.projectOperationRows.values()].some(
        (operation) =>
          operation.projectId === args.row.projectId &&
          (operation.status === 'queued' || operation.status === 'running'),
      );
      if (hasLiveOperation) {
        return err([notFound('PROJECT_OPERATION_INVALID_STATE', 'project already has a live operation')]);
      }
      const operation: ProjectOperation = {
        ...args.row,
        status: 'queued',
        result: null,
        errorCode: null,
        errorMessage: null,
        queuedAt: this.now(),
        startedAt: null,
        finishedAt: null,
        lastHeartbeatAt: null,
      };
      this.projectOperationRows.set(operation.id, operation);
      return ok(operation);
    },
    attachDeployment: async (operationId, deploymentId) => {
      const operation = this.projectOperationRows.get(operationId);
      if (!operation) return err([notFound('PROJECT_OPERATION_NOT_FOUND', operationId)]);
      const updated = { ...operation, deploymentId };
      this.projectOperationRows.set(operationId, updated);
      return ok(updated);
    },
    getById: async (id) => ok(this.projectOperationRows.get(id) ?? null),
    getByDeploymentId: async (deploymentId) =>
      ok([...this.projectOperationRows.values()].find((operation) => operation.deploymentId === deploymentId) ?? null),
    listByProject: async (projectId, opts) =>
      ok([...this.projectOperationRows.values()].filter((operation) => operation.projectId === projectId).slice(0, opts.limit)),
    transition: async (id, _status, side) => {
      const operation = this.projectOperationRows.get(id);
      if (!operation) return err([notFound('PROJECT_OPERATION_NOT_FOUND', id)]);
      this.projectOperationRows.set(id, { ...operation, status: 'running', startedAt: side.startedAt, lastHeartbeatAt: side.startedAt });
      return ok(undefined);
    },
    finalize: async (id, args) => {
      const operation = this.projectOperationRows.get(id);
      if (!operation) return err([notFound('PROJECT_OPERATION_NOT_FOUND', id)]);
      const updated = { ...operation, status: args.status, result: args.result ?? null, errorCode: args.errorCode ?? null, errorMessage: args.errorMessage ?? null, finishedAt: this.now() };
      this.projectOperationRows.set(id, updated);
      return ok(updated);
    },
    touchHeartbeat: async (id) => {
      const operation = this.projectOperationRows.get(id);
      if (operation) this.projectOperationRows.set(id, { ...operation, lastHeartbeatAt: this.now() });
      return ok(undefined);
    },
    appendLog: async (args) => {
      const list = this.projectOperationLogsByOperation.get(args.operationId) ?? [];
      this.projectOperationLogsByOperation.set(args.operationId, [...list, { id: list.length + 1, operationId: args.operationId, orgId: args.orgId, ts: this.now(), level: args.level, step: args.step, message: args.message }]);
      return ok(undefined);
    },
    readLogs: async (args) => {
      const lines = (this.projectOperationLogsByOperation.get(args.operationId) ?? []).filter((line) => line.id > args.sinceLineId).slice(0, args.limit);
      return ok({ lines, lastLineId: lines[lines.length - 1]?.id ?? args.sinceLineId });
    },
    findStaleRunning: async () => ok([]),
  };
}

function publicTarget(target: DeployTargetWithSecret): DeployTarget {
  const { apiTokenCiphertext: _ciphertext, apiTokenNonce: _nonce, apiTokenKeyVersion: _keyVersion, ...rest } = target;
  return { ...rest, apiTokenRedacted: '***' };
}

function publicTargetOrNull(target: DeployTargetWithSecret | null): DeployTarget | null {
  return target === null ? null : publicTarget(target);
}
