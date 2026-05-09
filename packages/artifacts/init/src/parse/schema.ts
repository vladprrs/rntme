import { z } from 'zod';

const nonEmptyString = z.string().min(1);

const processSchema = z
  .object({
    kind: z.literal('bpmn'),
    definition: nonEmptyString,
    processId: nonEmptyString,
  })
  .strict();

const stepSchema = z
  .object({
    id: nonEmptyString,
    type: z.literal('init'),
    provider: nonEmptyString,
    targetService: nonEmptyString,
    mode: nonEmptyString,
    input: z.object({ path: nonEmptyString }).strict(),
    dependsOn: z.array(nonEmptyString).default([]),
  })
  .strict();

export const InitArtifactSchema = z
  .object({
    initVersion: z.literal(1),
    process: processSchema,
    steps: z.array(stepSchema).default([]),
  })
  .strict();
