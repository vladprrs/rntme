import {
  createDeployTarget,
  deleteDeployTarget,
  getDeployTarget,
  isOk,
  listDeployTargets,
  updateDeployTarget,
} from '@rntme/platform-core';
import { resolveAuthorizedOrg } from './shared.js';
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

/** GET /api/deployments/targets — list deploy targets for the authorized org. */
export async function listDeployTargetsHandler(
  deps: DeployTargetCrudDeps,
  input: ListDeployTargetsInput,
): Promise<ListDeployTargetsOutput> {
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
  deps: DeployTargetCrudDeps,
  input: CreateDeployTargetInput,
): Promise<CreateDeployTargetOutput> {
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

/** PUT /api/deployments/targets/{slug} — patch a deploy target. */
export async function updateDeployTargetHandler(
  deps: DeployTargetCrudDeps,
  input: UpdateDeployTargetInput,
): Promise<UpdateDeployTargetOutput> {
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
