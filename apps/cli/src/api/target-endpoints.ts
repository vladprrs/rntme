import { z } from 'zod';
import { apiCall, PLATFORM_API, type ApiError } from './client.js';
import { err, ok } from '../result.js';

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
const NativeHandlerErrorResponseSchema = z.object({
  status: z.literal('error'),
  errors: z.array(z.object({
    code: z.string(),
    message: z.string(),
  })).min(1),
});
const TargetCreateResponseSchema = z.union([TargetResponseSchema, NativeHandlerErrorResponseSchema]);
type TargetCreateResponse = z.infer<typeof TargetCreateResponseSchema>;
type NativeHandlerErrorResponse = z.infer<typeof NativeHandlerErrorResponseSchema>;

export type Target = z.infer<typeof TargetSchema>;

/**
 * Platform blueprint paths for deploy targets:
 *
 *   GET    /api/deployments/targets?organizationId=<id>
 *   GET    /api/deployments/targets/{slug}
 *   POST   /api/deployments/targets                    (body: { organizationId, body })
 *   POST   /api/deployments/targets/{slug}/actions/update (body: { body })
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

function nativeHandlerError(error: { readonly code: string; readonly message: string }, requestId: string | undefined): ApiError {
  return {
    kind: 'http',
    status: 200,
    code: error.code,
    message: error.message,
    requestId,
  };
}

function isNativeHandlerErrorResponse(value: TargetCreateResponse): value is NativeHandlerErrorResponse {
  return 'status' in value && value.status === 'error';
}

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
  ) => {
    const response = await apiCall({
      method: 'POST',
      path: targetEndpointPaths.create(),
      body: { organizationId, body },
      responseSchema: TargetCreateResponseSchema,
      ...ctx,
    });
    if (!response.ok) return response;
    if (isNativeHandlerErrorResponse(response.value)) {
      return err(nativeHandlerError(response.value.errors[0]!, ctx.requestId));
    }
    return ok(response.value);
  },
  setConfig: async (
    ctx: TargetApiContext,
    organizationId: string,
    slug: string,
    body: Record<string, unknown>,
  ) =>
    apiCall({
      method: 'POST',
      path: targetEndpointPaths.update(slug),
      body: { organizationId, body },
      responseSchema: TargetResponseSchema,
      ...ctx,
    }),
  delete: async (ctx: TargetApiContext, _organizationId: string, slug: string) =>
    apiCall({
      method: 'POST',
      path: targetEndpointPaths.delete(slug),
      responseSchema: TargetResponseSchema,
      ...ctx,
    }),
};
