import { z } from 'zod';

const pdmPrimitiveType = z.enum([
  'integer',
  'long',
  'decimal',
  'string',
  'boolean',
  'date',
  'datetime',
]);

const pdmField = z
  .object({
    type: pdmPrimitiveType,
    nullable: z.boolean(),
    column: z.string(),
  })
  .strict();

const pdmRelation = z
  .object({
    to: z.string(),
    cardinality: z.enum(['one', 'many']),
    localKey: z.string(),
    foreignKey: z.string(),
  })
  .strict();

const pdmEntity = z
  .object({
    table: z.string(),
    fields: z.record(pdmField),
    relations: z.record(pdmRelation),
    keys: z.array(z.string()),
  })
  .strict();

export const PdmSchema = z
  .object({
    entities: z.record(pdmEntity),
  })
  .strict();

export type Pdm = z.output<typeof PdmSchema>;
export type PdmEntity = z.output<typeof pdmEntity>;
export type PdmField = z.output<typeof pdmField>;
export type PdmRelation = z.output<typeof pdmRelation>;
export type PdmPrimitiveType = z.output<typeof pdmPrimitiveType>;
