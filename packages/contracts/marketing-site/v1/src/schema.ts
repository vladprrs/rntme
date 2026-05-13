import { z } from 'zod';

const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, 'sha256 must be 64 lowercase hex chars');
const VarPlaceholder = z.string().regex(/^\$\{[A-Z][A-Z0-9_]*\}$/, 'must be a declared blueprint variable placeholder');
const Hostname = z
  .string()
  .min(1)
  .regex(/^[a-z0-9.-]+$/i, 'domain must be a valid hostname');

/**
 * Path declared in `project-folder` source: a forward-slash relative path
 * rooted at the project bundle. Rejects absolute paths, drive prefixes,
 * empty segments, `.`, and `..` segments so a bundle author cannot escape
 * the project root or rely on platform-specific path handling.
 */
const RelativeProjectPathSchema = z.string().min(1).superRefine((value, ctx) => {
  if (
    value.startsWith('/') ||
    value.includes('\\') ||
    /^[A-Za-z]:[/\\]/.test(value) ||
    value
      .split('/')
      .some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'project-folder path must be a relative path inside the project bundle',
    });
  }
});

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

export const ProjectFolderSourceSchema = z
  .object({
    kind: z.literal('project-folder'),
    path: RelativeProjectPathSchema,
  })
  .strict();

export const BundleSourceSchema = z.discriminatedUnion('kind', [
  S3SourceSchema,
  LocalPathSourceSchema,
  ProjectFolderSourceSchema,
]);

export const MarketingSiteV1ConfigSchema = z.object({
  source: BundleSourceSchema,
  primaryDomain: z.union([Hostname, VarPlaceholder]),
  ssl: z.enum(['auto', 'manual', 'none']),
});
