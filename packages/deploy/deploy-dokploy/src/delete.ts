import type { DokployClient } from './client.js';
import type { DokployDeploymentError } from './errors.js';
import { err, ok, type Result } from './result.js';

export type DokployDeleteResource = {
  readonly resourceKind: 'application' | 'compose';
  readonly targetResourceId: string;
  readonly targetResourceName: string;
};

export type DokployDeleteResult = {
  readonly deletedResources: readonly DokployDeleteResource[];
  readonly warnings: readonly string[];
};

export async function deleteDokployResources(
  resources: readonly DokployDeleteResource[],
  client: DokployClient,
): Promise<Result<DokployDeleteResult, DokployDeploymentError>> {
  const deleted: DokployDeleteResource[] = [];
  const warnings: string[] = [];
  const ordered = dedupe(resources).sort((a, b) => {
    if (a.resourceKind === b.resourceKind) return a.targetResourceName.localeCompare(b.targetResourceName);
    return a.resourceKind === 'application' ? -1 : 1;
  });

  for (const resource of ordered) {
    try {
      if (resource.resourceKind === 'application') {
        await client.deleteApplication(resource.targetResourceId);
      } else {
        await client.deleteCompose(resource.targetResourceId);
      }
      deleted.push(resource);
    } catch (cause) {
      if (isMissingResource(cause)) {
        warnings.push(`${resource.resourceKind} ${resource.targetResourceName} already missing`);
        continue;
      }
      return err([
        {
          code: 'DEPLOY_APPLY_DOKPLOY_API_ERROR',
          message: `failed to delete ${resource.resourceKind} "${resource.targetResourceName}"`,
          resource: resource.targetResourceName,
          cause: sanitizeCause(cause),
        },
      ]);
    }
  }

  return ok({ deletedResources: deleted, warnings });
}

function dedupe(resources: readonly DokployDeleteResource[]): DokployDeleteResource[] {
  const seen = new Set<string>();
  const out: DokployDeleteResource[] = [];
  for (const resource of resources) {
    const key = `${resource.resourceKind}:${resource.targetResourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(resource);
  }
  return out;
}

function isMissingResource(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause);
  return /\b(404|not found|missing)\b/i.test(message);
}

function sanitizeCause(cause: unknown): { readonly message: string } {
  const message = cause instanceof Error ? cause.message : String(cause);
  return {
    message: message
      .replace(/\b(token|apiToken|password|secret)=([^&\s]+)/gi, '$1=[redacted]')
      .replace(/\b(Bearer\s+)[^\s]+/gi, '$1[redacted]'),
  };
}
