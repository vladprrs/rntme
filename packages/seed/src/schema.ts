import { z } from 'zod';

const ActorSchema = z
  .object({
    kind: z.string().min(1),
    id: z.string().min(1),
  })
  .strict();

export const SeedEventInputSchema = z
  .object({
    stream: z.string().min(1),
    aggregateType: z.string().min(1),
    aggregateId: z.string().min(1),
    version: z.number().int().min(1),
    eventType: z.string().min(1),
    payload: z.record(z.string(), z.unknown()),
    occurredAt: z.string().datetime({ offset: true }),
    eventId: z.string().min(1).optional(),
    actor: ActorSchema.optional(),
    schemaVersion: z.number().int().min(1).optional(),
  })
  .strict();

export const SeedArtifactSchema = z
  .object({
    seedVersion: z.literal(1),
    events: z.array(SeedEventInputSchema),
  })
  .strict();
