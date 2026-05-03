import { z } from 'zod';
import { SlugSchema, UuidSchema } from './primitives.js';

export const ProjectOperationKindSchema = z.enum(['update', 'delete']);
export type ProjectOperationKind = z.infer<typeof ProjectOperationKindSchema>;

export const ProjectOperationStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed']);
export type ProjectOperationStatus = z.infer<typeof ProjectOperationStatusSchema>;

export const ProjectOperationSchema = z.object({
  id: UuidSchema,
  orgId: UuidSchema,
  projectId: UuidSchema,
  kind: ProjectOperationKindSchema,
  status: ProjectOperationStatusSchema,
  requestedByAccountId: UuidSchema,
  requestedByTokenId: UuidSchema.nullable(),
  targetId: UuidSchema.nullable(),
  projectVersionId: UuidSchema.nullable(),
  deploymentId: UuidSchema.nullable(),
  input: z.record(z.string(), z.unknown()),
  result: z.record(z.string(), z.unknown()).nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  queuedAt: z.date(),
  startedAt: z.date().nullable(),
  finishedAt: z.date().nullable(),
  lastHeartbeatAt: z.date().nullable(),
});
export type ProjectOperation = z.infer<typeof ProjectOperationSchema>;

export const ProjectOperationLogLineSchema = z.object({
  id: z.number().int().nonnegative(),
  operationId: UuidSchema,
  orgId: UuidSchema,
  ts: z.date(),
  level: z.enum(['info', 'warn', 'error']),
  step: z.string().min(1),
  message: z.string(),
});
export type ProjectOperationLogLine = z.infer<typeof ProjectOperationLogLineSchema>;

export const ProjectOperationBundleSourceSchema = z.object({
  contentType: z.literal('application/rntme-project-bundle+json'),
  bytesBase64: z.string().min(1),
});
export type ProjectOperationBundleSource = z.infer<typeof ProjectOperationBundleSourceSchema>;

export const StartProjectUpdateOperationRequestSchema = z
  .object({
    targetSlug: SlugSchema,
    projectVersionSeq: z.number().int().positive().optional(),
    bundle: ProjectOperationBundleSourceSchema.optional(),
  })
  .refine((value) => (value.projectVersionSeq === undefined) !== (value.bundle === undefined), {
    message: 'exactly one of projectVersionSeq or bundle is required',
  });
export type StartProjectUpdateOperationRequest = z.infer<typeof StartProjectUpdateOperationRequestSchema>;

export const StartProjectDeleteOperationRequestSchema = z.object({
  confirm: SlugSchema,
});
export type StartProjectDeleteOperationRequest = z.infer<typeof StartProjectDeleteOperationRequestSchema>;

export const ListProjectOperationsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  cursor: z.string().optional(),
});
export type ListProjectOperationsQuery = z.infer<typeof ListProjectOperationsQuerySchema>;
