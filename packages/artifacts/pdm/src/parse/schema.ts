import { z } from 'zod';

const nonEmptyString = z.string().min(1);

const scalarPrimitiveSchema = z.enum([
  'integer',
  'decimal',
  'string',
  'boolean',
  'date',
  'datetime',
]);

const generatedKindSchema = z.enum(['id', 'createdAt', 'updatedAt', 'actor']);

const fieldSchema = z
  .object({
    type: scalarPrimitiveSchema,
    nullable: z.boolean(),
    column: nonEmptyString,
    generated: generatedKindSchema.optional(),
  })
  .strict();

const relationSchema = z
  .object({
    to: nonEmptyString,
    cardinality: z.enum(['one', 'many']),
    localKey: nonEmptyString,
    foreignKey: nonEmptyString,
  })
  .strict();

const transitionSchema = z
  .object({
    from: z.union([z.null(), nonEmptyString, z.array(nonEmptyString).min(1)]),
    to: nonEmptyString,
    affects: z.array(nonEmptyString).optional(),
  })
  .strict();

const stateMachineSchema = z
  .object({
    stateField: nonEmptyString,
    initial: z.null(),
    states: z.array(nonEmptyString).min(1),
    transitions: z.record(
      nonEmptyString.regex(
        /^[a-z][a-zA-Z0-9]*$/,
        'transition name must match /^[a-z][a-zA-Z0-9]*$/',
      ),
      transitionSchema,
    ),
  })
  .strict();

const entitySchema = z
  .object({
    ownerService: nonEmptyString,
    kind: z.enum(['root', 'owned']),
    table: nonEmptyString,
    fields: z.record(nonEmptyString, fieldSchema),
    relations: z.record(nonEmptyString, relationSchema).optional(),
    keys: z.array(nonEmptyString).min(1),
    stateMachine: stateMachineSchema.optional(),
  })
  .strict();

export const PdmArtifactSchema = z
  .object({
    entities: z.record(nonEmptyString, entitySchema),
  })
  .strict();

export type PdmArtifactParsed = z.infer<typeof PdmArtifactSchema>;
