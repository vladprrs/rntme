import type { z } from 'zod';
import { MarketingSiteV1ConfigSchema } from './schema.js';
import type { MarketingSiteV1Config } from './types.js';

export {
  BundleSourceSchema,
  MarketingSiteV1ConfigSchema,
  ProjectFolderSourceSchema,
} from './schema.js';
export { allErrorCodes, errorCodes } from './error-codes.js';
export type { MarketingSiteErrorCode, MarketingSiteErrorCodes } from './error-codes.js';
export type {
  BundleSource,
  BundleSourceKind,
  MarketingSiteV1Config,
  ProjectFolderSource,
} from './types.js';

export type ValidationError = {
  code: MarketingSiteValidationErrorCode;
  path: string;
  message: string;
};

export type MarketingSiteValidationErrorCode =
  | 'MARKETING_SITE_VALIDATE_INVALID_CONFIG'
  | 'MARKETING_SITE_VALIDATE_INVALID_SOURCE'
  | 'MARKETING_SITE_VALIDATE_INVALID_DOMAIN';

export type ValidationResult =
  | { ok: true; value: MarketingSiteV1Config }
  | { ok: false; errors: readonly ValidationError[] };

export function validateMarketingSiteConfig(input: unknown): ValidationResult {
  const parsed = MarketingSiteV1ConfigSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };

  return {
    ok: false,
    errors: parsed.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return {
        code: mapIssueToCode(path, issue),
        path,
        message: issue.message,
      };
    }),
  };
}

function mapIssueToCode(path: string, _issue: z.ZodIssue): MarketingSiteValidationErrorCode {
  if (path === 'primaryDomain') return 'MARKETING_SITE_VALIDATE_INVALID_DOMAIN';
  if (path.startsWith('source')) return 'MARKETING_SITE_VALIDATE_INVALID_SOURCE';
  return 'MARKETING_SITE_VALIDATE_INVALID_CONFIG';
}
