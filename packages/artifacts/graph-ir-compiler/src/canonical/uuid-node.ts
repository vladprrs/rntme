import { z } from 'zod';

export const UuidNodeSchema = z.object({
  id: z.string().min(1),
  type: z.literal('uuid'),
  config: z.object({}).strict(),
});

export type UuidNode = z.infer<typeof UuidNodeSchema>;

export const UUID_NODE_OUTPUT_TYPE = 'string' as const;
