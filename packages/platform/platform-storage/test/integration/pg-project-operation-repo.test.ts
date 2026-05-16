import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { withTransaction } from '../../src/pg/tx.js';
import { PgProjectOperationRepo, PgDeploymentRepo } from '../../src/index.js';
import { integrationContainersAvailable } from './docker-available.js';
import { startPostgres, stopPostgres, resetSchema, type PgHandles } from './harness.js';

const shouldRun = integrationContainersAvailable();
const d = shouldRun ? describe : describe.skip;

d('PgProjectOperationRepo', () => {
  let h: PgHandles;
  let orgId: string;
  let accountId: string;
  let projectId: string;

  beforeAll(async () => {
    h = await startPostgres();
  }, 120_000);

  afterAll(async () => {
    if (h) await stopPostgres(h);
  });

  beforeEach(async () => {
    await resetSchema(h.pool);
    orgId = randomUUID();
    accountId = randomUUID();
    projectId = randomUUID();

    await h.pool.query(`INSERT INTO account (id, workos_user_id, display_name) VALUES ($1, 'user_op', 'Ada')`, [accountId]);
    await h.pool.query(`INSERT INTO organization (id, workos_organization_id, slug, display_name) VALUES ($1, 'org_op', 'acme-op', 'Acme')`, [orgId]);
    await h.pool.query(`INSERT INTO project (id, org_id, slug, display_name) VALUES ($1,$2,'notes-demo','Notes Demo')`, [projectId, orgId]);
  });

  it('creates, attaches deployment, logs, and finalizes operation rows under RLS', async () => {
    const operationId = randomUUID();
    const versionId = randomUUID();
    const targetId = randomUUID();
    const deploymentId = randomUUID();

    await h.pool.query(
      `INSERT INTO project_version (id, org_id, project_id, seq, bundle_digest, bundle_blob_key, bundle_size_bytes, summary, uploaded_by_account_id)
       VALUES ($1,$2,$3,1,'sha256:op','projects/p/versions/op.json.gz',2,'{"projectName":"notes-demo","services":[],"routes":{"ui":{},"http":{}},"middleware":{},"mounts":[]}'::jsonb,$4)`,
      [versionId, orgId, projectId, accountId],
    );
    await h.pool.query(
      `INSERT INTO deploy_target (
         id, org_id, slug, display_name, kind, dokploy_url, dokploy_project_id,
         allow_create_project, api_token_ciphertext, api_token_nonce, api_token_key_version,
         event_bus_config, module_config, auth_config, policy_values
       ) VALUES ($1,$2,'dokploy','Dokploy','dokploy','https://dokploy.example.com','dokploy-project',false,'x'::bytea,'n'::bytea,1,'{"kind":"kafka","mode":"external","brokers":["redpanda:9092"]}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb)`,
      [targetId, orgId],
    );
    await h.pool.query(
      `INSERT INTO deployment (id, org_id, project_id, project_version_id, target_id, status, config_overrides, started_by_account_id)
       VALUES ($1,$2,$3,$4,$5,'queued','{}'::jsonb,$6)`,
      [deploymentId, orgId, projectId, versionId, targetId, accountId],
    );

    const created = await withTransaction(h.appPool, orgId, async (client) => {
      const repo = new PgProjectOperationRepo(client);
      return repo.create({
        row: {
          id: operationId,
          orgId,
          projectId,
          kind: 'update',
          requestedByAccountId: accountId,
          requestedByTokenId: null,
          targetId,
          projectVersionId: versionId,
          deploymentId: null,
          input: { confirm: 'notes-demo' },
        },
        auditActorAccountId: accountId,
        auditActorTokenId: null,
      });
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.status).toBe('queued');

    const attached = await withTransaction(h.appPool, orgId, async (client) => {
      const repo = new PgProjectOperationRepo(client);
      return repo.attachDeployment(operationId, deploymentId);
    });
    expect(attached.ok).toBe(true);
    if (!attached.ok) return;
    expect(attached.value.deploymentId).toBe(deploymentId);

    const transitioned = await withTransaction(h.appPool, orgId, async (client) => {
      const repo = new PgProjectOperationRepo(client);
      return repo.transition(operationId, 'running', { startedAt: new Date('2026-05-03T12:00:00Z') });
    });
    expect(transitioned.ok).toBe(true);

    const logged = await withTransaction(h.appPool, orgId, async (client) => {
      const repo = new PgProjectOperationRepo(client);
      return repo.appendLog({ operationId, orgId, level: 'info', step: 'teardown', message: 'started' });
    });
    expect(logged.ok).toBe(true);

    const logs = await withTransaction(h.appPool, orgId, async (client) => {
      const repo = new PgProjectOperationRepo(client);
      return repo.readLogs({ operationId, sinceLineId: 0, limit: 10 });
    });
    expect(logs.ok).toBe(true);
    if (logs.ok) expect(logs.value.lines[0]?.message).toBe('started');

    const finalized = await withTransaction(h.appPool, orgId, async (client) => {
      const repo = new PgProjectOperationRepo(client);
      return repo.finalize(operationId, { status: 'succeeded', result: { deletedResources: 1 } });
    });
    expect(finalized.ok).toBe(true);
    if (finalized.ok) expect(finalized.value.result).toEqual({ deletedResources: 1 });
  });

  it('finds queued or running operations with null or stale heartbeats', async () => {
    const targetId = randomUUID();
    await h.pool.query(
      `INSERT INTO deploy_target (
         id, org_id, slug, display_name, kind, dokploy_url, dokploy_project_id,
         allow_create_project, api_token_ciphertext, api_token_nonce, api_token_key_version,
         event_bus_config, module_config, auth_config, policy_values
       ) VALUES ($1,$2,'dokploy','Dokploy','dokploy','https://dokploy.example.com','dokploy-project',false,'x'::bytea,'n'::bytea,1,'{"kind":"kafka","mode":"external","brokers":["redpanda:9092"]}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb)`,
      [targetId, orgId],
    );

    const insertOp = async (id: string) => {
      await h.pool.query(
        `INSERT INTO project_operation (
           id, org_id, project_id, kind, requested_by_account_id, target_id, input
         ) VALUES ($1,$2,$3,'update',$4,$5,'{}'::jsonb)`,
        [id, orgId, projectId, accountId, targetId],
      );
    };

    const nullHeartbeatId = randomUUID();
    const oldHeartbeatId = randomUUID();
    const freshHeartbeatId = randomUUID();
    const staleQueuedId = randomUUID();
    const freshQueuedId = randomUUID();
    await insertOp(nullHeartbeatId);
    await insertOp(oldHeartbeatId);
    await insertOp(freshHeartbeatId);
    await insertOp(staleQueuedId);
    await insertOp(freshQueuedId);

    await h.pool.query(
      `UPDATE project_operation SET status='running', started_at=now(), last_heartbeat_at=NULL WHERE id=$1`,
      [nullHeartbeatId],
    );
    await h.pool.query(
      `UPDATE project_operation SET status='running', started_at=now(), last_heartbeat_at=now() - interval '2 minutes' WHERE id=$1`,
      [oldHeartbeatId],
    );
    await h.pool.query(
      `UPDATE project_operation SET status='running', started_at=now(), last_heartbeat_at=now() WHERE id=$1`,
      [freshHeartbeatId],
    );
    // staleQueuedId stays 'queued' with NULL heartbeat — must be reaped.
    await h.pool.query(
      `UPDATE project_operation SET last_heartbeat_at=now() WHERE id=$1`,
      [freshQueuedId],
    );

    const stale = await new PgProjectOperationRepo(h.pool).findStaleRunning(60);
    expect(stale.ok).toBe(true);
    if (!stale.ok) return;
    const ids = stale.value.map((row) => row.id);
    expect(ids).toEqual(expect.arrayContaining([nullHeartbeatId, oldHeartbeatId, staleQueuedId]));
    expect(ids).not.toContain(freshHeartbeatId);
    expect(ids).not.toContain(freshQueuedId);
  });

  it('finds active deployments and applied resources by project', async () => {
    const versionId = randomUUID();
    const targetId = randomUUID();
    const deploymentId = randomUUID();

    await h.pool.query(
      `INSERT INTO project_version (id, org_id, project_id, seq, bundle_digest, bundle_blob_key, bundle_size_bytes, summary, uploaded_by_account_id)
       VALUES ($1,$2,$3,1,'sha256:a','projects/p/versions/a.json.gz',2,'{"projectName":"notes-demo","services":[],"routes":{"ui":{},"http":{}},"middleware":{},"mounts":[]}'::jsonb,$4)`,
      [versionId, orgId, projectId, accountId],
    );
    await h.pool.query(
      `INSERT INTO deploy_target (
         id, org_id, slug, display_name, kind, dokploy_url, dokploy_project_id,
         allow_create_project, api_token_ciphertext, api_token_nonce, api_token_key_version,
         event_bus_config, module_config, auth_config, policy_values
       ) VALUES ($1,$2,'dokploy','Dokploy','dokploy','https://dokploy.example.com','dokploy-project',false,'x'::bytea,'n'::bytea,1,'{"kind":"kafka","mode":"external","brokers":["redpanda:9092"]}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb)`,
      [targetId, orgId],
    );
    await h.pool.query(
      `INSERT INTO deployment (id, org_id, project_id, project_version_id, target_id, status, config_overrides, started_by_account_id, apply_result)
       VALUES ($1,$2,$3,$4,$5,'queued','{}'::jsonb,$6,'{"resources":[{"resourceKind":"application","targetResourceId":"app_1","targetResourceName":"rntme-acme-notes-app"}]}'::jsonb)`,
      [deploymentId, orgId, projectId, versionId, targetId, accountId],
    );

    const active = await withTransaction(h.appPool, orgId, async (client) => {
      const repo = new PgDeploymentRepo(client);
      return repo.hasActiveForProjectTarget(projectId, targetId);
    });
    expect(active).toEqual({ ok: true, value: true });

    await h.pool.query(`UPDATE deployment SET status='failed', finished_at=now() WHERE id=$1`, [deploymentId]);
    const resources = await withTransaction(h.appPool, orgId, async (client) => {
      const repo = new PgDeploymentRepo(client);
      return repo.listAppliedResourcesByProject(projectId);
    });
    expect(resources.ok).toBe(true);
    if (resources.ok) {
      expect(resources.value).toEqual([
        {
          deploymentId,
          targetId,
          resources: [
            {
              resourceKind: 'application',
              targetResourceId: 'app_1',
              targetResourceName: 'rntme-acme-notes-app',
            },
          ],
        },
      ]);
    }
  });
});
