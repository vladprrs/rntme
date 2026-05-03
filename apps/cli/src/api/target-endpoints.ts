import { z } from 'zod';
import { apiCall } from './client.js';

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

export const targetEndpoints = {
  list: async (ctx: TargetApiContext, org: string) =>
    apiCall({
      method: 'GET',
      path: `/v1/orgs/${encodeURIComponent(org)}/deploy-targets`,
      responseSchema: TargetsResponseSchema,
      ...ctx,
    }),
  show: async (ctx: TargetApiContext, org: string, slug: string, _opts: { unredacted?: boolean }) =>
    apiCall({
      method: 'GET',
      path: `/v1/orgs/${encodeURIComponent(org)}/deploy-targets/${encodeURIComponent(slug)}`,
      responseSchema: TargetResponseSchema,
      ...ctx,
    }),
  setConfig: async (ctx: TargetApiContext, org: string, slug: string, body: Record<string, unknown>) =>
    apiCall({
      method: 'PATCH',
      path: `/v1/orgs/${encodeURIComponent(org)}/deploy-targets/${encodeURIComponent(slug)}`,
      body,
      responseSchema: TargetResponseSchema,
      ...ctx,
    }),
};
