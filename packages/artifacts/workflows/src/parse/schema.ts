import { z } from 'zod';

const nonEmptyString = z.string().min(1);

const eventRefSchema = z
  .object({
    service: nonEmptyString,
    aggregateType: nonEmptyString,
    eventType: nonEmptyString,
  })
  .strict();

export const workflowMappingValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(workflowMappingValueSchema),
    z.record(nonEmptyString, workflowMappingValueSchema),
  ]),
);

const definitionSchema = z
  .object({
    id: nonEmptyString,
    bpmnFile: nonEmptyString,
    processId: nonEmptyString,
  })
  .strict();

const messageStartSchema = z
  .object({
    id: nonEmptyString,
    definition: nonEmptyString,
    messageName: nonEmptyString,
    event: eventRefSchema,
    businessKey: nonEmptyString,
    variables: z.record(nonEmptyString, workflowMappingValueSchema).optional(),
  })
  .strict();

const serviceTaskSchema = z
  .object({
    definition: nonEmptyString,
    taskId: nonEmptyString,
    bindingRef: nonEmptyString,
    input: z.record(nonEmptyString, workflowMappingValueSchema).optional(),
    resultVariable: nonEmptyString.optional(),
  })
  .strict();

export const WorkflowArtifactSchema = z
  .object({
    workflowVersion: z.literal(1),
    definitions: z.array(definitionSchema),
    messageStarts: z.array(messageStartSchema).default([]),
    serviceTasks: z.array(serviceTaskSchema).default([]),
  })
  .strict();
