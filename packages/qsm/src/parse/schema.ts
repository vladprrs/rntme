import { z } from 'zod';
import { CARDINALITY_VALUES, RELATION_ROLE_VALUES } from '../types/artifact.js';

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

const cardinalitySchema = z.enum(CARDINALITY_VALUES);
const roleSchema = z.enum(RELATION_ROLE_VALUES);

const relationSchema = z
  .object({
    to: nonEmptyString,
    localKey: nonEmptyString,
    foreignKey: nonEmptyString,
    cardinality: cardinalitySchema,
    role: roleSchema.optional(),
  })
  .strict();

export const QsmArtifactSchema = z
  .object({
    projections: z.record(nonEmptyString, projectionSchema).default({}),
    relations: z.record(nonEmptyString, relationSchema).default({}),
  })
  .strict();

export type QsmArtifactParsed = z.output<typeof QsmArtifactSchema>;
