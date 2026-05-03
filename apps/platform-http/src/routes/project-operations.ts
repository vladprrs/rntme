import { Buffer } from 'node:buffer';
import { Hono } from 'hono';
import {
  StartProjectDeleteOperationRequestSchema,
  StartProjectUpdateOperationRequestSchema,
  getProjectOperation,
  isOk,
  listProjectOperations,
  parseCanonicalBundle,
  publishProjectVersion,
  readProjectOperationLogs,
  startProjectDeleteOperation,
  startProjectUpdateOperation,
  type BlobStore,
  type Ids,
} from '@rntme/platform-core';
import type { PoolClient } from 'pg';
import { materializeAndCompose } from '../blueprint/load.js';
import { requireOrgMatch, requireScope } from '../middleware/auth.js';
import { respond, resolveProject } from './helpers.js';
import { resolveDeps as defaultResolveDeps, type RequestRepos } from '../resolve-deps.js';

const BUNDLE_MAX_BYTES = 10 * 1024 * 1024;

type Deps = {
  readonly ids: Ids;
  readonly blob?: BlobStore;
  readonly resolveDeps?: (tx: PoolClient) => RequestRepos;
  readonly scheduleDeployment?: (deploymentId: string, orgId: string) => void;
  readonly scheduleProjectDelete?: (operationId: string, orgId: string) => void;
};

export function projectOperationRoutes(deps: Deps): Hono {
  const app = new Hono();
  const resolve = deps.resolveDeps ?? defaultResolveDeps;

  app.use('*', requireOrgMatch('orgSlug'));

  app.post('/update', requireScope('deploy:execute'), async (c) => {
    const repos = resolve(c.get('tx'));
    const project = await resolveProject(repos, c.req.param('orgSlug') ?? '', c.req.param('projSlug') ?? '');
    if (!project.ok) return respond(c, project);

    const parsed = StartProjectUpdateOperationRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: parsed.error.message } }, 400);
    }

    const subject = c.get('subject');
    let req = parsed.data;
    if (req.bundle !== undefined) {
      if (deps.blob === undefined) {
        return c.json({ error: { code: 'PLATFORM_INTERNAL', message: 'blob store unavailable' } }, 500);
      }
      const bytes = Buffer.from(req.bundle.bytesBase64, 'base64');
      if (bytes.byteLength > BUNDLE_MAX_BYTES) {
        return c.json({ error: { code: 'PROJECT_VERSION_BUNDLE_TOO_LARGE', message: `max ${BUNDLE_MAX_BYTES} bytes` } }, 413);
      }
      const parsedBundle = parseCanonicalBundle(bytes);
      if (!isOk(parsedBundle)) return respond(c, parsedBundle);
      const composed = await materializeAndCompose(parsedBundle.value.bundle);
      if (!isOk(composed)) return respond(c, composed);
      const published = await publishProjectVersion(
        { repos: { projects: repos.projects, projectVersions: repos.projectVersions }, blob: deps.blob, ids: deps.ids },
        {
          orgId: subject.org.id,
          projectId: project.value.project.id,
          accountId: subject.account.id,
          tokenId: subject.tokenId ?? null,
          bundleBytes: bytes,
          bundleDigest: parsedBundle.value.digest,
          summary: composed.value.summary,
        },
      );
      if (!isOk(published)) return respond(c, published);
      req = { targetSlug: req.targetSlug, projectVersionSeq: published.value.seq };
    }

    const result = await startProjectUpdateOperation(
      { repos, ids: deps.ids },
      {
        orgId: subject.org.id,
        projectId: project.value.project.id,
        accountId: subject.account.id,
        tokenId: subject.tokenId ?? null,
        req,
      },
    );
    if (isOk(result)) deps.scheduleDeployment?.(result.value.deployment.id, subject.org.id);
    return respond(c, result, 202);
  });

  app.post('/delete', requireScope('project:delete'), async (c) => {
    const repos = resolve(c.get('tx'));
    const project = await resolveProject(repos, c.req.param('orgSlug') ?? '', c.req.param('projSlug') ?? '');
    if (!project.ok) return respond(c, project);
    const parsed = StartProjectDeleteOperationRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: { code: 'PLATFORM_PARSE_BODY_INVALID', message: parsed.error.message } }, 400);
    }
    const subject = c.get('subject');
    const result = await startProjectDeleteOperation(
      { repos, ids: deps.ids },
      {
        orgId: subject.org.id,
        projectId: project.value.project.id,
        projectSlug: project.value.project.slug,
        accountId: subject.account.id,
        tokenId: subject.tokenId ?? null,
        req: parsed.data,
      },
    );
    if (isOk(result)) deps.scheduleProjectDelete?.(result.value.operation.id, subject.org.id);
    return respond(c, result, 202);
  });

  app.get('/', requireScope('project:read'), async (c) => {
    const repos = resolve(c.get('tx'));
    const project = await resolveProject(repos, c.req.param('orgSlug') ?? '', c.req.param('projSlug') ?? '');
    if (!project.ok) return respond(c, project);
    const result = await listProjectOperations({ repos }, { projectId: project.value.project.id, limit: Number(c.req.query('limit') ?? 50) });
    return respond(c, result, 200, 'operations');
  });

  app.get('/:operationId', requireScope('project:read'), async (c) => {
    const repos = resolve(c.get('tx'));
    const result = await getProjectOperation({ repos }, { operationId: c.req.param('operationId') });
    if (isOk(result) && result.value === null) {
      return c.json({ error: { code: 'PROJECT_OPERATION_NOT_FOUND', message: c.req.param('operationId') } }, 404);
    }
    return respond(c, result, 200, 'operation');
  });

  app.get('/:operationId/logs', requireScope('project:read'), async (c) => {
    const repos = resolve(c.get('tx'));
    const result = await readProjectOperationLogs(
      { repos },
      {
        operationId: c.req.param('operationId'),
        sinceLineId: Number(c.req.query('sinceLineId') ?? 0),
        limit: Number(c.req.query('limit') ?? 200),
      },
    );
    return respond(c, result, 200);
  });

  return app;
}
