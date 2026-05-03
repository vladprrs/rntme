import { z } from 'zod';
import type { ApiContext } from './client.js';
import { request } from './client.js';

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
  list: async (ctx: ApiContext, org: string) =>
    request(TargetsResponseSchema, ctx, 'GET', `/v1/orgs/${encodeURIComponent(org)}/deploy-targets`),
  show: async (ctx: ApiContext, org: string, slug: string, _opts: { unredacted?: boolean }) =>
    request(TargetResponseSchema, ctx, 'GET', `/v1/orgs/${encodeURIComponent(org)}/deploy-targets/${encodeURIComponent(slug)}`),
  setConfig: async (ctx: ApiContext, org: string, slug: string, body: Record<string, unknown>) =>
    request(TargetResponseSchema, ctx, 'PATCH', `/v1/orgs/${encodeURIComponent(org)}/deploy-targets/${encodeURIComponent(slug)}`, body),
};
