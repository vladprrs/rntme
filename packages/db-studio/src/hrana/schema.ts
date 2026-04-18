import { z } from 'zod';
import { err, ok, type Result } from '../errors.js';
import type { HranaPipelineBody } from './types.js';

const HranaValueSchema: z.ZodType = z.union([
  z.object({ type: z.literal('null') }),
  z.object({ type: z.literal('integer'), value: z.string() }),
  z.object({ type: z.literal('float'), value: z.number() }),
  z.object({ type: z.literal('text'), value: z.string() }),
  z.object({ type: z.literal('blob'), base64: z.string() }),
]);

const HranaStmtSchema = z.object({
  sql: z.string(),
  args: z.array(HranaValueSchema).optional(),
  named_args: z.array(z.object({ name: z.string(), value: HranaValueSchema })).optional(),
  want_rows: z.boolean().optional(),
});

const HranaBatchStepSchema = z.object({
  stmt: HranaStmtSchema,
  condition: z.unknown().nullable().optional(),
});

const HranaRequestSchema = z.union([
  z.object({ type: z.literal('execute'), stmt: HranaStmtSchema }),
  z.object({
    type: z.literal('batch'),
    batch: z.object({ steps: z.array(HranaBatchStepSchema) }),
  }),
  z.object({ type: z.literal('close') }),
]);

export const PipelineBodySchema = z.object({
  baton: z.string().nullable(),
  requests: z.array(HranaRequestSchema),
});

export function parsePipelineRequest(raw: unknown): Result<HranaPipelineBody> {
  const p = PipelineBodySchema.safeParse(raw);
  if (!p.success) {
    return err('DB_STUDIO_HRANA_BAD_REQUEST', p.error.message);
  }
  return ok(p.data as HranaPipelineBody);
}
