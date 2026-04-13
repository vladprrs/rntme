import { z } from 'zod';

const projection = z
  .object({
    grain: z.array(z.string()),
    keys: z.array(z.string()),
    exposed: z.array(z.string()),
    source: z
      .object({ entity: z.string(), pathPrefix: z.string() })
      .strict(),
  })
  .strict();

export const QsmSchema = z
  .object({
    projections: z.record(projection).default({}),
    relationRoles: z.record(z.string()).default({}),
  })
  .strict();

export type Qsm = z.output<typeof QsmSchema>;
export type QsmProjection = z.output<typeof projection>;
