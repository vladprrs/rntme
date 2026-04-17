import { z } from 'zod';

const ActorKindSchema = z.enum(['user', 'system', 'service']);

export const SeedEventInputSchema = z
  .object({
    id: z.string().min(1),
    eventType: z.string().min(1),
    rntAggregateType: z.string().min(1),
    rntAggregateId: z.string().min(1),
    subject: z.string().min(1),
    rntVersion: z.number().int().min(1),
    time: z.string().datetime({ offset: true }),
    data: z.record(z.string(), z.unknown()),
    rntSchemaVersion: z.number().int().min(1).optional(),
    rntActorKind: ActorKindSchema.nullable().optional(),
    rntActorId: z.string().nullable().optional(),
    correlationId: z.string().min(1).optional(),
    causationId: z.string().nullable().optional(),
    commandId: z.string().nullable().optional(),
    traceparent: z.string().nullable().optional(),
  })
  .strict();

export const SeedArtifactSchema = z
  .object({
    seedVersion: z.literal(1),
    events: z.array(SeedEventInputSchema),
  })
  .strict();
