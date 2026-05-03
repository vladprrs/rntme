import { Hono } from 'hono';
import {
  getDeployTarget,
  isOk,
  parseTargetSecret,
  type Ids,
  type SecretCipher,
  type TargetSecretsRepo,
} from '@rntme/platform-core';
import { createPgTargetSecretsRepo } from '@rntme/platform-storage';
import type { PoolClient } from 'pg';
import { requireOrgMatch, requireScope } from '../middleware/auth.js';
import { resolveDeps as defaultResolveDeps, type RequestRepos } from '../resolve-deps.js';

type Deps = {
  readonly ids: Ids;
  readonly cipher: SecretCipher;
  readonly resolveDeps?: (tx: PoolClient) => RequestRepos;
  /**
   * Override the per-request target-secrets repo construction. Only used in tests.
   */
  readonly secretsRepoFactory?: (tx: PoolClient, cipher: SecretCipher) => TargetSecretsRepo;
};

export function targetSecretsRoutes(deps: Deps): Hono {
  const app = new Hono();
  const resolve = deps.resolveDeps ?? defaultResolveDeps;
  const buildRepo =
    deps.secretsRepoFactory ??
    ((tx, cipher) => createPgTargetSecretsRepo({ db: tx, cipher }));

  app.use('*', requireOrgMatch('orgSlug'));

  app.get('/', requireScope('deploy:target:manage'), async (c) => {
    const subject = c.get('subject');
    const tx = c.get('tx') as PoolClient;
    const repos = resolve(tx);
    const targetSlug = c.req.param('targetSlug') ?? '';
    const targetResult = await getDeployTarget(
      { repos },
      { orgId: subject.org.id, slug: targetSlug },
    );
    if (!isOk(targetResult)) {
      return c.json({ error: { code: targetResult.errors[0]?.code ?? 'PLATFORM_INTERNAL', message: targetResult.errors[0]?.message ?? 'error' } }, 500);
    }
    if (targetResult.value === null) {
      return c.json({ error: { code: 'DEPLOY_TARGET_NOT_FOUND', message: targetSlug } }, 404);
    }
    const repo = buildRepo(tx, deps.cipher);
    const list = await repo.list(targetResult.value.id);
    return c.json(
      {
        secrets: list.map((s) => ({
          name: s.name,
          schema: s.schema,
          updatedAt: s.updatedAt.toISOString(),
        })),
      },
      200,
    );
  });

  app.put('/:secretName', requireScope('deploy:target:manage'), async (c) => {
    const subject = c.get('subject');
    const tx = c.get('tx') as PoolClient;
    const repos = resolve(tx);
    const targetSlug = c.req.param('targetSlug') ?? '';
    const targetResult = await getDeployTarget(
      { repos },
      { orgId: subject.org.id, slug: targetSlug },
    );
    if (!isOk(targetResult)) {
      return c.json({ error: { code: targetResult.errors[0]?.code ?? 'PLATFORM_INTERNAL', message: targetResult.errors[0]?.message ?? 'error' } }, 500);
    }
    if (targetResult.value === null) {
      return c.json({ error: { code: 'DEPLOY_TARGET_NOT_FOUND', message: targetSlug } }, 404);
    }
    const body = (await c.req.json().catch(() => ({}))) as { schema?: unknown; value?: unknown };
    if (typeof body.schema !== 'string') {
      return c.json(
        { error: { code: 'TARGET_SECRET_SCHEMA_REQUIRED', message: 'schema is required' } },
        400,
      );
    }
    const parsed = parseTargetSecret(body.schema, body.value);
    if (!parsed.ok) {
      return c.json(
        {
          error: {
            code: parsed.errors[0]?.code ?? 'TARGET_SECRET_VALIDATION_FAILED',
            message: parsed.errors[0]?.message ?? 'invalid',
            errors: parsed.errors,
          },
        },
        400,
      );
    }
    const repo = buildRepo(tx, deps.cipher);
    await repo.upsert(
      targetResult.value.id,
      { name: c.req.param('secretName'), schema: body.schema, value: parsed.value },
      new Date(),
    );
    return c.json({ name: c.req.param('secretName'), schema: body.schema }, 200);
  });

  app.delete('/:secretName', requireScope('deploy:target:manage'), async (c) => {
    const subject = c.get('subject');
    const tx = c.get('tx') as PoolClient;
    const repos = resolve(tx);
    const targetSlug = c.req.param('targetSlug') ?? '';
    const targetResult = await getDeployTarget(
      { repos },
      { orgId: subject.org.id, slug: targetSlug },
    );
    if (!isOk(targetResult)) {
      return c.json({ error: { code: targetResult.errors[0]?.code ?? 'PLATFORM_INTERNAL', message: targetResult.errors[0]?.message ?? 'error' } }, 500);
    }
    if (targetResult.value === null) {
      return c.json({ error: { code: 'DEPLOY_TARGET_NOT_FOUND', message: targetSlug } }, 404);
    }
    const repo = buildRepo(tx, deps.cipher);
    await repo.remove(targetResult.value.id, c.req.param('secretName'));
    return c.body(null, 204);
  });

  return app;
}
