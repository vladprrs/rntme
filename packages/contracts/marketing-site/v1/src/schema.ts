import { z } from 'zod';

const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, 'sha256 must be 64 lowercase hex chars');

const S3SourceSchema = z.object({
  kind: z.literal('s3'),
  bucket: z.string().min(1),
  key: z.string().min(1),
  sha256: Sha256Hex,
  endpoint: z.string().url().optional(),
  region: z.string().min(1).optional(),
});

const LocalPathSourceSchema = z.object({
  kind: z.literal('local-path'),
  path: z.string().min(1),
  sha256: Sha256Hex,
});

export const BundleSourceSchema = z.discriminatedUnion('kind', [S3SourceSchema, LocalPathSourceSchema]);

export const MarketingSiteV1ConfigSchema = z.object({
  source: BundleSourceSchema,
  primaryDomain: z
    .string()
    .min(1)
    .regex(/^[a-z0-9.-]+$/i, 'domain must be a valid hostname'),
  ssl: z.enum(['auto', 'manual', 'none']),
});
