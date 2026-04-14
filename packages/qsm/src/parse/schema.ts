import { z } from 'zod';
import { RELATION_ROLE_VALUES } from '../types/artifact.js';

const nonEmptyString = z.string().min(1);

const backingSchema = z.enum(['entity-mirror', 'derived']);

const sourceSchema = z
  .object({
    entity: nonEmptyString,
    pathPrefix: nonEmptyString.optional(),
  })
  .strict();

const projectionSchema = z
  .object({
    backing: backingSchema.optional(),
    source: sourceSchema,
    keys: z.array(nonEmptyString),
    grain: z.array(nonEmptyString),
    exposed: z.array(nonEmptyString),
    table: nonEmptyString.optional(),
  })
  .strict();

const relationRoleSchema = z.enum(RELATION_ROLE_VALUES);

export const QsmArtifactSchema = z
  .object({
    projections: z.record(nonEmptyString, projectionSchema).default({}),
    relationRoles: z.record(nonEmptyString, relationRoleSchema).default({}),
  })
  .strict();

export type QsmArtifactParsed = z.output<typeof QsmArtifactSchema>;
