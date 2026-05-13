import { z } from 'zod';
import { apiCall, PLATFORM_API } from './client.js';

type TargetApiContext = { baseUrl: string; token: string | null; requestId?: string };

export const TargetSchema = z.object({
  id: z.string(),
  slug: z.string(),
  displayName: z.string(),
  kind: z.string(),
  publicBaseUrl: z.string().nullable(),
  isDefault: z.boolean(),
  apiTokenRedacted: z.string().optional(),
  auth: z.record(z.string(), z.unknown()).optional(),
  modules: z.record(z.string(), z.unknown()).optional(),
  eventBus: z.record(z.string(), z.unknown()).optional(),
});

export const TargetsResponseSchema = z.object({ targets: z.array(TargetSchema) });
export const TargetResponseSchema = z.object({ target: TargetSchema });

export type Target = z.infer<typeof TargetSchema>;

/**
 * Platform blueprint paths for deploy targets:
 *
 *   GET    /api/deployments/targets?organizationId=<id>
 *   GET    /api/deployments/targets/{slug}
 *   POST   /api/deployments/targets                    (body: { organizationId, ...body })
 *   POST   /api/deployments/targets/{slug}/actions/update
 *   POST   /api/deployments/targets/{slug}/actions/delete
 *
 * The bindings runtime only supports GET/POST, so update and delete use the
 * `/actions/...` action-style POST endpoints rather than PUT/DELETE on the
 * bare slug path.
 */
export const targetEndpointPaths = {
  list: (): string => PLATFORM_API.deployTargets,
  show: (slug: string): string => `${PLATFORM_API.deployTargets}/${encodeURIComponent(slug)}`,
  create: (): string => PLATFORM_API.deployTargets,
  update: (slug: string): string =>
    `${PLATFORM_API.deployTargets}/${encodeURIComponent(slug)}/actions/update`,
  delete: (slug: string): string =>
    `${PLATFORM_API.deployTargets}/${encodeURIComponent(slug)}/actions/delete`,
} as const;

export const targetEndpoints = {
  list: async (ctx: TargetApiContext, organizationId: string) => {
    const qs = new URLSearchParams();
    qs.set('organizationId', organizationId);
    return apiCall({
      method: 'GET',
      path: `${targetEndpointPaths.list()}?${qs.toString()}`,
      responseSchema: TargetsResponseSchema,
      ...ctx,
    });
  },
  show: async (ctx: TargetApiContext, _organizationId: string, slug: string) =>
    apiCall({
      method: 'GET',
      path: targetEndpointPaths.show(slug),
      responseSchema: TargetResponseSchema,
      ...ctx,
    }),
  create: async (
    ctx: TargetApiContext,
    organizationId: string,
    body: Record<string, unknown>,
  ) =>
    apiCall({
      method: 'POST',
      path: targetEndpointPaths.create(),
      body: { organizationId, ...body },
      responseSchema: TargetResponseSchema,
      ...ctx,
    }),
  setConfig: async (
    ctx: TargetApiContext,
    organizationId: string,
    slug: string,
    body: Record<string, unknown>,
  ) =>
    apiCall({
      method: 'POST',
      path: targetEndpointPaths.update(slug),
      body: { organizationId, ...body },
      responseSchema: TargetResponseSchema,
      ...ctx,
    }),
  delete: async (ctx: TargetApiContext, organizationId: string, slug: string) =>
    apiCall({
      method: 'POST',
      path: targetEndpointPaths.delete(slug),
      body: { organizationId },
      responseSchema: TargetResponseSchema,
      ...ctx,
    }),
};
